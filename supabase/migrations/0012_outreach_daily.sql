-- Daily draft-and-approve cadence controls for the Outreach agent.
-- daily_quota = how many NEW first-touch drafts to prepare per weekday run.
alter table outreach_settings add column if not exists daily_quota int not null default 1;
alter table outreach_settings add column if not exists last_batch_date date;
