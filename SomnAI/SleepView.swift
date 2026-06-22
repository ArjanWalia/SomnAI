import SwiftUI
import Charts

struct SleepView: View {
    @State private var store = SessionStore.shared
    @State private var showRecorder = false
    @State private var showClaude = false

    var body: some View {
        NavigationStack {
            ZStack {
                AuroraBackground(palette: Theme.sleepPalette)

                ScrollView {
                    VStack(spacing: 24) {
                        ScoreOrb(title: "latest sleep score",
                                 score: store.latestSleepScore.map(formatScore),
                                 tint: Theme.sleep)
                            .padding(.top, 8)

                        VStack(alignment: .leading, spacing: 12) {
                            sectionLabel("Trend")
                            scoreChart
                                .frame(height: 160)
                                .card(tint: Theme.sleep)
                                .padding(.horizontal, 20)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            sectionLabel("Sleep sessions")

                            if store.sleepSessions.isEmpty {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("No recordings yet")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.white)
                                    Text("Tap Record sleep below to capture your first night.")
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.65))
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .card(tint: Theme.sleep)
                                .padding(.horizontal, 20)
                            } else {
                                LazyVStack(spacing: 12) {
                                    ForEach(store.sleepSessions) { s in
                                        NavigationLink(value: s) {
                                            SleepSessionRow(session: s)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 20)
                            }
                        }
                    }
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Sleep")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    ClaudeBadge { showClaude = true }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    showRecorder = true
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "mic.fill")
                            .symbolEffect(.bounce, value: showRecorder)
                        Text("Record sleep")
                            .fontWeight(.semibold)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.sleep)
                .controlSize(.large)
                .padding(.bottom, 8)
            }
            .navigationDestination(for: SleepSession.self) { SleepDetailView(session: $0) }
            .fullScreenCover(isPresented: $showRecorder) {
                SleepRecorderView()
            }
            .sheet(isPresented: $showClaude) { ClaudeSettingsView() }
        }
    }

    private var scoreChart: some View {
        Chart {
            ForEach(store.sleepSessions) { s in
                LineMark(x: .value("Date", s.start),
                         y: .value("Score", s.sleepScore))
                    .foregroundStyle(Theme.sleep)
                    .interpolationMethod(.catmullRom)
                AreaMark(x: .value("Date", s.start),
                         y: .value("Score", s.sleepScore))
                    .foregroundStyle(
                        LinearGradient(colors: [Theme.sleep.opacity(0.45), .clear],
                                       startPoint: .top, endPoint: .bottom)
                    )
                    .interpolationMethod(.catmullRom)
                PointMark(x: .value("Date", s.start),
                          y: .value("Score", s.sleepScore))
                    .foregroundStyle(Theme.sleep)
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

struct SleepSessionRow: View {
    let session: SleepSession

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Theme.sleep.opacity(0.20))
                Text("\(formatScore(session.sleepScore))")
                    .font(.callout.weight(.bold))
                    .foregroundStyle(Theme.sleep)
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
        .card(tint: Theme.sleep)
    }
}
