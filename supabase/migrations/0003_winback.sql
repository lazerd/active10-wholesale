-- ============================================================================
-- Active 10 Revenue Engine — Win-Back Automation
-- Per-customer comeback offers: AI-suggested, admin-approved, one-time codes.
-- ============================================================================
create table if not exists winback_offers (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid references customers(id) on delete cascade,
  customer_email     text not null,
  code               text not null unique,            -- one-time redemption code
  discount_pct       numeric not null,                -- 0.20 = 20%
  free_shipping      boolean not null default true,
  subject            text,
  body               text,
  reason             text,                            -- why this offer was suggested
  status             text not null default 'draft',   -- draft | sent | redeemed | expired
  sent_at            timestamptz,
  opened_at          timestamptz,
  redeemed_at        timestamptz,
  redeemed_order_id  uuid,
  revenue_recovered  numeric,
  expires_at         timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists winback_customer_idx on winback_offers (customer_id);
create index if not exists winback_code_idx     on winback_offers (upper(code));
create index if not exists winback_status_idx   on winback_offers (status);

-- Service-role only (admin routes + redemption validation). No public policies.
alter table winback_offers enable row level security;
