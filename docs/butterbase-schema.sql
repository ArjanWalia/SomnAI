-- SomnAI — Butterbase (Postgres) schema.
--
-- Apply this once to the Butterbase app (app_kf3crd1822g8) via the dashboard's
-- SQL editor or the declarative /schema endpoint. Both the iOS app and the web
-- app read and write these exact tables — this file is the source of truth for
-- the cross-platform data contract (see docs/DATA-CONTRACT.md).
--
-- Heavy media never lives in a row: audio and video are stored as objects in
-- buckets and referenced by id (audio_id / video_id).

-- ---------------------------------------------------------------------------
-- users — one row per account. The auth system owns identity; this table just
-- stores the email (per spec) and links sessions to a user.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sleep_sessions — one row per night, recorded on the phone.
-- Label columns hold arrays of offsets (seconds from the recording start) of
-- the 10-second windows the classifier tagged.
-- ---------------------------------------------------------------------------
create table if not exists sleep_sessions (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null references users (id) on delete cascade,
  date                          date not null,                 -- (Date)
  start_ts                      timestamptz not null,          -- (Timestamp)
  end_ts                        timestamptz not null,          -- (End Timestamp)
  sleep_score                   real not null,                 -- (Sleep score) 0–100
  audio_id                      text,                          -- (audio_ID) -> audio bucket object key
  hypopnea_timestamps           double precision[] not null default '{}',           -- (Hypopnea timestamps)
  obstructive_apnea_timestamps  double precision[] not null default '{}',           -- (Obstructive hypopnea timestamps)
  snoring_timestamps            double precision[] not null default '{}',           -- (Snoring timestamps)
  created_at                    timestamptz not null default now()
);
create index if not exists sleep_sessions_user_start
  on sleep_sessions (user_id, start_ts desc);

-- ---------------------------------------------------------------------------
-- stress_sessions — one row per work session, recorded on the computer (web).
-- Video lives in the video bucket; audio in the audio bucket.
-- ---------------------------------------------------------------------------
create table if not exists stress_sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users (id) on delete cascade,
  date                 date not null,                 -- (Date)
  start_ts             timestamptz not null,          -- (Start Timestamp)
  end_ts               timestamptz not null,          -- (End Timestamp)
  stress_score         real not null,                 -- (Stress score) 0–100, 100 = calm
  video_id             text,                          -- (video_ID) -> video bucket object key
  audio_id             text,                          -- (audio_ID) -> audio bucket object key
  stressed_timestamps  double precision[] not null default '{}',  -- (Stressed timestamps)
  created_at           timestamptz not null default now()
);
create index if not exists stress_sessions_user_start
  on stress_sessions (user_id, start_ts desc);

-- ---------------------------------------------------------------------------
-- Row-level security: each user sees only their own rows. Adjust the auth uid
-- function name to whatever Butterbase exposes (e.g. auth.uid()).
-- ---------------------------------------------------------------------------
alter table users           enable row level security;
alter table sleep_sessions  enable row level security;
alter table stress_sessions enable row level security;

create policy users_self on users
  for all using (id = auth.uid());
create policy sleep_owner on sleep_sessions
  for all using (user_id = auth.uid());
create policy stress_owner on stress_sessions
  for all using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets (create via the Butterbase storage dashboard/API):
--   session-audio : sleep + stress audio (e.g. webm/opus, m4a). Private.
--   stress-video  : work-session video (webm/mp4). Private, served via presigned URLs.
-- Audio is kept out of the more expensive video bucket so the database and the
-- video store stay lean.
-- ---------------------------------------------------------------------------
