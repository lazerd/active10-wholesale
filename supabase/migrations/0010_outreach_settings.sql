-- Persistent pitch-writing rules for the Outreach agent (single row).
-- e.g. "Sign as: Darrin, then 'Active Formulations Inc. CEO' on the next line"
create table if not exists outreach_settings (
  id                    text primary key default 'default',
  standing_instructions text,
  updated_at            timestamptz not null default now()
);
alter table outreach_settings enable row level security; -- service-role only
