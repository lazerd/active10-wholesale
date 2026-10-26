---
name: content-strategy
description: Mines Active 10 sales data for winning and slow-moving products and the outreach angles that get replies, then builds a 30-day content brief (social, email, blog) around them. Use when Darrin asks what to post, for a content plan, or a marketing brief.
---

# /content-strategy

Read `.claude/active10-context.md` first.

## Find the story in the data

- **Winners and slow movers:** last 90 days vs prior 90, units and revenue per product, wholesale
  (`orders.items`) and retail (QB sales by product). Winner = growing and high volume; slow mover
  = flat/declining or turned off recently.
- **Who buys:** wholesale revenue by `customers.type` and city — which verticals (chiro, PT,
  gym, pro shop, pickleball/tennis club) are growing.
- **What messages work:** reply rate by `outreach_touches.angle`, and winning variants in
  `growth_variants` / `/abtests` data (subject lines and angles that beat control).
- **Seasonality:** month-over-month retail for the last 12–24 months.
- **Customer language:** if `/customer-pulse` has run recently, reuse its quotes and themes.

## Brief (30 days)

- Goal + one number (e.g. "+15 new wholesale accounts", "+20% PLUS pump retail units").
- 2–3 audiences (e.g. clinic owners, weekend athletes, pickleball/tennis players) with the pain
  and the proof point for each.
- 3 content pillars mapped to the winners, plus one push for a slow mover (bundle, use case).
- Channel plan: Instagram/Facebook posts per week, one customer email per week to retail list,
  one wholesale email (feeds `/run-campaign`), one blog/SEO post.
- A dated 30-day calendar table: date, channel, pillar, hook, CTA, asset needed.
- Guardrails: no medical claims beyond the label ("temporary relief of minor aches and pains"
  style wording only), no THC confusion, show real customers only with permission.

## Output

The brief as a doc (save to Google Drive `Active 10 / Marketing` on approval). Hand the
calendar to `/canva-creator` if Darrin wants assets made.
