# SomnAI

Track your **sleep** and your **daytime stress** in one place.

SomnAI is two clients over a shared [Butterbase](https://butterbase.ai) backend:

- **iPhone app** (built separately) — records sleep audio overnight, classifies
  Hypopnea / Obstructive Apnea / Snoring from 10‑second mel‑spectrogram windows,
  and computes a sleep score.
- **Web app** (this repo, in [`web/`](web/)) — records a work session from your
  computer's **camera and microphone**, runs two on‑device models to estimate
  **calmness**, computes a stress score, and shows everything from the phone too.

Because both clients read and write the same Butterbase tables, the two stay in
sync automatically. The web app is also where phone‑only actions (like recording
sleep) prompt you to "connect your phone."

## What the web app does

- **Auth** — log in / sign up; your email is stored in Butterbase.
- **Home** — latest stress and sleep scores, your last work and sleep sessions,
  and a combined **stress + sleep graph**.
- **Stress** — record a work session: live face analysis (brow tension, frown,
  eye squint, cringe, sweat, eye‑redness) + audio analysis (sighs, shallow
  breaths, anger) → a calmness‑based stress score and the exact timestamps where
  you were stressed. Review past sessions with video/audio playback.
- **Sleep** — view phone‑recorded nights: score, audio playback, and the
  Hypopnea / Obstructive Apnea / Snoring timestamps. Recording sleep redirects
  you to the iPhone app.
- **Claude insights** — add your Anthropic API key to get AI‑powered, actionable
  guidance on any session.

It runs **with zero setup** in a local demo mode (seeded data, browser storage),
and switches to live Butterbase sync when you add an anon key.

## Quick start

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

See [`docs/SETUP.md`](docs/SETUP.md) for Butterbase configuration and the Claude
key.

## Repository layout

```
web/                  The React + TypeScript + Vite web app
  src/shared/         Cross-platform data model + scoring algorithms (+ tests)
  src/lib/            Butterbase client, models, recorder, Claude, data layer
  src/components/     UI building blocks
  src/pages/          Screens (Home, Stress, Sleep, detail, record, auth)
docs/
  ARCHITECTURE.md     How the pieces fit; spec → code map
  DATA-CONTRACT.md    The shared contract: tables, offsets, scoring algorithms
  MODEL-CHOICES.md    Which models and why ("{insert best model}" resolved)
  SETUP.md            Install, run, configure Butterbase + Claude
  butterbase-schema.sql / .json   The backend schema to apply
```

## Tech

React 18 · TypeScript · Vite · React Router · MediaPipe Face Landmarker ·
Web Audio API · `@anthropic-ai/sdk` (Claude Opus 4.8) · Butterbase.

## Tests

```bash
cd web && npm run test    # scoring algorithm unit tests
```

The sleep and stress scoring is fully unit‑tested (including the spec's
"5 hypopnea in an hour → 95" example) so the web app and the iOS app agree on
every number.
