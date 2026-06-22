import Foundation

nonisolated enum SleepLabelKind: String, Codable, CaseIterable, Hashable, Sendable {
    case noApnea = "no_apnea"
    case snoring
    case hypopnea
    case obstructiveApnea = "obstructive_apnea"

    var display: String {
        switch self {
        case .noApnea: return "No Apnea"
        case .snoring: return "Snoring"
        case .hypopnea: return "Hypopnea"
        case .obstructiveApnea: return "Obstructive"
        }
    }
}

nonisolated struct SleepLabel: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var kind: SleepLabelKind
    var start: Date
    var duration: TimeInterval
    var end: Date { start.addingTimeInterval(duration) }
}

nonisolated struct SleepSession: Codable, Identifiable, Hashable, Sendable {
    var id = UUID()
    var start: Date
    var end: Date
    var sleepScore: Double
    var audioFileName: String?
    var labels: [SleepLabel]

    var snoringTimestamps: [Date] { labels.filter { $0.kind == .snoring }.map(\.start) }
    var hypopneaTimestamps: [Date] { labels.filter { $0.kind == .hypopnea }.map(\.start) }
    var obstructiveTimestamps: [Date] { labels.filter { $0.kind == .obstructiveApnea }.map(\.start) }
}

nonisolated struct StressLabel: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var start: Date
    var duration: TimeInterval
}

nonisolated struct StressSession: Codable, Identifiable, Hashable, Sendable {
    var id = UUID()
    var start: Date
    var end: Date
    var stressScore: Double
    var videoFileName: String?
    var audioFileName: String?
    var stressedTimestamps: [StressLabel]
}

nonisolated struct UserProfile: Codable, Hashable, Sendable {
    var email: String
}
