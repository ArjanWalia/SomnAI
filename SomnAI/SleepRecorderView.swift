import SwiftUI

struct SleepRecorderView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var auth
    @State private var recorder = SleepRecorder()
    @State private var store = SessionStore.shared

    var body: some View {
        ZStack {
            AuroraBackground(palette: Theme.sleepPalette)

            VStack(spacing: 28) {
                Spacer()

                heroIcon

                Text(formatElapsed(recorder.elapsed))
                    .font(.system(size: 72, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())

                stateLabel

                liveLabelStats
                    .padding(.horizontal, 24)

                Spacer()

                actionButtons
                    .padding(.bottom, 32)
            }
        }
    }

    @ViewBuilder
    private var heroIcon: some View {
        let isRecording = if case .recording = recorder.state { true } else { false }
        ZStack {
            Circle()
                .fill(Theme.sleep.opacity(0.15))
                .frame(width: 200, height: 200)
                .scaleEffect(isRecording ? 1.15 : 1.0)
                .opacity(isRecording ? 0.6 : 1.0)
                .animation(
                    isRecording
                    ? .easeInOut(duration: 1.6).repeatForever(autoreverses: true)
                    : .default,
                    value: isRecording
                )

            Circle()
                .fill(Theme.sleep.opacity(0.25))
                .frame(width: 140, height: 140)

            Image(systemName: isRecording ? "waveform" : "mic.fill")
                .font(.system(size: 56))
                .foregroundStyle(.white)
                .symbolEffect(.variableColor.iterative, options: .repeating, isActive: isRecording)
        }
    }

    @ViewBuilder
    private var stateLabel: some View {
        switch recorder.state {
        case .idle:
            Text("Tap start when you're ready to sleep")
                .foregroundStyle(.white.opacity(0.7))
        case .recording:
            Text("Listening for snoring, hypopnea, apnea")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
        case .processing:
            HStack(spacing: 8) {
                ProgressView().tint(.white)
                Text("Processing final chunk…").foregroundStyle(.white.opacity(0.85))
            }
        case .finished:
            Text("All done").foregroundStyle(.white.opacity(0.85))
        case .error(let msg):
            Text(msg)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    private var liveLabelStats: some View {
        HStack(spacing: 12) {
            stat("Snore", recorder.labels.filter { $0.kind == .snoring }.count, .pink)
            stat("Hypo", recorder.labels.filter { $0.kind == .hypopnea }.count, .orange)
            stat("Obstr.", recorder.labels.filter { $0.kind == .obstructiveApnea }.count, .red)
        }
    }

    private func stat(_ name: String, _ count: Int, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.bold().monospacedDigit())
                .foregroundStyle(tint)
                .contentTransition(.numericText())
            Text(name)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .glassEffect(.regular.tint(tint.opacity(0.2)), in: .rect(cornerRadius: 16))
    }

    @ViewBuilder
    private var actionButtons: some View {
        switch recorder.state {
        case .idle:
            HStack(spacing: 12) {
                Button("Cancel") { dismiss() }
                    .buttonStyle(.glass)
                    .controlSize(.large)
                Button {
                    Task { await recorder.start() }
                } label: {
                    Label("Start", systemImage: "record.circle")
                        .font(.headline)
                        .padding(.horizontal, 8)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.sleep)
                .controlSize(.large)
            }
        case .recording:
            Button {
                Task {
                    await recorder.stop()
                    await finalizeAndDismiss()
                }
            } label: {
                Label("Stop", systemImage: "stop.circle.fill")
                    .font(.headline)
                    .padding(.horizontal, 12)
            }
            .buttonStyle(.glassProminent)
            .tint(.red)
            .controlSize(.large)
        case .processing, .finished:
            ProgressView().tint(.white)
        case .error:
            Button("Try again") {
                Task { await recorder.start() }
            }
            .buttonStyle(.glassProminent)
            .tint(Theme.sleep)
        }
    }

    private func finalizeAndDismiss() async {
        guard let start = recorder.sessionStart else { dismiss(); return }
        let score = SleepScoring.compute(labels: recorder.labels)
        let session = SleepSession(
            start: start,
            end: Date(),
            sleepScore: score,
            audioFileName: recorder.audioFileURL?.lastPathComponent,
            labels: recorder.labels
        )
        store.addSleep(session, email: auth.email)
        dismiss()
    }

    private func formatElapsed(_ t: TimeInterval) -> String {
        let h = Int(t) / 3600, m = (Int(t) % 3600) / 60, s = Int(t) % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }
}
