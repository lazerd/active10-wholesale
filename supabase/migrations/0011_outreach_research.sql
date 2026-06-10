-- Cached website research per prospect, used to personalize pitches.
alter table outreach_prospects add column if not exists research text;
