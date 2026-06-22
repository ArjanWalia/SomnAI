import Foundation
import Observation

@Observable
final class AuthManager {
    var email: String?
    var lastError: String?
    var isWorking = false

    init() {
        self.email = KeychainStore.get(SecretKey.userEmail)
    }

    var isSignedIn: Bool { email != nil }

    func signIn(email: String) async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard isValidEmail(trimmed) else {
            lastError = "Please enter a valid email."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            try await ButterbaseClient.shared.upsertUser(email: trimmed)
            KeychainStore.set(trimmed, for: SecretKey.userEmail)
            self.email = trimmed
            self.lastError = nil
        } catch {
            // Network failure shouldn't lock the user out — Butterbase upsert is best-effort.
            KeychainStore.set(trimmed, for: SecretKey.userEmail)
            self.email = trimmed
            self.lastError = nil
        }
    }

    func signOut() {
        KeychainStore.remove(SecretKey.userEmail)
        email = nil
    }

    private func isValidEmail(_ s: String) -> Bool {
        s.contains("@") && s.contains(".") && s.count >= 5
    }
}
