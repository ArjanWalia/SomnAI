import ActivityKit
import WidgetKit
import SwiftUI

// SleepRecordingAttributes is defined in the main app (SleepLiveActivity.swift).
// IMPORTANT: in Xcode, set that file's Target Membership to include the Widget
// Extension target as well, so this Widget can see the type.

struct SleepRecordingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SleepRecordingAttributes.self) { context in
            // Lock screen / banner UI
            LockScreenView(state: context.state)
                .padding(16)
                .activityBackgroundTint(.black.opacity(0.5))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "waveform")
                        .symbolEffect(.variableColor.iterative, options: .repeating)
                        .font(.title2)
                        .foregroundStyle(Color(red: 0.45, green: 0.60, blue: 1.00))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.startedAt, style: .timer)
                        .font(.title3.monospacedDigit())
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 16) {
                        stat("Snore", context.state.snoringCount, .pink)
                        stat("Hypo", context.state.hypopneaCount, .orange)
                        stat("Obstr.", context.state.obstructiveCount, .red)
                    }
                }
            } compactLeading: {
                Image(systemName: "moon.stars.fill")
                    .foregroundStyle(Color(red: 0.45, green: 0.60, blue: 1.00))
            } compactTrailing: {
                Text(context.state.startedAt, style: .timer)
                    .monospacedDigit()
                    .frame(maxWidth: 50)
            } minimal: {
                Image(systemName: "waveform")
                    .foregroundStyle(Color(red: 0.45, green: 0.60, blue: 1.00))
            }
            .keylineTint(Color(red: 0.45, green: 0.60, blue: 1.00))
        }
    }

    private func stat(_ name: String, _ count: Int, _ tint: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(count)").font(.headline.monospacedDigit()).foregroundStyle(tint)
            Text(name).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct LockScreenView: View {
    let state: SleepRecordingAttributes.ContentState

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.45, green: 0.60, blue: 1.00).opacity(0.25))
                    .frame(width: 52, height: 52)
                Image(systemName: "waveform")
                    .symbolEffect(.variableColor.iterative, options: .repeating)
                    .font(.title2)
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("SomnAI · recording")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.8))
                Text(state.startedAt, style: .timer)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(state.snoringCount + state.hypopneaCount + state.obstructiveCount)")
                    .font(.title2.bold().monospacedDigit())
                    .foregroundStyle(.white)
                Text("events")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
    }
}
