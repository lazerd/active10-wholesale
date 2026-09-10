import { founderLetter } from "@/lib/outreachPitch";
import { monthDay, monthYear, shortGreeting } from "./config";

export type Mail = { subject: string; text: string };

const SIGN = "Darrin Cohen\nFounder, Active 10\n800-636-4130";

// ── cold: the chiropractor letter (unchanged from the 9/8 batch — it's the one
// that earned replies, so it is reused word for word) ─────────────────────────
const CHIRO_PARAS = [
  "I'll keep this short because I know your day is booked back to back.",
  "My name is Darrin and I make Active 10, a topical pain relief cream. Chiropractors were our first real customers. Before we ever sold a single jar online, it was DCs using it on patients during adjustments and selling it at the front desk. Years later, that's still the heart of the business — hundreds of practices around the country carry it now.",
  "The short version of why it sticks: patients use it after their adjustment and between visits, they feel the difference, and they come back to your front desk asking for more. It sells itself once it's on the shelf, and the margins actually make it worth shelf space.",
  "But I'd rather you judge that yourself than take my word for it. Reply with your shipping address and I'll personally get samples in the mail to you this week. No catch, no sales call, no ten-email follow-up sequence. Try it on yourself, try it on a few patients, and see what they say.",
  "If it earns a spot in the practice, the first order is simple: our starter kit is 3 tubes, 3 roll-ons and 10 single-use sample packets for $99 shipped. That's about $120 at normal wholesale, and $240 of retail sitting on your front desk. Setting up the account takes two minutes at wholesale.getactive10.com.",
  "Either way, thanks for reading this far. I mean that.",
];

export function chiroFirst(greeting: string, business: string): Mail {
  return { subject: `Active 10 — samples for ${business}?`, text: [greeting, ...CHIRO_PARAS, SIGN].join("\n\n") };
}

export function clubFirst(name: string | null, business: string | null): Mail {
  const l = founderLetter({ type: "club", name, business });
  return { subject: l.subject, text: l.body };
}

/** The ONE follow-up a cold contact ever gets — the letter promises no sequence. */
export function coldBump(kind: "chiro" | "club", greeting: string, originalSubject: string): Mail {
  const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
  if (kind === "club") {
    return {
      subject,
      text: `${greeting}\n\nFloating this back up once in case it got buried. Happy to mail a free sample to the shop, just reply with where to send it. If it's not a fit, no worries, and this is the last you'll hear from me about it.\n\nDarrin & June`,
    };
  }
  return {
    subject,
    text: `${greeting}\n\nBumping this once in case it got buried under the day. The offer is simple: reply with a shipping address and I'll mail you samples this week. If it's not a fit, no problem, and I won't keep writing.\n\nDarrin`,
  };
}

// ── customers ───────────────────────────────────────────────────────────────
/** Modeled on the Jarrett Chirico check-in: facts about THEIR cadence, no discount. */
export function restock(greeting: string, o: { lastDate: string; days: number; gapDays: number; lastOrder: string | null; portal: boolean }): Mail {
  const weeks = Math.round(o.days / 7);
  const ask = o.lastOrder
    ? `Last time you took ${o.lastOrder}. Want me to put the same together?`
    : "Want me to put your usual order together?";
  const how = o.portal
    ? "Just reply and I'll get it out to you this week, or reorder in a couple of clicks at wholesale.getactive10.com."
    : "Just reply and I'll get it out to you this week.";
  return {
    subject: "checking in from Active 10",
    text: `${greeting}\n\nIt's been about ${weeks} weeks since your last order (${monthDay(o.lastDate)}), and you usually reorder about every ${o.gapDays} days, so I wanted to check in rather than assume anything.\n\n${ask} ${how}\n\nAnd if something changed on your end, a different supplier or changes at the practice, I'd genuinely rather know than keep wondering.\n\nThanks,\nDarrin\nActive 10`,
  };
}

/** Same offer as the July mailing that produced this summer's orders: 20% off, any size. */
export function winback(greeting: string, o: { lastDate: string; portal: boolean }): Mail {
  const online = o.portal
    ? " Or order online at wholesale.getactive10.com with code WELCOMEBACK."
    : "";
  return {
    subject: "20% off to welcome you back to Active 10",
    text: `${greeting}\n\nYour last Active 10 order was back in ${monthYear(o.lastDate)}, so I wanted to reach out personally. We're still here, and my cofounder June and I still pack most orders ourselves.\n\nIf you'd like to restock, I'll take 20% off your next order, any size. Easiest way: reply with what you'd like and I'll send you an invoice.${online}\n\nAnd if it's no longer a fit, no hard feelings. A one-line reply telling me why would honestly help.\n\n${SIGN}`,
  };
}

export function winbackBump(greeting: string, originalSubject: string): Mail {
  return {
    subject: /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`,
    text: `${shortGreeting(greeting)}, floating this back up in case it got buried. The 20% off still stands. Just reply with what you need and I'll take care of the rest.\n\nDarrin`,
  };
}

/** After a sample went out and nothing came back. */
export function sampleFollowup(greeting: string): Mail {
  return {
    subject: "did the samples make it?",
    text: `${greeting}\n\nChecking that the Active 10 samples made it to you. I'm curious what you and your patients thought, good or bad.\n\nIf it earned a spot, the easiest way to start is our starter kit: 3 tubes, 3 roll-ons and 10 single-use sample packets for $99 shipped. That's about $240 of retail on your front desk. Reply "send the kit" and I'll invoice you and get it out this week, or set up an account at wholesale.getactive10.com and it's waiting on your home page.\n\nThanks for giving it a try.\n\n${SIGN}`,
  };
}
