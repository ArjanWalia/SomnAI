import SwiftUI
import AVKit

struct StressDetailView: View {
    let session: StressSession

    @State private var player: AVPlayer?
    @State private var insights: String?
    @State private var loadingInsights = false
    @State private var showClaude = false

    var body: some View {
        ZStack {
            AuroraBackground(palette: Theme.stressPalette)

            ScrollView {
                VStack(spacing: 20) {
                    headerCard
                    videoCard
                    timelineCard
                    insightsCard
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
        }
        .navigationTitle("Work session")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ClaudeBadge { showClaude = true }
            }
        }
        .sheet(isPresented: $showClaude) { ClaudeSettingsView() }
    }

    private var headerCard: some View {
        VStack(spacing: 10) {
            Text(session.start.dayShort)
                .font(.headline)
                .foregroundStyle(.white.opacity(0.85))
            Text("\(session.start.timeHMM) – \(session.end.timeHMM)")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.65))
            Text("\(formatScore(session.stressScore))")
                .font(.system(size: 56, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(colors: [Theme.stress, .pink],
                                   startPoint: .topLeading,
                                   endPoint: .bottomTrailing)
                )
            Text("stress score")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
        .card(tint: Theme.stress)
    }

    @ViewBuilder
    private var videoCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recording")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.85))

            if let player {
                VideoPlayer(player: player)
                    .frame(height: 220)
                    .clipShape(.rect(cornerRadius: 16))
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "video.slash")
                        .font(.title)
                        .foregroundStyle(.white.opacity(0.5))
                    Text("Open the SomnAI web app to view the camera recording.")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, minHeight: 180)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(tint: Theme.stress)
    }

    private var timelineCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Stress events")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.85))

            if session.stressedTimestamps.isEmpty {
                Text("No stress events recorded.")
                    .foregroundStyle(.white.opacity(0.6))
            } else {
                GeometryReader { geo in
                    let total = max(session.end.timeIntervalSince(session.start), 1)
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(.white.opacity(0.10))
                            .frame(height: 28)

                        ForEach(session.stressedTimestamps) { label in
                            let x = label.start.timeIntervalSince(session.start) / total
                            let w = max(label.duration / total, 0.005)
                            Capsule()
                                .fill(Theme.stress)
                                .frame(width: max(geo.size.width * w, 4), height: 28)
                                .offset(x: geo.size.width * x)
                        }
                    }
                }
                .frame(height: 28)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(tint: Theme.stress)
    }

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

    private func loadInsights() async {
        loadingInsights = true
        defer { loadingInsights = false }
        let summary = """
        Work session on \(session.start.dayShort) from \(session.start.timeHMM) to \(session.end.timeHMM).
        Stress score: \(formatScore(session.stressScore))/100.
        Stress events: \(session.stressedTimestamps.count).
        """
        do {
            insights = try await ClaudeClient.shared.insights(for: .stress, summary: summary)
        } catch {
            insights = "Could not generate insights: \(error.localizedDescription)"
        }
    }
}
