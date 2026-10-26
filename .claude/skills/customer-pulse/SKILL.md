---
name: customer-pulse
description: Turns Active 10 customer emails, order notes, sample feedback, and product reviews into themes with real quotes and three concrete actions. Use when Darrin asks what customers are saying, for feedback themes, or the voice of the customer.
---

# /customer-pulse

Read `.claude/active10-context.md` first. Default window: last 60 days.

## Sources

- **Gmail** (activeformulations@gmail.com): threads from customers and prospects — exclude
  newsletters, notifications, and our own outbound. Search e.g. `newer_than:60d -from:me
  -category:promotions`, then keep threads whose sender is in `customers`, `applications`,
  `outreach_prospects`, or is a retail buyer.
- **Order notes:** `select order_number, customer_name, notes from orders where notes is not null
  and notes not like '[Admin%' and created_at > now() - interval '60 days';`
- **Outreach replies:** `outreach_prospects.status = 'replied'` → their reply text in Gmail.
- **Winback reasons** and declines (`winback_offers.reason`, replies to winback emails).
- **Retail reviews:** if Darrin pastes or exports Shopify/Amazon reviews, include them.

## Analyse

Tag each item: product (Original/PLUS, format), topic (efficacy, scent/feel, price, shipping,
packaging, ordering portal, reorder, display/merch, private label), sentiment, and customer
type. Group into 4–7 themes, each with frequency, sentiment, and 1–2 verbatim quotes
(attributed by business type and city, not name).

## Output

1. Themes table (theme, mentions, sentiment, representative quote).
2. Three actions, each specific and owned: e.g. "Add a 3-pump case deal — 4 clinics asked
   for bulk pumps", "Fix the portal password reset email — 3 customers stuck".
3. Anything urgent (a complaint unanswered > 48h, a product problem) at the top.
No customer names or emails in anything saved to Drive.
