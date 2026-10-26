---
name: call-list
description: Ranks the top 5 Active 10 accounts or leads for Darrin to call today, with talking points pulled from order history and Gmail threads. Use when Darrin asks who to call, who to follow up with, or for today's sales list.
---

# /call-list

Read `.claude/active10-context.md` first.

## Candidates (read-only)

Pull from four pools and score each person once (dedupe by lower(email)):

1. **Lapsing customers** — ordered before, gap now longer than their usual reorder interval:
   ```sql
   with o as (select customer_id, created_at, total from orders where status <> 'cancelled'),
   g as (select customer_id, count(*) n, max(created_at) last_at,
                avg(total) avg_total,
                extract(day from (max(created_at)-min(created_at)))/nullif(count(*)-1,0) avg_gap_days
         from o group by 1)
   select c.name, c.business, c.email, c.phone, c.city, g.n, g.last_at, g.avg_total, g.avg_gap_days,
          extract(day from now()-g.last_at) days_since
   from g join customers c on c.id = g.customer_id
   where g.n >= 2 and extract(day from now()-g.last_at) > coalesce(g.avg_gap_days,60)*1.2
   order by g.avg_total desc limit 20;
   ```
2. **Hot prospects** — `outreach_prospects` with `status = 'replied'`, plus `sample_requests`
   from the last 30 days that haven't become customers.
3. **New applications** — `applications` with `status = 'pending'`.
4. **Abandoned carts** — `carts` updated in the last 14 days by customers with no order since.

## Score

`value` (avg order or expected first order ~ $150) × `urgency` (days overdue, reply age,
cart age) × `warmth` (replied/sample > lapsing > application). Skip anyone with a Gmail thread
in the last 3 days where the ball is in *their* court, and anyone on `growth_suppression`.

## Talking points

For each of the top 5, read their last Gmail thread (`search_threads` on their email) and
last order items, then write: who they are (business, city, type), last contact + what was
said, what they bought and when, one specific reason to call today (e.g. "usually reorders
PLUS pumps every ~45 days, now day 62"), and an offer if appropriate (tier gap to the next
discount, intro kit for a first order, winback code if one is already drafted in
`winback_offers`).

## Output

Numbered list of 5: name · business · phone · why today · 3 talking-point bullets.
Optionally create Google Calendar holds for the calls only if Darrin asks.
