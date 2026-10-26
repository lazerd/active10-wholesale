---
name: lead-triage
description: Scores inbound Active 10 leads — wholesale applications, sample requests, outreach replies, Explee campaign replies — by fit and engagement, and drafts the right follow-up for each. Use when Darrin asks to go through leads, applications, or replies.
---

# /lead-triage

Read `.claude/active10-context.md` and `templates/hot-lead-reply.md` first.

## Inbound sources

- `applications` where `status = 'pending'` (wholesale applications from the portal).
- `sample_requests` in the last 30 days.
- `outreach_prospects` with `status = 'replied'`, joined to their latest `outreach_touches`.
- Gmail: unread/unanswered replies to outreach in activeformulations@gmail.com, and any
  `from:notify@explee.com` "replied — reply now" emails (Explee goes cold in 24h — top priority).

## Score (0–100)

- **Fit (0–50):** chiropractor / PT / massage / clinic 50; gym, studio, pro shop, pharmacy 40;
  general retail 25; individual / consumer 5 (point them to getactiveten.com instead).
  +5 if their city already has an Active 10 account (social proof), −20 if the email domain
  is free-mail and there's no business name or website.
- **Engagement (0–50):** asked about pricing/ordering 50; requested samples 40; replied with a
  question 30; replied "not now" 10; auto-reply 0.

Check `customers` by email first — if they're already a customer, it's not a lead; route to
`/ticket-deflector` or note it.

## Draft follow-ups

≥ 70: same-day reply using the right variant of `templates/hot-lead-reply.md` (A for portal
leads from activeformulations@gmail.com, B for Explee shops/gyms, C for Explee clinics — Explee
replies are sent from the persona mailbox, so for those output the text for Darrin to paste
rather than a Gmail draft). 40–69: short reply + offer samples. < 40: polite one-liner or no
reply; suggest marking `dead`.

Create Gmail drafts for activeformulations@gmail.com leads (`scripts/_draft.mjs` replies
in-thread). Don't approve applications or change prospect status — list the suggested
status changes for Darrin to confirm.

## Output

Table sorted by score: lead, source, fit, engagement, score, action, draft created.
