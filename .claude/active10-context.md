# Active 10 — shared context for the small-business skills

Every skill in `.claude/skills/` reads this first. It maps the generic "small business"
playbooks onto what Active 10 actually runs on.

## The business

Active Formulations Inc. makes Active 10, a topical pain cream in two lines: **Original**
and **PLUS** (stronger, with turmeric, no THC). Formats: 3oz roll-on, 4oz/3oz tube, 8oz pump.
Owner: Darrin Cohen, (800) 636-4130, activeformulations@gmail.com.

Three revenue channels:

| Channel | Where it lives | How Claude reads it |
|---|---|---|
| Wholesale (chiros, clinics, gyms, shops) | this repo; Supabase `orders`, `customers` | `node scripts/readonly-sql.mjs "select ..."` |
| Retail web: getactiveten.com + activeten.shop (Shopify) | synced into QuickBooks by the `activeten-sync` app | QuickBooks connector (sales by product/customer) |
| Everything, as booked | QuickBooks Online | `mcp__Intuit_QuickBooks__*` tools |

## Tool mapping (the generic plugin vs. Active 10)

| Generic plugin uses | Active 10 uses instead |
|---|---|
| QuickBooks | QuickBooks connector (P&L, balance sheet, cash flow, AR/AP aging, invoices, sales by product/customer, payroll) |
| PayPal / Stripe / Square | Shopify payouts land in QuickBooks via activeten-sync; wholesale `orders.pay_method` (`check`, `card` +2.99%, `ach` +1%) and `orders.cc_fee` |
| HubSpot (leads, deals, contacts) | Supabase: `applications` (inbound wholesale applications), `outreach_prospects` + `outreach_touches` (outbound SDR), `growth_queue` / `growth_events` (cold email lanes), `sample_requests`, `customers` |
| Gmail | Gmail connector, mailbox activeformulations@gmail.com (`scripts/_draft.mjs` drafts replies in-thread) |
| Slack | none — briefs go to chat, and optionally a Gmail draft to Darrin |
| Canva | none — produce design briefs + copy; save to Google Drive |
| Google Calendar / Drive | Google Calendar / Google Drive connectors |

If a connector a skill needs is not connected in this session, say which one and carry on
with the sources that are available. Never invent numbers to fill the gap.

## Database cheat-sheet (Supabase / Postgres)

Run **reads only** through `node scripts/readonly-sql.mjs` (it wraps every query in a
READ ONLY transaction). Needs `.env.local` with `DATABASE_URL`.

- `customers`: id, name, email, phone, business, city, state, type, status, total_orders,
  total_spent, last_order_at, created_at, qb_customer_id, referral_code, affiliate_id
- `orders`: id, order_number, customer_id, customer_name, customer_email, items (jsonb array of
  `{product_id, name, qty, unit_price, line_total}`), subtotal (pre-discount wholesale),
  tier_name, tier_discount, discount_amount, cc_fee, total, pay_method, notes, status
  (`pending` → `confirmed` → `shipped` → `delivered`, or cancelled), qb_invoice_id, created_at
- `products`: id, name, subtitle, retail, cat, active, sort_order, qb_sku — **the catalog lives
  here, not in source** (see CLAUDE.md). Wholesale = 50% of `retail`.
- `applications`: inbound wholesale applications (name, email, business, city, type, status)
- `outreach_prospects` (status: prospected | emailed | followed_up | replied | won | dead,
  touch_count, last_contacted_at, type, research) and `outreach_touches` (angle, subject, status)
- `winback_offers`, `restock_reminders`, `carts` (abandoned carts), `sample_requests`,
  `referrals`, `customer_credits`, `affiliates`, `growth_queue`, `growth_events`

Tier names: STARTER, PRO ($150+, 10%), PRO+ ($300+, 15%), ELITE ($1,000+, 20%).
Pricing facts (re-check against `products` before quoting): volume tiers on top of wholesale —
$150+ 10%, $300+ 15%, $1,000+ 20%; $50 minimum; $99 first-order intro kit; private label from
$1,000 with free label design, ~2 weeks. Kits and case deals take no tier discount.

## House rules for every skill

1. **Read freely, write only with approval.** Anything that sends email, changes a QuickBooks
   record, edits a DB row, or issues money is shown to Darrin first and done only on an
   explicit yes. Default output for anything outbound is a **Gmail draft**, never a send.
2. **Voice.** Plain, warm, short sentences, no hype — match `templates/hot-lead-reply.md`.
   Customer mail from activeformulations@gmail.com is signed:
   `Darrin Cohen / Active Formulations Inc. / (800) 636-4130`.
   Persona-channel (Explee) leads follow that template's Variant B/C rules instead.
3. **Show your sources.** Every number says where it came from (QuickBooks report + date range,
   or the SQL you ran). Flag anything that looks off rather than smoothing it over.
4. **Money is in USD; dates in America/Los_Angeles** unless QuickBooks says otherwise.
5. **PII stays out of the repo.** Write reports to the scratchpad, Google Drive, or chat —
   never commit customer lists or exports.
