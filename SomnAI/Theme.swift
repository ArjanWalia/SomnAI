import SwiftUI

enum Theme {
    static let accent = Color(red: 0.62, green: 0.50, blue: 1.00)
    static let sleep = Color(red: 0.45, green: 0.60, blue: 1.00)
    static let stress = Color(red: 1.00, green: 0.55, blue: 0.50)
    static let claude = Color(red: 0.95, green: 0.55, blue: 0.30)

    // Backdrop palettes for each tab.
    static let sleepPalette: [Color] = [
        Color(red: 0.04, green: 0.04, blue: 0.12),
        Color(red: 0.10, green: 0.07, blue: 0.25),
        Color(red: 0.16, green: 0.10, blue: 0.32),
        Color(red: 0.22, green: 0.16, blue: 0.42)
    ]
    static let stressPalette: [Color] = [
        Color(red: 0.10, green: 0.05, blue: 0.12),
        Color(red: 0.22, green: 0.07, blue: 0.18),
        Color(red: 0.30, green: 0.12, blue: 0.20),
        Color(red: 0.18, green: 0.08, blue: 0.28)
    ]
    static let homePalette: [Color] = [
        Color(red: 0.05, green: 0.05, blue: 0.16),
        Color(red: 0.15, green: 0.10, blue: 0.30),
        Color(red: 0.25, green: 0.15, blue: 0.32),
        Color(red: 0.10, green: 0.18, blue: 0.36)
    ]
}

// MARK: - Animated mesh gradient backdrop

struct AuroraBackground: View {
    let palette: [Color]

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let s = { (phase: Double, amp: Float) -> Float in
                Float(sin(t * phase)) * amp
            }
            MeshGradient(
                width: 3,
                height: 3,
                points: [
                    [0.0, 0.0],                            [0.5 + s(0.20, 0.05), 0.0],                                [1.0, 0.0],
                    [0.0, 0.5 + s(0.18, 0.06)],           [0.5 + s(0.25, 0.10), 0.5 + s(0.22, 0.08)],                [1.0, 0.5 + s(0.20, 0.05)],
                    [0.0, 1.0],                            [0.5 + s(0.15, 0.05), 1.0],                                [1.0, 1.0]
                ],
                colors: meshColors(at: t),
                background: palette.first ?? .black,
                smoothsColors: true
            )
            .ignoresSafeArea()
            .overlay(
                LinearGradient(
                    colors: [.black.opacity(0.35), .clear, .black.opacity(0.45)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            )
        }
    }

    private func meshColors(at t: TimeInterval) -> [Color] {
        let shift = (sin(t * 0.15) + 1) / 2
        let p = palette
        let mix = { (a: Color, b: Color) in a.mix(with: b, by: shift) }
        return [
            p[0], mix(p[1], p[2]), p[1],
            mix(p[2], p[3]), p[3], mix(p[0], p[2]),
            p[1], mix(p[0], p[3]), p[2]
        ]
    }
}

// MARK: - Score orb with animated progress ring

struct ScoreOrb: View {
    let title: String
    let score: Int?
    let tint: Color
    @State private var animatedFraction: Double = 0

    var fraction: Double {
        guard let score else { return 0 }
        return min(1, max(0, Double(score) / 100))
    }

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 8)

                Circle()
                    .trim(from: 0, to: animatedFraction)
                    .stroke(
                        AngularGradient(
                            colors: [tint.opacity(0.4), tint, tint.opacity(0.7)],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .shadow(color: tint.opacity(0.6), radius: 8)

                VStack(spacing: 2) {
                    Text(score.map(String.init) ?? "–")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                        .foregroundStyle(.white)
                    Text(title)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.65))
                        .multilineTextAlignment(.center)
                }
                .padding(10)
            }
            .frame(width: 140, height: 140)
        }
        .onAppear {
            withAnimation(.smooth(duration: 1.2)) { animatedFraction = fraction }
        }
        .onChange(of: fraction) { _, new in
            withAnimation(.smooth(duration: 0.8)) { animatedFraction = new }
        }
    }
}

// MARK: - Claude badge (glass)

struct ClaudeBadge: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("Claude")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
        }
        .buttonStyle(.glass)
        .tint(Theme.claude)
    }
}

// MARK: - Glass card modifier

struct GlassCardStyle: ViewModifier {
    var tint: Color? = nil
    func body(content: Content) -> some View {
        if let tint {
            content
                .padding(16)
                .glassEffect(.regular.tint(tint.opacity(0.18)), in: .rect(cornerRadius: 20))
        } else {
            content
                .padding(16)
                .glassEffect(.regular, in: .rect(cornerRadius: 20))
        }
    }
}

extension View {
    func card(tint: Color? = nil) -> some View { modifier(GlassCardStyle(tint: tint)) }
}

// MARK: - Date / score helpers

extension Date {
    nonisolated var timeHMM: String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: self)
    }
    nonisolated var dayShort: String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: self)
    }
}

nonisolated func formatScore(_ value: Double) -> Int { Int(value.rounded()) }
