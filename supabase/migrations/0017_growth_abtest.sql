-- ── Growth engine: cold outreach runs itself + daily A/B testing ────────────
-- Cold first letters (chiro, club) and the one cold bump are auto-approved and
-- ramp 5 → 25 a day. Customer lanes (restock, win-back, samples) stay on the
-- swipe deck. Each cold letter is one of several "variants"; the engine splits
-- sends between them and shifts volume toward whichever earns replies.

alter table growth_settings add column if not exists auto_lanes text[] not null default '{chiro,club,cold_bump}';
alter table growth_settings add column if not exists cold_start_date date;
alter table growth_settings add column if not exists cold_ramp int[] not null default '{5,10,15,20,25}';
alter table growth_settings add column if not exists last_challenger_date date;

create table if not exists growth_variants (
  id uuid primary key default gen_random_uuid(),
  lane text not null,                       -- chiro | club
  name text not null,                       -- "A · Founder letter"
  angle text,                               -- one line: what this version tries
  subject text,                             -- null = the built-in letter for the lane
  body text,                                -- {greeting} {business} {first_name}; null = built-in
  status text not null default 'active',    -- active | proposed | retired | rejected
  source text not null default 'darrin',    -- darrin | ai
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists growth_variants_lane on growth_variants (lane, status);
alter table growth_variants enable row level security;

alter table growth_queue add column if not exists variant_id uuid references growth_variants(id);
create index if not exists growth_queue_variant on growth_queue (variant_id) where variant_id is not null;

-- Starting lineup. A is the 9/8 letter unchanged (the control).
insert into growth_variants (lane, name, angle, subject, body) select * from (values
  ('chiro', 'A · Founder letter (control)', 'The long 9/8 letter that earned the first replies', null, null),
  ('chiro', 'B · Just the samples', 'Three lines: who I am, free samples, reply with an address',
   'free samples for {business}?',
   E'{greeting}\n\nI make Active 10, a topical pain relief cream. Chiropractors were our very first customers and a lot of practices sell it right at the front desk.\n\nCan I mail you a few free samples? Try it yourself, hand a couple to patients, and see what they think. Just reply with the best address.\n\nThanks,\nDarrin Cohen\nFounder, Active 10\n800-636-4130'),
  ('chiro', 'C · Front desk revenue', 'Leads with the $99 starter kit and the retail value on the counter',
   'a front desk product for {business}',
   E'{greeting}\n\nPatients use Active 10 after their adjustment and between visits, feel the difference, and come back to the front desk for more. That''s why chiropractors were our first customers.\n\nThe starter kit is 3 tubes, 3 roll-ons and 10 sample packets for $99 shipped. That''s about $240 of retail on your counter. You can set up an account in two minutes at wholesale.getactive10.com.\n\nOr if you''d rather try it first, reply with your address and I''ll mail you free samples this week.\n\nThanks,\nDarrin Cohen\nFounder, Active 10\n800-636-4130'),
  ('chiro', 'D · Question first', 'Opens with a question about what patients use at home',
   'what do your patients use between visits?',
   E'{greeting}\n\nWhen patients ask what they should put on it between visits, what do you tell them?\n\nA lot of DCs hand them Active 10. It''s a topical pain relief cream I make, and chiropractors were our very first customers.\n\nI''d be glad to mail you free samples so you can try it yourself first. Just reply with where to send them.\n\nThanks,\nDarrin Cohen\nFounder, Active 10\n800-636-4130'),
  ('club', 'A · Founder letter (control)', 'The DCA founder letter from Darrin and June', null, null),
  ('club', 'B · Just a sample', 'Short: fellow director, free sample for the pro shop',
   'a free sample for the pro shop',
   E'{greeting}\n\nI''m Darrin, a fellow tennis director and the founder of Active 10, a topical recovery cream. Sore players buy it right off the pro shop counter.\n\nCan I send you a free sample for the shop? Just reply with where to send it.\n\nThanks,\nDarrin & June\nActive 10')
) as v(lane, name, angle, subject, body)
where not exists (select 1 from growth_variants);
