"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tinder for the growth engine: each card is the real email. Right = send it,
// left = skip it. Nothing leaves activeformulations@ until it's swiped right.

type Card = {
  id: string; lane: string; laneLabel: string; to: string; name: string | null; business: string | null;
  time: string; subject: string; html: string; text: string; why: string;
};
type Deck = { date: string | null; dateLabel: string | null; total: number; approved: number; skipped: number; firstSend: string | null; learned: string[]; cards: Card[] };

const REASONS: [string, string][] = [
  ["wrong_person", "Wrong person"], ["greeting", "Bad greeting"], ["offer", "Wrong offer"], ["voice", "Doesn't sound like me"], ["timing", "Not now"],
];
type Action = "approve" | "reject" | "never";

const LANE_COLOR: Record<string, string> = {
  restock: "#0284c7", winback: "#d97706", winback_bump: "#d97706", cold_bump: "#7c3aed",
  chiro: "#059669", club: "#db2777", sample_followup: "#0d9488",
};

export default function SwipePage() {
  const [key, setKey] = useState<string | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [history, setHistory] = useState<{ card: Card; action: Action | "edit" }[]>([]);
  const [counts, setCounts] = useState({ approved: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [fly, setFly] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [askWhy, setAskWhy] = useState<Card | null>(null); // the card just skipped → "why?" chips
  const whyTimer = useRef<any>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    let k = url.searchParams.get("k");
    try { if (k) localStorage.setItem("a10-deck", k); else k = localStorage.getItem("a10-deck"); } catch { /* private mode */ }
    if (!k) { setError("Open this from the Swipe button in your Active 10 email."); return; }
    setKey(k);
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    const r = await fetch(`/api/growth/deck?k=${encodeURIComponent(key)}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "Couldn't load the deck."); return; }
    setDeck(j); setCards(j.cards); setCounts({ approved: j.approved, skipped: j.skipped });
  }, [key]);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const post = async (body: any) => {
    const r = await fetch(`/api/growth/deck?k=${encodeURIComponent(key!)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "That didn't save.");
    return j;
  };

  const decide = useCallback(async (card: Card, action: Action | "edit", extra: any = {}) => {
    const good = action === "approve" || action === "edit";
    setFly({ id: card.id, dir: good ? 1 : -1 });
    setTimeout(() => { setCards((cs) => cs.filter((c) => c.id !== card.id)); setFly(null); }, 280);
    setHistory((h) => [...h, { card, action }]);
    setCounts((c) => (good ? { ...c, approved: c.approved + 1 } : { ...c, skipped: c.skipped + 1 }));
    clearTimeout(whyTimer.current);
    if (action === "reject") { setAskWhy(card); whyTimer.current = setTimeout(() => setAskWhy(null), 6000); }
    else setAskWhy(null);
    try {
      return await post({ id: card.id, action, ...extra });
    } catch (e: any) {
      flash(e.message);
      setCards((cs) => [card, ...cs.filter((c) => c.id !== card.id)]);
      setHistory((h) => h.filter((x) => x.card.id !== card.id));
      setCounts((c) => (good ? { ...c, approved: c.approved - 1 } : { ...c, skipped: c.skipped - 1 }));
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return;
    try {
      await post({ id: last.card.id, action: "undo" });
      setHistory((h) => h.slice(0, -1));
      setCards((cs) => [last.card, ...cs]);
      const good = last.action === "approve" || last.action === "edit";
      setCounts((c) => (good ? { ...c, approved: c.approved - 1 } : { ...c, skipped: c.skipped - 1 }));
    } catch (e: any) { flash(e.message); }
  }, [history, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const giveReason = async (reason: string) => {
    const c = askWhy; setAskWhy(null); clearTimeout(whyTimer.current);
    if (!c) return;
    try { await post({ id: c.id, action: "reason", reason }); flash("Got it — I'll learn from that."); } catch (e: any) { flash(e.message); }
  };

  const top = cards[0];
  const never = (c: Card) => { if (confirm(`Never email ${c.name || c.to} again?`)) decide(c, "never"); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || !top) return;
      if (e.key === "ArrowRight") decide(top, "approve");
      else if (e.key === "ArrowLeft") decide(top, "reject");
      else if (e.key === "Backspace" || e.key === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, editing, decide, undo]);

  const done = counts.approved + counts.skipped;

  return (
    <div className="sw-root">
      <style>{CSS}</style>
      <header className="sw-head">
        <div>
          <div className="sw-brand">Active 10</div>
          <div className="sw-date">{deck?.dateLabel || " "}</div>
        </div>
        {deck && deck.total > 0 && (
          <div className="sw-progress">
            <span className="ok">✓ {counts.approved}</span> <span className="no">✕ {counts.skipped}</span>
            <div className="sw-bar"><i style={{ width: `${(done / deck.total) * 100}%` }} /></div>
          </div>
        )}
      </header>

      <main className="sw-stack">
        {error && <div className="sw-empty"><p>{error}</p></div>}
        {!error && !deck && <div className="sw-empty"><p>Loading…</p></div>}
        {deck && !top && (
          <div className="sw-empty">
            <div className="big">{deck.total ? "🎉" : "📭"}</div>
            {deck.total ? (
              <>
                <h2>All swiped</h2>
                <p>{counts.approved} going out{deck.dateLabel ? ` ${deck.dateLabel}` : ""}, {counts.skipped} skipped.</p>
                <p className="dim">They send themselves, spread across the day from activeformulations@gmail.com.</p>
              </>
            ) : (
              <>
                <h2>Nothing to swipe</h2>
                <p className="dim">The next batch shows up here at 4pm the day before. You'll get an email.</p>
              </>
            )}
            {deck.learned?.length > 0 && (
              <div className="learned">
                <div className="lt">🧠 What I've learned</div>
                {deck.learned.map((l, i) => <div key={i} className="li">{l}</div>)}
              </div>
            )}
          </div>
        )}
        {cards[1] && <EmailCard key={cards[1].id} card={cards[1]} behind />}
        {top && <EmailCard key={top.id} card={top} fly={fly?.id === top.id ? fly.dir : 0} onSwipe={(dir) => decide(top, dir > 0 ? "approve" : "reject")} />}
      </main>

      <footer className="sw-actions">
        <button className="b sm" onClick={undo} disabled={!history.length} aria-label="Undo">↺</button>
        <button className="b no" onClick={() => top && decide(top, "reject")} disabled={!top} aria-label="Skip">✕</button>
        <button className="b sm" onClick={() => top && setEditing(top)} disabled={!top} aria-label="Edit">✎</button>
        <button className="b yes" onClick={() => top && decide(top, "approve")} disabled={!top} aria-label="Send">✓</button>
        <button className="b sm" onClick={() => top && never(top)} disabled={!top} aria-label="Never email">🚫</button>
      </footer>

      {askWhy && (
        <div className="sw-why">
          <div className="q">Why skip {askWhy.name || askWhy.to}?</div>
          <div className="chips">{REASONS.map(([k, label]) => <button key={k} onClick={() => giveReason(k)}>{label}</button>)}</div>
        </div>
      )}
      {editing && <Editor card={editing} onCancel={() => setEditing(null)} onSave={(subject, text, saveTemplate) => {
        const c = editing; setEditing(null);
        const label = c.laneLabel.toLowerCase();
        decide({ ...c, subject, text }, "edit", { subject, text, saveTemplate }).then(async (j: any) => {
          if (!saveTemplate || !j) return;
          // The server rewrote the rest of this lane's cards — pull them so the next one shows it.
          await load();
          flash(j.updated ? `Rewrote ${j.updated} more ${label} card${j.updated === 1 ? "" : "s"} your way.` : `Saved. Every future ${label} email uses your wording.`);
        });
      }} />}
      {toast && <div className="sw-toast">{toast}</div>}
    </div>
  );
}

function EmailCard({ card, behind, fly = 0, onSwipe }: { card: Card; behind?: boolean; fly?: number; onSwipe?: (dir: 1 | -1) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const g = useRef({ x: 0, y: 0, dx: 0, active: false, horiz: false });
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  const down = (e: React.PointerEvent) => {
    if (behind || (e.target as HTMLElement).closest("a,button")) return;
    g.current = { x: e.clientX, y: e.clientY, dx: 0, active: true, horiz: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s.active) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.horiz) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) { s.horiz = true; ref.current?.setPointerCapture(e.pointerId); setDragging(true); }
      else if (Math.abs(my) > 12) { s.active = false; return; } // it's a scroll
    }
    if (s.horiz) { s.dx = mx; setDx(mx); }
  };
  const up = () => {
    const s = g.current;
    if (s.horiz && Math.abs(s.dx) > 110) onSwipe?.(s.dx > 0 ? 1 : -1);
    g.current = { x: 0, y: 0, dx: 0, active: false, horiz: false };
    setDragging(false); setDx(0);
  };

  const x = fly ? fly * 800 : dx;
  const style: React.CSSProperties = behind
    ? { transform: "scale(.95) translateY(14px)", opacity: 0.6 }
    : { transform: `translateX(${x}px) rotate(${x / 22}deg)`, transition: dragging ? "none" : "transform .28s ease" };
  const yes = Math.max(0, Math.min(1, x / 110)), no = Math.max(0, Math.min(1, -x / 110));

  return (
    <div ref={ref} className={`sw-card${behind ? " behind" : ""}`} style={style}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {!behind && <div className="stamp yes" style={{ opacity: yes }}>SEND</div>}
      {!behind && <div className="stamp no" style={{ opacity: no }}>SKIP</div>}
      <div className="sw-meta">
        <span className="pill" style={{ background: LANE_COLOR[card.lane] || "#475569" }}>{card.laneLabel}</span>
        <span className="when">{card.time}</span>
      </div>
      {card.why && <div className="why">{card.why}</div>}
      <div className="mail">
        <div className="hdr"><b>From</b> Darrin Cohen &lt;activeformulations@gmail.com&gt;</div>
        <div className="hdr"><b>To</b> {card.name ? `${card.name} <${card.to}>` : card.to}</div>
        <div className="subj">{card.subject}</div>
        <div className="body" dangerouslySetInnerHTML={{ __html: card.html }} />
      </div>
    </div>
  );
}

function Editor({ card, onCancel, onSave }: { card: Card; onCancel: () => void; onSave: (subject: string, text: string, saveTemplate: boolean) => void }) {
  const [subject, setSubject] = useState(card.subject);
  const [text, setText] = useState(card.text);
  const [always, setAlways] = useState(false);
  return (
    <div className="sw-modal">
      <div className="sheet">
        <div className="t">Edit, then send</div>
        <label>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label>Email</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <p className="dim">The "no thanks" line and address are added underneath automatically.</p>
        <label className="always"><input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} /> Write every {card.laneLabel.toLowerCase()} email this way from now on</label>
        <div className="row">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="go" onClick={() => onSave(subject, text, always)} disabled={!subject.trim() || !text.trim()}>Save &amp; send ✓</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.sw-root{height:100dvh;display:flex;flex-direction:column;overflow:hidden;padding:0 16px;max-width:560px;margin:0 auto;user-select:none}
.sw-head{display:flex;justify-content:space-between;align-items:center;padding:14px 2px 10px}
.sw-brand{font-weight:800;letter-spacing:.5px}
.sw-date{font-size:13px;opacity:.75}
.sw-progress{text-align:right;font-size:13px;font-weight:700}
.sw-progress .ok{color:#6ee7b7}.sw-progress .no{color:#fca5a5;margin-left:6px}
.sw-bar{width:120px;height:5px;border-radius:9px;background:rgba(255,255,255,.2);margin-top:5px;overflow:hidden}
.sw-bar i{display:block;height:100%;background:#6ee7b7;transition:width .3s}
.sw-stack{position:relative;flex:1;min-height:0}
.sw-card{position:absolute;inset:0;background:#fff;color:#1f2937;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;touch-action:pan-y;will-change:transform}
.sw-card.behind{pointer-events:none}
.stamp{position:absolute;top:22px;z-index:3;font-weight:900;font-size:30px;padding:4px 14px;border:4px solid;border-radius:10px;pointer-events:none;letter-spacing:2px}
.stamp.yes{left:18px;color:#059669;border-color:#059669;transform:rotate(-14deg)}
.stamp.no{right:18px;color:#dc2626;border-color:#dc2626;transform:rotate(14deg)}
.sw-meta{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 0}
.pill{color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px}
.when{font-size:12px;color:#6b7280}
.why{margin:8px 16px 0;font-size:13px;color:#374151;background:#f3f4f6;border-radius:10px;padding:8px 10px;line-height:1.4}
.mail{flex:1;overflow-y:auto;padding:12px 16px 20px;-webkit-overflow-scrolling:touch}
.hdr{font-size:12px;color:#6b7280;line-height:1.6;word-break:break-all}.hdr b{color:#374151;margin-right:4px}
.subj{font-size:17px;font-weight:700;margin:8px 0 12px;color:#111827;line-height:1.3}
.body{user-select:text}.body a{color:#0072BC}
.sw-actions{display:flex;justify-content:center;align-items:center;gap:14px;padding:14px 0 max(18px,env(safe-area-inset-bottom))}
.b{border:none;border-radius:50%;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;transition:transform .12s}
.b:active{transform:scale(.9)}.b:disabled{opacity:.35}
.b.sm{width:46px;height:46px;font-size:19px;color:#475569}
.b.no{width:64px;height:64px;font-size:28px;color:#dc2626}
.b.yes{width:64px;height:64px;font-size:30px;color:#059669}
.sw-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px}
.sw-empty .big{font-size:56px}.sw-empty h2{font-size:24px;font-weight:800;margin:10px 0 6px}
.dim{opacity:.7;font-size:13px;margin-top:6px}
.sw-toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:20;max-width:90vw}
.sw-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:30}
.sheet{background:#fff;color:#1f2937;width:100%;max-width:560px;border-radius:18px 18px 0 0;padding:18px 16px max(18px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;max-height:92dvh}
.sheet .t{font-weight:800;font-size:17px;margin-bottom:4px}
.sheet label{font-size:12px;font-weight:700;color:#6b7280;margin-top:6px}
.sheet input,.sheet textarea{border:1px solid #d1d5db;border-radius:10px;padding:10px;font-size:15px;font-family:inherit;color:#111827;width:100%;user-select:text}
.sheet textarea{flex:1;min-height:40dvh;resize:none;line-height:1.45}
.sheet .row{display:flex;gap:10px;margin-top:10px}
.sheet button{flex:1;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:700;cursor:pointer}
.ghost{background:#f3f4f6;color:#374151}.go{background:#059669;color:#fff}.go:disabled{opacity:.4}
.sheet .always{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#111827;margin-top:4px}
.sheet .always input{width:18px;height:18px;flex:none}
.sw-why{position:fixed;left:50%;bottom:104px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));background:#111827;border-radius:14px;padding:10px 12px;z-index:15;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.sw-why .q{font-size:13px;opacity:.8;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sw-why .chips{display:flex;flex-wrap:wrap;gap:6px}
.sw-why button{background:#374151;color:#fff;border:none;border-radius:20px;padding:7px 12px;font-size:13px;cursor:pointer}
.learned{margin-top:18px;background:rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;text-align:left;max-width:420px}
.learned .lt{font-weight:800;margin-bottom:6px}.learned .li{font-size:13px;line-height:1.45;opacity:.9;margin-top:3px}
`;
