-- Supabase security advisor: 4 public tables had RLS disabled (anon key could
-- read/edit/delete). All server access uses the service role, which bypasses RLS.

-- QuickBooks OAuth tokens: service-role only. The old "service role" policy was
-- granted to PUBLIC with USING (true), which exposed tokens even with RLS on.
drop policy if exists "Allow service role full access" on public.qb_tokens;
alter table public.qb_tokens enable row level security;
alter table public.retail_qb_tokens enable row level security;
alter table public.retail_sync_log enable row level security;

-- Applications: existing policies (anon insert, admin select/update) stay.
alter table public.applications enable row level security;

revoke all on public.qb_tokens, public.retail_qb_tokens, public.retail_sync_log from anon, authenticated;
