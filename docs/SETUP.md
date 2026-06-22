# Setup

## Run the web app

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Out of the box it runs in **demo mode**: sign in with any email and you get a
week of seeded sleep + stress data stored in your browser. No backend needed.

Camera/mic recording requires a secure context — `localhost` is fine; for a
deployed build serve it over **HTTPS**.

## Tests & build

```bash
npm run test     # scoring unit tests (incl. "5 hypopnea in an hour → 95")
npm run build    # type-check + production build to dist/
```

## Enable live Butterbase sync

The app talks to Butterbase app `app_kf3crd1822g8`. To go live you need a token
(a `bb_sk_…` service key or a user JWT) with access to that app.

Two ways to provide it:

1. **In-app** — open **Settings**, paste the token under *Butterbase token*,
   tap **Test connection**. Green means the `users`, `sleep`, `stress` tables are
   reachable.
2. **Env** — copy `web/.env.example` to `web/.env` and set:

   ```
   VITE_BUTTERBASE_TOKEN=bb_sk_xxx
   ```

The required tables/columns are in [`DATA-CONTRACT.md`](./DATA-CONTRACT.md). They
match what the iOS app provisions via its *Create tables* action, so once either
client creates them the other syncs automatically. The web app **writes stress**
sessions and **reads sleep** sessions written by the phone.

## Claude insights

Open **Settings**, paste your Anthropic API key (`sk-ant-…`) under *Claude API
key*, and save. It is stored only in your browser and sent directly to Anthropic
(model `claude-opus-4-8`). The insight panels on the sleep/stress detail pages
unlock once a key is present.

## Model assets (loaded at runtime from CDNs)

- **MediaPipe Face Landmarker** — WASM + `.task` model from the MediaPipe CDN.
- **YAMNet** — TensorFlow.js graph model from TF Hub (lazy-loaded on first
  recording). If it can't load, the app falls back to a built-in DSP audio
  classifier automatically.
