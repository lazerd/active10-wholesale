---
name: tax-prep
description: Active 10 quarterly estimated-tax calculation, or the year-end packet for the accountant (P&L, balance sheet, 1099 vendor list, sales-tax notes). Use when Darrin asks about estimated taxes, quarterly payments, 1099s, or year-end for the CPA.
---

# /tax-prep

Read `.claude/active10-context.md` first. Ask which mode if unclear: **quarterly** or **year-end**.
This is prep for a CPA, not tax advice — say so once in the output.

## Quarterly estimate

1. YTD P&L (`profit_loss_quickbooks_account`) and the same period last year.
2. Annualise YTD net income (or use last year's if Darrin prefers the safe-harbor method:
   100%/110% of prior-year tax).
3. Ask the entity type (Active Formulations Inc. — C-corp vs S-corp changes everything) and the
   rate to use if not known; don't assume.
4. Estimate = annualised taxable income × rate × (quarters elapsed / 4) − payments already made
   (look for estimated-tax payments in the expense/equity accounts).
5. Due dates: Apr 15, Jun 15, Sep 15, Jan 15 (federal; corporations use the 15th of months
   4, 6, 9, 12 of the fiscal year). Note state (California) equivalents.

## Year-end packet

Collect into one Google Drive folder `Active 10 — Tax <year>` (create only after approval):
- Full-year P&L and balance sheet (QB).
- AR aging and AP aging at 12/31.
- 1099 candidates: vendors paid ≥ $600 for services (contractors, designers, affiliates —
  check `affiliate_payouts`) who aren't corporations. List name, total paid, W-9 on file? (ask).
- Inventory on hand at year end (QB item list with quantity × cost).
- Sales-tax note: wholesale sales are for resale (should have resale certs); retail Shopify
  sales tax collected by state from QB.
- Payroll: `qbo_payroll_get_tax_filings_summary` if on QB payroll.
- Open questions list for the CPA (uncategorised items from `/month-end-prep`).

## Output

Quarterly: the calc table and amount due by date. Year-end: the packet index with what's
done vs missing.
