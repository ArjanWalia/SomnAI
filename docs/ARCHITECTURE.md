# Architecture

SomnAI is two clients over one backend:

```
   iPhone app (Swift)                         Web app (React)
   ─ records sleep audio                       ─ records work-session video + audio
   ─ on-device CNN → labels                    ─ on-device Face Landmarker + audio model
   ─ computes sleep score                      ─ computes stress score
            │                                            │
            └───────────────┬──────────────  ────────────┘
                            ▼
                    Butterbase backend
            users · sleep_sessions · stress_sessions
            buckets: session-audio · stress-video
```

The two apps are "the same app on two devices": each owns the capture that only
its device can do, and both render the full picture by reading the shared tables.
**Sync is the shared Butterbase schema + the shared scoring algorithms** — there
is no direct app‑to‑app channel.

## Web app layout (`web/`)

```
src/
  shared/      Cross-platform contract: types, scoring constants, sleep/stress
               algorithms (+ unit tests). Mirrors the iOS model and the schema.
  lib/         Services: butterbase client, db (Butterbase | local fallback),
               config, idb, seed, recorder, videoModel, audioModel, claude, format.
  context/     AuthContext, SettingsContext (Claude API key).
  components/  AppShell, BottomNav, ScoreCircle, ScoreGraph, SessionCard,
               LabelTimeline, ClaudePanel, ConnectPhonePrompt, Loader.
  pages/       Login, Home, Stress, StressRecord, StressDetail, Sleep,
               SleepDetail, Settings.
  hooks/       useSessions.
```

## How the spec maps to the code

| Spec | Where |
| --- | --- |
| Log in / sign up; store email in Butterbase | `pages/LoginPage`, `lib/db` (`signUp` inserts into `users`) |
| Record work session from computer camera + mic | `pages/StressRecordPage`, `lib/recorder` |
| Video model: sweat, eye‑redness, frown/cringe | `lib/videoModel` (MediaPipe Face Landmarker + CV) |
| Audio model: sighs, shallow breaths, anger | `lib/audioModel` (Web‑Audio DSP / YAMNet) |
| Calmness 0–1 per model, averaged ×100 | `shared/stressScore` |
| Exact times stress was labeled | `stressed_timestamps`, `components/LabelTimeline` |
| Sleep features are phone‑only → prompt to connect phone | `pages/SleepPage` + `components/ConnectPhonePrompt` |
| View past sessions, tap for detail, full media + timestamps | `pages/*DetailPage` |
| Sleep score degradation rules | `shared/labelAlgorithm` + `shared/sleepScore` |
| Claude API key → AI insights | `context/SettingsContext`, `lib/claude`, `components/ClaudePanel` |
| Stress + sleep graph; multiple scores/day | `components/ScoreGraph`, `lib/graphData` |
| Store sessions; media in buckets | `lib/db`, `docs/butterbase-schema.*` |

## Graceful degradation

The app is built to run end‑to‑end even when pieces are missing:

- **No Butterbase key** → `lib/db` transparently uses a localStorage +
  IndexedDB backend and seeds a week of realistic demo sessions, so the UI,
  graphs and lists look correct immediately. Set `VITE_BUTTERBASE_ANON_KEY` to
  switch to live sync.
- **A model can't load** (e.g. offline) → the recorder still captures, and the
  stress score falls back to whichever model is available.
- **No Claude key** → insight panels show a prompt to add one in Settings.

## Notes & non‑goals on the web

- The **lock‑screen recording widget** and **sleep audio capture** are iOS‑only
  (WidgetKit / background mic). The web app provides a live recording timer and,
  for sleep, the "connect your phone" prompt.
- Browser camera/mic require a **secure context** (localhost or HTTPS).
