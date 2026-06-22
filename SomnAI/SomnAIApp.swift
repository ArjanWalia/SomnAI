import SwiftUI

@main
struct SomnAIApp: App {
    @State private var auth = AuthManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        Group {
            if auth.isSignedIn {
                ContentView()
            } else {
                AuthView()
            }
        }
        .animation(.easeInOut, value: auth.isSignedIn)
    }
}
