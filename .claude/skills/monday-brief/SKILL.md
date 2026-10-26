---
name: monday-brief
description: One-page Monday morning brief for Active 10 — cash, last week's sales, pipeline, the week ahead on the calendar, and Darrin's top three to-dos. Use on Mondays or when Darrin asks for the weekly brief or "what's on this week".
---

# /monday-brief

Read `.claude/active10-context.md` first. Keep it to one screen; detail lives in the other skills.

## Sections

1. **Cash** — bank balance today (QB balance sheet), open AR total and how much is > 30 days,
   bills due this week (AP aging).
2. **Last week (Mon–Sun)** — wholesale orders count + revenue (`orders`, non-cancelled),
   retail revenue (QB sales), vs the week before. New customers, first orders.
3. **Needs action in the portal** — pending applications, orders `pending` not yet confirmed,
   orders shipped but not invoiced (`qb_invoice_id is null`), sample requests to ship,
   growth queue items waiting for approval (`growth_queue.approval = 'pending'`).
4. **Pipeline** — replied prospects awaiting an answer, hot leads (Explee replies in Gmail),
   abandoned carts from the last 7 days.
5. **Week ahead** — Google Calendar events this week (meetings, trade shows, payroll date,
   tax due dates within 14 days).
6. **Top 3 to-dos** — the three highest-value actions from the above, each one line with why.

## Output

Render in chat as a compact brief. If Darrin wants it emailed, create a Gmail draft to
activeformulations@gmail.com with subject `Monday brief — <date>`. To make this automatic,
offer a scheduled task (weekdays 7:30am PT) — only set it up if he says yes.
