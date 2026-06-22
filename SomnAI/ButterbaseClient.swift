import Foundation
import OSLog

// Butterbase Data API + Storage API client.
// Reference: https://docs.butterbase.ai/api-reference/data-api/
//            https://docs.butterbase.ai/api-reference/storage-api/
actor ButterbaseClient {
    static let shared = ButterbaseClient()

    enum SyncStatus: Sendable, Equatable {
        case idle
        case ok(at: Date)
        case noToken
        case failed(String)
    }

    private(set) var lastStatus: SyncStatus = .idle

    private let appID = "app_kf3crd1822g8"
    private let host = URL(string: "https://api.butterbase.ai")!
    private let session: URLSession
    private let log = Logger(subsystem: "SomnAI", category: "Butterbase")

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        self.session = URLSession(configuration: cfg)
    }

    private func tableURL(_ table: String, filter: String? = nil) -> URL {
        var url = host.appendingPathComponent("v1/\(appID)/\(table)")
        if let filter {
            var comps = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            comps.query = filter
            url = comps.url ?? url
        }
        return url
    }

    private func authedRequest(_ url: URL, method: String, body: Data? = nil) throws -> URLRequest {
        guard let token = KeychainStore.get(SecretKey.butterbaseToken), !token.isEmpty else {
            throw NSError(domain: "Butterbase", code: 401,
                          userInfo: [NSLocalizedDescriptionKey: "No Butterbase token set. Add it in Settings."])
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = body
        return req
    }

    private func send(_ req: URLRequest) async throws -> Data {
        log.debug("→ \(req.httpMethod ?? "?") \(req.url?.absoluteString ?? "")")
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        let bodyPreview = String(data: data.prefix(400), encoding: .utf8) ?? "(binary)"
        log.debug("← \(http.statusCode) \(bodyPreview, privacy: .public)")
        guard (200..<300).contains(http.statusCode) else {
            throw NSError(domain: "Butterbase", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode): \(bodyPreview)"])
        }
        return data
    }

    private func record(_ status: SyncStatus) {
        self.lastStatus = status
        switch status {
        case .ok: log.info("Butterbase sync OK")
        case .failed(let m): log.error("Butterbase failed: \(m, privacy: .public)")
        case .noToken: log.warning("No Butterbase token")
        case .idle: break
        }
    }

    private func decode<T: Decodable>(_ data: Data, as: T.Type) throws -> T {
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        dec.keyDecodingStrategy = .convertFromSnakeCase
        return try dec.decode(T.self, from: data)
    }

    private func encode<T: Encodable>(_ value: T) throws -> Data {
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        enc.keyEncodingStrategy = .convertToSnakeCase
        return try enc.encode(value)
    }

    nonisolated var hasToken: Bool {
        (KeychainStore.get(SecretKey.butterbaseToken) ?? "").isEmpty == false
    }

    /// Pings Butterbase to verify the token works. Returns a user-facing message.
    func testConnection() async -> String {
        guard hasToken else {
            record(.noToken)
            return "No token set. Paste your Butterbase token above and tap Save."
        }
        do {
            let req = try authedRequest(tableURL("users"), method: "GET")
            _ = try await send(req)
            record(.ok(at: Date()))
            return "Connected. Users table is reachable."
        } catch {
            let msg = error.localizedDescription
            record(.failed(msg))
            return "Failed: \(msg)"
        }
    }

    // MARK: Users

    struct UserRow: Codable, Sendable { var email: String }

    func upsertUser(email: String) async throws {
        let req = try authedRequest(tableURL("users"), method: "POST", body: try encode(UserRow(email: email)))
        do {
            _ = try await send(req)
            record(.ok(at: Date()))
        } catch {
            record(.failed(error.localizedDescription))
            throw error
        }
    }

    // MARK: Sleep

    struct SleepRow: Codable, Sendable {
        var id: String
        var email: String
        var date: String
        var startTimestamp: Date
        var endTimestamp: Date
        var sleepScore: Double
        var audioId: String?
        var hypopneaTimestamps: [Date]
        var obstructiveTimestamps: [Date]
        var snoringTimestamps: [Date]
    }

    func putSleep(_ session: SleepSession, email: String) async throws {
        let row = SleepRow(
            id: session.id.uuidString,
            email: email,
            date: session.start.dayShort,
            startTimestamp: session.start,
            endTimestamp: session.end,
            sleepScore: session.sleepScore,
            audioId: session.audioFileName,
            hypopneaTimestamps: session.hypopneaTimestamps,
            obstructiveTimestamps: session.obstructiveTimestamps,
            snoringTimestamps: session.snoringTimestamps
        )
        let req = try authedRequest(tableURL("sleep"), method: "POST", body: try encode(row))
        do {
            _ = try await send(req)
            record(.ok(at: Date()))
        } catch {
            record(.failed(error.localizedDescription))
            throw error
        }
    }

    func fetchSleep(email: String) async throws -> [SleepRow] {
        let filter = "email=eq.\(email)&order=start_timestamp.desc"
        let req = try authedRequest(tableURL("sleep", filter: filter), method: "GET")
        let data = try await send(req)
        return try decode(data, as: [SleepRow].self)
    }

    // MARK: Stress

    struct StressRow: Codable, Sendable {
        var id: String
        var email: String
        var date: String
        var startTimestamp: Date
        var endTimestamp: Date
        var stressScore: Double
        var videoId: String?
        var audioId: String?
        var stressedTimestamps: [Date]
    }

    func putStress(_ session: StressSession, email: String) async throws {
        let row = StressRow(
            id: session.id.uuidString,
            email: email,
            date: session.start.dayShort,
            startTimestamp: session.start,
            endTimestamp: session.end,
            stressScore: session.stressScore,
            videoId: session.videoFileName,
            audioId: session.audioFileName,
            stressedTimestamps: session.stressedTimestamps.map(\.start)
        )
        let req = try authedRequest(tableURL("stress"), method: "POST", body: try encode(row))
        do {
            _ = try await send(req)
            record(.ok(at: Date()))
        } catch {
            record(.failed(error.localizedDescription))
            throw error
        }
    }

    func fetchStress(email: String) async throws -> [StressRow] {
        let filter = "email=eq.\(email)&order=start_timestamp.desc"
        let req = try authedRequest(tableURL("stress", filter: filter), method: "GET")
        let data = try await send(req)
        return try decode(data, as: [StressRow].self)
    }

    // MARK: Storage (two-step upload)

    private struct UploadRequest: Codable, Sendable {
        var filename: String
        var contentType: String
        var sizeBytes: Int
        var `public`: Bool
    }

    private struct UploadResponse: Codable, Sendable {
        var uploadUrl: String
        var objectKey: String
        var objectId: String
        var expiresIn: Int
    }

    func uploadAudio(fileURL: URL) async throws -> String? {
        let data = try Data(contentsOf: fileURL)
        let body = UploadRequest(
            filename: fileURL.lastPathComponent,
            contentType: "audio/m4a",
            sizeBytes: data.count,
            public: false
        )
        let endpoint = host.appendingPathComponent("storage/\(appID)/upload")
        let req = try authedRequest(endpoint, method: "POST", body: try encode(body))
        let respData = try await send(req)
        let resp = try decode(respData, as: UploadResponse.self)

        guard let uploadURL = URL(string: resp.uploadUrl) else {
            throw NSError(domain: "Butterbase", code: 0,
                          userInfo: [NSLocalizedDescriptionKey: "Invalid upload URL"])
        }
        var put = URLRequest(url: uploadURL)
        put.httpMethod = "PUT"
        put.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        let (_, putResp) = try await session.upload(for: put, from: data)
        guard let http = putResp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return resp.objectId
    }
}
