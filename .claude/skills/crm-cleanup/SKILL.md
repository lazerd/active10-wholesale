---
name: crm-cleanup
description: Finds stale and duplicate records across Active 10's customer and prospect tables — duplicate customers, prospects who are already customers, stuck outreach, customers missing a QuickBooks link — and fixes only what Darrin approves. Use for CRM hygiene, dedupe, or "clean up the lists".
---

# /crm-cleanup

Read `.claude/active10-context.md` first. Read everything; change nothing until approved.

## Findings

1. **Duplicate customers** — same lower(email), or same business + city, or same phone digits.
2. **Prospects that are already customers** — `outreach_prospects` whose lower(email) matches
   a `customers` row but `status <> 'won'` (they may still be getting cold email — check
   `growth_queue` for pending sends to them and flag urgently).
3. **Stale outreach** — `status in ('emailed','followed_up')` with `last_contacted_at` > 45 days
   and `touch_count >= 3` → candidates for `dead`.
4. **Applications never actioned** — `applications.status = 'pending'` older than 7 days.
5. **Customers missing QuickBooks link** — `qb_customer_id is null` and `total_orders > 0`
   (their next invoice will fail or create a duplicate QB customer).
6. **Customer stats drift** — `customers.total_orders / total_spent / last_order_at` that don't
   match a recount from `orders` (excluding cancelled).
7. **Bad data** — invalid emails, missing city/state on customers who've ordered (shipping),
   bounced addresses (search Gmail for `from:mailer-daemon` mentioning them) not yet in
   `growth_suppression`.

## Fix plan

Present a numbered list grouped by finding with the exact change each would make (the SQL,
or the admin action such as "Sync to QB"). Ask Darrin to approve by number. Then:
- Run approved DB changes with `node scripts/dbrun.mjs "<sql>"`, one statement per approved
  item, inside `begin; … commit;`, and show row counts.
- Never delete a customer with orders — merge by repointing `orders.customer_id` and marking
  the duplicate, and only with explicit approval (deleting a customer also deletes their login).
- QuickBooks links go through the admin "Sync to QB" (`/api/qb/sync-customer`), not raw SQL.

## Output

Findings table (category, count, examples), then the approval list, then what was changed.
