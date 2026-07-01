// Outreach pitch engine. Multiple angles so follow-ups differ; uses Gemini when
// GEMINI_API_KEY is set, otherwise smart templates. Same output shape either way.

export type Prospect = { name?: string | null; business?: string | null; city?: string | null; type?: string | null; research?: string | null };
export type Pitch = { subject: string; body: string };

const SITE = "https://wholesale.getactive10.com";

// Darrin's hand-written default letter — always sent verbatim (greeting personalized).
// This is the first touch for every prospect; AI angles kick in on follow-ups.
export function founderLetter(p: Prospect): Pitch {
  const first = p.name ? p.name.split(" ")[0] : "there";
  // Club pro-shop first touch — from Darrin & June, anchored on Jarrett Chirico.
  if ((p.type || "") === "club") {
    return {
      subject: "jarrett chirico + your pro shop",
      body: `Hi ${first},\n\nI'll keep this short. I'm Darrin Cohen — I run the tennis program at Sleepy Hollow — and my cofounder June Munroe and I make Active 10, a topical recovery cream players reach for after a tough match. Fast-acting, made in the USA, hemp-derived and THC-free.\n\nHere's why I'm emailing you specifically: Jarrett Chirico has carried Active 10 in his pro shop — at his last club and now at North Hills — and both times it was one of his best sellers at the counter. Players try it, feel the difference, and come back for more. Easy margin for the shop, and it genuinely helps your members.\n\nRather than pitch you, I'd just send you a sample. Try it after your own match, put a few on the counter, and see what your players say. No cost, no sales call.\n\nIf it earns a spot in your shop, setting up a wholesale account takes about two minutes at wholesale.getactive10.com.\n\nJust reply with where to ship and I'll get a sample out this week. Thanks for reading this far.\n\nDarrin & June\nActive 10\n800-636-4130`,
    };
  }
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
  club: [
    { key: "proshop_intro", label: "Darrin & June letter (Chirico proof + free sample)" },
    { key: "margin", label: "Pro-shop margin / counter impulse buy" },
    { key: "player_demand", label: "Player demand & free samples" },
    { key: "trial", label: "Low-risk first order (no minimum)" },
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

// Club pro-shop templates (used when Gemini is off). Distinct copy from the
// healthcare templates; all reference the pro-shop counter + free sample.
export function clubTemplatePitch(p: Prospect, angle: string): Pitch {
  const first = hi(p);
  const b = p.business || "your club";
  const T: Record<string, Pitch> = {
    proshop_intro: founderLetter(p),
    margin: {
      subject: `a counter product for the ${b} pro shop`,
      body: `Hi ${first},\n\nQuick idea for the pro shop at ${b}: Active 10 is a topical recovery cream (made in the USA, hemp-derived, THC-free) that players buy right at the counter after a match. Wholesale runs about 50% off retail, so it's easy margin on a small footprint.\n\nJarrett Chirico has it in his shop at North Hills and it's been one of his best sellers. Want me to send a free sample so you can see for yourself?\n\nDarrin & June\nActive 10\n${SITE}`,
    },
    player_demand: {
      subject: `what your players use after a match`,
      body: `Hi ${first},\n\nFollowing up — the reason Active 10 works in a pro shop is pull-through: players try it after a tough match, feel the difference, and come back to the counter for more. We'll send free samples to get it started, no cost and no commitment.\n\nCan I mail a sample to ${b}? Just reply with a shipping address.\n\nDarrin & June\nActive 10\n${SITE}`,
    },
    trial: {
      subject: `an easy first order for ${b}`,
      body: `Hi ${first},\n\nI know adding a product to the shop is a hassle, so we make the first order easy — no minimum, free shipping, and free samples to try first. If even a few of your players like it, it earns its shelf space.\n\nHappy to set ${b} up whenever you're ready. Want a sample first?\n\nDarrin & June\nActive 10\n${SITE}`,
    },
  };
  return T[angle] || T.margin;
}

export function templatePitch(p: Prospect, angle: string): Pitch {
  if ((p.type || "") === "club") return clubTemplatePitch(p, angle);
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
  const isClub = (p.type || "") === "club";
  const clubAngleHint: Record<string, string> = {
    margin: "the pro shop can stock Active 10 and sell it at the counter at a ~50%-off-retail wholesale margin — easy revenue on a tiny footprint",
    player_demand: "players try it after a match, feel the difference, and come back to the counter for more; we send free samples to start that pull-through",
    trial: "a genuinely low-risk first order: no minimum, free shipping, free samples first — if a few players like it, it earns its shelf space",
  };
  const tone = TONES[opts.tone || "human"] || TONES.human;
  const lengthRule = opts.length === "medium" ? "4–6 short sentences, under 110 words" : opts.length === "tiny" ? "2–3 sentences, under 45 words" : "3–4 short sentences, under 75 words";
  const research = (p.research || "").trim();

  const hcPrompt = `You're Darrin Cohen, founder of Active 10 (professional-grade CBD & topical pain-relief products for healthcare practices — wholesale.getactive10.com). Write ONE cold outreach email that actually gets a reply.

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

  const clubPrompt = `You're Darrin Cohen. You and your cofounder June Munroe make Active 10, a topical recovery cream (made in the USA, hemp-derived, THC-free) that racquet players use after a match. You sell it wholesale to private-club PRO SHOPS to stock at the counter. Write ONE cold outreach email to a club's racquets director / GM that actually gets a reply.

Recipient: ${p.name || "the racquets director"} at "${p.business || "a private club"}"${p.city ? ` in ${p.city}` : ""}.
The hook: ${clubAngleHint[angle] || clubAngleHint.margin}.
Proof you can reference (true): Jarrett Chirico (Dir. of Racquets, North Hills Club) carries Active 10 in his pro shop and it's been one of his best sellers.
${research ? `\nWhat their club's website says (USE THIS — open with one specific, true detail from it, stated casually, never flattery):\n"""${research.slice(0, 1200)}"""\n` : ""}
Two examples of the QUALITY BAR — match their feel and specificity (do NOT copy the content):

EXAMPLE 1
subject: jarrett chirico sent me your way
body: Quick one — Jarrett Chirico stocks our recovery cream (Active 10) in his pro shop at North Hills and it's been a top seller at the counter. Players grab it after a match, love it, and come back. Want me to mail a free sample so you can see if your members go for it?\n\nDarrin & June

EXAMPLE 2
subject: a counter product players actually rebuy
body: We make a topical recovery cream players reach for after a tough match, and pro shops keep about a 50% margin selling it at the counter. I'd rather just send you one than pitch you — mail a free sample to the shop? Just reply with an address.\n\nDarrin & June

What makes it work (follow strictly):
- Sound like a busy human who dashed off a quick, genuine note — NOT marketing copy.
- Tone: ${tone}.
- Length: ${lengthRule}. Shorter is better.
- Subject line: lowercase, ~3–6 words, specific or curiosity-driven, never salesy.
- Open with something specific to THEM (from their website info above if provided); never open with pleasantries.
- Exactly ONE ask, a low-friction yes ("want me to send a free sample?") — not a hard sell.
- Use contractions and plain words. No stacked adjectives. At most one exclamation point.
- Sign off as just "Darrin & June" (unless the extra direction below specifies a different signature — then use that exactly).

BANNED (never use): "I hope this email finds you well", "I hope you're doing well", "I'm reaching out", "I wanted to reach out", "in today's", "fast-paced", "elevate", "seamless", "cutting-edge", "innovative", "exciting opportunity", "game-changer", "leverage", "synergy", "passionate about", "revolutionary", "unlock", "—" em-dashes, and corporate buzzwords. No fake personalization you can't back up — if no website info was given, don't invent details.
${opts.instructions ? `\nExtra direction from Darrin (follow this): ${opts.instructions}\n` : ""}
Return ONLY valid JSON: {"subject":"...","body":"..."} with \\n for line breaks in the body.`;

  const prompt = isClub ? clubPrompt : hcPrompt;

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
  // (founder_intro = healthcare first touch; proshop_intro = club first touch.)
  if (angle === "founder_intro" || angle === "proshop_intro") return { ...founderLetter(p), source: "template" };
  const ai = await geminiPitch(p, angle, opts);
  if (!("error" in ai)) return { ...ai, source: "ai" };
  return { ...templatePitch(p, angle), source: "template", aiError: ai.error };
}

// ── LinkedIn outreach ───────────────────────────────────────────────────────
// Two pieces: a connection-request NOTE (<=300 chars, no links — LinkedIn
// penalizes them) and a longer MESSAGE sent AFTER they accept (the real offer).
// Everything is copied and sent manually by Darrin — no automation.
export type LinkedInPitch = { connectNote: string; message: string };
export const LINKEDIN_NOTE_LIMIT = 300;

const clampNote = (s: string) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length <= LINKEDIN_NOTE_LIMIT ? t : t.slice(0, LINKEDIN_NOTE_LIMIT - 1).trimEnd() + "…";
};

export function templateLinkedInPitch(p: Prospect, angle: string): LinkedInPitch {
  const first = hi(p);
  const b = biz(p);
  const connectByAngle: Record<string, string> = {
    margin: `Hi ${first}, I'm Darrin — I make Active 10, a topical pain-relief cream chiropractors stock and resell to patients. Came across ${b} and thought I'd reach out to connect.`,
    pull_through: `Hi ${first}, I'm Darrin, founder of Active 10 (pro-grade topical pain relief). Lots of DCs hand our samples to patients between visits — saw ${b} and wanted to connect.`,
    clinical: `Hi ${first}, I'm Darrin with Active 10 — professional-grade topical relief for the musculoskeletal stuff you treat daily. Would love to connect with you and ${b}.`,
    trial: `Hi ${first}, I'm Darrin, founder of Active 10. We help practices like ${b} add a low-risk take-home pain-relief product. Thought I'd connect.`,
  };
  const connectNote = clampNote(connectByAngle[angle] || connectByAngle.margin);
  const message = `Thanks for connecting, ${first}!\n\nQuick reason I reached out: I make Active 10, a topical pain-relief cream that started with chiropractors using it on patients during adjustments and selling it at the front desk. Hundreds of practices carry it now.\n\nRather than pitch you, I'd just send you a free sample — try it on yourself and a few patients and see what they say. No sales call, no catch. Want me to mail one to ${b}? Just send me a shipping address, or grab one here: ${SITE}/sample\n\nDarrin Cohen\nFounder, Active 10`;
  return { connectNote, message };
}

async function geminiLinkedIn(p: Prospect, angle: string, opts: PitchOpts = {}): Promise<LinkedInPitch | { error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "no GEMINI_API_KEY" };
  const angleHint: Record<string, string> = {
    margin: "they can stock our products and resell to patients at a ~50%-off-retail wholesale margin",
    pull_through: "we give free patient sample packets that create take-home demand so patients come back asking to buy",
    clinical: "professional-grade topical pain relief for the exact musculoskeletal issues they treat — a take-home complement to in-office care",
    trial: "a genuinely low-risk way to try it: free samples first, no commitment",
  };
  const tone = TONES[opts.tone || "human"] || TONES.human;
  const research = (p.research || "").trim();

  const prompt = `You're Darrin Cohen, founder of Active 10 (professional-grade topical pain-relief / CBD for healthcare practices — ${SITE}). Write a LinkedIn outreach pair to a ${p.type || "chiropractic"} practice owner.

Recipient: ${p.name || "the practice owner"}${p.business ? ` at "${p.business}"` : ""}${p.city ? ` in ${p.city}` : ""}.
The hook: ${angleHint[angle] || angleHint.margin}.
${research ? `\nWhat their LinkedIn/website says (use one true, specific detail; never flattery):\n"""${research.slice(0, 800)}"""\n` : ""}
Produce TWO things:
1) "connectNote": the note attached to a LinkedIn CONNECTION REQUEST. HARD LIMIT 300 characters (count them — must be under 300). Warm, human, who-you-are + a soft reason you're reaching out. NO links/URLs (LinkedIn penalizes them). No hard sell — the goal is just to get the connection accepted. Sign as "Darrin" only if it fits the character budget, otherwise omit the signature.
2) "message": the message you send AFTER they accept. This is where the real ask goes: offer to mail a FREE sample (no sales call, no catch), ask for a shipping address OR point them to ${SITE}/sample, and sign "Darrin Cohen / Founder, Active 10". 3–5 short sentences.

Tone: ${tone}. Use contractions, plain words, no corporate buzzwords.
BANNED: "I hope this finds you well", "I wanted to reach out", "I'm reaching out", "exciting opportunity", "leverage", "synergy", "passionate about", em-dashes, stacked adjectives.

Return ONLY valid JSON: {"connectNote":"...","message":"..."} with \\n for line breaks in message.`;

  const MODELS = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastError = "";
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, topP: 0.95, responseMimeType: "application/json" },
        }),
      });
      if (!r.ok) { lastError = `${model}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`; console.error("Gemini LI error:", lastError); continue; }
      const d = await r.json();
      let txt: string = d?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      txt = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt);
      if (parsed.connectNote && parsed.message) {
        return { connectNote: clampNote(String(parsed.connectNote)), message: String(parsed.message) };
      }
      lastError = `${model}: empty/invalid JSON`;
    } catch (e: any) {
      lastError = `${model}: ${String(e?.message || e).slice(0, 200)}`;
      console.error("Gemini LI error:", lastError);
    }
  }
  return { error: lastError };
}

export async function generateLinkedInPitch(p: Prospect, angle: string, opts: PitchOpts = {}): Promise<LinkedInPitch & { source: "ai" | "template"; aiError?: string }> {
  const ai = await geminiLinkedIn(p, angle, opts);
  if (!("error" in ai)) return { ...ai, source: "ai" };
  return { ...templateLinkedInPitch(p, angle), source: "template", aiError: ai.error };
}
