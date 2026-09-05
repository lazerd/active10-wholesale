import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** 2026 campaign target, in TUBES shipped — not requests, not offices. */
const GOAL_TUBES = 2000;

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await supabaseAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  // Exact case-insensitive match, not ilike: PostgREST does not honor escaped
  // LIKE wildcards, so an account whose address contains "_" (legal in an email)
  // would pattern-match an admin row and inherit admin on this route.
  const { data: admins } = await supabaseAdmin.from("admin_emails").select("email");
  const ad = (admins || []).some((r: { email: string | null }) => (r.email || "").toLowerCase() === email);
  return !!ad;
}

type SampleRow = {
  id: string;
  email: string | null;
  status: string;
  tubes: number | null;
  packets: number | null;
  ordered_at: string | null;
};

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const body = await req.json();

    if (body.action === "list") {
      const { data } = await supabaseAdmin.from("sample_requests").select("*").order("created_at", { ascending: false });
      const rows = (data || []) as SampleRow[];

      // Conversion is derived, not typed in — a tickbox would go stale in a
      // week. It is reported as TWO numbers on purpose:
      //
      //   opened an account  — a customers row exists on that address
      //   ordered            — total_orders > 0
      //
      // They are far apart here, and the gap is not failure: plenty of this
      // book orders by replying to an email and gets invoiced through
      // QuickBooks, which never touches the portal and so never increments
      // total_orders. Reporting only "ordered" would badly under-count the
      // campaign and make a working funnel look dead.
      const emails = Array.from(
        new Set(rows.map((r) => (r.email || "").trim().toLowerCase()).filter(Boolean)),
      );
      const hasAccount = new Set<string>();
      const ordered = new Set<string>();
      if (emails.length) {
        const { data: custs } = await supabaseAdmin
          .from("customers")
          .select("email, total_orders")
          .in("email", emails);
        for (const c of (custs || []) as { email: string | null; total_orders: number | null }[]) {
          const e = (c.email || "").trim().toLowerCase();
          if (!e) continue;
          hasAccount.add(e);
          if ((c.total_orders || 0) > 0) ordered.add(e);
        }
      }

      const shippedRows = rows.filter((r) => r.status === "shipped");
      const tubesShipped = shippedRows.reduce((n, r) => n + (r.tubes ?? 1), 0);
      const packetsShipped = shippedRows.reduce((n, r) => n + (r.packets ?? 6), 0);
      const converted = shippedRows.filter((r) => ordered.has((r.email || "").trim().toLowerCase())).length;
      const accounts = shippedRows.filter((r) => hasAccount.has((r.email || "").trim().toLowerCase())).length;

      return NextResponse.json({
        ok: true,
        requests: rows.map((r) => {
          const e = (r.email || "").trim().toLowerCase();
          return { ...r, ordered: ordered.has(e), hasAccount: hasAccount.has(e) };
        }),
        stats: {
          goalTubes: GOAL_TUBES,
          tubesShipped,
          packetsShipped,
          officesShipped: shippedRows.length,
          pending: rows.length - shippedRows.length,
          converted,
          accounts,
          // Percent of shipped practices that went on to order. Undefined until
          // something has actually shipped — a 0% on an empty campaign reads as
          // failure rather than "no data".
          conversionRate: shippedRows.length ? converted / shippedRows.length : null,
        },
      });
    }

    if (body.action === "mark_shipped") {
      const shipped = body.shipped !== false;
      const patch: Record<string, unknown> = {
        status: shipped ? "shipped" : "requested",
        shipped_at: shipped ? new Date().toISOString() : null,
      };
      if (shipped) {
        if (typeof body.tubes === "number") patch.tubes = Math.max(0, Math.round(body.tubes));
        if (typeof body.packets === "number") patch.packets = Math.max(0, Math.round(body.packets));
      }
      const { data } = await supabaseAdmin
        .from("sample_requests")
        .update(patch)
        .eq("id", body.id)
        .select("id, status, shipped_at, tubes, packets")
        .single();
      return NextResponse.json({ ok: true, row: data, status: patch.status });
    }

    if (body.action === "update") {
      const patch: Record<string, unknown> = {};
      if (typeof body.tubes === "number") patch.tubes = Math.max(0, Math.round(body.tubes));
      if (typeof body.packets === "number") patch.packets = Math.max(0, Math.round(body.packets));
      if (typeof body.tracking === "string") patch.tracking = body.tracking.trim() || null;
      if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
      if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from("sample_requests")
        .update(patch)
        .eq("id", body.id)
        .select("id, tubes, packets, tracking, notes")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: data });
    }

    if (body.action === "delete") {
      await supabaseAdmin.from("sample_requests").delete().eq("id", body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
