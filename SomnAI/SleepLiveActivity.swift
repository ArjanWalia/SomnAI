import Foundation
import ActivityKit

// Shared between the main app and the widget extension.
// When you add the Widget Extension target in Xcode, add THIS FILE to that
// target's "Compile Sources" build phase so both targets see it.
public struct SleepRecordingAttributes: ActivityAttributes, Sendable {
    public struct ContentState: Codable, Hashable, Sendable {
        public var startedAt: Date
        public var snoringCount: Int
        public var hypopneaCount: Int
        public var obstructiveCount: Int

        public init(startedAt: Date, snoringCount: Int = 0, hypopneaCount: Int = 0, obstructiveCount: Int = 0) {
            self.startedAt = startedAt
            self.snoringCount = snoringCount
            self.hypopneaCount = hypopneaCount
            self.obstructiveCount = obstructiveCount
        }
    }

    public init() {}
}

// Drives the Live Activity from the main app.
@MainActor
final class SleepActivityController {
    static let shared = SleepActivityController()

    private var activity: Activity<SleepRecordingAttributes>?

    func start(at date: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attrs = SleepRecordingAttributes()
        let initial = SleepRecordingAttributes.ContentState(startedAt: date)
        do {
            activity = try Activity.request(
                attributes: attrs,
                content: .init(state: initial, staleDate: nil),
                pushType: nil
            )
        } catch {
            // Permission off or another activity issue; recording still works.
        }
    }

    func update(snoring: Int, hypopnea: Int, obstructive: Int, startedAt: Date) {
        guard let activity else { return }
        let state = SleepRecordingAttributes.ContentState(
            startedAt: startedAt,
            snoringCount: snoring,
            hypopneaCount: hypopnea,
            obstructiveCount: obstructive
        )
        Task { await activity.update(.init(state: state, staleDate: nil)) }
    }

    func end() {
        guard let activity else { return }
        Task {
            await activity.end(nil, dismissalPolicy: .immediate)
            self.activity = nil
        }
    }
}
