"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Touch = { id: string; angle: string; subject: string; body: string; status: string; sent_at: string | null };
type Prospect = { id: string; name: string | null; business: string | null; email: string | null; website: string | null; city: string | null; type: string; status: string; touch_count: number; touches: Touch[] };
type Funnel = { total: number; prospected: number; emailed: number; replied: number; won: number; dead: number };

const statusColor: Record<string, string> = { prospected: "#9FD2F0", emailed: "#FFC940", followed_up: "#FFA940", replied: GR, won: GR, dead: "rgba(255,255,255,.35)" };

export default function AdminOutreach() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [angles, setAngles] = useState<{ angle: string; sent: number; replied: number; rate: number }[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [searchOn, setSearchOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("chiropractor");
  const [urls, setUrls] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Touch>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [gmail, setGmail] = useState<{ connected: boolean; email: string | null; configured: boolean }>({ connected: false, email: null, configured: false });
  const [tone, setTone] = useState("human");
  const [length, setLength] = useState("short");
  const [instructions, setInstructions] = useState("");
  const [standing, setStanding] = useState("");
  const [standingSaved, setStandingSaved] = useState(true);
  const [savingStanding, setSavingStanding] = useState(false);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/outreach/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) { setRows(d.prospects); setFunnel(d.funnel); setAngles(d.angles); setAiOn(d.aiOn); setSearchOn(!!d.searchOn); setStanding(d.standingInstructions || ""); setStandingSaved(true); const dr: Record<string, Touch> = {}; d.prospects.forEach((p: Prospect) => { const draft = p.touches.find((t) => t.status === "draft"); if (draft) dr[p.id] = draft; }); setDrafts(dr); } else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/gmail/status", { cache: "no-store" }).then((r) => r.json()).then(setGmail).catch(() => {}); }, []);

  const sendGmail = async (p: Prospect, t: Touch) => { setBusy(t.id); setMsg(null); await call({ action: "update_touch", touchId: t.id, subject: t.subject, body: t.body }); const d = await call({ action: "send_gmail", touchId: t.id, prospectId: p.id }); setBusy(null); if (d.ok) { setDrafts((x) => { const n = { ...x }; delete n[p.id]; return n; }); setMsg({ t: `Sent to ${p.email} via Gmail.`, ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false }); };
  const checkReplies = async () => { setBusy("replies"); setMsg(null); const d = await call({ action: "check_replies" }); setBusy(null); if (d.ok) { setMsg({ t: `Checked Gmail — ${d.replies} new repl${d.replies === 1 ? "y" : "ies"} found.`, ok: true }); load(); } else setMsg({ t: d.error || "Failed", ok: false }); };
  const disconnectGmail = async () => { if (!confirm("Disconnect Gmail?")) return; await fetch("/api/gmail/disconnect", { method: "POST" }); setGmail({ connected: false, email: null, configured: gmail.configured }); };

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const inp: React.CSSProperties = { padding: "10px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const btnP: React.CSSProperties = { padding: "10px 18px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "7px 12px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };

  const scrape = async () => {
    if (busy) return;
    if (!query.trim() && !urls.trim()) { setMsg({ t: "Enter a search (e.g. 'chiropractors in Walnut Creek') or paste practice URLs.", ok: false }); return; }
    setBusy("scrape"); setMsg(null);
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const payload: any = { type, city };
    if (urls.trim()) payload.urls = urls.split(/[\s,\n]+/).map((u) => u.trim()).filter(Boolean);
    else payload.query = query.trim();
    const r = await fetch("/api/outreach/scrape", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const d = await r.json();
    setBusy(null);
    if (d.error) { setMsg({ t: d.error, ok: false }); return; }
    setMsg({ t: `Found ${d.added} new prospect${d.added === 1 ? "" : "s"}.${d.note ? " " + d.note : ""}`, ok: d.added > 0 });
    load();
  };

  const generate = async (p: Prospect) => { setBusy(p.id); setMsg(null); const d = await call({ action: "generate", prospectId: p.id, tone, length, instructions: instructions.trim() || undefined }); setBusy(null); if (d.ok) { setDrafts((x) => ({ ...x, [p.id]: d.touch })); if (d.source === "template") setMsg({ t: d.aiKey ? `⚠️ AI failed, used a template. Reason: ${d.aiError || "unknown"}` : "⚠️ No Gemini key in production — using templates.", ok: false }); else setMsg({ t: "✨ AI-generated with your current style.", ok: true }); } else setMsg({ t: d.error || "Failed", ok: false }); };
  const copyEmail = (p: Prospect, t: Touch) => { navigator.clipboard?.writeText(`Subject: ${t.subject}\n\n${t.body}`); setCopiedId(t.id); setTimeout(() => setCopiedId(null), 1800); };
  const markSent = async (p: Prospect, t: Touch) => { await call({ action: "update_touch", touchId: t.id, subject: t.subject, body: t.body }); await call({ action: "mark_sent", touchId: t.id, prospectId: p.id }); setDrafts((x) => { const n = { ...x }; delete n[p.id]; return n; }); load(); };
  const setStatus = async (p: Prospect, status: string) => { const lastSent = [...p.touches].find((t) => t.status === "sent"); await call({ action: "set_status", prospectId: p.id, status, touchId: status === "replied" ? lastSent?.id : undefined }); load(); };
  const del = async (p: Prospect) => { if (!confirm(`Remove ${p.business || p.email}?`)) return; await call({ action: "delete", prospectId: p.id }); load(); };

  const editDraft = (pid: string, field: "subject" | "body", val: string) => setDrafts((x) => ({ ...x, [pid]: { ...x[pid], [field]: val } }));
  const saveStanding = async () => { setSavingStanding(true); const d = await call({ action: "save_settings", standing_instructions: standing }); setSavingStanding(false); if (d.ok) { setStandingSaved(true); setMsg({ t: "Standing rules saved — they'll apply to every pitch from now on.", ok: true }); } else setMsg({ t: d.error || "Save failed", ok: false }); };

  return (<div>
    {/* Gmail connection */}
    <div style={{ ...card, padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, background: gmail.connected ? `${GR}10` : "rgba(255,255,255,.03)", borderColor: gmail.connected ? `${GR}33` : `${B}22` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>📬</span><div><div style={{ fontSize: 13, fontWeight: 700, color: gmail.connected ? GR : "rgba(255,255,255,.7)" }}>Gmail {gmail.connected ? `connected · ${gmail.email}` : "not connected"}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{gmail.connected ? "Send pitches & auto-detect replies." : gmail.configured ? "Connect to send & track replies automatically." : "Add GOOGLE_CLIENT_ID/SECRET in Vercel to enable."}</div></div></div>
      <div style={{ display: "flex", gap: 8 }}>
        {gmail.connected && <button onClick={checkReplies} disabled={busy === "replies"} style={{ ...btnP, opacity: busy === "replies" ? 0.5 : 1 }}>{busy === "replies" ? "Checking…" : "🔄 Check Replies"}</button>}
        {gmail.connected ? <button onClick={disconnectGmail} style={btnS}>Disconnect</button> : gmail.configured ? <a href="/api/gmail/connect" style={{ ...btnP, textDecoration: "none" }}>Connect Gmail</a> : null}
      </div>
    </div>

    {/* Finder */}
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>🔎 Find prospects</div>
        <div style={{ fontSize: 11, display: "flex", gap: 12, flexWrap: "wrap" }}><span style={{ color: aiOn ? GR : "#FFC940" }}>{aiOn ? "✨ Gemini AI pitches ON" : "📝 Template pitches"}</span><span style={{ color: searchOn ? GR : "#FFC940" }}>{searchOn ? "🔎 Brave search ON" : "🔎 Auto-search off (paste URLs)"}</span></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inp, flex: "0 0 150px" }}><option value="chiropractor">Chiropractors</option><option value="affiliate">Affiliates</option><option value="other">Other</option></select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, e.g. 'chiropractors in Walnut Creek CA'" style={{ ...inp, flex: 1, minWidth: 240 }} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" style={{ ...inp, flex: "0 0 160px" }} />
        <button onClick={scrape} disabled={busy === "scrape"} style={{ ...btnP, opacity: busy === "scrape" ? 0.5 : 1 }}>{busy === "scrape" ? "Scanning…" : "Find Prospects"}</button>
      </div>
      <details style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>
        <summary style={{ cursor: "pointer" }}>Or paste practice website URLs directly (most reliable)</summary>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://practice1.com&#10;https://practice2.com" rows={3} style={{ ...inp, width: "100%", marginTop: 8, resize: "vertical", fontFamily: "inherit" }} />
        <button onClick={scrape} disabled={busy === "scrape"} style={{ ...btnS, marginTop: 6 }}>Scrape these URLs</button>
      </details>
    </div>

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {funnel && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 16 }}>
      {[["Prospects", funnel.total, "#9FD2F0"], ["Emailed", funnel.emailed, "#FFC940"], ["Replied", funnel.replied, GR], ["Won", funnel.won, GR], ["Dead", funnel.dead, "rgba(255,255,255,.4)"]].map(([l, v, c], i) => (
        <div key={i} style={{ ...card, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c as string }}>{v as number}</div></div>
      ))}
    </div>}

    {angles.length > 0 && <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8 }}>🏆 Winning angles (reply rate)</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{angles.map((a) => <div key={a.angle} style={{ fontSize: 13 }}><span style={{ color: "white", fontWeight: 600, textTransform: "capitalize" }}>{a.angle.replace(/_/g, " ")}</span> <span style={{ color: GR, fontWeight: 700 }}>{a.rate}%</span> <span style={{ color: "rgba(255,255,255,.4)" }}>({a.replied}/{a.sent})</span></div>)}</div>
    </div>}

    {rows.length > 0 && <div style={{ ...card, padding: "14px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 10 }}>✍️ Pitch style <span style={{ textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,.3)" }}>— applies when you Generate / Regenerate</span></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ ...inp, flex: "0 0 auto" }}><option value="human">Tone: Warm &amp; human</option><option value="casual">Tone: Casual &amp; friendly</option><option value="direct">Tone: Direct &amp; punchy</option><option value="professional">Tone: Professional</option></select>
        <select value={length} onChange={(e) => setLength(e.target.value)} style={{ ...inp, flex: "0 0 auto" }}><option value="tiny">Length: Very short</option><option value="short">Length: Short</option><option value="medium">Length: Medium</option></select>
        <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="One-off direction for the next pitch, e.g. 'lead with the patient-retail margin; keep it 2 lines'" style={{ ...inp, flex: "1 1 280px" }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>📌 Standing rules <span style={{ textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,.3)" }}>— saved permanently, applied to every pitch</span></div>
        <textarea value={standing} onChange={(e) => { setStanding(e.target.value); setStandingSaved(false); }} rows={3} placeholder={'e.g.\nSign as: Darrin, then "Active Formulations Inc. CEO" on the next line\nAlways mention we are family-owned\nNever use the word "synergy"'} style={{ ...inp, width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <button onClick={saveStanding} disabled={savingStanding || standingSaved} style={{ ...btnP, opacity: savingStanding || standingSaved ? 0.5 : 1 }}>{savingStanding ? "Saving…" : standingSaved ? "✓ Saved" : "Save Rules"}</button>
          {!standingSaved && <span style={{ fontSize: 12, color: "#FFC940" }}>Unsaved changes</span>}
        </div>
      </div>
    </div>}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No prospects yet. Run a search above to start building your outreach list.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rows.map((p) => {
        const draft = drafts[p.id];
        const sentCount = p.touches.filter((t) => t.status === "sent" || t.status === "replied").length;
        return (<div key={p.id} style={{ ...card, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.business || p.email}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{p.email}{p.website ? ` · ` : ""}{p.website && <a href={p.website} target="_blank" rel="noreferrer" style={{ color: BL, textDecoration: "none" }}>site</a>}{p.city ? ` · ${p.city}` : ""}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>{sentCount > 0 ? `${sentCount} email${sentCount === 1 ? "" : "s"} sent` : "not contacted"}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusColor[p.status] || "white", textTransform: "capitalize" }}>{p.status.replace(/_/g, " ")}</span>
          </div>

          {draft ? (<div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${B}15`, position: "relative" }}>
            {busy === p.id && <div style={{ position: "absolute", inset: 0, background: "rgba(0,37,61,.55)", backdropFilter: "blur(1px)", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 10, background: `${B}33`, border: `1px solid ${BL}55`, borderRadius: 10, padding: "10px 18px" }}><span style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${BL}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><span style={{ fontSize: 13, fontWeight: 600 }}>Writing a new pitch…</span></div></div>}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <input value={draft.subject} onChange={(e) => editDraft(p.id, "subject", e.target.value)} style={{ ...inp, width: "100%", fontWeight: 600, marginBottom: 8, opacity: busy === p.id ? 0.4 : 1 }} />
            <textarea value={draft.body} onChange={(e) => editDraft(p.id, "body", e.target.value)} rows={8} style={{ ...inp, width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, opacity: busy === p.id ? 0.4 : 1 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {gmail.connected && p.email && <button onClick={() => sendGmail(p, draft)} disabled={busy === draft.id} style={{ ...btnP, background: `linear-gradient(135deg,${GR},#00D2A0)`, opacity: busy === draft.id ? 0.5 : 1 }}>{busy === draft.id ? "Sending…" : "📨 Send via Gmail"}</button>}
              <button onClick={() => copyEmail(p, draft)} style={btnP}>{copiedId === draft.id ? "✓ Copied" : "📋 Copy for Gmail"}</button>
              <button onClick={() => markSent(p, draft)} style={{ ...btnS, color: GR, borderColor: `${GR}55` }}>✓ Mark as Sent</button>
              <button onClick={() => generate(p)} disabled={busy === p.id} style={{ ...btnS, opacity: busy === p.id ? 0.5 : 1 }}>{busy === p.id ? "⏳ Writing…" : "↻ Regenerate"}</button>
            </div>
          </div>) : (<div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${B}15`, paddingTop: 12 }}>
            <button onClick={() => generate(p)} disabled={busy === p.id} style={{ ...btnP, opacity: busy === p.id ? 0.5 : 1 }}>{busy === p.id ? "Writing…" : sentCount > 0 ? "✍️ Write Follow-up (new angle)" : "✍️ Generate Pitch"}</button>
            {sentCount > 0 && p.status !== "replied" && <button onClick={() => setStatus(p, "replied")} style={{ ...btnS, color: GR, borderColor: `${GR}55` }}>💬 They Replied</button>}
            {p.status !== "won" && <button onClick={() => setStatus(p, "won")} style={btnS}>🎉 Won</button>}
            {p.status !== "dead" && <button onClick={() => setStatus(p, "dead")} style={btnS}>✕ Dead</button>}
            <button onClick={() => del(p)} style={{ ...btnS, color: "#FF6B6B", borderColor: "rgba(255,80,80,.3)", marginLeft: "auto" }}>Remove</button>
          </div>)}
        </div>);
      })}</div>}
  </div>);
}
