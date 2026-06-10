// Outreach pitch engine. Multiple angles so follow-ups differ; uses Gemini when
// GEMINI_API_KEY is set, otherwise smart templates. Same output shape either way.

export type Prospect = { name?: string | null; business?: string | null; city?: string | null; type?: string | null; research?: string | null };
export type Pitch = { subject: string; body: string };

const SITE = "https://wholesale.getactive10.com";

// Darrin's hand-written default letter — always sent verbatim (greeting personalized).
// This is the first touch for every prospect; AI angles kick in on follow-ups.
export function founderLetter(p: Prospect): Pitch {
  const first = p.name ? p.name.split(" ")[0] : "there";
  return {
    subject: "free samples, no sales call",
    body: `Hi ${first},\n\nI'll keep this short because I know your day is booked back to back.\n\nMy name is Darrin and I make Active 10, a topical pain relief cream. Chiropractors were our first real customers. Before we ever sold a single jar online, it was DCs using it on patients during adjustments and selling it at the front desk. Years later, that's still the heart of the business — hundreds of practices around the country carry it now.\n\nThe short version of why it sticks: patients use it after their adjustment and between visits, they feel the difference, and they come back to your front desk asking for more. It sells itself once it's on the shelf, and the margins actually make it worth shelf space.\n\nBut I'd rather you judge that yourself than take my word for it. Reply with your shipping address and I'll personally get samples in the mail to you this week. No catch, no sales call, no ten-email follow-up sequence. Try it on yourself, try it on a few patients, and see what they say.\n\nIf it earns a spot in your practice, setting up a wholesale account takes about two minutes at wholesale.getactive10.com — opening orders get 20% off plus free shipping.\n\nEither way, thanks for reading this far. I mean that.\n\nDarrin Cohen\nFounder, Active 10\n800-636-4130`,
  };
}

export const ANGLES: Record<string, { key: string; label: string }[]> = {
  chiropractor: [
    { key: "founder_intro", label: "Darrin's letter (founder story + free samples)" },
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
    { key: "founder_intro", label: "Darrin's letter (founder story + free samples)" },
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
    founder_intro: founderLetter(p),
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

export type PitchOpts = { tone?: string; length?: string; instructions?: string };

const TONES: Record<string, string> = {
  human: "warm and human — like a real person who quickly typed a genuine note",
  casual: "casual and friendly — relaxed, like emailing a peer you respect",
  direct: "direct and punchy — confident, gets to the point fast, a little bold",
  professional: "polished and professional, but still personable (not stiff or corporate)",
};

async function geminiPitch(p: Prospect, angle: string, opts: PitchOpts = {}): Promise<Pitch | { error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "no GEMINI_API_KEY" };
  const angleHint: Record<string, string> = {
    margin: "they can stock our products and resell to patients at a ~50%-off-retail wholesale margin (extra revenue + helps patients between visits)",
    pull_through: "we give free patient sample packets that create take-home demand, so patients come back asking to buy and the practice reorders",
    clinical: "professional-grade topical pain relief / full-spectrum CBD for the exact musculoskeletal issues they treat — a take-home complement to in-office care",
    trial: "a genuinely low-risk first order: welcome discount, free shipping, free samples, no real commitment",
    commission: "they earn commission on every practice they refer through a personal tracked link",
    passive: "passive income with automatic tracking and transparent payouts — nothing to chase",
    audience: "they can monetize their health-focused audience with an affiliate link",
  };
  const tone = TONES[opts.tone || "human"] || TONES.human;
  const lengthRule = opts.length === "medium" ? "4–6 short sentences, under 110 words" : opts.length === "tiny" ? "2–3 sentences, under 45 words" : "3–4 short sentences, under 75 words";
  const research = (p.research || "").trim();

  const prompt = `You're Darrin Cohen, founder of Active 10 (professional-grade CBD & topical pain-relief products for healthcare practices — wholesale.getactive10.com). Write ONE cold outreach email that actually gets a reply.

Recipient: ${p.name || "the practice owner"} at "${p.business || "a " + (p.type || "chiropractic") + " practice"}"${p.city ? ` in ${p.city}` : ""}.
The hook: ${angleHint[angle] || angleHint.margin}.
${research ? `\nWhat their own website says about them (USE THIS — open with one specific, true detail from it, stated casually, never as flattery):\n"""${research.slice(0, 1200)}"""\n` : ""}
Here are two examples of the QUALITY BAR — match their feel, rhythm, and specificity (do NOT copy their content):

EXAMPLE 1
subject: post-adjustment soreness
body: Dr. Reyes — noticed you do a lot of sports rehab at Eastside Spine. Patients always ask what to use between visits, and that's exactly why practices stock our topical line: it's professional-grade, and you keep the retail margin. Want me to mail you a few samples to try on your toughest cases?\n\nDarrin

EXAMPLE 2
subject: your patients keep asking
body: Quick one — chiros tell us the #1 question after an adjustment is "what can I use at home?" We make pro-grade topical relief practices resell at 50% margin, and we'll send free patient samples to start. Worth a look?\n\nDarrin

What makes it work (follow strictly):
- Sound like a busy human who dashed off a quick, genuine note — NOT marketing copy.
- Tone: ${tone}.
- Length: ${lengthRule}. Shorter is better.
- Subject line: lowercase, ~3–6 words, specific or curiosity-driven, never salesy.
- Open with something specific to THEM (from their website info above if provided); never open with pleasantries.
- Exactly ONE ask, a low-friction yes (e.g. "want me to send a sample pack?") — not a hard sell.
- Use contractions and plain words. No stacked adjectives. At most one exclamation point.
- Sign off simply as just "Darrin" (unless the extra direction below specifies a different signature — then use that exactly).

BANNED (never use): "I hope this email finds you well", "I hope you're doing well", "I'm reaching out", "I wanted to reach out", "in today's", "fast-paced", "elevate", "seamless", "cutting-edge", "innovative", "exciting opportunity", "game-changer", "leverage", "synergy", "passionate about", "revolutionary", "unlock", "—" em-dashes, and corporate buzzwords. No fake personalization you can't back up — if no website info was given, don't invent details.
${opts.instructions ? `\nExtra direction from Darrin (follow this): ${opts.instructions}\n` : ""}
Return ONLY valid JSON: {"subject":"...","body":"..."} with \\n for line breaks in the body.`;

  // Pro first for writing quality (free tier allows low daily volume), then
  // flash fallbacks — Google retires/renames these periodically.
  const MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastError = "";
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // Force strict JSON output so parsing can't fail on prose/markdown.
          generationConfig: { temperature: 0.95, topP: 0.95, responseMimeType: "application/json" },
        }),
      });
      if (!r.ok) {
        lastError = `${model}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
        console.error("Gemini error:", lastError);
        continue; // next model
      }
      const d = await r.json();
      let txt: string = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      txt = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt);
      if (parsed.subject && parsed.body) return { subject: String(parsed.subject), body: String(parsed.body) };
      lastError = `${model}: empty/invalid JSON in response`;
    } catch (e: any) {
      lastError = `${model}: ${String(e?.message || e).slice(0, 200)}`;
      console.error("Gemini error:", lastError);
    }
  }
  return { error: lastError };
}

export async function generatePitch(p: Prospect, angle: string, opts: PitchOpts = {}): Promise<Pitch & { source: "ai" | "template"; aiError?: string }> {
  // The default letter is Darrin's own writing — never AI-rewritten.
  if (angle === "founder_intro") return { ...founderLetter(p), source: "template" };
  const ai = await geminiPitch(p, angle, opts);
  if (!("error" in ai)) return { ...ai, source: "ai" };
  return { ...templatePitch(p, angle), source: "template", aiError: ai.error };
}
