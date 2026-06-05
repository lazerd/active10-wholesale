import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";
const MIN = 60000;
const ABANDON_MINUTES = 60;     // untouched this long = abandoned
const COOLDOWN_HOURS = 48;      // don't re-nudge the same cart within this window

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

const cartTotal = (items: any[]) => Math.round((items || []).reduce((s, i) => s + Number(i.line_total ?? Number(i.unit_price || 0) * Number(i.qty || 0)), 0) * 100) / 100;

function buildCartEmail(name: string, items: any[]) {
  const first = (name || "there").split(" ")[0];
  const rows = (items || [])
    .map((i) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #e8f0fe;color:#1a1a2e">${i.name}</td><td style="padding:10px 8px;border-bottom:1px solid #e8f0fe;text-align:center;color:#0072BC;font-weight:600">${i.qty}</td></tr>`)
    .join("");
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fc;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0072BC,#00A8E8);padding:32px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 18px;margin-bottom:12px;"><span style="color:white;font-size:22px;font-weight:900;letter-spacing:1px;">A10</span></div>
        <h1 style="color:white;margin:0;font-size:23px;font-weight:800;">You left something behind, ${first}</h1>
      </div>
      <div style="padding:32px;">
        <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 18px;">Your wholesale cart is still saved and ready to go. Pick up right where you left off:</p>
        <table style="width:100%;border-collapse:collapse;background:#fafcff;border-radius:8px;overflow:hidden;border:1px solid #e8f0fe;margin-bottom:20px;">
          <thead><tr style="background:#e8f0fe;"><th style="padding:10px 8px;text-align:left;font-size:12px;color:#555;text-transform:uppercase;">Product</th><th style="padding:10px 8px;text-align:center;font-size:12px;color:#555;text-transform:uppercase;">Qty</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="${SITE}" style="background:#0072BC;color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;font-size:15px;">Complete Your Order</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;line-height:1.6;">Just log in — your cart will be waiting. Questions? <a href="mailto:activeformulations@gmail.com" style="color:#0072BC;">activeformulations@gmail.com</a></p>
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

    const { data: cartsData } = await supabaseAdmin.from("carts").select("*").order("updated_at", { ascending: false });
    const carts = cartsData || [];
    const now = Date.now();
    const isAbandoned = (c: any) =>
      (c.items || []).length > 0 &&
      now - +new Date(c.updated_at) >= ABANDON_MINUTES * MIN &&
      (!c.recovery_sent_at || now - +new Date(c.recovery_sent_at) >= COOLDOWN_HOURS * 3600000);

    if (action === "list") {
      const list = carts.filter(isAbandoned).map((c) => ({
        id: c.id,
        customer_name: c.customer_name,
        customer_email: c.customer_email,
        items: c.items,
        itemCount: (c.items || []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0),
        total: cartTotal(c.items),
        updated_at: c.updated_at,
        recovery_sent_at: c.recovery_sent_at,
      }));
      return NextResponse.json({ ok: true, carts: list });
    }

    const sendOne = async (cartId: string) => {
      const c = carts.find((x) => x.id === cartId);
      if (!c || !c.customer_email) return false;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to: c.customer_email, subject: `${(c.customer_name || "there").split(" ")[0]}, your Active 10 cart is waiting`, html: buildCartEmail(c.customer_name, c.items) }),
      });
      if (!res.ok) return false;
      await supabaseAdmin.from("carts").update({ recovery_sent_at: new Date().toISOString() }).eq("id", cartId);
      return true;
    };

    if (action === "send") {
      const ok = await sendOne(body.cartId);
      return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Send failed" }, { status: 502 });
    }
    if (action === "send_all") {
      let sent = 0;
      for (const c of carts.filter(isAbandoned)) if (await sendOne(c.id)) sent++;
      return NextResponse.json({ ok: true, sent });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("abandoned/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
