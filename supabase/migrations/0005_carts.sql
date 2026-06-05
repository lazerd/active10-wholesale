-- ============================================================================
-- Active 10 Revenue Engine — Abandoned Cart Recovery
-- One live cart per customer, persisted so we can recover the ones left behind.
-- ============================================================================
create table if not exists carts (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid unique references customers(id) on delete cascade,
  customer_email    text,
  customer_name     text,
  items             jsonb not null default '[]'::jsonb,  -- [{product_id,name,qty,unit_price,line_total}]
  updated_at        timestamptz not null default now(),
  recovery_sent_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists carts_updated_idx on carts (updated_at desc);

alter table carts enable row level security; -- service-role only
