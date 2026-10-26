---
name: cash-flow-snapshot
description: Active 10 30/60/90-day cash forecast with risk flags, built from QuickBooks (cash, AR/AP aging, P&L run-rate) plus wholesale orders not yet invoiced. Use when Darrin asks about cash, runway, "can we afford X", or a cash forecast.
---

# /cash-flow-snapshot

Read `.claude/active10-context.md` first.

## Gather (read-only)

1. **Cash on hand** — `qbo_accounting_get_balance_sheet` (today): bank + undeposited funds.
   Note any Shopify clearing/payout account balance separately; it is cash in transit.
2. **Money coming in**
   - `qbo_accounting_get_ar_aging_summary` → open AR by bucket (current, 1-30, 31-60, 61-90, 90+).
   - Wholesale orders shipped/confirmed but **not invoiced yet**:
     ```sql
     select order_number, customer_name, total, status, pay_method, created_at
     from orders where qb_invoice_id is null and status in ('confirmed','shipped','delivered')
     order by created_at;
     ```
   - Retail run-rate: `profit_loss_quickbooks_account` (or `qbo_accounting_get_sales_by_product_summary`)
     for the last 90 days → average weekly retail (Shopify) income.
3. **Money going out**
   - `qbo_accounting_get_ap_aging_summary` → bills due by bucket.
   - Last 90 days of expenses from the P&L → monthly run-rate for recurring costs
     (COGS/inventory buys, shipping, ad spend, software, payroll).
   - Payroll: `qbo_payroll_get_pay_schedules` + `qbo_payroll_get_company_last_payroll_run`
     if payroll is on QuickBooks.

## Forecast

Build three windows (0–30, 31–60, 61–90 days):

`opening cash + expected collections − expected payments = closing cash`

- Collections: AR weighted by age (current 95%, 1-30 85%, 31-60 60%, 61-90 35%, 90+ 10% —
  say these are assumptions) + un-invoiced wholesale orders + retail run-rate.
- Payments: AP by due date + recurring run-rate + payroll dates.

## Risk flags

Flag any of: a window closing below one month of fixed costs; one customer > 25% of open AR;
any AR over 60 days; un-invoiced orders older than 7 days (CLAUDE.md: orders must be invoiced
via `/api/qb/create-invoice`); retail run-rate down > 15% vs prior 90 days; a large
inventory/production buy due inside 30 days.

## Output

One table (opening, in, out, closing per window), then the top 3 risks, each with the next
action (usually: run `/invoice-chase`, invoice the listed orders, or delay a bill). State the
source and date of every figure. No writes.
