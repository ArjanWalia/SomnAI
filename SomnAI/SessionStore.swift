import Foundation
import Observation

// Hybrid store: local JSON cache on disk + best-effort Butterbase sync.
// The local cache is the source of truth for the UI; remote calls happen in the background.
@Observable
@MainActor
final class SessionStore {
    static let shared = SessionStore()

    private(set) var sleepSessions: [SleepSession] = []
    private(set) var stressSessions: [StressSession] = []

    private let sleepURL: URL
    private let stressURL: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.sleepURL = docs.appendingPathComponent("sleep_sessions.json")
        self.stressURL = docs.appendingPathComponent("stress_sessions.json")
        loadLocal()
    }

    func loadLocal() {
        if let data = try? Data(contentsOf: sleepURL),
           let arr = try? jsonDecoder().decode([SleepSession].self, from: data) {
            sleepSessions = arr.sorted { $0.start > $1.start }
        }
        if let data = try? Data(contentsOf: stressURL),
           let arr = try? jsonDecoder().decode([StressSession].self, from: data) {
            stressSessions = arr.sorted { $0.start > $1.start }
        }
    }

    private func persist() {
        if let data = try? jsonEncoder().encode(sleepSessions) {
            try? data.write(to: sleepURL, options: .atomic)
        }
        if let data = try? jsonEncoder().encode(stressSessions) {
            try? data.write(to: stressURL, options: .atomic)
        }
    }

    func addSleep(_ session: SleepSession, email: String?) {
        sleepSessions.insert(session, at: 0)
        persist()
        guard let email else { return }
        Task.detached {
            try? await ButterbaseClient.shared.putSleep(session, email: email)
            if let url = session.audioFileName.flatMap({ Self.audioURL(for: $0) }),
               let audioID = session.audioFileName {
                try? await ButterbaseClient.shared.uploadAudio(fileURL: url, audioID: audioID)
            }
        }
    }

    func addStress(_ session: StressSession, email: String?) {
        stressSessions.insert(session, at: 0)
        persist()
        guard let email else { return }
        Task.detached {
            try? await ButterbaseClient.shared.putStress(session, email: email)
        }
    }

    var latestSleepScore: Double? { sleepSessions.first?.sleepScore }
    var latestStressScore: Double? { stressSessions.first?.stressScore }

    static func audioURL(for fileName: String) -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }

    private func jsonDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
    private func jsonEncoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}
