-- ── Free-sample campaign to chiropractors ───────────────────────────────────
-- The 2026 push: one 4 oz tube + six single-use packets per practice, shipped
-- from expiring stock, tracked against a unit goal rather than a request count.
--
-- sample_requests already recorded WHO asked and a requested/shipped flag. The
-- campaign needs three more things it could not answer:
--   how many units actually left        -> tubes / packets
--   when, and where did it go           -> shipped_at / tracking
--   did the free tube turn into an order-> ordered_at (+ the prospect it came from)

alter table sample_requests
  add column if not exists tubes       int not null default 1,
  add column if not exists packets     int not null default 6,
  add column if not exists shipped_at  timestamptz,
  add column if not exists tracking    text,
  add column if not exists notes       text,
  add column if not exists ordered_at  timestamptz,
  add column if not exists prospect_id uuid references outreach_prospects (id) on delete set null;

create index if not exists sample_requests_shipped_at_idx on sample_requests (shipped_at desc);
create index if not exists sample_requests_prospect_idx  on sample_requests (prospect_id);

-- Backfill: anything already marked shipped got its units counted from the
-- campaign defaults, and is stamped with its request date rather than left
-- null, so the shipped-unit total is not silently short.
update sample_requests
   set shipped_at = coalesce(shipped_at, created_at)
 where status = 'shipped' and shipped_at is null;
