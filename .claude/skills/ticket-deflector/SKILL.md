---
name: ticket-deflector
description: Reads a forwarded or pasted Active 10 customer email (order status, damaged item, wrong item, refund, reorder, login trouble), looks up the account and order, and drafts the reply in Darrin's voice; stages a refund or credit only with approval. Use when Darrin forwards a support email or asks to handle a customer issue.
---

# /ticket-deflector

Read `.claude/active10-context.md` first.

## 1. Understand the ticket

Get the email (pasted, or Gmail thread by search). Classify: order status / shipping,
damaged or wrong item, refund request, reorder or "send me the same", pricing question,
portal login / password, product question (usage, ingredients), wholesale vs retail confusion.

## 2. Look it up

- Wholesale: `customers` by lower(email) → their last orders (`order_number`, items, status,
  total, `qb_invoice_id`, created_at).
- Retail: no Shopify data here — search Gmail for the Shopify order confirmation for that
  email, or ask Darrin for the order number.
- Invoice/payment: `qbo_sales_get_invoices` for the customer.
- Prior conversation: the rest of the Gmail thread.

## 3. Resolve

| Case | Default resolution (needs Darrin's yes before anything happens) |
|---|---|
| Where's my order | Status from `orders.status`; if `shipped`, give tracking if it's in Gmail |
| Damaged / wrong item | Apologise, reship the item; no return needed under ~$50 |
| Refund | Wholesale: a `customer_credits` row (kind `adjustment`, status `available`) or a QB credit memo; retail: refund in Shopify (Darrin does it) |
| Reorder | Offer to place it as an admin order and send the invoice |
| Login trouble | Admin "Reset password" sends a temp password (`/api/reset-password`) |
| Retail customer on wholesale | Point to getactiveten.com |
| Usage / ingredients | Answer from product page facts; no medical claims |

## 4. Draft

Reply in Darrin's voice (short, warm, specific, no corporate apology language), as a Gmail
draft in-thread (`node scripts/_draft.mjs "<gmail search>" <bodyfile>`). Then list the
staged actions (credit amount, reship items, password reset) for approval. After approval,
carry them out and say exactly what was done.
