//
//  SomnAIWidgetLiveActivity.swift
//  SomnAIWidget
//

import ActivityKit
import WidgetKit
import SwiftUI

// SleepRecordingAttributes lives in the main app target at
// SomnAI/SleepLiveActivity.swift. For this file to compile, that file MUST
// also be a member of the SomnAIWidgetExtension target. In Xcode:
//   Select SleepLiveActivity.swift → File Inspector → Target Membership →
//   tick "SomnAIWidgetExtension".

struct SomnAIWidgetLiveActivity: Widget {
    private let sleep = Color(red: 0.45, green: 0.60, blue: 1.00)

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SleepRecordingAttributes.self) { context in
            // Lock screen / banner UI
            LockScreenView(state: context.state, tint: sleep)
                .padding(16)
                .activityBackgroundTint(.black.opacity(0.5))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "waveform")
                        .symbolEffect(.variableColor.iterative, options: .repeating)
                        .font(.title2)
                        .foregroundStyle(sleep)
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
                    .foregroundStyle(sleep)
            } compactTrailing: {
                Text(context.state.startedAt, style: .timer)
                    .monospacedDigit()
                    .frame(maxWidth: 50)
            } minimal: {
                Image(systemName: "waveform")
                    .foregroundStyle(sleep)
            }
            .keylineTint(sleep)
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
    let tint: Color

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(tint.opacity(0.25))
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

#Preview("Notification", as: .content, using: SleepRecordingAttributes()) {
    SomnAIWidgetLiveActivity()
} contentStates: {
    SleepRecordingAttributes.ContentState(startedAt: .now.addingTimeInterval(-1800),
                                          snoringCount: 3, hypopneaCount: 1, obstructiveCount: 0)
}
