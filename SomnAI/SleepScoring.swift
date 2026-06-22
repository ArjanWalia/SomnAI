import Foundation

// Implements the label-checking algorithm described in the spec.
//
// For each label that hasn't been visited:
//   1. Take it as the "initial" label, anchoring a 60-minute window.
//   2. Within that window, count labels of the same kind.
//   3. Apply weight multipliers per group of 5 labels:
//        - snoring     > 5  events  →  *0.995 per group of 5
//        - hypopnea    5..14 events →  *0.95  per group of 5
//        - hypopnea    > 15 events  →  *0.90  per group of 5
//        - obstructive > 3  events  →  *0.85  per group of 3
//   4. Mark all labels in that window as visited.
//   5. Continue from the next unvisited label.
enum SleepScoring {
    static func compute(labels: [SleepLabel]) -> Double {
        let sorted = labels
            .filter { $0.kind != .noApnea }
            .sorted { $0.start < $1.start }
        guard !sorted.isEmpty else { return 100 }

        var score: Double = 100
        var visited = Set<UUID>()

        for anchor in sorted where !visited.contains(anchor.id) {
            let windowEnd = anchor.start.addingTimeInterval(3600)
            let inWindow = sorted.filter { $0.start >= anchor.start && $0.start < windowEnd }

            // Mark this window so we don't re-anchor on labels already counted.
            for l in inWindow { visited.insert(l.id) }

            let snoring = inWindow.filter { $0.kind == .snoring }.count
            let hypopnea = inWindow.filter { $0.kind == .hypopnea }.count
            let obstructive = inWindow.filter { $0.kind == .obstructiveApnea }.count

            // Snoring: >5 → 0.995 per group of 5
            if snoring > 5 {
                let groups = snoring / 5
                score *= pow(0.995, Double(groups))
            }

            // Hypopnea: tiered. >15 wins over 5..14 per the spec.
            if hypopnea > 15 {
                let groups = hypopnea / 5
                score *= pow(0.90, Double(groups))
            } else if hypopnea >= 5 {
                let groups = hypopnea / 5
                score *= pow(0.95, Double(groups))
            }

            // Obstructive: >3 → 0.85 per group of 3
            if obstructive > 3 {
                let groups = obstructive / 3
                score *= pow(0.85, Double(groups))
            }
        }

        return max(0, min(100, score))
    }
}
