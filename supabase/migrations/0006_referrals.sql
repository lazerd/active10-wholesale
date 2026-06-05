-- ============================================================================
-- Active 10 Revenue Engine — "Grow the Network" Customer Referral Program
-- Customers refer peer practices for a one-time $100 store credit (paid only
-- after the referred practice's first order is confirmed; expires in 12 months).
-- ============================================================================

-- Each customer gets a personal referral code + remembers who referred them.
alter table customers    add column if not exists referral_code text unique;
alter table customers    add column if not exists referred_by_customer_id uuid references customers(id) on delete set null;
-- Applications capture the referring customer's code (before a customer exists).
alter table applications add column if not exists referred_by_code text;

-- Referral records.
create table if not exists referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_customer_id  uuid references customers(id) on delete cascade,
  referred_email        text not null,
  referred_name         text,
  referred_customer_id  uuid references customers(id) on delete set null,
  status                text not null default 'invited',  -- invited | joined | qualified | expired
  reward_amount         numeric not null default 100,
  created_at            timestamptz not null default now(),
  joined_at             timestamptz,
  qualified_at          timestamptz
);
create index if not exists referrals_referrer_idx on referrals (referrer_customer_id);
create index if not exists referrals_email_idx    on referrals (lower(referred_email));

-- Store-credit ledger. Positive = grant, negative = redemption.
create table if not exists customer_credits (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references customers(id) on delete cascade,
  amount       numeric not null,
  kind         text not null,                       -- referral_reward | redemption | adjustment
  status       text not null default 'available',   -- pending | available | used | expired | applied
  referral_id  uuid references referrals(id) on delete set null,
  order_id     uuid,
  note         text,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists customer_credits_customer_idx on customer_credits (customer_id, status);

-- Referral welcome offers reuse the winback_offers table + redemption engine.
alter table winback_offers add column if not exists sample_packets int not null default 0;
alter table winback_offers add column if not exists kind text not null default 'winback'; -- winback | referral_welcome

alter table referrals        enable row level security; -- service-role only
alter table customer_credits enable row level security; -- service-role only
