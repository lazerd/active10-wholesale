-- Invoice chaser: emails open QuickBooks invoices (QB's own email, with the Pay
-- now link) when they were never sent, then resends on a schedule until paid.
-- Off until Darrin approves the first preview (enabled = false).
create table if not exists invoice_chaser_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  resend_days int not null default 7,
  max_resends int not null default 4,
  window_days int not null default 60,          -- ignore invoices older than this
  exclude_customers text[] not null default '{}', -- QB customer display names
  run_after_minutes int not null default 540,   -- 9:00am PT
  last_run_date date
);
insert into invoice_chaser_settings (id) values ('default') on conflict do nothing;

create table if not exists invoice_chaser_log (
  id bigserial primary key,
  invoice_id text not null,
  doc_number text,
  customer text,
  email text,
  balance numeric,
  kind text not null,            -- 'first' | 'resend'
  sent_at timestamptz not null default now()
);
create index if not exists invoice_chaser_log_inv on invoice_chaser_log (invoice_id);

alter table invoice_chaser_settings enable row level security;
alter table invoice_chaser_log enable row level security;
