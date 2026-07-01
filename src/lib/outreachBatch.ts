import { createClient } from "@supabase/supabase-js";
import { generatePitch, nextAngle } from "@/lib/outreachPitch";
import { getGmailAccess, gmailRepliesFrom } from "@/lib/gmail";

// Prepares (does NOT send) the day's club outreach drafts:
//  1. folds in replies so we never follow up someone who answered,
//  2. drafts first-touch founder letters for the next `daily_quota` clubs,
//  3. drafts 30-day recalibrate (next-angle) follow-ups for silent contacts.
// Darrin reviews each draft and one-click sends via the send_gmail action.
export async function prepareBatch(): Promise<{ firstTouch: number; recalibrate: number; replies: number }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const DAY_MS = 86400000;
  const RECAL_DAYS = 30;        // wait this long before a follow-up
  const RECAL_MAX_TOUCHES = 4;  // stop after this many touches
  const RECAL_CAP = 10;         // max recalibrate drafts per run (stay reviewable)

  // 1) Reply check first.
  let replies = 0;
  try {
    const token = await getGmailAccess();
    if (token) {
      const { data: ps } = await sb.from("outreach_prospects").select("id, email, status").in("status", ["emailed", "followed_up"]);
      const list = (ps || []).filter((p) => p.email);
      if (list.length) {
        const repliedEmails = await gmailRepliesFrom(token, list.map((p) => p.email as string));
        for (const p of list) {
          if (repliedEmails.has((p.email as string).toLowerCase())) {
            await sb.from("outreach_prospects").update({ status: "replied" }).eq("id", p.id);
            const { data: last } = await sb.from("outreach_touches").select("id").eq("prospect_id", p.id).eq("status", "sent").order("created_at", { ascending: false }).limit(1).single();
            if (last) await sb.from("outreach_touches").update({ status: "replied" }).eq("id", last.id);
            replies++;
          }
        }
      }
    }
  } catch (e) { console.error("prepareBatch reply-check:", e); }

  // Prospects that already have an unsent draft — don't double-draft.
  const { data: draftT } = await sb.from("outreach_touches").select("prospect_id").eq("status", "draft");
  const hasDraft = new Set((draftT || []).map((t) => t.prospect_id));

  const { data: settings } = await sb.from("outreach_settings").select("daily_quota").eq("id", "default").single();
  const quota = Math.max(0, settings?.daily_quota ?? 1);

  const draftFor = async (p: any, angle: string) => {
    const info = { name: p.name, business: p.business, city: p.city, type: p.type, research: p.research };
    const pitch = await generatePitch(info, angle, {});
    await sb.from("outreach_touches").insert({ prospect_id: p.id, angle, subject: pitch.subject, body: pitch.body, status: "draft" });
  };

  // 2) First-touch drafts. Prefer club-domain (work) emails over personal
  // (gmail/hotmail/etc.) so the reliable, low-bounce addresses go out first —
  // protects a new sender's reputation. Nothing is dropped, just sequenced.
  const PERSONAL_DOMAINS = new Set(["gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com", "icloud.com", "comcast.net", "live.com", "me.com", "msn.com", "att.net", "bellsouth.net", "verizon.net", "mail.ru", "googlemail.com", "mac.com", "windstream.net"]);
  const isPersonal = (email: string) => PERSONAL_DOMAINS.has((email.split("@")[1] || "").toLowerCase());
  let firstTouch = 0;
  const { data: freshRaw } = await sb.from("outreach_prospects").select("*").eq("type", "club").eq("status", "prospected").limit(1000);
  const fresh = (freshRaw || []).sort((a, b) => {
    const pa = isPersonal(a.email || "") ? 1 : 0, pb = isPersonal(b.email || "") ? 1 : 0;
    if (pa !== pb) return pa - pb;                       // work-domain first
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
  for (const p of fresh) {
    if (firstTouch >= quota) break;
    if (hasDraft.has(p.id)) continue;
    await draftFor(p, "proshop_intro");
    firstTouch++;
  }

  // 3) Recalibrate drafts (30+ days quiet, under touch cap).
  let recalibrate = 0;
  const cutoff = new Date(Date.now() - RECAL_DAYS * DAY_MS).toISOString();
  const { data: quiet } = await sb.from("outreach_prospects").select("*").eq("type", "club").in("status", ["emailed", "followed_up"]).lt("last_contacted_at", cutoff).lt("touch_count", RECAL_MAX_TOUCHES).order("last_contacted_at", { ascending: true }).limit(RECAL_CAP + 50);
  for (const p of quiet || []) {
    if (recalibrate >= RECAL_CAP) break;
    if (hasDraft.has(p.id)) continue;
    const { data: prior } = await sb.from("outreach_touches").select("angle").eq("prospect_id", p.id);
    const used = (prior || []).map((t) => t.angle).filter(Boolean) as string[];
    await draftFor(p, nextAngle("club", used));
    recalibrate++;
  }

  await sb.from("outreach_settings").upsert({ id: "default", last_batch_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() });
  return { firstTouch, recalibrate, replies };
}
