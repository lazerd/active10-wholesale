-- ============================================================================
-- Active 10 Revenue Engine — Affiliate / Influencer Portal
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run (idempotent: IF NOT EXISTS everywhere).
-- ============================================================================

-- Affiliates (influencers / referrers who get their own login + portal)
create table if not exists affiliates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  name             text not null,
  email            text not null unique,
  slug             text not null unique,                  -- referral code in URL, e.g. 'cymerint'
  commission_rate  numeric not null default 0.15,         -- 0.15 = 15%; per-affiliate custom
  commission_rule  text    not null default 'lifetime',   -- 'lifetime' | 'first_order' | '12_months'
  commission_base  text    not null default 'subtotal',   -- 'subtotal' (product value) | 'total'
  status           text    not null default 'active',     -- 'active' | 'paused'
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists affiliates_slug_idx  on affiliates (lower(slug));
create index if not exists affiliates_email_idx on affiliates (lower(email));

-- Referral attribution
-- Customers carry the affiliate they were referred by (set at approval time).
alter table customers    add column if not exists affiliate_id uuid references affiliates(id) on delete set null;
-- Applications capture the referral slug at submit time (before a customer exists).
alter table applications add column if not exists affiliate_slug text;

create index if not exists customers_affiliate_idx on customers (affiliate_id);

-- Payout ledger: money actually paid out to an affiliate.
-- "Owed" = (earned commission, computed from referred customers' orders) - (sum of payouts).
create table if not exists affiliate_payouts (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references affiliates(id) on delete cascade,
  amount        numeric not null,
  note          text,
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists affiliate_payouts_affiliate_idx on affiliate_payouts (affiliate_id);

-- ============================================================================
-- RLS: all affiliate data is served through server routes using the service
-- role key (which bypasses RLS), scoped to the logged-in affiliate's verified
-- session. So we keep RLS ON with NO public policies = no direct anon/customer
-- access. (The service role connects as a privileged role and is unaffected.)
-- ============================================================================
alter table affiliates        enable row level security;
alter table affiliate_payouts enable row level security;

-- Seed Dr. Cymerint so you can test immediately (edit/remove as needed):
-- insert into affiliates (name, email, slug, commission_rate, commission_rule)
-- values ('Dr. Cymerint', 'cymerint@example.com', 'cymerint', 0.15, 'lifetime')
-- on conflict (email) do nothing;
