# Hot-lead reply template

Use when a prospect replies to outreach asking "is it available / what's the pricing?"

Before sending, check the portal DB for the sender's email:
- **Already an approved customer** → "your account is already active, log in here"
- **Application pending / not in DB** → swap that line for "I'll get an account set up for you today"
- **`total_orders = 0`** → keep the $99 intro-kit paragraph (the hero card only shows on a first order)
- **Has ordered before** → drop the intro-kit paragraph

Send from **activeformulations@gmail.com**, BCC **junemunroe@aol.com**.

Prices below are wholesale = 50% of retail per `src/lib/products.ts`. Re-check that file
before sending — the catalog the app actually reads is the Supabase `products` table.

---

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
- First used 2026-08-14 replying to Dr Gerald Butrimovitz (moneydoctor@gmail.com).
