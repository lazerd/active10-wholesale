-- ── Growth engine: learn from swipes ────────────────────────────────────────
-- reject_reason: the one-tap chip after a left swipe.
-- growth_templates: Darrin's own rewrite of a lane's email, generalized with
-- {{placeholders}}; the planner uses it for every future email in that lane.
alter table growth_queue add column if not exists reject_reason text;

create table if not exists growth_templates (
  lane       text primary key,
  subject    text not null,
  body       text not null,
  source     text,
  updated_at timestamptz not null default now()
);
alter table growth_templates enable row level security;
