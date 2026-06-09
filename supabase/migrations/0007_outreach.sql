-- ============================================================================
-- Active 10 — Outreach Agent (AI SDR): scrape prospects, pitch, track, iterate
-- ============================================================================
create table if not exists outreach_prospects (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  business          text,
  email             text,
  phone             text,
  website           text,
  city              text,
  type              text not null default 'chiropractor',  -- chiropractor | affiliate | other
  source            text,                                   -- where we scraped it
  status            text not null default 'prospected',     -- prospected | emailed | followed_up | replied | won | dead
  notes             text,
  touch_count       int  not null default 0,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists outreach_prospects_email_idx  on outreach_prospects (lower(email));
create index if not exists outreach_prospects_status_idx on outreach_prospects (status);

-- One row per pitch generated/sent (for sequencing + winning-angle analytics).
create table if not exists outreach_touches (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid references outreach_prospects(id) on delete cascade,
  angle        text,          -- which pitch angle was used
  subject      text,
  body         text,
  status       text not null default 'draft',  -- draft | sent | replied
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists outreach_touches_prospect_idx on outreach_touches (prospect_id, created_at desc);

alter table outreach_prospects enable row level security; -- service-role only
alter table outreach_touches   enable row level security; -- service-role only
