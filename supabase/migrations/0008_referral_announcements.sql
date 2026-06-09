-- Tracks which customers have been emailed the "refer a practice" announcement,
-- so the admin "Announce" button never double-sends.
create table if not exists referral_announcements (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid unique references customers(id) on delete cascade,
  sent_at      timestamptz not null default now()
);
alter table referral_announcements enable row level security; -- service-role only
