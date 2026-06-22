# SomnAI data contract

The single source of truth shared by the **iOS app** and the **web app**. Both
talk to the same Butterbase backend (`app_kf3crd1822g8`), so "syncing" the two
means agreeing on (1) the table shapes and (2) the scoring algorithms below. The
**iOS app is the canonical wire format**; the web app mirrors it
(`web/src/lib/butterbase.ts`, `web/src/shared/`).

## Identity

- **users**: `id`, `email`, `created_at`. The email is the cross-client
  identity — every sleep/stress row carries the owner's `email`. Sign-in upserts
  the email (`POST /v1/{app}/users`).

## Tables

**sleep** (written by the phone, read by both):

| column | type | notes |
| --- | --- | --- |
| id | text | UUID |
| email | text | owner |
| date | text | "MMM d" e.g. `Jun 22` |
| start_timestamp | timestamptz | absolute ISO-8601 |
| end_timestamp | timestamptz | |
| sleep_score | numeric | 0–100 |
| audio_id | text? | storage object id |
| hypopnea_timestamps | jsonb | array of absolute ISO instants |
| obstructive_timestamps | jsonb | array of absolute ISO instants |
| snoring_timestamps | jsonb | array of absolute ISO instants |

**stress** (written by the web app, read by both): same head columns plus
`stress_score`, `video_id?`, `audio_id?`, and `stressed_timestamps` (array of
absolute ISO instants).

> **Timestamps are absolute ISO-8601 instants**, matching the iOS `[Date]`
> encoding. Playback seeking derives an offset as `label − start_timestamp`. The
> sleep classifier tags fixed **10-second** windows.

## Media

- Audio (sleep + stress) and video (stress) are uploaded via the two-step
  storage flow (`POST /storage/{app}/upload` → presigned `PUT`); the returned
  object id is stored as `audio_id` / `video_id`. Rows never embed media bytes.

## REST surface (mirrors `ButterbaseClient.swift`)

| Operation | Method & path |
| --- | --- |
| Upsert user | `POST /v1/{app}/users` `{email}` |
| Select rows | `GET /v1/{app}/{table}?email=eq.<email>&order=start_timestamp.desc` |
| Insert row | `POST /v1/{app}/{table}` |
| Upload media | `POST /storage/{app}/upload` → presigned `PUT` |

All requests carry `Authorization: Bearer <token>`; JSON is snake_case, dates
ISO-8601.

## Sleep score algorithm

Implemented in `web/src/shared/sleepScore.ts` (port of `SleepScoring.swift`),
unit-tested in `sleepScore.test.ts`. Start at **100**, walk labels (the three
categories merged, sorted by start):

1. Take the earliest **not-yet-visited** label as the *anchor*.
2. Form the window `[anchor, anchor + 60 min)`.
3. Count the **same-category** labels inside it; mark them visited.
4. Apply the category's weight once **per group** (of 5; obstructive uses 3),
   at least once when the band qualifies:

   | Category | Condition (count in window) | Weight |
   | --- | --- | --- |
   | Snoring | more than 5 | ×0.995 |
   | Hypopnea | 5–14 | ×0.95 |
   | Hypopnea | 15 or more | ×0.90 |
   | Obstructive Apnea | more than 3 | ×0.85 |

5. Continue with the next unvisited label.

`sleep_score = round(100 × Π multipliers, 1dp)`.

> Worked example (from the spec): 5 hypopnea within one hour → one group of 5 →
> `100 × 0.95 = 95`. (Unit-tested.)

## Stress score algorithm

Implemented in `web/src/shared/stressScore.ts`.

- Two on-device models each emit **calmness** ∈ [0,1] per ~1s tick
  (0 = extremely stressed, 1 = perfectly calm).
- Per tick, calmness = the **average** of whichever model(s) produced a value.
- `stress_score = round(mean(calmness) × 100, 1dp)` → **100 = perfectly calm**.
- A moment is flagged **stressed** when combined calmness stays below `0.5` for
  ≥3 consecutive samples; the run's start offset is appended to
  `stressed_timestamps`.
