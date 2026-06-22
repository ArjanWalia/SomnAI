# SomnAI

Track your **sleep** and your **daytime stress** in one place.

SomnAI is two clients over one shared [Butterbase](https://butterbase.ai) backend
(app `app_kf3crd1822g8`):

- **iPhone app** (on the [`IOS`](https://github.com/ArjanWalia/SomnAI/tree/IOS)
  branch) — records sleep audio overnight, classifies Hypopnea / Obstructive
  Apnea / Snoring from 10-second mel-spectrogram windows, computes a sleep score,
  and shows a lock-screen Live Activity for the recording button + elapsed time.
- **Web app** (this branch, in [`web/`](web/)) — records a *work session* from
  your computer's **camera and microphone**, runs **two on-device ML models** to
  estimate calmness, computes a stress score, and mirrors everything the phone
  shows.

Both clients read/write the **same Butterbase tables** (`users`, `sleep`,
`stress`), so the two stay in sync automatically.

## What the web app does

- **Auth** — sign in / sign up with your email (stored in Butterbase).
- **Home** — latest stress & sleep scores, your last work and sleep sessions, and
  a combined **stress + sleep** graph.
- **Stress** — record a work session: live **face/expression model** (brow
  tension, frown, eye squint, cringe, sweat, eye-redness, head-motion) +
  **YAMNet audio model** (sighs, shallow breaths, anger) → a calmness-based
  stress score and the exact timestamps where you were stressed. Review past
  sessions with video/audio playback.
- **Sleep** — view phone-recorded nights: score, audio playback, and the
  Hypopnea / Obstructive Apnea / Snoring timelines. Recording sleep prompts you
  to use the iPhone app.
- **Claude insights** — add your Anthropic API key for AI-powered, actionable
  guidance on any session (Claude Opus 4.8).

Runs with **zero setup** in a local demo mode (seeded data, browser storage),
and switches to live Butterbase sync when you add a token.

## Quick start

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run test     # scoring unit tests (incl. the spec's "5 hypopnea → 95")
```

See [`docs/SETUP.md`](docs/SETUP.md) for Butterbase + Claude configuration.

## The two stress models

Grounded in the two research papers (`docs/MODEL-CHOICES.md`):

- **Video** — MediaPipe Face Landmarker (52 blendshapes) + pixel heuristics +
  head-motion, mapping negative expression & frustration to a calmness value.
- **Audio** — **YAMNet** (a CNN over a log-mel spectrogram) via TensorFlow.js,
  mapping agitation classes (shout/yell/groan/heavy-breathing/sigh) to calmness.
  Falls back to a lightweight Web-Audio DSP classifier if the model can't load.

Each emits calmness ∈ [0,1]; they are averaged per second and ×100 for the score
(100 = perfectly calm).

## Repository layout

```
web/                  React + TypeScript + Vite web app
  src/shared/         Cross-client data model + scoring (mirrors iOS) + tests
  src/lib/            Butterbase client, models, recorder, Claude, data layer
  src/components/     UI building blocks
  src/pages/          Screens (Home, Stress, Sleep, detail, record, settings, login)
docs/
  ARCHITECTURE.md     How the pieces fit; spec → code map
  DATA-CONTRACT.md    Shared tables, timestamps, scoring algorithms
  MODEL-CHOICES.md    The two stress models and why
  SETUP.md            Install, run, configure Butterbase + Claude
```

## Tech

React 18 · TypeScript · Vite · React Router · MediaPipe Face Landmarker ·
TensorFlow.js (YAMNet) · Web Audio API · `@anthropic-ai/sdk` (Claude Opus 4.8) ·
Butterbase.
