import { NextRequest, NextResponse } from "next/server";
import { db, deckKey, ptParts, LANE_LABEL, Lane, toHtml, TZ } from "@/lib/growth/config";

// The swipe deck behind /swipe. GET = the cards waiting for a decision;
// POST = approve / reject / never / edit / undo. Keyed by the signed link in
// Darrin's digest (deckKey), so it works on his phone without a login.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const FOOTER = "\n\n--\n";
const authed = (req: NextRequest) => req.nextUrl.searchParams.get("k") === deckKey();
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const money = (n: any) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

/** One line on why this person is in the deck, so the swipe is informed. */
function why(r: any): string {
  const m = r.meta || {};
  switch (r.lane) {
    case "restock": return `Last order ${m.lastDate}. Usually reorders every ${m.gap} days. ${money(m.spent)} lifetime.`;
    case "winback": return `No order since ${m.lastDate} (${Math.round((m.days || 0) / 30)} months). ${m.orders} orders, ${money(m.spent)} lifetime.`;
    case "winback_bump": return "Didn't answer last week's 20%-off email. Replies in the same thread.";
    case "cold_bump": return "Didn't answer the first letter. This is the only follow-up they ever get.";
    case "sample_followup": return `Samples went out ${String(m.sampleAt || "").slice(0, 10)}. No order yet.`;
    case "chiro": return "Practice found online. First letter — they've never heard from us.";
    case "club": return "DCA member club. First letter.";
    default: return "";
  }
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "This link isn't valid. Use the Swipe button in your Active 10 email." }, { status: 401 });
  const sb = db();
  const today = ptParts().date;
  const { data: rows, error } = await sb.from("growth_queue")
    .select("id, plan_date, send_at, lane, email, name, business, subject, body_text, body_html, meta, approval, status")
    .gte("plan_date", today).in("status", ["planned", "rejected", "sending", "sent"]).order("send_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const all = rows || [];
  // The soonest day that still has undecided cards; else the latest day (all done).
  const pending = all.filter((r) => r.status === "planned" && r.approval === "pending");
  const date = pending[0]?.plan_date || all[all.length - 1]?.plan_date || null;
  const day = all.filter((r) => r.plan_date === date);
  const firstApproved = day.find((r) => r.approval === "approved" && r.status === "planned");
  return NextResponse.json({
    date, dateLabel: date ? dayLabel(date) : null,
    total: day.length,
    approved: day.filter((r) => r.approval === "approved").length,
    skipped: day.filter((r) => r.approval === "rejected" || r.status === "rejected").length,
    firstSend: firstApproved ? time(firstApproved.send_at) : null,
    cards: day.filter((r) => r.status === "planned" && r.approval === "pending").map((r) => ({
      id: r.id, lane: r.lane, laneLabel: LANE_LABEL[r.lane as Lane] || r.lane, to: r.email, name: r.name, business: r.business,
      time: time(r.send_at), subject: r.subject, html: r.body_html, text: String(r.body_text).split(FOOTER)[0], why: why(r),
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, action, subject, text } = await req.json().catch(() => ({}));
  const sb = db();
  const { data: row } = await sb.from("growth_queue").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["planned", "rejected"].includes(row.status)) return NextResponse.json({ error: "Already sent — can't change it now." }, { status: 409 });

  const soon = new Date(Date.now() + 60000).toISOString();
  const sendAt = row.send_at < soon ? soon : row.send_at; // approved late → goes out on the next tick

  if (action === "approve") {
    await sb.from("growth_queue").update({ approval: "approved", status: "planned", send_at: sendAt, skip_reason: null }).eq("id", id);
  } else if (action === "edit") {
    const footer = String(row.body_text).includes(FOOTER) ? FOOTER + String(row.body_text).split(FOOTER).slice(1).join(FOOTER) : "";
    const body_text = String(text || "").trim() + footer;
    if (!String(text || "").trim() || !String(subject || "").trim()) return NextResponse.json({ error: "Subject and body can't be empty." }, { status: 400 });
    await sb.from("growth_queue").update({
      subject: String(subject).trim(), body_text, body_html: toHtml(body_text), meta: { ...(row.meta || {}), edited: true },
      approval: "approved", status: "planned", send_at: sendAt, skip_reason: null,
    }).eq("id", id);
  } else if (action === "reject") {
    await sb.from("growth_queue").update({ approval: "rejected", status: "rejected", skip_reason: "swiped left" }).eq("id", id);
  } else if (action === "never") {
    await sb.from("growth_suppression").upsert({ email: String(row.email).toLowerCase(), reason: "never (swiped)" }, { onConflict: "email" });
    await sb.from("growth_queue").update({ approval: "rejected", status: "rejected", skip_reason: "never email" }).eq("id", id);
  } else if (action === "undo") {
    if (row.skip_reason === "never email") await sb.from("growth_suppression").delete().eq("email", String(row.email).toLowerCase()).eq("reason", "never (swiped)");
    const { error } = await sb.from("growth_queue").update({ approval: "pending", status: "planned", skip_reason: null }).eq("id", id);
    if (error) return NextResponse.json({ error: "Can't undo — that email was re-planned elsewhere." }, { status: 409 });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
