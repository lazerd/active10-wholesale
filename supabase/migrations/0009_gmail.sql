-- Stores the connected Gmail OAuth tokens (single account, like qb_tokens).
create table if not exists gmail_tokens (
  id            text primary key default 'default',
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  email         text,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
alter table gmail_tokens enable row level security; -- service-role only
