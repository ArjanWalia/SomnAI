# Setup & running the web app

## Prerequisites

- Node.js 20+ and npm (the project was built with Node 22 / npm 10).
- A modern Chromium/Safari/Firefox for camera + mic (a **secure context** —
  `localhost` counts; otherwise HTTPS).

## Install & run

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build to web/dist
npm run preview    # serve the production build
npm run test       # run the scoring unit tests (vitest)
npm run typecheck  # tsc --noEmit
```

Out of the box the app runs in **local demo mode** (no backend required): it
stores accounts/sessions in your browser and seeds example data. Sign up with
any email to explore.

## Connect Butterbase (live sync with the iOS app)

1. Apply the schema to the Butterbase app `app_kf3crd1822g8` using
   [`docs/butterbase-schema.sql`](./butterbase-schema.sql) (or the declarative
   [`.json`](./butterbase-schema.json)), and create the two storage buckets
   `session-audio` and `stress-video`.
2. Copy `web/.env.example` to `web/.env.local` and fill in:

   ```
   VITE_BUTTERBASE_URL=https://api.butterbase.ai/v1/app_kf3crd1822g8
   VITE_BUTTERBASE_ANON_KEY=<your publishable/anon key>
   ```

   Only the **publishable/anon** key belongs here — it ships to the browser, and
   row‑level security is what protects data. Never put the service key in client
   env.
3. Restart `npm run dev`. The app now reads/writes the same tables as the phone,
   so sessions recorded on either device appear on both.

> If a Butterbase version uses different endpoint paths than the Supabase‑style
> defaults, adjust the `paths` map in
> [`web/src/lib/butterbase.ts`](../web/src/lib/butterbase.ts) — every URL is
> built in that one place.

## Claude AI insights

In the app, open the **Claude** badge (top‑right) → Settings, and paste your
Anthropic API key. It is stored only in your browser and sent directly to
Anthropic. Insights use `claude-opus-4-8`.

## Recording tips

- Grant camera + microphone permission when prompted on the Stress → Record
  screen.
- Recording produces a video (camera + mic) and a separate audio track; both are
  uploaded on stop (to the local store in demo mode).
