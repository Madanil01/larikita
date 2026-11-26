-- Jalankan sekali di Neon SQL Editor (atau: npm run db:setup)
create table if not exists users (
  id                    serial primary key,
  email                 text,
  password_hash         text,
  name                  text not null,
  avatar                text,
  timezone              text not null default 'Asia/Jakarta',
  -- aplikasi Strava milik user sendiri (kosong = pakai STRAVA_CLIENT_ID/SECRET dari env)
  strava_client_id      text,
  strava_client_secret  text,            -- terenkripsi (AES-GCM)
  strava_webhook_id     bigint,
  -- koneksi Strava (kosong = belum tersambung)
  strava_id             bigint unique,
  access_token          text,
  refresh_token         text,
  expires_at            integer,
  last_sync_at          timestamptz,
  created_at            timestamptz not null default now()
);

-- Migrasi dari versi lama (login hanya via Strava). Aman dijalankan berulang.
alter table users add column if not exists email text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists strava_client_id text;
alter table users add column if not exists strava_client_secret text;
alter table users add column if not exists strava_webhook_id bigint;
alter table users alter column strava_id drop not null;
alter table users alter column access_token drop not null;
alter table users alter column refresh_token drop not null;
alter table users alter column expires_at drop not null;
create unique index if not exists users_email_key on users (lower(email));

create table if not exists plans (
  id                  serial primary key,
  user_id             integer not null references users(id) on delete cascade,
  race_name           text not null,
  race_date           date not null,
  race_km             real not null default 42.195,
  goal_title          text,
  target_sec          integer not null,
  start_date          date not null,
  runs_per_week       integer not null,
  current_weekly_km   real not null,
  peak_weekly_km      real not null,
  total_weeks         integer not null,
  created_at          timestamptz not null default now()
);
-- Migrasi: kategori jarak (5 / 10 / 21.0975 / 42.195). Rencana lama dianggap maraton.
alter table plans add column if not exists race_km real not null default 42.195;
-- Migrasi: hari lari pilihan user (0 = Senin … 6 = Minggu), hari long run, jumlah strength per minggu
alter table plans add column if not exists run_days text;
alter table plans add column if not exists long_day integer;
alter table plans add column if not exists strength_per_week integer not null default 0;
-- Migrasi: mode push (pace dipercepat X%)
alter table plans add column if not exists push_pct integer not null default 0;
alter table plans add column if not exists push_all boolean not null default false;
-- Migrasi: boleh lebih dari satu rencana per user (mis. 10K bulan Maret dan HM bulan Mei)
alter table plans drop constraint if exists plans_user_id_key;
create index if not exists plans_user on plans(user_id, race_date);

create table if not exists sessions (
  id            serial primary key,
  plan_id       integer not null references plans(id) on delete cascade,
  date          date not null,
  week          integer not null,
  phase         text not null,
  type          text not null,
  title         text not null,
  distance_km   real not null,
  pace_sec      integer,
  target_sec    integer,
  notes         text
);
create index if not exists sessions_plan_date on sessions(plan_id, date);

create table if not exists activities (
  id              bigint primary key,
  user_id         integer not null references users(id) on delete cascade,
  name            text,
  sport_type      text not null,
  start_date      timestamptz not null,
  local_date      date not null,
  distance_m      real not null default 0,
  moving_time_s   integer not null default 0,
  elapsed_time_s  integer not null default 0,
  avg_hr          real,
  elev_gain_m     real
);
create index if not exists activities_user_date on activities(user_id, local_date);
-- Migrasi: aktivitas yang dicatat manual di aplikasi (id negatif dari sequence, supaya tidak bentrok dengan id Strava)
alter table activities add column if not exists manual boolean not null default false;
create sequence if not exists manual_activity_seq;

create table if not exists analyses (
  user_id     integer not null references users(id) on delete cascade,
  date        date not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, date)
);

-- Migrasi: sesi yang diubah/ditambah manual di Jadwal (akan tertimpa kalau rencana dibuat ulang)
alter table sessions add column if not exists edited boolean not null default false;
