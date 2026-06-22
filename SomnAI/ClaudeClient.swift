import Foundation

actor ClaudeClient {
    static let shared = ClaudeClient()

    private let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    private let model = "claude-opus-4-7"
    private let session = URLSession(configuration: .default)

    enum InsightKind {
        case sleep, stress
    }

    func insights(for kind: InsightKind, summary: String) async throws -> String {
        guard let key = KeychainStore.get(SecretKey.claudeAPI), !key.isEmpty else {
            throw NSError(domain: "Claude", code: 401, userInfo: [NSLocalizedDescriptionKey: "Add your Claude API key in Settings."])
        }

        let systemPrompt: String
        switch kind {
        case .sleep:
            systemPrompt = "You are a sleep coach. Given a sleep session summary with detected snoring, hypopnea, and obstructive apnea events, give 3-4 specific, kind, actionable suggestions to improve sleep quality. Keep it under 180 words."
        case .stress:
            systemPrompt = "You are a focus coach. Given a work session summary with stress signals, give 3-4 specific, kind, actionable suggestions to reduce stress while working. Keep it under 180 words."
        }

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 600,
            "system": systemPrompt,
            "messages": [
                ["role": "user", "content": summary]
            ]
        ]

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "Claude", code: (response as? HTTPURLResponse)?.statusCode ?? 0,
                          userInfo: [NSLocalizedDescriptionKey: msg])
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let content = json?["content"] as? [[String: Any]]
        let text = content?.compactMap { $0["text"] as? String }.joined(separator: "\n")
        return text ?? "(No response)"
    }
}
