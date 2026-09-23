import { NextRequest, NextResponse } from "next/server";
import { db, deckKey } from "@/lib/growth/config";

// Approve / reject a proposed challenger, or retire / restore a variant. Same signed key as /swipe.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k");
  if (k !== deckKey()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const id = String(form.get("id") || "");
  const action = String(form.get("action") || "");
  const status = ({ approve: "active", reject: "rejected", retire: "retired", restore: "active" } as Record<string, string>)[action];
  if (id && status) await db().from("growth_variants").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.redirect(new URL(`/abtests?k=${k}`, req.url), 303);
}
