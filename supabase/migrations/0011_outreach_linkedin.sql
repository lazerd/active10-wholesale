-- ============================================================================
-- Active 10 — LinkedIn-assist outreach channel + self-serve sample requests
-- ============================================================================

-- ── LinkedIn channel on the existing outreach pipeline ──────────────────────
alter table outreach_prospects add column if not exists linkedin_url text;
alter table outreach_prospects add column if not exists channel text not null default 'email'; -- 'email' | 'linkedin'

-- A LinkedIn touch carries a short connection note (<=300 chars) plus a longer
-- post-accept message (stored in body). subject is unused for LinkedIn.
alter table outreach_touches add column if not exists channel text not null default 'email';
alter table outreach_touches add column if not exists connect_note text;

create index if not exists outreach_prospects_channel_idx on outreach_prospects (channel);
create index if not exists outreach_prospects_linkedin_idx on outreach_prospects (linkedin_url);
-- Note: prospect status now also allows 'connected' (LinkedIn interim, between emailed/invited and replied).

-- ── Self-serve free-sample requests ─────────────────────────────────────────
create table if not exists sample_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  business   text,
  email      text,
  phone      text,
  address    text,
  city       text,
  state      text,
  zip        text,
  type       text,
  status     text not null default 'requested',  -- requested | shipped
  created_at timestamptz not null default now()
);
create index if not exists sample_requests_status_idx on sample_requests (status);
create index if not exists sample_requests_created_idx on sample_requests (created_at desc);

alter table sample_requests enable row level security; -- service-role only
