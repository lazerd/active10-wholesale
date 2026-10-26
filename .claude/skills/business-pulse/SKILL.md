---
name: business-pulse
description: On-demand Active 10 health check — cash, sales, and pipeline in one view plus a watch-list from every connected source (QuickBooks, Supabase, Gmail, Calendar). Use when Darrin asks "how's the business", "anything I should know", or for a quick status.
---

# /business-pulse

Read `.claude/active10-context.md` first. First list which sources are reachable this session
(QuickBooks connector, `.env.local` DB access, Gmail, Calendar, Drive) and say which are missing.

## Vital signs (each: value, trend arrow vs prior period, source)

| Area | Metric |
|---|---|
| Cash | Bank balance; 30-day forecast closing balance (`/cash-flow-snapshot` method) |
| Receivables | Open AR; % over 30 days; largest overdue account |
| Sales | Last 30 days revenue by channel (wholesale `orders`, retail QB) vs prior 30 |
| Margin | Gross margin % last full month (QB P&L) vs 3-month average |
| Customers | Active wholesale accounts (ordered in 90 days); new this month; lapsed this month |
| Pipeline | Pending applications; replied prospects; samples sent last 30 days → orders |
| Outreach engine | Emails sent / reply rate last 14 days (`growth_events` kinds `contacted` vs `reply`); queue awaiting approval |
| Inbox | Customer emails unanswered > 48h |
| Calendar | Anything in the next 7 days that needs prep |

## Watch-list

Every item that crosses a threshold: cash < 1 month of costs, AR > 60 days, revenue down > 15%,
an un-invoiced order > 7 days, a top-10 customer silent past their reorder interval, reply rate
halved, QuickBooks or Gmail token disconnected (`/api/qb/status`, `/api/gmail/status`), products
with `active = true` that Darrin has said are out of stock.

## Output

The vital-signs table, then the watch-list sorted by urgency with the skill to run next for
each (e.g. "→ /invoice-chase"). Read-only.
