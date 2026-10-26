---
name: invoice-chase
description: Drafts overdue-invoice reminders for Active 10 wholesale accounts in the right tone per customer — gentle for good payers, firmer for repeat-late ones. Drafts only. Use when Darrin asks to chase invoices, collect AR, or follow up on unpaid orders.
---

# /invoice-chase

Read `.claude/active10-context.md` first.

## Find what's overdue

- `qbo_accounting_get_ar_aging_detail` (as of today) — every open invoice past due.
- `qbo_sales_get_invoices` for the customer's history: how many past invoices were paid late.
- Cross-reference the wholesale DB for context (matching on `customers.qb_customer_id` or email):
  ```sql
  select c.name, c.business, c.email, c.total_orders, c.total_spent, c.last_order_at
  from customers c where c.qb_customer_id = '<id>' or lower(c.email) = lower('<email>');
  ```
- Search Gmail (`from:<email> OR to:<email>`) for a recent payment promise, dispute, or
  "check is in the mail" — if there is one, don't chase; note it instead.

## Pick the tone

| Payer | Signal | Tone |
|---|---|---|
| Good | ≤ 1 late invoice ever, < 30 days over | Friendly heads-up, assume it slipped. Offer the QB payment link. |
| Slow | 2+ late, or 30–60 days over | Direct: amount, invoice #, due date, ask for a pay date. |
| Repeat late | 3+ late, or 60+ days over | Firm: amount, age, next orders will need card/prepay until current. |

Never threaten collections or legal action in a draft — flag it for Darrin instead.

## Draft

One email per customer (combine multiple invoices). Subject: `Invoice <#> — Active 10`.
Include amount, invoice number, original date, and a payment link (`qbo_sales_get_payment_links`
or create one only after approval). Sign as Darrin per house rules. Save as **Gmail drafts**
from activeformulations@gmail.com.

## Output

A table: customer, invoices, amount, days over, tone, draft created (y/n), and any customers
skipped because of a payment promise or dispute.
