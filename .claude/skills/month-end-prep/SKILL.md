---
name: month-end-prep
description: Active 10 month-end close checklist — reconciles wholesale orders and Shopify sales against QuickBooks, finds orders never invoiced, mismatched SKUs, and uncategorised transactions. Use at month end or when Darrin asks to reconcile or "close the books".
---

# /month-end-prep

Read `.claude/active10-context.md` first. Default period = last full calendar month.

## Checks

1. **Wholesale orders vs QuickBooks invoices**
   ```sql
   select order_number, customer_name, total, status, qb_invoice_id, created_at
   from orders where created_at >= '<start>' and created_at < '<end>' and status <> 'cancelled'
   order by created_at;
   ```
   - `qb_invoice_id is null` → not invoiced (list them; invoicing goes through `/api/qb/create-invoice`).
   - For invoiced ones, `qbo_sales_get_invoices` → flag any where QB total ≠ `orders.total`.
2. **SKU mapping** — run `node scripts/qb-sku-audit.mjs` (read-only) and report products whose
   `qb_sku` doesn't resolve to a QB item.
3. **Shopify (retail) vs QuickBooks** — sales by product in QB for the period
   (`qbo_accounting_get_sales_by_product_summary`) vs what the activeten-sync log recorded. If
   the sync app's data isn't available, compare month-over-month and flag big swings or a
   week with zero retail sales (a stalled sync).
4. **Uncategorised / suspense** — from the P&L and balance sheet: Uncategorized Income/Expense,
   Ask My Accountant, Undeposited Funds older than 7 days, Shopify clearing account not near zero.
5. **AR / AP sanity** — invoices over 90 days (write-off candidates?), bills with no due date.
6. **Cancelled orders** that still have a `qb_invoice_id` (invoice should be voided).

## Output

A checklist with ✅/⚠️ per check, the exception list for each ⚠️, and the fix each needs.
Propose fixes only — don't create, void, or recategorise anything in QuickBooks without a yes.
