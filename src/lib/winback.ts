// Win-back offer suggestion engine. Deterministic heuristics over a customer's
// real order history — no external AI dependency (zero cost). The output shape
// matches what a future LLM call would return, so it can be swapped in later by
// replacing suggestOffer() alone.

export type WinbackInput = {
  name: string;
  business?: string | null;
  daysSinceLastOrder: number;   // Infinity if never ordered
  totalSpent: number;            // computed from real orders
  orderCount: number;
  topProduct?: string | null;    // most-ordered product name
};

export type WinbackSuggestion = {
  discount_pct: number;   // 0.20
  free_shipping: boolean;
  subject: string;
  body: string;           // HTML email
  reason: string;         // shown to admin
  tier_label: string;
};

const SITE = "https://wholesale.getactive10.com";

// Discount scales with how long they've been gone, with a bump for high-value
// accounts (worth more to win back). Free shipping is always included — it's the
// strongest reactivation hook.
function pickDiscount(daysSince: number, totalSpent: number): { pct: number; tier: string } {
  let pct: number;
  let tier: string;
  if (daysSince >= 365) { pct = 0.25; tier = "Lapsed 12+ months"; }
  else if (daysSince >= 180) { pct = 0.2; tier = "Lapsed 6–12 months"; }
  else { pct = 0.15; tier = "Lapsed 3–6 months"; }
  // High-LTV bump (cap at 25%)
  if (totalSpent >= 1000 && pct < 0.25) { pct += 0.05; tier += " · high-value"; }
  return { pct: Math.round(pct * 100) / 100, tier };
}

export function suggestOffer(c: WinbackInput): WinbackSuggestion {
  const { pct, tier } = pickDiscount(c.daysSinceLastOrder, c.totalSpent);
  const pctLabel = Math.round(pct * 100);
  const first = (c.name || "there").split(" ")[0];
  const months = c.daysSinceLastOrder === Infinity ? null : Math.round(c.daysSinceLastOrder / 30);
  const fav = c.topProduct;

  const reason =
    `${tier}. ${c.orderCount} prior order${c.orderCount === 1 ? "" : "s"}, $${c.totalSpent.toFixed(0)} lifetime` +
    (fav ? `, favorite: ${fav}` : "") +
    `. Suggested ${pctLabel}% off + free shipping.`;

  const subject = months
    ? `${first}, we miss you — ${pctLabel}% off your next order`
    : `${first}, here's ${pctLabel}% off to welcome you back`;

  // CODE is injected by the caller after a unique code is generated.
  return {
    discount_pct: pct,
    free_shipping: true,
    subject,
    reason,
    tier_label: tier,
    body: "", // built by buildEmail() once we have the code + expiry
  };
}

export function buildEmail(opts: {
  name: string;
  pct: number;
  code: string;
  expiresLabel: string;
  topProduct?: string | null;
  months?: number | null;
}): string {
  const first = (opts.name || "there").split(" ")[0];
  const pctLabel = Math.round(opts.pct * 100);
  const favLine = opts.topProduct
    ? `<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 20px;">Need to restock your <strong>${opts.topProduct}</strong>? Now's the perfect time.</p>`
    : "";
  const missLine = opts.months
    ? `It's been about ${opts.months} month${opts.months === 1 ? "" : "s"} since your last order and we'd love to have you back.`
    : `We'd love to have you back.`;
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;">
          <span style="color:white;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span>
        </div>
        <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">We miss you, ${first}!</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#1a1a2e;font-size:15px;margin:0 0 16px;">Hi ${first},</p>
        <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 20px;">${missLine} As a thank-you for being part of the Active 10 family, here's an exclusive offer just for you:</p>
        <div style="background:#f0f7ff;border:2px dashed #0072BC;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px;">
          <div style="font-size:30px;font-weight:900;color:#0072BC;line-height:1;">${pctLabel}% OFF</div>
          <div style="font-size:14px;color:#0072BC;font-weight:600;margin-top:6px;">+ FREE shipping on your comeback order</div>
          <div style="margin-top:16px;font-size:13px;color:#666;">Use code</div>
          <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#1a1a2e;font-family:monospace;margin-top:4px;">${opts.code}</div>
          <div style="margin-top:10px;font-size:12px;color:#999;">Expires ${opts.expiresLabel} · one-time use</div>
        </div>
        ${favLine}
        <div style="text-align:center;margin:24px 0;">
          <a href="${SITE}" style="background:#0072BC;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">Shop Now &amp; Save</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;line-height:1.6;">Just log in at <a href="${SITE}" style="color:#0072BC;">wholesale.getactive10.com</a> and enter your code at checkout. Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
      </div>
      <div style="background:#f4f7fc;padding:16px 32px;text-align:center;border-top:1px solid #e8f0fe;">
        <p style="margin:0;font-size:11px;color:#aaa;">Active Formulations Inc. · wholesale.getactive10.com</p>
      </div>
    </div>
  </div>`;
}
