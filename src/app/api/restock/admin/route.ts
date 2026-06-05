import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";
const DAY = 86400000;
const DORMANT_DAYS = 90;        // beyond this it's a win-back, not a restock
const RESEND_COOLDOWN_DAYS = 21; // don't nudge the same practice again within this window
const DUE_FACTOR = 0.9;          // nudge slightly before their average interval

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

// Average gap (days) between a customer's consecutive orders, last order date,
// and their favorite product.
function cadenceFor(custId: string, orders: any[]) {
  const mine = orders
    .filter((o) => o.customer_id === custId && o.status !== "cancelled")
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  if (mine.length < 2) return null;
  let gapSum = 0;
  for (let i = 1; i < mine.length; i++) gapSum += (+new Date(mine[i].created_at) - +new Date(mine[i - 1].created_at)) / DAY;
  const cadence = Math.round(gapSum / (mine.length - 1));
  const lastOrder = +new Date(mine[mine.length - 1].created_at);
  const daysSince = Math.floor((Date.now() - lastOrder) / DAY);
  const tally: Record<string, number> = {};
  for (const o of mine) for (const it of o.items || []) tally[it.name] = (tally[it.name] || 0) + Number(it.qty || 0);
  const topProduct = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
  return { cadence, daysSince, orderCount: mine.length, topProduct };
}

function buildRestockEmail(name: string, topProduct: string | null) {
  const first = (name || "there").split(" ")[0];
  const favLine = topProduct
    ? `<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 20px;">Based on your last orders, you may be running low on <strong>${topProduct}</strong>. Reorder in a couple of clicks so you don't run out.</p>`
    : `<p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 20px;">Based on your ordering pattern, it might be time to restock. Reorder in a couple of clicks so you don't run out.</p>`;
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;"><span style="color:white;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span></div>
        <h1 style="color:white;margin:0;font-size:23px;font-weight:800;">Running low, ${first}?</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#1a1a2e;font-size:15px;margin:0 0 16px;">Hi ${first},</p>
        ${favLine}
        <div style="background:#f0f7ff;border:1px solid #cce0f5;border-radius:8px;padding:16px 18px;margin-bottom:22px;">
          <p style="margin:0;font-size:13px;color:#0072BC;font-weight:600;">⚡ One-click reorder</p>
          <p style="margin:6px 0 0;font-size:13px;color:#555;line-height:1.6;">Log in and hit “Order Again” to instantly reload your last order into your cart.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${SITE}" style="background:#0072BC;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">Reorder Now</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;line-height:1.6;">Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
      </div>
      <div style="background:#f4f7fc;padding:16px 32px;text-align:center;border-top:1px solid #e8f0fe;"><p style="margin:0;font-size:11px;color:#aaa;">Active Formulations Inc. · wholesale.getactive10.com</p></div>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();
    const action = body.action;

    const { data: custs } = await supabaseAdmin.from("customers").select("id, name, email, business, city").eq("status", "active");
    const { data: ords } = await supabaseAdmin.from("orders").select("customer_id, created_at, total, status, items");
    const { data: reminders } = await supabaseAdmin.from("restock_reminders").select("customer_id, sent_at").order("sent_at", { ascending: false });
    const customers = custs || [], orders = ords || [], rem = reminders || [];
    const lastReminder: Record<string, number> = {};
    for (const r of rem) if (!lastReminder[r.customer_id]) lastReminder[r.customer_id] = +new Date(r.sent_at);

    const computeDue = () =>
      customers
        .map((c) => ({ c, cad: cadenceFor(c.id, orders) }))
        .filter((x) => x.cad !== null)
        .map((x) => ({ ...x, cad: x.cad! }))
        .filter((x) => x.cad.daysSince >= Math.round(x.cad.cadence * DUE_FACTOR) && x.cad.daysSince < DORMANT_DAYS)
        .filter((x) => !lastReminder[x.c.id] || (Date.now() - lastReminder[x.c.id]) / DAY >= RESEND_COOLDOWN_DAYS);

    if (action === "list") {
      const due = computeDue()
        .map((x) => ({ id: x.c.id, name: x.c.name, email: x.c.email, business: x.c.business, city: x.c.city, cadence: x.cad.cadence, daysSinceLastOrder: x.cad.daysSince, orderCount: x.cad.orderCount, topProduct: x.cad.topProduct, lastReminderAt: lastReminder[x.c.id] ? new Date(lastReminder[x.c.id]).toISOString() : null }))
        .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
      return NextResponse.json({ ok: true, due });
    }

    const sendTo = async (custId: string) => {
      const c = customers.find((x) => x.id === custId);
      if (!c) return false;
      const cad = cadenceFor(custId, orders);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to: c.email, subject: `Time to restock, ${(c.name || "there").split(" ")[0]}?`, html: buildRestockEmail(c.name, cad?.topProduct || null) }),
      });
      if (!res.ok) return false;
      await supabaseAdmin.from("restock_reminders").insert({ customer_id: custId });
      return true;
    };

    if (action === "send") {
      const ok = await sendTo(body.customerId);
      return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Send failed" }, { status: 502 });
    }

    if (action === "send_all") {
      const due = computeDue();
      let sent = 0;
      for (const x of due) if (await sendTo(x.c.id)) sent++;
      return NextResponse.json({ ok: true, sent });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("restock/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
