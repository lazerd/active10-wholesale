# Hot-lead reply templates

Two of them, because the leads arrive through two different channels:

- **[Variant A](#variant-a--portal-wholesale-lead)** — a chiropractor / practice replies to the
  portal's own outreach asking about availability and pricing. Sent by Darrin, in his own name.
- **[Variant B](#variant-b--explee--autogtm-campaign-lead)** — a shop, gym, or studio replies to an
  Explee / AutoGTM campaign. Sent by a persona, through Explee. **Start here for any
  `notify@explee.com` "replied — reply now" email.**

Same product facts and pricing underneath both. Re-check `src/lib/products.ts` before sending —
the catalog the app actually reads is the Supabase `products` table.

---

## Variant A — portal wholesale lead

Use when a prospect replies to outreach asking "is it available / what's the pricing?"

Before sending, check the portal DB for the sender's email:
- **Already an approved customer** → "your account is already active, log in here"
- **Application pending / not in DB** → swap that line for "I'll get an account set up for you today"
- **`total_orders = 0`** → keep the $99 intro-kit paragraph (the hero card only shows on a first order)
- **Has ordered before** → drop the intro-kit paragraph

Send from **activeformulations@gmail.com**, BCC **junemunroe@aol.com**.

**Subject:** Re: <their subject line>

```
Hi Dr. <Last name>,

Great to hear from you — yes, everything is in stock and ready to ship.

Your wholesale account is already active, so you can log in and order any time:
https://wholesale.getactive10.com

Wholesale is 50% off retail. The PLUS line:

  Active 10 PLUS Tube, 3oz      $19.98   (retail $39.95)
  Active 10 PLUS Roll-On, 3oz   $19.98   (retail $39.95)
  Active 10 PLUS Pump, 8oz      $34.98   (retail $69.95)

And the Original line, if you want it on the shelf alongside:

  Original Tube, 4oz            $14.98   (retail $29.95)
  Original Pump, 8oz            $17.98   (retail $35.95)
  Original Roll-On, 3oz         $12.48   (retail $24.95)

Volume discounts stack on top of that automatically at checkout:
$150+ takes another 10% off, $300+ 15%, $1,000+ 20%. Minimum order is $50.

Since this would be your first order, there's also an intro kit at $99
shipped — 3 PLUS tubes, 3 PLUS roll-ons, and 10 sample packets
(about $198 at retail). It shows up on your portal home page.

If it's easier, tell me what you'd like and quantities and I'll put the
order in for you and send the invoice.

Best,
Darrin Cohen
Active Formulations Inc.
(800) 636-4130
```

---

## Variant B — Explee / AutoGTM campaign lead

Use for any `notify@explee.com` email titled "<name> at <company> replied — reply now".
These are shops, gyms, studios, and resellers — not clinics. One email covers all of them;
only the greeting and the sign-off change.

**How to send:** hit Reply on the Explee notification itself. It goes out from that campaign's
outreach mailbox under that campaign's persona — never from `activeformulations@gmail.com`.
Each campaign has its own persona and mailbox, so **match the sign-off to the mailbox**:

| Persona | Mailbox | Seen on |
| --- | --- | --- |
| Anna Carter | a@meetfreshbase.com | SK8Co. (Kyle Berry) |
| Catherine Reed | c@getvox.digital | It Starts Here Fitness (Brad Lane) |

Explee says replies go cold in 24 hours — these are worth answering the day they land.

**Subject:** Re: <their subject line — keep the thread>

```
Hi <first name>,

Here's the short version.

Active 10 is a topical pain relief cream. We're Active Formulations,
family-run, and we've been making it since 2013. Two formulas:
Original, and PLUS, which is stronger and has turmeric in it. Both are
THC-free. Three sizes — a 3oz roll-on, a 4oz tube, and an 8oz pump.

How it gets used: the roll-on goes in the bag and people use it
themselves after a workout. The 8oz pump is what a trainer or massage
therapist works with hands-on. Either one also sells at the counter.

Wholesale is 50% off retail:

  Original Roll-On, 3oz    retail $24.95    your cost $12.48
  Original Tube, 4oz       retail $29.95    your cost $14.98
  Original Pump, 8oz       retail $35.95    your cost $17.98
  PLUS Roll-On, 3oz        retail $39.95    your cost $19.98
  PLUS Tube, 3oz           retail $39.95    your cost $19.98
  PLUS Pump, 8oz           retail $69.95    your cost $34.98

Volume discounts come off automatically on top of that: $150+ takes
another 10%, $300+ 15%, $1,000+ 20%. Minimum order is $50.

Best first step is free samples — tell me where to ship them and who
should get them, and I'll send a pump and a couple of roll-ons so you
can try it before you stock anything.

Best,
<persona first name>
```

**The persona handoff.** The lead thinks they're dealing with the persona. The moment an account
or invoice appears it comes from Darrin and June at Active Formulations. Introduce him on the
next message — "I've looped in Darrin, our founder, who'll get your account set up" — so the
name change reads as a handoff rather than a surprise.

---

## Other products, if they ask

| Product | Retail | Wholesale |
| --- | --- | --- |
| Night Time Sleep Aid (drops) | $29.95 | $14.98 |
| PLUS Turmeric & Boswellia, 30 caps | $39.95 | $19.98 |
| DCA Intro Kit (first order only) | $198 | $99 |

## Tiers

| Order subtotal | Tier | Extra off |
| --- | --- | --- |
| under $150 | STARTER | — |
| $150+ | PRO | 10% |
| $300+ | PRO+ | 15% |
| $1,000+ | ELITE | 20% |

Payment fees at checkout: card 2.99%, ACH 1%, check 0%. Minimum order $50.

## Notes

- **Never write "CBD" or "Hemp"** — dropped from all product copy 2026-08-12 (commit 3fb07d2).
  The line is **PLUS**. If a prospect uses the word CBD themselves, answer them without
  repeating it; "PLUS formula, THC-free" is the phrasing.
- Don't make medical claims. "Professional-grade topical pain relief" is the ceiling.
  In particular, don't repeat **"clinically tested for joint and muscle relief"** — it appears in
  the live Explee outbound copy, nothing on file substantiates it, and it's the kind of claim FTC
  and FDA pursue on a topical marketed to athletes.
- The Explee outbound copy also still says "CBD-infused" and "hemp oil", against the 2026-08-12
  decision. Keep both words out of the replies regardless of what the outbound said.
- Variant A first used 2026-08-14 (Dr Gerald Butrimovitz, moneydoctor@gmail.com).
  Variant B first used 2026-08-14 (Kyle Berry at SK8Co., Brad Lane at It Starts Here Fitness).
