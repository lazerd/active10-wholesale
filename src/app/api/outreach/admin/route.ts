import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePitch, nextAngle, ANGLES } from "@/lib/outreachPitch";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: ad } = await supabaseAdmin.from("admin_emails").select("email").ilike("email", email).single();
  return !!ad;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();
    const action = body.action;

    if (action === "list") {
      const { data: prospects } = await supabaseAdmin.from("outreach_prospects").select("*").order("created_at", { ascending: false });
      const { data: touches } = await supabaseAdmin.from("outreach_touches").select("*").order("created_at", { ascending: false });
      const ps = prospects || [], ts = touches || [];
      const byProspect: Record<string, any[]> = {};
      for (const t of ts) (byProspect[t.prospect_id] = byProspect[t.prospect_id] || []).push(t);

      // Winning-angle analytics
      const angleStats: Record<string, { sent: number; replied: number }> = {};
      for (const t of ts) {
        if (!t.angle) continue;
        if (t.status === "sent" || t.status === "replied") {
          angleStats[t.angle] = angleStats[t.angle] || { sent: 0, replied: 0 };
          angleStats[t.angle].sent++;
          if (t.status === "replied") angleStats[t.angle].replied++;
        }
      }
      const angles = Object.entries(angleStats).map(([angle, s]) => ({ angle, ...s, rate: s.sent ? Math.round((s.replied / s.sent) * 100) : 0 })).sort((a, b) => b.rate - a.rate || b.sent - a.sent);

      const rows = ps.map((p) => ({ ...p, touches: (byProspect[p.id] || []).map((t) => ({ id: t.id, angle: t.angle, subject: t.subject, body: t.body, status: t.status, sent_at: t.sent_at })) }));
      const funnel = {
        total: ps.length,
        prospected: ps.filter((p) => p.status === "prospected").length,
        emailed: ps.filter((p) => p.status === "emailed" || p.status === "followed_up").length,
        replied: ps.filter((p) => p.status === "replied").length,
        won: ps.filter((p) => p.status === "won").length,
        dead: ps.filter((p) => p.status === "dead").length,
      };
      return NextResponse.json({ ok: true, prospects: rows, funnel, angles, aiOn: !!process.env.GEMINI_API_KEY });
    }

    if (action === "generate") {
      const { prospectId } = body;
      const { data: p } = await supabaseAdmin.from("outreach_prospects").select("*").eq("id", prospectId).single();
      if (!p) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
      const { data: prior } = await supabaseAdmin.from("outreach_touches").select("angle").eq("prospect_id", prospectId);
      const used = (prior || []).map((t) => t.angle).filter(Boolean) as string[];
      // Clear any unsent draft so we don't pile up drafts for one prospect.
      await supabaseAdmin.from("outreach_touches").delete().eq("prospect_id", prospectId).eq("status", "draft");
      const angle = nextAngle(p.type || "chiropractor", used);
      const pitch = await generatePitch({ name: p.name, business: p.business, city: p.city, type: p.type }, angle);
      const { data: touch } = await supabaseAdmin.from("outreach_touches").insert({ prospect_id: prospectId, angle, subject: pitch.subject, body: pitch.body, status: "draft" }).select().single();
      return NextResponse.json({ ok: true, touch, angleLabel: (ANGLES[p.type || "chiropractor"] || ANGLES.other).find((a) => a.key === angle)?.label || angle });
    }

    if (action === "update_touch") {
      const { touchId, subject, body: tbody } = body;
      const upd: any = {};
      if (subject != null) upd.subject = subject;
      if (tbody != null) upd.body = tbody;
      await supabaseAdmin.from("outreach_touches").update(upd).eq("id", touchId);
      return NextResponse.json({ ok: true });
    }

    if (action === "mark_sent") {
      const { touchId, prospectId } = body;
      await supabaseAdmin.from("outreach_touches").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", touchId);
      const { data: p } = await supabaseAdmin.from("outreach_prospects").select("touch_count").eq("id", prospectId).single();
      const tc = (p?.touch_count || 0) + 1;
      await supabaseAdmin.from("outreach_prospects").update({ status: tc > 1 ? "followed_up" : "emailed", touch_count: tc, last_contacted_at: new Date().toISOString() }).eq("id", prospectId);
      return NextResponse.json({ ok: true });
    }

    if (action === "set_status") {
      const { prospectId, status, touchId } = body;
      await supabaseAdmin.from("outreach_prospects").update({ status }).eq("id", prospectId);
      if (status === "replied" && touchId) await supabaseAdmin.from("outreach_touches").update({ status: "replied" }).eq("id", touchId);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      await supabaseAdmin.from("outreach_prospects").delete().eq("id", body.prospectId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("outreach/admin error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
