import Foundation
import Accelerate
import AVFoundation

// Each 10-second chunk is processed into a mel-spectrogram and classified.
// The protocol is CoreML-ready: bundle a `.mlmodel` and swap `MockSleepClassifier`
// for a `CoreMLSleepClassifier` without touching callers.
protocol SleepClassifier: Sendable {
    func classify(melSpectrogram: [[Float]]) async -> SleepLabelKind
}

enum SleepClassifierFactory {
    static func make() -> any SleepClassifier {
        // TODO: When you ship a trained CoreML model, return CoreMLSleepClassifier(model:).
        MockSleepClassifier()
    }
}

// Deterministic mock — uses simple energy/zero-crossing heuristics on the
// mel-spectrogram so the UI has plausible labels until the real model is bundled.
struct MockSleepClassifier: SleepClassifier {
    func classify(melSpectrogram: [[Float]]) async -> SleepLabelKind {
        guard !melSpectrogram.isEmpty else { return .noApnea }
        let lowBandEnergy = melSpectrogram.prefix(16).flatMap { $0 }.map { abs($0) }.reduce(0, +)
        let totalEnergy = melSpectrogram.flatMap { $0 }.map { abs($0) }.reduce(0, +)
        let bandRatio = totalEnergy > 0 ? lowBandEnergy / totalEnergy : 0

        // Frame-to-frame variance (proxy for "interrupted breathing").
        var variance: Float = 0
        if melSpectrogram.count > 1 {
            for i in 1..<melSpectrogram.count {
                let prev = melSpectrogram[i-1]
                let curr = melSpectrogram[i]
                let len = min(prev.count, curr.count)
                for j in 0..<len {
                    let d = curr[j] - prev[j]
                    variance += d * d
                }
            }
            variance /= Float(melSpectrogram.count - 1)
        }

        switch (bandRatio, variance) {
        case let (b, v) where b > 0.55 && v < 2.0:
            return .snoring
        case let (_, v) where v > 6.0:
            return .obstructiveApnea
        case let (_, v) where v > 3.5:
            return .hypopnea
        default:
            return .noApnea
        }
    }
}

// 10-second PCM chunk → mel-spectrogram via Accelerate (vDSP FFT + mel filterbank).
enum MelSpectrogram {
    nonisolated static let sampleRate: Double = 16_000
    nonisolated static let windowSize = 1024
    nonisolated static let hopSize = 512
    nonisolated static let melBands = 64

    nonisolated static func compute(pcm: [Float]) -> [[Float]] {
        guard pcm.count >= windowSize else { return [] }
        var hann = [Float](repeating: 0, count: windowSize)
        vDSP_hann_window(&hann, vDSP_Length(windowSize), Int32(vDSP_HANN_NORM))

        let log2n = vDSP_Length(log2(Float(windowSize)))
        guard let fft = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2)) else { return [] }
        defer { vDSP_destroy_fftsetup(fft) }

        let filterbank = melFilterbank(nFFT: windowSize, melBands: melBands, sampleRate: sampleRate)
        let halfSize = windowSize / 2

        var frames: [[Float]] = []
        var real = [Float](repeating: 0, count: halfSize)
        var imag = [Float](repeating: 0, count: halfSize)
        var magnitudes = [Float](repeating: 0, count: halfSize)
        var windowed = [Float](repeating: 0, count: windowSize)

        var i = 0
        while i + windowSize <= pcm.count {
            let slice = Array(pcm[i..<i+windowSize])
            vDSP_vmul(slice, 1, hann, 1, &windowed, 1, vDSP_Length(windowSize))

            real.withUnsafeMutableBufferPointer { realPtr in
                imag.withUnsafeMutableBufferPointer { imagPtr in
                    var split = DSPSplitComplex(realp: realPtr.baseAddress!, imagp: imagPtr.baseAddress!)
                    windowed.withUnsafeBytes { raw in
                        let cmplx = raw.bindMemory(to: DSPComplex.self).baseAddress!
                        vDSP_ctoz(cmplx, 2, &split, 1, vDSP_Length(halfSize))
                    }
                    vDSP_fft_zrip(fft, &split, 1, log2n, FFTDirection(FFT_FORWARD))
                    vDSP_zvmags(&split, 1, &magnitudes, 1, vDSP_Length(halfSize))
                }
            }

            var melFrame = [Float](repeating: 0, count: melBands)
            for b in 0..<melBands {
                let row = filterbank[b]
                var acc: Float = 0
                vDSP_dotpr(row, 1, magnitudes, 1, &acc, vDSP_Length(min(row.count, magnitudes.count)))
                melFrame[b] = log(acc + 1e-6)
            }
            frames.append(melFrame)

            i += hopSize
        }
        return frames
    }

    nonisolated private static func melFilterbank(nFFT: Int, melBands: Int, sampleRate: Double) -> [[Float]] {
        let fMin: Double = 0
        let fMax = sampleRate / 2
        let melMin = hzToMel(fMin)
        let melMax = hzToMel(fMax)
        let melPoints = (0...(melBands + 1)).map { melMin + (melMax - melMin) * Double($0) / Double(melBands + 1) }
        let hzPoints = melPoints.map(melToHz)
        let bins = hzPoints.map { Int(floor(Double(nFFT) * $0 / sampleRate)) }
        let nMag = nFFT / 2

        var bank = Array(repeating: [Float](repeating: 0, count: nMag), count: melBands)
        for m in 0..<melBands {
            let left = bins[m]
            let center = bins[m + 1]
            let right = bins[m + 2]
            if center == left || right == center { continue }
            for k in max(left, 0)..<min(center, nMag) {
                bank[m][k] = Float(k - left) / Float(center - left)
            }
            for k in max(center, 0)..<min(right, nMag) {
                bank[m][k] = Float(right - k) / Float(right - center)
            }
        }
        return bank
    }

    nonisolated private static func hzToMel(_ hz: Double) -> Double { 2595 * log10(1 + hz / 700) }
    nonisolated private static func melToHz(_ mel: Double) -> Double { 700 * (pow(10, mel / 2595) - 1) }
}
