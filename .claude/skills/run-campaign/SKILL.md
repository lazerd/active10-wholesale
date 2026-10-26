---
name: run-campaign
description: End-to-end Active 10 email campaign — picks the target segment from sales data, writes the brief and the email(s), prepares creative, and stages the send through the existing growth/outreach queue or Gmail drafts for approval. Use when Darrin asks to run a campaign, promo, or email blast.
---

# /run-campaign

Read `.claude/active10-context.md` first. Pairs with `/content-strategy` (angle) and
`/canva-creator` (creative).

## 1. Analyse

Pick the objective with Darrin (reactivate lapsed wholesale, push a product, land new verticals,
retail promo). Size the segment with SQL, e.g. lapsed wholesale:
```sql
select c.id, c.name, c.business, c.email, c.type, c.last_order_at, c.total_spent
from customers c
where c.status = 'active' and c.last_order_at < now() - interval '90 days'
  and lower(c.email) not in (select email from growth_suppression)
order by c.total_spent desc;
```
Note who already has an open `winback_offers` (status `draft`/`sent`) — don't double-offer.

## 2. Brief

Objective, segment + count, offer (must be margin-safe — check `/margin-analyser`; tiers already
give 10–20%), angle (best-performing `outreach_touches.angle` / `growth_variants`), timeline,
success metric.

## 3. Write

Subject line A/B (two options), preview text, body (≤ 120 words, one CTA), personalisation
tokens (first name, business, last product bought). Follow `templates/hot-lead-reply.md` voice.
Creative via `/canva-creator` if the email needs an image.

## 4. Stage — never send

Use the machinery that already exists in this repo instead of a new sender:
- **Email to customers or prospects → the growth swipe deck.** Write a one-off
  `scripts/queue-<campaign>.ts` modeled on `scripts/queue-case-deal.ts` (dry run by default,
  `--write` to insert; reuses `src/lib/growth/config` for suppression, internal-address and
  recent-contact skips, footer and HTML). Use a lane that is **not** in
  `growth_settings.auto_lanes`, so every row waits for Darrin's right swipe — never insert
  rows as `approval = 'approved'` unless he says so for this campaign.
- **Personal comeback offers → `winback_offers`** drafts, reviewed in the admin Win-back tab.
- **Small lists (< 20) → Gmail drafts.**
Show the dry-run count and 2 rendered examples, and wait for approval before `--write`.

## 5. Measure (when re-run later)

Sends, replies, bounces and unsubscribes (`growth_events.kind`; opens aren't tracked), redemptions (`winback_offers.redeemed_at`,
`revenue_recovered`), and orders from the segment since send date.
