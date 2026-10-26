---
name: canva-creator
description: Turns an Active 10 content calendar into ready-to-design posts — captions, hashtags, image/design briefs (Canva-ready), alt text — and stages them for scheduling. Active 10 has no Canva connector, so this produces design briefs and copy, not the designs. Use when Darrin asks for social posts, captions, or creative for the calendar.
---

# /canva-creator

Read `.claude/active10-context.md` first. Input: a calendar from `/content-strategy`, or a
topic + number of posts.

## Per post

- **Hook** (first line, ≤ 10 words) and **caption** (≤ 80 words, Darrin's plain voice, one CTA:
  "Shop at getactiveten.com" for retail, "Wholesale at wholesale.getactive10.com" for B2B).
- **Hashtags** (5–8, mix of broad and niche: #painrelief #pickleball #chiropractor …).
- **Design brief** for Canva: format (1080×1350 feed, 1080×1920 story), layout, headline text
  on the image (≤ 6 words), which product shot (check `public/` and `marketing/assets/` for
  existing images and name the file), brand colors from the storefront, and a reference to a
  template if Darrin has one.
- **Alt text.**
- **Compliance check:** no disease/cure claims, no before/after medical claims, no THC.

## Calendar + staging

Produce a table (date, channel, hook, caption, design brief, asset file). Save it as a Google
Sheet/Doc in Drive `Active 10 / Social` on approval, and create Google Calendar reminders on
the post dates only if Darrin asks. If an image can be generated locally from existing assets
(like `marketing/dca-offer.svg`), offer to make it; otherwise leave the brief for Canva.

Nothing is posted — Darrin (or his scheduler) publishes.
