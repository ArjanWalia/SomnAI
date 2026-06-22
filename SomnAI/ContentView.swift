import SwiftUI

struct ContentView: View {
    @State private var selection: Tab = .home

    enum Tab: Hashable { case home, stress, sleep }

    var body: some View {
        TabView(selection: $selection) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(Tab.home)
            StressView()
                .tabItem { Label("Stress", systemImage: "brain.head.profile") }
                .tag(Tab.stress)
            SleepView()
                .tabItem { Label("Sleep", systemImage: "moon.stars.fill") }
                .tag(Tab.sleep)
        }
        .tint(Theme.accent)
    }
}
