"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Due = { id: string; name: string; email: string; business: string | null; city: string | null; cadence: number; daysSinceLastOrder: number; orderCount: number; topProduct: string | null; lastReminderAt: string | null };

export default function AdminRestock() {
  const [rows, setRows] = useState<Due[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/restock/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) setRows(d.due); else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnP: React.CSSProperties = { padding: "9px 18px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };

  const sendOne = async (c: Due) => { setBusy(c.id); setMsg(null); const d = await call({ action: "send", customerId: c.id }); setBusy(null); if (d.ok) { setMsg({ t: `Reminder sent to ${c.name}.`, ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false }); };
  const sendAll = async () => { if (!confirm(`Send a restock reminder to all ${rows.length} practices that are due?`)) return; setBusy("all"); setMsg(null); const d = await call({ action: "send_all" }); setBusy(null); if (d.ok) { setMsg({ t: `Sent ${d.sent} restock reminder${d.sent === 1 ? "" : "s"}.`, ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false }); };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Active practices that are due to reorder based on their own ordering rhythm. A gentle nudge with one-click reorder — no discount needed.</div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={load} style={btnS}>↻ Refresh</button>{rows.length > 0 && <button onClick={sendAll} disabled={busy === "all"} style={{ ...btnP, opacity: busy === "all" ? .5 : 1 }}>{busy === "all" ? "Sending…" : `📧 Send All Due (${rows.length})`}</button>}</div>
    </div>

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No one is due to restock right now. Check back as orders age — practices appear here automatically when they hit their usual reorder window.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rows.map((c) => (
        <div key={c.id} style={{ ...card, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.business || c.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.name} · {c.email}</div>
            <div style={{ fontSize: 12, color: BL, marginTop: 3 }}>Orders every ~{c.cadence} days · last order {c.daysSinceLastOrder} days ago{c.topProduct ? ` · ♥ ${c.topProduct}` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.lastReminderAt && <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>last nudge {new Date(c.lastReminderAt).toLocaleDateString()}</span>}
            <button onClick={() => sendOne(c)} disabled={busy === c.id} style={{ ...btnP, opacity: busy === c.id ? .5 : 1 }}>{busy === c.id ? "Sending…" : "📧 Send Reminder"}</button>
          </div>
        </div>
      ))}</div>}
  </div>);
}
