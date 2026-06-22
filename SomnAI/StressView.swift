import SwiftUI
import Charts

struct StressView: View {
    @State private var store = SessionStore.shared
    @State private var showClaude = false

    var body: some View {
        NavigationStack {
            ZStack {
                AuroraBackground(palette: Theme.stressPalette)

                ScrollView {
                    VStack(spacing: 24) {
                        ScoreOrb(title: "latest stress score",
                                 score: store.latestStressScore.map(formatScore),
                                 tint: Theme.stress)
                            .padding(.top, 8)

                        VStack(alignment: .leading, spacing: 12) {
                            sectionLabel("Trend")
                            scoreChart
                                .frame(height: 160)
                                .card(tint: Theme.stress)
                                .padding(.horizontal, 20)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            sectionLabel("Work sessions")
                            if store.stressSessions.isEmpty {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("No work sessions yet")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.white)
                                    Text("Record stress sessions in the SomnAI web app — they'll show up here automatically.")
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.65))
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .card(tint: Theme.stress)
                                .padding(.horizontal, 20)
                            } else {
                                LazyVStack(spacing: 12) {
                                    ForEach(store.stressSessions) { s in
                                        NavigationLink(value: s) {
                                            StressSessionRow(session: s)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 20)
                            }
                        }
                    }
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Stress")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ClaudeBadge { showClaude = true }
                }
            }
            .navigationDestination(for: StressSession.self) { StressDetailView(session: $0) }
            .sheet(isPresented: $showClaude) { ClaudeSettingsView() }
        }
    }

    private var scoreChart: some View {
        Chart {
            ForEach(store.stressSessions) { s in
                LineMark(x: .value("Date", s.start),
                         y: .value("Score", s.stressScore))
                    .foregroundStyle(Theme.stress)
                    .interpolationMethod(.catmullRom)
                AreaMark(x: .value("Date", s.start),
                         y: .value("Score", s.stressScore))
                    .foregroundStyle(
                        LinearGradient(colors: [Theme.stress.opacity(0.4), .clear],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                PointMark(x: .value("Date", s.start),
                          y: .value("Score", s.stressScore))
                    .foregroundStyle(Theme.stress)
                    .symbolSize(50)
            }
        }
        .chartYScale(domain: 0...100)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) {
                AxisGridLine().foregroundStyle(.white.opacity(0.1))
                AxisValueLabel().foregroundStyle(.white.opacity(0.5))
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) {
                AxisGridLine().foregroundStyle(.white.opacity(0.1))
                AxisValueLabel().foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    @ViewBuilder
    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(.white.opacity(0.85))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
    }
}

struct StressSessionRow: View {
    let session: StressSession

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Theme.stress.opacity(0.20))
                Text("\(formatScore(session.stressScore))")
                    .font(.callout.weight(.bold))
                    .foregroundStyle(Theme.stress)
            }
            .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 4) {
                Text(session.start.dayShort)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                Text("\(session.start.timeHMM) – \(session.end.timeHMM)")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white.opacity(0.5))
        }
        .card(tint: Theme.stress)
    }
}
