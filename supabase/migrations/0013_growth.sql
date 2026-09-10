-- ── Growth engine: 25 emails a day, drafted AND sent without a human ────────
-- Planner (first tick after 6am PT on weekdays) fills growth_queue with the
-- day's emails across lanes (restock, win-back, sample follow-up, cold). The
-- tick (pg_cron → /api/growth/tick every 10 min) sends what is due, one or two
-- at a time, and reads the inbox so a reply/bounce/"no thanks" stops everything
-- for that person.

create table if not exists growth_settings (
  id              text primary key default 'default',
  enabled         boolean not null default true,
  daily_cap       int not null default 25,
  lane_caps       jsonb not null default '{}'::jsonb,   -- overrides DEFAULT_CAPS in src/lib/growth/config.ts
  start_date      date,                                 -- nothing is planned before this date
  paused_on       date,                                 -- "pause today" link sets this
  window_start    int not null default 510,             -- minutes after midnight PT (8:30am)
  window_end      int not null default 930,             -- 3:30pm PT
  footer_address  text,
  digest_to       text not null default 'darrinjco@gmail.com',
  city_cursor     int not null default 0,               -- prospect discovery position
  last_plan_date  date,
  last_inbox_scan timestamptz,
  last_error      text,
  updated_at      timestamptz default now()
);

create table if not exists growth_queue (
  id                uuid primary key default gen_random_uuid(),
  plan_date         date not null,
  send_at           timestamptz not null,
  lane              text not null,
  step              int not null default 1,
  email             text not null,
  name              text,
  business          text,
  subject           text not null,
  body_text         text not null,
  body_html         text not null,
  dedupe_key        text not null,          -- one send per person per lane-step-cycle, ever
  reply_to_queue_id uuid,
  prospect_id       uuid,
  qb_customer_id    text,
  meta              jsonb not null default '{}'::jsonb,
  status            text not null default 'planned',   -- planned | sending | sent | skipped | failed | cancelled
  skip_reason       text,
  gmail_id          text,
  gmail_thread_id   text,
  message_id_header text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);
create unique index if not exists growth_queue_dedupe on growth_queue (dedupe_key) where status in ('planned', 'sending', 'sent');
create index if not exists growth_queue_due on growth_queue (status, send_at);
create index if not exists growth_queue_email on growth_queue (lower(email));

create table if not exists growth_suppression (
  email      text primary key,       -- stored lowercased
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists growth_events (
  id       uuid primary key default gen_random_uuid(),
  email    text not null,
  kind     text not null,            -- contacted | reply | bounce | unsubscribe | sample_shipped
  gmail_id text,
  at       timestamptz not null default now(),
  meta     jsonb not null default '{}'::jsonb
);
-- Not partial: PostgREST upserts can't target a partial index. NULL gmail_ids stay distinct anyway.
create unique index if not exists growth_events_gmail_kind on growth_events (gmail_id, kind);
create index if not exists growth_events_email on growth_events (lower(email), kind, at desc);

alter table growth_settings    enable row level security;
alter table growth_queue       enable row level security;
alter table growth_suppression enable row level security;
alter table growth_events      enable row level security;

insert into growth_settings (id, start_date, footer_address)
values ('default', '2026-09-14', 'Active Formulations Inc. · 1572 Hillgrade Ave, Alamo, CA 94507')
on conflict (id) do nothing;
