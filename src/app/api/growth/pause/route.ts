import { NextRequest } from "next/server";
import { db, sign } from "@/lib/growth/config";

// One-click links from the morning digest. Signed, so only the digest can use them.
export const dynamic = "force-dynamic";

const page = (msg: string, status = 200) =>
  new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 16px;font-size:16px">${msg}</div>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8" },
  });

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const a = q.get("a") || "", d = q.get("d") || "", s = q.get("s") || "";
  if (!["today", "all", "resume"].includes(a) || s !== sign(`${a}:${d}`)) return page("That link isn't valid.", 403);
  const sb = db();
  if (a === "today") {
    await sb.from("growth_settings").update({ paused_on: d }).eq("id", "default");
    return page(`<b>Paused for ${d}.</b><br>Nothing else goes out today. It picks back up tomorrow morning on its own.`);
  }
  if (a === "all") {
    await sb.from("growth_settings").update({ enabled: false }).eq("id", "default");
    return page("<b>Paused.</b><br>No more Active 10 growth emails until you hit Resume in any digest.");
  }
  await sb.from("growth_settings").update({ enabled: true, paused_on: null }).eq("id", "default");
  return page("<b>Resumed.</b><br>Tomorrow's batch plans itself at 6am.");
}
