import SwiftUI
import Charts

struct HomeView: View {
    @Environment(AuthManager.self) private var auth
    @State private var store = SessionStore.shared
    @State private var showClaude = false

    var body: some View {
        NavigationStack {
            ZStack {
                AuroraBackground(palette: Theme.homePalette)

                ScrollView {
                    VStack(spacing: 24) {
                        GlassEffectContainer(spacing: 32) {
                            HStack(spacing: 24) {
                                ScoreOrb(title: "latest stress score",
                                         score: store.latestStressScore.map(formatScore),
                                         tint: Theme.stress)
                                ScoreOrb(title: "latest sleep score",
                                         score: store.latestSleepScore.map(formatScore),
                                         tint: Theme.sleep)
                            }
                        }
                        .padding(.top, 8)

                        sessionRow(title: "Your last work session",
                                   session: store.stressSessions.first.map { ($0.start, $0.end) },
                                   tint: Theme.stress)

                        sessionRow(title: "Your last sleep session",
                                   session: store.sleepSessions.first.map { ($0.start, $0.end) },
                                   tint: Theme.sleep)

                        VStack(alignment: .leading, spacing: 12) {
                            sectionHeader("Stress and sleep")
                            CombinedScoreChart(sleep: store.sleepSessions, stress: store.stressSessions)
                                .frame(height: 240)
                                .card()
                                .padding(.horizontal, 20)
                        }
                    }
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Home")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ClaudeBadge { showClaude = true }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("Sign Out", role: .destructive) { auth.signOut() }
                    } label: {
                        Image(systemName: "person.circle")
                            .font(.title3)
                            .foregroundStyle(.white)
                    }
                }
            }
            .sheet(isPresented: $showClaude) {
                ClaudeSettingsView()
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.headline)
            .foregroundStyle(.white.opacity(0.85))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
    }

    @ViewBuilder
    private func sessionRow(title: String, session: (Date, Date)?, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeader(title)

            HStack {
                if let s = session {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(s.0.dayShort)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                        Text("\(s.0.timeHMM) – \(s.1.timeHMM)")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                } else {
                    Text("No sessions yet")
                        .foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Circle()
                    .fill(tint.opacity(0.8))
                    .frame(width: 8, height: 8)
            }
            .card(tint: tint)
            .padding(.horizontal, 20)
        }
    }
}

struct CombinedScoreChart: View {
    let sleep: [SleepSession]
    let stress: [StressSession]

    var body: some View {
        Chart {
            ForEach(sleep) { s in
                LineMark(x: .value("Date", s.start),
                         y: .value("Score", s.sleepScore),
                         series: .value("Type", "Sleep"))
                    .foregroundStyle(Theme.sleep)
                    .interpolationMethod(.catmullRom)
                AreaMark(x: .value("Date", s.start),
                         y: .value("Score", s.sleepScore),
                         series: .value("Type", "Sleep"))
                    .foregroundStyle(
                        LinearGradient(colors: [Theme.sleep.opacity(0.4), .clear],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                PointMark(x: .value("Date", s.start),
                          y: .value("Score", s.sleepScore))
                    .foregroundStyle(Theme.sleep)
                    .symbolSize(60)
            }
            ForEach(stress) { s in
                LineMark(x: .value("Date", s.start),
                         y: .value("Score", s.stressScore),
                         series: .value("Type", "Stress"))
                    .foregroundStyle(Theme.stress)
                    .interpolationMethod(.catmullRom)
                AreaMark(x: .value("Date", s.start),
                         y: .value("Score", s.stressScore),
                         series: .value("Type", "Stress"))
                    .foregroundStyle(
                        LinearGradient(colors: [Theme.stress.opacity(0.35), .clear],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                PointMark(x: .value("Date", s.start),
                          y: .value("Score", s.stressScore))
                    .foregroundStyle(Theme.stress)
                    .symbolSize(60)
            }
        }
        .chartYScale(domain: 0...100)
        .chartLegend(position: .top, alignment: .leading)
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
}
