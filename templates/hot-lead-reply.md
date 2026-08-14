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

Sure — quick rundown.

We make a topical pain cream, two versions. Original is the standard
one. PLUS is stronger and has turmeric in it. Neither has any THC.
Comes as a 3oz roll-on, a 4oz tube, or an 8oz pump.

Most places end up with roll-ons for people to take with them and a
pump or two for whoever's doing the hands-on work.

It all lives on our wholesale site, wholesale.getactive10.com. I can
open an account for you today and then you just order direct whenever
you need to, without going through me. Wholesale is half of retail, so
the Original roll-on is $12.48 to you and sells at $24.95, the 4oz
tube is $14.98 against $29.95, the 8oz pump $17.98 against $35.95.
PLUS is $19.98 for the roll-on or the tube, $34.98 for the pump. The
site takes another 10% off anything over $150, 15% over $300, 20% over
$1,000, and the minimum order is $50, so there's no big opening buy.

One other thing worth mentioning. We also do private label, meaning
it's your name on the tube instead of ours. Minimum is $1,000, we do
the label design for free, and a first run ships in about two weeks.
Worth a thought if you already put your own brand on things.

Honestly the easiest thing is to just try it. Tell me where to send
samples and who should get them and I'll put a pump and a couple
roll-ons in the mail this week.

<persona first name>
```

Three jobs, in order: get them onto **wholesale.getactive10.com** with an account so they can
reorder without a human in the loop, plant **private label** as a second door, and land the
free-samples ask. Private-label terms ($1,000 minimum, free label design, first run in ~2 weeks)
match Darrin's own private-label outreach — keep them consistent.

**Keep it sounding human.** Darrin's read on the earlier draft: "it's just so AI." What fixed it:
prices in sentences instead of an aligned column of retail-vs-cost, no ALL-CAPS section headers,
contractions throughout, a couple of throwaway words ("sure", "honestly", "quick rundown"), one
ask at the end instead of two, and a bare first-name sign-off with no "Best,". Resist the urge to
tidy this back into a spec sheet — the tidiness is the tell.

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
