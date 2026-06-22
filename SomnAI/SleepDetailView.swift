import SwiftUI
import AVFoundation

struct SleepDetailView: View {
    let session: SleepSession

    @State private var player: AVAudioPlayer?
    @State private var isPlaying = false
    @State private var currentTime: TimeInterval = 0
    @State private var duration: TimeInterval = 0
    @State private var timer: Timer?
    @State private var insights: String?
    @State private var loadingInsights = false
    @State private var showClaude = false
    @State private var filter: SleepLabelKind? = nil

    private var events: [SleepLabel] {
        session.labels
            .filter { $0.kind != .noApnea }
            .filter { filter == nil || $0.kind == filter }
            .sorted { $0.start < $1.start }
    }

    var body: some View {
        ZStack {
            AuroraBackground(palette: Theme.sleepPalette)

            ScrollView {
                VStack(spacing: 20) {
                    headerCard
                    playbackCard
                    statsRow
                    eventsCard
                    insightsCard
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle("Sleep session")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ClaudeBadge { showClaude = true }
            }
        }
        .sheet(isPresented: $showClaude) { ClaudeSettingsView() }
        .onAppear(perform: setupPlayer)
        .onDisappear {
            player?.stop()
            timer?.invalidate()
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(spacing: 10) {
            Text(session.start.dayShort)
                .font(.headline)
                .foregroundStyle(.white.opacity(0.85))
            Text("\(session.start.timeHMM) – \(session.end.timeHMM)")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.65))
            Text("\(formatScore(session.sleepScore))")
                .font(.system(size: 56, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(colors: [Theme.sleep, Theme.accent],
                                   startPoint: .topLeading,
                                   endPoint: .bottomTrailing)
                )
            Text("sleep score")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
        .card(tint: Theme.sleep)
    }

    // MARK: - Playback

    private var playbackCard: some View {
        VStack(spacing: 14) {
            HStack {
                Text(format(currentTime))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.65))
                Slider(value: Binding(
                    get: { currentTime },
                    set: { newValue in
                        player?.currentTime = newValue
                        currentTime = newValue
                    }
                ), in: 0...max(duration, 1))
                .tint(Theme.sleep)
                Text(format(duration))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.65))
            }

            Button {
                if isPlaying { player?.pause() } else { player?.play() }
                isPlaying.toggle()
            } label: {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                    .font(.title2.weight(.bold))
                    .contentTransition(.symbolEffect(.replace))
                    .frame(width: 56, height: 56)
            }
            .buttonStyle(.glassProminent)
            .clipShape(Circle())
            .tint(Theme.sleep)
            .disabled(player == nil)
        }
        .card(tint: Theme.sleep)
    }

    // MARK: - Stats row (3 orbs)

    private var statsRow: some View {
        HStack(spacing: 10) {
            statTile(.snoring, count: session.snoringTimestamps.count)
            statTile(.hypopnea, count: session.hypopneaTimestamps.count)
            statTile(.obstructiveApnea, count: session.obstructiveTimestamps.count)
        }
    }

    private func statTile(_ kind: SleepLabelKind, count: Int) -> some View {
        let isActive = filter == kind
        let c = palette(for: kind)
        return Button {
            withAnimation(.smooth(duration: 0.25)) {
                filter = isActive ? nil : kind
            }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon(for: kind))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(c)
                Text("\(count)")
                    .font(.title2.bold().monospacedDigit())
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                Text(kind.display)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.65))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .glassEffect(
            .regular.tint(c.opacity(isActive ? 0.35 : 0.18)).interactive(),
            in: .rect(cornerRadius: 18)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(c.opacity(isActive ? 0.8 : 0), lineWidth: 1.5)
        )
    }

    // MARK: - Events card (timeline + list)

    private var eventsCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Events")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                if filter != nil {
                    Button("Show all") {
                        withAnimation(.smooth(duration: 0.25)) { filter = nil }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.sleep)
                }
            }

            timeline

            if events.isEmpty {
                emptyState
            } else {
                VStack(spacing: 8) {
                    ForEach(events) { e in
                        eventRow(e)
                    }
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(tint: Theme.sleep)
        .animation(.smooth, value: filter)
    }

    private var timeline: some View {
        GeometryReader { geo in
            let total = max(session.end.timeIntervalSince(session.start), 1)
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(.white.opacity(0.08))
                    .frame(height: 32)

                // Playback head
                let headX = geo.size.width * (currentTime / max(duration, 1))
                Capsule()
                    .fill(.white.opacity(0.9))
                    .frame(width: 2, height: 36)
                    .offset(x: headX - 1, y: -2)
                    .shadow(color: .white.opacity(0.5), radius: 4)

                ForEach(session.labels.filter { $0.kind != .noApnea }) { label in
                    let x = label.start.timeIntervalSince(session.start) / total
                    let w = max(label.duration / total, 0.005)
                    let active = filter == nil || filter == label.kind
                    Capsule()
                        .fill(palette(for: label.kind))
                        .frame(width: max(geo.size.width * w, 4), height: 22)
                        .offset(x: geo.size.width * x, y: 5)
                        .opacity(active ? 1.0 : 0.25)
                        .onTapGesture {
                            jump(to: label.start.timeIntervalSince(session.start))
                        }
                }
            }
        }
        .frame(height: 32)
        .animation(.smooth, value: filter)
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "checkmark.circle")
                .font(.title)
                .foregroundStyle(.green.opacity(0.8))
            Text(filter == nil ? "No apnea events detected." : "No events of this type.")
                .foregroundStyle(.white.opacity(0.7))
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    private func eventRow(_ label: SleepLabel) -> some View {
        let c = palette(for: label.kind)
        let offset = label.start.timeIntervalSince(session.start)
        return Button {
            jump(to: offset)
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(c.opacity(0.25))
                    Image(systemName: icon(for: label.kind))
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(c)
                }
                .frame(width: 36, height: 36)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label.kind.display)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    Text("at \(format(offset))  ·  \(Int(label.duration))s")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.6))
                }

                Spacer()

                Image(systemName: "play.circle.fill")
                    .font(.title3)
                    .foregroundStyle(c.opacity(0.85))
            }
            .padding(12)
            .background(c.opacity(0.10), in: .rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(c.opacity(0.30), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Insights

    private var insightsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Claude insights")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Button {
                    Task { await loadInsights() }
                } label: {
                    HStack(spacing: 6) {
                        if loadingInsights {
                            ProgressView().controlSize(.small).tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                        }
                        Text(loadingInsights ? "Thinking…" : "Generate")
                    }
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.claude)
                .disabled(loadingInsights)
                .controlSize(.small)
            }

            if let insights {
                Text(insights)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.9))
                    .transition(.opacity)
            } else {
                Text("Add your Claude API key in Settings, then tap Generate for personalized suggestions.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.65))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(tint: Theme.claude)
        .animation(.smooth, value: insights)
    }

    // MARK: - Helpers

    private func icon(for kind: SleepLabelKind) -> String {
        switch kind {
        case .snoring: return "waveform.path"
        case .hypopnea: return "wind"
        case .obstructiveApnea: return "lungs.fill"
        case .noApnea: return "checkmark.circle"
        }
    }

    private func palette(for kind: SleepLabelKind) -> Color {
        switch kind {
        case .snoring: return Color(red: 0.95, green: 0.55, blue: 0.75)
        case .hypopnea: return Color(red: 1.00, green: 0.65, blue: 0.30)
        case .obstructiveApnea: return Color(red: 1.00, green: 0.40, blue: 0.35)
        case .noApnea: return Color.white.opacity(0.5)
        }
    }

    private func jump(to offset: TimeInterval) {
        guard let player else { return }
        player.currentTime = offset
        currentTime = offset
        if !isPlaying {
            player.play()
            isPlaying = true
        }
    }

    private func loadInsights() async {
        loadingInsights = true
        defer { loadingInsights = false }
        let summary = """
        Sleep session on \(session.start.dayShort) from \(session.start.timeHMM) to \(session.end.timeHMM).
        Sleep score: \(formatScore(session.sleepScore))/100.
        Snoring events: \(session.snoringTimestamps.count).
        Hypopnea events: \(session.hypopneaTimestamps.count).
        Obstructive apnea events: \(session.obstructiveTimestamps.count).
        """
        do {
            insights = try await ClaudeClient.shared.insights(for: .sleep, summary: summary)
        } catch {
            insights = "Could not generate insights: \(error.localizedDescription)"
        }
    }

    private func setupPlayer() {
        guard let name = session.audioFileName else { return }
        let url = SessionStore.audioURL(for: name)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.prepareToPlay()
            self.player = p
            self.duration = p.duration
            self.timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { _ in
                Task { @MainActor in
                    currentTime = player?.currentTime ?? 0
                    if let p = player, !p.isPlaying { isPlaying = false }
                }
            }
        } catch {
            // No audio bundled; UI degrades gracefully.
        }
    }

    private func format(_ t: TimeInterval) -> String {
        let h = Int(t) / 3600, m = (Int(t) % 3600) / 60, s = Int(t) % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}
