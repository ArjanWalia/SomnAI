import Foundation
import AVFoundation
import Observation

@Observable
final class SleepRecorder {
    enum State { case idle, recording, processing, finished, error(String) }

    var state: State = .idle
    var labels: [SleepLabel] = []
    var elapsed: TimeInterval = 0
    var sessionStart: Date?
    var audioFileURL: URL?

    private let engine = AVAudioEngine()
    private var converter: AVAudioConverter?
    private var fileWriter: AVAudioFile?
    private let classifier: any SleepClassifier = SleepClassifierFactory.make()

    private let chunkSeconds: TimeInterval = 10
    private var chunkBuffer: [Float] = []
    private var chunkStart: Date?
    private var timer: Timer?

    @MainActor
    func start() async {
        let granted = await requestMicAccess()
        guard granted else {
            state = .error("Microphone access denied. Enable it in Settings.")
            return
        }
        do {
            try configureAudioSession()
            try startEngine()
            let now = Date()
            sessionStart = now
            chunkStart = now
            labels.removeAll()
            elapsed = 0
            state = .recording
            startTimer()
            SleepActivityController.shared.start(at: now)
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    @MainActor
    func stop() async {
        timer?.invalidate()
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        state = .processing

        // Flush any remaining audio as a final partial chunk.
        if !chunkBuffer.isEmpty {
            let pcm = chunkBuffer
            let start = chunkStart ?? Date()
            chunkBuffer.removeAll()
            await processChunk(pcm: pcm, start: start, duration: TimeInterval(pcm.count) / MelSpectrogram.sampleRate)
        }

        fileWriter = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        SleepActivityController.shared.end()
        state = .finished
    }

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let start = self.sessionStart else { return }
            Task { @MainActor in self.elapsed = Date().timeIntervalSince(start) }
        }
    }

    private func requestMicAccess() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        case .undetermined:
            return await withCheckedContinuation { cont in
                AVAudioApplication.requestRecordPermission { ok in cont.resume(returning: ok) }
            }
        @unknown default: return false
        }
    }

    private func configureAudioSession() throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.playAndRecord, mode: .measurement, options: [.allowBluetoothHFP, .mixWithOthers])
        try s.setActive(true)
    }

    private func startEngine() throws {
        let input = engine.inputNode
        let hwFormat = input.outputFormat(forBus: 0)

        // Set up file output (compressed .m4a so all-night recordings stay small).
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let fileName = "sleep_\(Int(Date().timeIntervalSince1970)).m4a"
        let url = docs.appendingPathComponent(fileName)
        audioFileURL = url

        let outSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 64_000
        ]
        fileWriter = try AVAudioFile(forWriting: url, settings: outSettings)

        // Converter to 16k mono Float32 for spectrogram.
        let targetFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                         sampleRate: MelSpectrogram.sampleRate,
                                         channels: 1,
                                         interleaved: false)!
        converter = AVAudioConverter(from: hwFormat, to: targetFormat)

        input.installTap(onBus: 0, bufferSize: 4096, format: hwFormat) { [weak self] buffer, _ in
            self?.handle(buffer: buffer, targetFormat: targetFormat)
        }

        try engine.start()
    }

    private func handle(buffer: AVAudioPCMBuffer, targetFormat: AVAudioFormat) {
        // Persist to disk
        try? fileWriter?.write(from: buffer)

        // Convert to 16k mono float
        guard let converter else { return }
        let frameCapacity = AVAudioFrameCount(Double(buffer.frameLength) * targetFormat.sampleRate / buffer.format.sampleRate) + 1024
        guard let out = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: frameCapacity) else { return }

        var consumed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if consumed { status.pointee = .noDataNow; return nil }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, let channelData = out.floatChannelData?.pointee else { return }

        let samples = Array(UnsafeBufferPointer(start: channelData, count: Int(out.frameLength)))
        chunkBuffer.append(contentsOf: samples)

        let samplesPerChunk = Int(chunkSeconds * MelSpectrogram.sampleRate)
        while chunkBuffer.count >= samplesPerChunk {
            let pcm = Array(chunkBuffer.prefix(samplesPerChunk))
            chunkBuffer.removeFirst(samplesPerChunk)
            let start = chunkStart ?? Date()
            chunkStart = start.addingTimeInterval(chunkSeconds)
            Task { [weak self] in
                await self?.processChunk(pcm: pcm, start: start, duration: self?.chunkSeconds ?? 10)
            }
        }
    }

    private func processChunk(pcm: [Float], start: Date, duration: TimeInterval) async {
        let mel = MelSpectrogram.compute(pcm: pcm)
        let kind = await classifier.classify(melSpectrogram: mel)
        let label = SleepLabel(kind: kind, start: start, duration: duration)
        await MainActor.run {
            self.labels.append(label)
            if let started = self.sessionStart {
                SleepActivityController.shared.update(
                    snoring: self.labels.filter { $0.kind == .snoring }.count,
                    hypopnea: self.labels.filter { $0.kind == .hypopnea }.count,
                    obstructive: self.labels.filter { $0.kind == .obstructiveApnea }.count,
                    startedAt: started
                )
            }
        }
    }
}
