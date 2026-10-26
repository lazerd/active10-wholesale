---
name: plan-payroll
description: Before an Active 10 payday — checks cash covers payroll, ranks overdue invoices to collect first, and stages (drafts, never sends) payment reminders. Use when payroll is coming up or Darrin asks "are we good for payroll".
---

# /plan-payroll

Read `.claude/active10-context.md` first.

1. **What payroll costs and when.** `qbo_payroll_get_pay_schedules`,
   `qbo_payroll_get_company_last_payroll_run`, and `qbo_payroll_preview_payroll` for the next run
   (gross + employer taxes). If payroll is not run in QuickBooks, ask Darrin for the amount and date.
   Also check `qbo_payroll_get_company_payroll_readiness` and report anything blocking the run.
2. **Cash available by payday.** Balance sheet bank balance + collections expected before payday
   − bills due before payday (`qbo_accounting_get_ap_aging_detail`). Reuse the method in
   `/cash-flow-snapshot`.
3. **Cover ratio.** `cash available ÷ payroll cost`. ≥ 1.5 green, 1.0–1.5 amber, < 1.0 red.
4. **Collect first.** From `qbo_accounting_get_ar_aging_detail`, rank overdue invoices by
   `amount × likelihood to pay before payday` (older and larger first, but customers with a clean
   history who are just late rank high because a nudge works). Add wholesale orders with
   `qb_invoice_id is null` that should be invoiced today.
5. **Stage reminders.** For the top invoices, draft reminders using the `/invoice-chase` tone
   rules, as **Gmail drafts** (or `qbo_sales_send_invoice_reminder` only after Darrin approves
   each one). List what you staged.

## Output

Payroll date, amount, cash available, cover ratio, the ranked collect-first list, the drafts
created, and — if red — the shortfall and options (pull forward collections, delay a named bill,
short-term draw). Never run or submit payroll.
