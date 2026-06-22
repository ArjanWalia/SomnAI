# Architecture

The web app is a React 18 + TypeScript + Vite SPA. It mirrors the SomnAI iOS app
1:1 (UI + backend) and shares the same Butterbase tables, adding the web-only
ability to record a stress session from the computer's camera + mic.

## Layers

```
pages/        Screens (route components)
components/   Presentational building blocks
context/      AuthContext (email identity), SettingsContext (Claude/Butterbase keys)
hooks/        useSessions — load sleep + stress for the signed-in user
lib/          Side-effecting services:
                config        token + table config; live vs demo gate
                butterbase    REST client (mirrors ButterbaseClient.swift)
                db            Backend interface; butterbaseBackend | localBackend
                idb           IndexedDB blob store for demo media
                seed          deterministic demo data (real sleep scores)
                videoModel    MediaPipe face/expression + motion → calmness
                audioModel    YAMNet (TF.js) → calmness, DSP fallback
                recorder      MediaRecorder (video + audio tracks)
                claude        Anthropic SDK insights (claude-opus-4-8)
                graphData     per-day aggregation for the chart
                format        score colors/labels
shared/       Cross-client contract — pure, unit-tested:
                types, constants, sleepScore, stressScore, time
```

`shared/` has no DOM/network imports, so the scoring is identical to (and
verifiable against) the iOS implementation.

## Backend selection

`lib/config.isButterbaseConfigured()` returns true when a Butterbase token is
present (env `VITE_BUTTERBASE_TOKEN` or the Settings field). `lib/db.backend()`
then returns the live `butterbaseBackend`; otherwise the `localBackend`
(localStorage + IndexedDB) seeded with a week of demo data on first sign-in. The
UI is identical in both modes.

## Spec → code map

| Spec requirement | Where |
| --- | --- |
| Login / sign up; email in Butterbase | `pages/LoginPage`, `context/AuthContext`, `lib/butterbase.upsertUser` |
| Home: scores + last sessions + combined graph | `pages/HomePage`, `components/ScoreGraph`, `lib/graphData` |
| Record work session (camera+mic, two models) | `pages/StressRecordPage`, `lib/{recorder,videoModel,audioModel}` |
| Calmness 0–1 per model, averaged ×100 | `shared/stressScore`, `pages/StressRecordPage` |
| Exact times stress was labeled | `shared/stressScore` flags + `pages/StressDetailPage` |
| Stress detail: video/audio playback + timestamps + insights | `pages/StressDetailPage` |
| Sleep list/detail mirrors phone; record → "connect phone" | `pages/SleepPage`, `pages/SleepDetailPage`, `components/ConnectPhonePrompt` |
| Sleep score weights & 1-hour windowing | `shared/sleepScore`, `shared/constants` |
| Claude insights via user's key | `lib/claude`, `components/ClaudePanel`, `context/SettingsContext` |
| Stress + sleep graph; multiple/day aggregated | `lib/graphData`, `components/ScoreGraph` |
| Butterbase tables (users/sleep/stress) + media buckets | `lib/butterbase`, `docs/DATA-CONTRACT.md` |

## Out of scope (lives in the iOS app)

The lock-screen **recording widget / elapsed-time Live Activity** is the iOS
sleep-recording feature (`SomnAIWidget/`, `SleepLiveActivity.swift` on the `IOS`
branch). Sleep recording is phone-only; the web app surfaces it via the "connect
your phone" prompt.
