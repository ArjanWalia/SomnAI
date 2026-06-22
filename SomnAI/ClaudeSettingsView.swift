import SwiftUI

struct ClaudeSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var store = SessionStore.shared
    @State private var claudeKey: String = KeychainStore.get(SecretKey.claudeAPI) ?? ""
    @State private var butterbaseToken: String = KeychainStore.get(SecretKey.butterbaseToken) ?? ""
    @State private var testResult: String?
    @State private var testing = false
    @State private var provisioning = false

    var body: some View {
        NavigationStack {
            ZStack {
                AuroraBackground(palette: Theme.homePalette)

                ScrollView {
                    VStack(spacing: 18) {
                        claudeCard
                        butterbaseCard
                        syncStatusCard
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { save() }.fontWeight(.semibold)
                }
            }
        }
    }

    private var claudeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Claude API Key", systemImage: "sparkles")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.9))
            SecureField("sk-ant-…", text: $claudeKey)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .glassEffect(.regular, in: .rect(cornerRadius: 12))
                .foregroundStyle(.white)
            Text("Used to generate AI insights on your sleep and stress.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.6))
        }
        .card(tint: Theme.claude)
    }

    private var butterbaseCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Butterbase Token", systemImage: "cylinder.split.1x2")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.9))
            SecureField("bb_sk_… or user JWT", text: $butterbaseToken)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .glassEffect(.regular, in: .rect(cornerRadius: 12))
                .foregroundStyle(.white)
            Text("Required to sync sessions. Without it the app stores everything locally only.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.6))

            HStack(spacing: 10) {
                Button {
                    Task { await runTest() }
                } label: {
                    HStack(spacing: 6) {
                        if testing {
                            ProgressView().controlSize(.small).tint(.white)
                        } else {
                            Image(systemName: "wave.3.right")
                        }
                        Text(testing ? "Testing…" : "Test connection")
                    }
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.sleep)
                .disabled(testing || provisioning)

                Button {
                    Task { await runProvision() }
                } label: {
                    HStack(spacing: 6) {
                        if provisioning {
                            ProgressView().controlSize(.small).tint(.white)
                        } else {
                            Image(systemName: "cylinder.split.1x2.fill")
                        }
                        Text(provisioning ? "Creating…" : "Create tables")
                    }
                }
                .buttonStyle(.glass)
                .tint(Theme.accent)
                .disabled(testing || provisioning)
            }
            .padding(.top, 4)

            if let testResult {
                Text(testResult)
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.05), in: .rect(cornerRadius: 10))
            }
        }
        .card(tint: Theme.sleep)
    }

    private var syncStatusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Last sync", systemImage: "arrow.triangle.2.circlepath")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.9))

            if let err = store.lastSyncError {
                Text(err)
                    .font(.footnote)
                    .foregroundStyle(.red)
            } else if let ok = store.lastSyncOK {
                Text("Synced at \(ok.formatted(date: .abbreviated, time: .standard))")
                    .font(.footnote)
                    .foregroundStyle(.green)
            } else {
                Text("No sync attempts yet.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func save() {
        KeychainStore.set(claudeKey, for: SecretKey.claudeAPI)
        KeychainStore.set(butterbaseToken, for: SecretKey.butterbaseToken)
        dismiss()
    }

    private func runTest() async {
        KeychainStore.set(butterbaseToken, for: SecretKey.butterbaseToken)
        testing = true
        defer { testing = false }
        testResult = await ButterbaseClient.shared.testConnection()
    }

    private func runProvision() async {
        KeychainStore.set(butterbaseToken, for: SecretKey.butterbaseToken)
        provisioning = true
        defer { provisioning = false }
        testResult = await ButterbaseClient.shared.provisionSchema()
    }
}
