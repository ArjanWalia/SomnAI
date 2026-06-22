import SwiftUI

struct AuthView: View {
    @Environment(AuthManager.self) private var auth
    @State private var email = ""
    @State private var mode: Mode = .signIn
    @FocusState private var focused: Bool

    enum Mode: Hashable { case signIn, signUp }

    var body: some View {
        ZStack {
            AuroraBackground(palette: Theme.sleepPalette)

            VStack(spacing: 32) {
                Spacer()

                VStack(spacing: 14) {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Theme.accent, Theme.sleep],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .symbolEffect(.breathe.pulse, options: .repeating)
                        .shadow(color: Theme.accent.opacity(0.6), radius: 14)

                    Text("SomnAI")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Sleep & stress, understood.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                }

                Picker("", selection: $mode) {
                    Text("Sign In").tag(Mode.signIn)
                    Text("Sign Up").tag(Mode.signUp)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 40)

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused)
                        .padding(16)
                        .glassEffect(.regular, in: .rect(cornerRadius: 14))
                        .foregroundStyle(.white)

                    if let err = auth.lastError {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    Button {
                        focused = false
                        Task { await auth.signIn(email: email) }
                    } label: {
                        HStack {
                            if auth.isWorking { ProgressView().tint(.white) }
                            Text(mode == .signIn ? "Sign In" : "Create Account")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.glassProminent)
                    .tint(Theme.accent)
                    .disabled(auth.isWorking || email.isEmpty)
                    .controlSize(.large)
                }
                .padding(.horizontal, 40)

                Spacer()

                Text("Your email is stored securely with Butterbase.")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.55))
                    .padding(.bottom, 24)
            }
            .animation(.smooth, value: auth.lastError)
        }
    }
}
