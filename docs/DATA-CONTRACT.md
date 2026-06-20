# SomnAI data contract

This is the single source of truth shared by the **iOS app** and the **web app**.
Both clients talk to the same Butterbase backend, so "syncing" the two apps means
agreeing on (1) the table shapes and (2) the scoring algorithms below. The web
implementation lives in [`web/src/shared/`](../web/src/shared); the schema lives
in [`butterbase-schema.sql`](./butterbase-schema.sql) /
[`butterbase-schema.json`](./butterbase-schema.json). Keep all four in lock‑step.

## Identity

- **users**: `id`, `email`, `created_at`. The email is stored on sign‑up (spec
  requirement). Auth (email/password) is handled by Butterbase; the user id ties
  every session row to its owner, and row‑level security scopes reads/writes.

## Timestamps & offsets

- `start_ts` / `end_ts` are absolute instants (ISO‑8601 / `timestamptz`).
- `date` is the local calendar day the session started (`YYYY-MM-DD`).
- **Label arrays** (`hypopnea_timestamps`, `…`, `stressed_timestamps`) are arrays
  of **offsets in seconds from `start_ts`**. The sleep classifier tags fixed
  **10‑second** windows, so each value is a window's start offset. Offsets (not
  absolute instants) keep the arrays compact and make "jump playback to this
  label" a one‑liner (`media.currentTime = offset`).

## Media

- Audio (sleep and stress) → **`session-audio`** bucket; `audio_id` is the object key.
- Video (stress) → **`stress-video`** bucket; `video_id` is the object key.
- Rows never embed media bytes. Clients upload to the bucket, then store the key.

## Sleep score algorithm

Implemented in [`web/src/shared/labelAlgorithm.ts`](../web/src/shared/labelAlgorithm.ts)
and [`sleepScore.ts`](../web/src/shared/sleepScore.ts); unit‑tested in
[`sleepScore.test.ts`](../web/src/shared/sleepScore.test.ts). The iOS app must
implement the same procedure so a re‑derived score matches.

Start at **100** and walk the labels (all three categories merged, sorted by
start offset):

1. Take the earliest **not‑yet‑visited** label as the *anchor*.
2. Form the window `[anchor.start, anchor.start + 60 min)`.
3. Count the labels of the **same category** as the anchor inside that window;
   mark them visited.
4. Pick the category's weight from its count band, and apply it **once per group
   of 5** same‑category labels in the window (a qualifying window applies its
   weight at least once):

   | Category | Condition (count in window) | Weight |
   | --- | --- | --- |
   | Snoring | more than 5 | ×0.995 |
   | Hypopnea | 5–14 | ×0.95 |
   | Hypopnea | 15 or more | ×0.90 |
   | Obstructive Apnea | more than 3 | ×0.85 |

   `groups = floor(count / 5)`; a matched band multiplies `score` by
   `weight ^ max(1, groups)`.
5. Move to the next not‑yet‑visited label and repeat.

Final `sleep_score = round(100 × Πwindow multipliers, 1 dp)`.

> Worked example (from the spec): 5 hypopnea labels within one hour → one group
> of 5 → `100 × 0.95 = 95`.

The thresholds/weights are centralized in
[`web/src/shared/constants.ts`](../web/src/shared/constants.ts) so they can be
tuned in one place.

## Stress score algorithm

Implemented in [`web/src/shared/stressScore.ts`](../web/src/shared/stressScore.ts).

- Two on‑device models each emit a **calmness** value in `[0, 1]` per tick
  (0 = extremely stressed, 1 = perfectly calm).
- Per tick, calmness = the **average** of whichever model(s) produced a value.
- `stress_score = round(mean(calmness over the session) × 100, 1 dp)` — so **100
  = perfectly calm**, 0 = extremely stressed.
- A moment is flagged **stressed** when combined calmness stays below `0.5` for
  at least 3 consecutive samples; the run's start offset is appended to
  `stressed_timestamps` (for "view the exact times when stress was labeled").

## REST surface (Butterbase auto‑api)

The web client ([`web/src/lib/butterbase.ts`](../web/src/lib/butterbase.ts))
uses Butterbase's Supabase‑style surfaces. Endpoint construction is centralized
so it is trivial to adjust if a Butterbase version differs:

| Operation | Method & path (relative to the app base URL) |
| --- | --- |
| Sign up / in / out | `POST /auth/signup`, `/auth/signin`, `/auth/signout` |
| Select rows | `GET /auto-api/<table>?<col>=eq.<val>&order=<col>.desc` |
| Insert row | `POST /auto-api/<table>` (`Prefer: return=representation`) |
| Update rows | `PATCH /auto-api/<table>?<col>=eq.<val>` |
| Upload object | `PUT /storage/<bucket>/<key>` |
| Signed URL | `GET /storage/<bucket>/<key>/signed-url` |

Requests carry `apikey: <anon>` and `Authorization: Bearer <user‑jwt or anon>`.
