import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { suggestOffer, buildEmail } from "@/lib/winback";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SITE = "https://wholesale.getactive10.com";
const DORMANT_DAYS = 90;
const OFFER_VALID_DAYS = 14;

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

const DAY = 86400000;

function statsFor(customerId: string, customerCreated: string, orders: any[]) {
  const mine = orders.filter((o) => o.customer_id === customerId && o.status !== "cancelled");
  const orderCount = mine.length;
  const totalSpent = mine.reduce((s, o) => s + Number(o.total || 0), 0);
  let lastOrder: number | null = null;
  const tally: Record<string, number> = {};
  for (const o of mine) {
    const t = +new Date(o.created_at);
    if (lastOrder === null || t > lastOrder) lastOrder = t;
    for (const it of o.items || []) tally[it.name] = (tally[it.name] || 0) + Number(it.qty || 0);
  }
  const topProduct = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || null;
  const daysSinceLastOrder = lastOrder === null ? Infinity : Math.floor((Date.now() - lastOrder) / DAY);
  return { orderCount, totalSpent: Math.round(totalSpent * 100) / 100, lastOrder, daysSinceLastOrder, topProduct };
}

async function makeUniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = "WB" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data } = await supabaseAdmin.from("winback_offers").select("id").eq("code", code).limit(1);
    if (!data || data.length === 0) return code;
  }
  return "WB" + Date.now().toString(36).toUpperCase().slice(-7);
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();
    const action = body.action;

    // Shared fetch of customers + orders + offers
    const loadAll = async () => {
      const { data: custs } = await supabaseAdmin.from("customers").select("id, name, email, business, city, created_at, status").eq("status", "active");
      const { data: ords } = await supabaseAdmin.from("orders").select("customer_id, created_at, total, status, items");
      const { data: offs } = await supabaseAdmin.from("winback_offers").select("*").order("created_at", { ascending: false });
      return { customers: custs || [], orders: ords || [], offers: offs || [] };
    };

    if (action === "list") {
      const { customers, orders, offers } = await loadAll();
      const latestOfferByCustomer: Record<string, any> = {};
      for (const o of offers) if (!latestOfferByCustomer[o.customer_id]) latestOfferByCustomer[o.customer_id] = o;

      const dormant = customers
        .map((c) => ({ c, s: statsFor(c.id, c.created_at, orders) }))
        .filter((x) => x.s.orderCount > 0 && x.s.daysSinceLastOrder >= DORMANT_DAYS)
        .map((x) => ({
          id: x.c.id,
          name: x.c.name,
          email: x.c.email,
          business: x.c.business,
          city: x.c.city,
          daysSinceLastOrder: x.s.daysSinceLastOrder,
          totalSpent: x.s.totalSpent,
          orderCount: x.s.orderCount,
          topProduct: x.s.topProduct,
          offer: latestOfferByCustomer[x.c.id]
            ? {
                id: latestOfferByCustomer[x.c.id].id,
                code: latestOfferByCustomer[x.c.id].code,
                discount_pct: Number(latestOfferByCustomer[x.c.id].discount_pct),
                free_shipping: latestOfferByCustomer[x.c.id].free_shipping,
                subject: latestOfferByCustomer[x.c.id].subject,
                body: latestOfferByCustomer[x.c.id].body,
                reason: latestOfferByCustomer[x.c.id].reason,
                status: latestOfferByCustomer[x.c.id].status,
                expires_at: latestOfferByCustomer[x.c.id].expires_at,
              }
            : null,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent);

      const funnel = {
        dormantCount: dormant.length,
        drafted: offers.filter((o) => o.status === "draft").length,
        sent: offers.filter((o) => o.status === "sent").length,
        redeemed: offers.filter((o) => o.status === "redeemed").length,
        revenueRecovered: Math.round(offers.filter((o) => o.status === "redeemed").reduce((s, o) => s + Number(o.revenue_recovered || 0), 0) * 100) / 100,
      };
      return NextResponse.json({ ok: true, dormant, funnel });
    }

    if (action === "generate") {
      const { customerId } = body;
      const { data: c } = await supabaseAdmin.from("customers").select("id, name, email, business, created_at").eq("id", customerId).single();
      if (!c) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      const { data: ords } = await supabaseAdmin.from("orders").select("customer_id, created_at, total, status, items").eq("customer_id", customerId);
      const s = statsFor(c.id, c.created_at, ords || []);

      const sug = suggestOffer({ name: c.name, business: c.business, daysSinceLastOrder: s.daysSinceLastOrder, totalSpent: s.totalSpent, orderCount: s.orderCount, topProduct: s.topProduct });
      const code = await makeUniqueCode();
      const expires = new Date(Date.now() + OFFER_VALID_DAYS * DAY);
      const expiresLabel = expires.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const months = s.daysSinceLastOrder === Infinity ? null : Math.round(s.daysSinceLastOrder / 30);
      const emailBody = buildEmail({ name: c.name, pct: sug.discount_pct, code, expiresLabel, topProduct: s.topProduct, months });

      // Replace any existing draft for this customer so we don't pile up drafts.
      await supabaseAdmin.from("winback_offers").delete().eq("customer_id", customerId).eq("status", "draft");

      const { data: inserted, error } = await supabaseAdmin
        .from("winback_offers")
        .insert({ customer_id: c.id, customer_email: c.email, code, discount_pct: sug.discount_pct, free_shipping: sug.free_shipping, subject: sug.subject, body: emailBody, reason: sug.reason, status: "draft", expires_at: expires.toISOString() })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, offer: inserted });
    }

    if (action === "update") {
      const { offerId, discount_pct, free_shipping, subject, body: emailBody } = body;
      const updates: Record<string, any> = {};
      if (discount_pct != null) updates.discount_pct = Number(discount_pct);
      if (free_shipping != null) updates.free_shipping = !!free_shipping;
      if (subject != null) updates.subject = subject;
      if (emailBody != null) updates.body = emailBody;
      const { error } = await supabaseAdmin.from("winback_offers").update(updates).eq("id", offerId).eq("status", "draft");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "send") {
      const { offerId } = body;
      const { data: offer } = await supabaseAdmin.from("winback_offers").select("*").eq("id", offerId).single();
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      if (offer.status !== "draft") return NextResponse.json({ error: "This offer was already sent." }, { status: 400 });

      // Rebuild the email from the (possibly admin-edited) discount + subject so
      // the copy always matches the actual offer.
      const { data: c } = await supabaseAdmin.from("customers").select("id, name, created_at").eq("id", offer.customer_id).single();
      const { data: cOrds } = await supabaseAdmin.from("orders").select("customer_id, created_at, total, status, items").eq("customer_id", offer.customer_id);
      const s = c ? statsFor(c.id, c.created_at, cOrds || []) : { topProduct: null, daysSinceLastOrder: Infinity } as any;
      const expiresLabel = offer.expires_at ? new Date(offer.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon";
      const months = s.daysSinceLastOrder === Infinity ? null : Math.round(s.daysSinceLastOrder / 30);
      const freshBody = buildEmail({ name: c?.name || "there", pct: Number(offer.discount_pct), code: offer.code, expiresLabel, topProduct: s.topProduct, months });
      await supabaseAdmin.from("winback_offers").update({ body: freshBody }).eq("id", offerId);

      const pixel = `<img src="${SITE}/api/winback/open?id=${offer.id}" width="1" height="1" style="display:none" alt="" />`;
      const html = freshBody + pixel;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: "Active 10 Wholesale <notifications@getactive10.com>", to: offer.customer_email, subject: offer.subject || "A special offer from Active 10", html }),
      });
      if (!res.ok) return NextResponse.json({ error: "Email failed to send (" + res.status + ")" }, { status: 502 });
      await supabaseAdmin.from("winback_offers").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", offerId);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { offerId } = body;
      const { error } = await supabaseAdmin.from("winback_offers").delete().eq("id", offerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("winback/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
