-- ============================================================================
-- Active 10 Revenue Engine — Restock Reminders
-- Logs each "time to reorder" nudge so we don't double-send.
-- ============================================================================
create table if not exists restock_reminders (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid references customers(id) on delete cascade,
  sent_at      timestamptz not null default now()
);

create index if not exists restock_customer_idx on restock_reminders (customer_id, sent_at desc);

alter table restock_reminders enable row level security; -- service-role only
