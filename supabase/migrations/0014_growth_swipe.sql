-- ── Growth engine: swipe to approve ─────────────────────────────────────────
-- Every planned email waits for Darrin at /swipe. Right = approved (sends on
-- schedule), left = rejected (never proposed again for that lane/cycle).
alter table growth_queue add column if not exists approval text not null default 'pending';  -- pending | approved | rejected
alter table growth_settings add column if not exists require_approval boolean not null default true;

-- A left-swipe burns the dedupe key too, so the same email doesn't come back tomorrow.
drop index if exists growth_queue_dedupe;
create unique index if not exists growth_queue_dedupe on growth_queue (dedupe_key) where status in ('planned', 'sending', 'sent', 'rejected');
create index if not exists growth_queue_deck on growth_queue (plan_date, approval);
