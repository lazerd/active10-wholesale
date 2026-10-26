---
name: quarterly-review
description: Full Active 10 quarterly business review — revenue by channel, margin, customer health, pipeline, and what's working in outreach — as a narrative deck or document. Use when Darrin asks for a QBR, quarterly review, investor/board update, or "how did the quarter go".
---

# /quarterly-review

Read `.claude/active10-context.md` first. Default = last completed quarter vs prior quarter
and same quarter last year.

## Numbers

- **P&L** (`profit_loss_quickbooks_account`): revenue, COGS, gross margin, opex, net — this Q,
  last Q, same Q last year.
- **Revenue by channel:** wholesale from `orders` (non-cancelled `total`), retail Shopify from
  QB sales by product minus wholesale invoices. Break wholesale out by customer `type`.
- **Product mix:** top products by revenue and units (see `/margin-analyser` query), plus any
  products turned off/on (`products.active`).
- **Customer health:** active accounts (ordered in the quarter), new accounts, repeat rate,
  average order value, tier mix (`tier_name`), churned (ordered prior Q, not this Q), top 10
  customers and concentration (% revenue from top 5).
- **Growth engine:** prospects added, emails sent (`growth_events` / `outreach_touches`), reply
  rate, samples sent, applications, conversions to first order; winback offers sent vs redeemed
  and `revenue_recovered`; referrals and affiliate revenue.
- **Cash:** ending cash, AR days, AP days (balance sheet + aging).

## Narrative

Write it as a story, not a data dump: headline (one sentence), 3 wins, 3 concerns, what
changed and why, and 3 priorities for next quarter with an owner and a number to hit. Use
`/customer-pulse` themes if run recently.

## Format

Ask: deck or document. Deck → use the Slides artifact type / pptx skill; document → a doc.
Use the `dataviz` skill for charts (revenue by channel, customer cohort, funnel). Every chart
cites its source. Save the final file to Google Drive `Active 10 / QBR` only after approval.
