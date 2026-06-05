-- Let a logged-in user read ONLY their own affiliate row, so the app can detect
-- the affiliate role client-side. All aggregate/commission data still flows
-- through service-role server routes; this exposes nothing but the user's own row.
drop policy if exists "affiliates_self_select" on affiliates;
create policy "affiliates_self_select"
  on affiliates for select
  to authenticated
  using (lower(email) = lower((auth.jwt() ->> 'email')));
