// Outreach pitch engine. Multiple angles so follow-ups differ; uses Gemini when
// GEMINI_API_KEY is set, otherwise smart templates. Same output shape either way.

export type Prospect = { name?: string | null; business?: string | null; city?: string | null; type?: string | null };
export type Pitch = { subject: string; body: string };

const SITE = "https://wholesale.getactive10.com";

export const ANGLES: Record<string, { key: string; label: string }[]> = {
  chiropractor: [
    { key: "margin", label: "Wholesale margin / resell to patients" },
    { key: "pull_through", label: "Patient demand & free samples" },
    { key: "clinical", label: "Professional-grade relief" },
    { key: "trial", label: "Low-risk first order" },
  ],
  affiliate: [
    { key: "commission", label: "Earn commission referring practices" },
    { key: "passive", label: "Passive income, full tracking" },
    { key: "audience", label: "Monetize your audience" },
  ],
  other: [
    { key: "margin", label: "Wholesale opportunity" },
    { key: "trial", label: "Low-risk first order" },
  ],
};

export function nextAngle(type: string, used: string[]): string {
  const list = ANGLES[type] || ANGLES.other;
  const unused = list.find((a) => !used.includes(a.key));
  return (unused || list[used.length % list.length]).key;
}

function hi(p: Prospect) {
  return p.name ? p.name.split(" ")[0] : "there";
}
function biz(p: Prospect) {
  return p.business || "your practice";
}

export function templatePitch(p: Prospect, angle: string): Pitch {
  const first = hi(p);
  const b = biz(p);
  const T: Record<string, Pitch> = {
    margin: {
      subject: `Wholesale pricing for ${b}`,
      body: `Hi ${first},\n\nI'm with Active 10 — we make professional-grade CBD and topical pain-relief products used in chiropractic and physical-therapy practices.\n\nMany practices like ${b} stock our line and resell to patients: our wholesale pricing is 50% off retail, so it becomes a nice additional revenue stream while genuinely helping patients between visits.\n\nWould it be worth a quick look? I can set you up with an account and an intro offer.\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    pull_through: {
      subject: `Free samples for ${b}'s patients`,
      body: `Hi ${first},\n\nQuick idea for ${b}: we send chiropractic practices free Active 10 sample packets to hand out to patients. Patients try our CBD/topical relief at home, come back asking where to buy it, and you keep them stocked at a wholesale margin.\n\nIt's a simple way to add patient value (and revenue) with zero upfront cost. Want me to send a sample pack your way?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    clinical: {
      subject: `Professional-grade pain relief for your patients`,
      body: `Hi ${first},\n\nI wanted to introduce Active 10 — professional-grade topical pain relief and full-spectrum CBD formulated for the kind of musculoskeletal issues you treat every day at ${b}.\n\nPractitioners use it as a take-home complement to in-office care. I'd love to send you details and our wholesale pricing for practices.\n\nWould that be helpful?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    trial: {
      subject: `A low-risk way to try Active 10 at ${b}`,
      body: `Hi ${first},\n\nFollowing up — I know trying a new product line is a hassle, so we make the first order easy: a welcome discount, free shipping, and free patient samples, no minimum commitment.\n\nIf ${b} has even a few patients who'd benefit from take-home pain relief, it's worth a small trial. Can I set you up?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    commission: {
      subject: `Partner with Active 10 — earn on every practice you refer`,
      body: `Hi ${first},\n\nI'm with Active 10 (professional-grade CBD & topical pain relief for healthcare practices). We're growing our partner program and you came to mind.\n\nYou'd get a personal referral link and earn commission on every order from the practices you refer — tracked automatically in your own dashboard. It's a clean, passive way to earn from a product practices genuinely value.\n\nWould you be open to hearing more?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    passive: {
      subject: `A simple passive-income partnership`,
      body: `Hi ${first},\n\nFollowing up on partnering with Active 10. The nice part: once you share your link, it tracks itself — you see exactly which practices you referred and what you've earned, and payouts are fully transparent.\n\nNo follow-up, no bookkeeping. Worth a quick look?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
    audience: {
      subject: `Monetize your audience with Active 10`,
      body: `Hi ${first},\n\nYour audience is exactly the kind of health-focused community that loves Active 10's CBD and pain-relief line. Our affiliate program lets you earn commission on every customer you send our way, with a personal link and real-time tracking.\n\nHappy to set you up so you can see how it works — interested?\n\nBest,\nDarrin Cohen\nActive Formulations\n${SITE}`,
    },
  };
  return T[angle] || T.margin;
}

async function geminiPitch(p: Prospect, angle: string): Promise<Pitch | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const angleHint: Record<string, string> = {
    margin: "they can resell our products to patients at a 50%-off-retail wholesale margin",
    pull_through: "we give free patient samples that drive take-home demand and reorders",
    clinical: "our products are professional-grade pain relief / full-spectrum CBD for the conditions they treat",
    trial: "a low-risk first order: welcome discount, free shipping, free samples, no minimum",
    commission: "they earn commission on every practice they refer via a personal tracked link",
    passive: "it's passive income with automatic tracking and transparent payouts",
    audience: "they can monetize their health-focused audience with an affiliate link",
  };
  const prompt = `Write a short, warm, professional cold outreach email from Darrin Cohen at Active 10 (professional-grade CBD & topical pain-relief products, wholesale.getactive10.com) to ${p.name || "the owner"} at "${p.business || "a " + (p.type || "chiropractic") + " practice"}"${p.city ? " in " + p.city : ""}. Angle: ${angleHint[angle] || angleHint.margin}. Keep it under 130 words, no fluff, one clear ask, sign as "Darrin Cohen, Active Formulations". Return ONLY valid JSON: {"subject":"...","body":"..."} with \\n for line breaks.`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85 } }),
    });
    const d = await r.json();
    let txt: string = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    txt = txt.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(txt);
    if (parsed.subject && parsed.body) return { subject: String(parsed.subject), body: String(parsed.body) };
  } catch {}
  return null;
}

export async function generatePitch(p: Prospect, angle: string): Promise<Pitch> {
  return (await geminiPitch(p, angle)) || templatePitch(p, angle);
}
