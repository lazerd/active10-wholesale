"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Cart = { id: string; customer_name: string; customer_email: string; items: any[]; itemCount: number; total: number; updated_at: string; recovery_sent_at: string | null };

const ago = (iso: string) => { const h = (Date.now() - +new Date(iso)) / 3600000; return h < 1 ? `${Math.round(h * 60)}m ago` : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

export default function AdminAbandoned() {
  const [rows, setRows] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/abandoned/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) setRows(d.carts); else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnP: React.CSSProperties = { padding: "9px 18px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };

  const sendOne = async (c: Cart) => { setBusy(c.id); setMsg(null); const d = await call({ action: "send", cartId: c.id }); setBusy(null); if (d.ok) { setMsg({ t: `Reminder sent to ${c.customer_name}.`, ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false }); };
  const sendAll = async () => { if (!confirm(`Send a cart reminder to all ${rows.length} customers?`)) return; setBusy("all"); setMsg(null); const d = await call({ action: "send_all" }); setBusy(null); if (d.ok) { setMsg({ t: `Sent ${d.sent} reminder${d.sent === 1 ? "" : "s"}.`, ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false }); };

  const potential = rows.reduce((s, c) => s + c.total, 0);

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Customers who built a cart but didn't check out (idle 60+ min). One click sends them back to their saved cart.{rows.length > 0 ? ` ~$${potential.toFixed(2)} in recoverable orders.` : ""}</div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={load} style={btnS}>↻ Refresh</button>{rows.length > 0 && <button onClick={sendAll} disabled={busy === "all"} style={{ ...btnP, opacity: busy === "all" ? .5 : 1 }}>{busy === "all" ? "Sending…" : `📧 Send All (${rows.length})`}</button>}</div>
    </div>

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No abandoned carts right now. 🎉 Carts that sit idle for 60+ minutes show up here.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rows.map((c) => (
        <div key={c.id} style={{ ...card, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.customer_name || c.customer_email}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.customer_email}</div>
            <div style={{ fontSize: 12, color: "#FFC940", marginTop: 3 }}>{c.itemCount} items · ${c.total.toFixed(2)} · idle {ago(c.updated_at)}{c.items?.length ? ` · ${c.items.map((i: any) => i.name).slice(0, 2).join(", ")}${c.items.length > 2 ? "…" : ""}` : ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.recovery_sent_at && <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>nudged {ago(c.recovery_sent_at)}</span>}
            <button onClick={() => sendOne(c)} disabled={busy === c.id} style={{ ...btnP, opacity: busy === c.id ? .5 : 1 }}>{busy === c.id ? "Sending…" : "📧 Send Reminder"}</button>
          </div>
        </div>
      ))}</div>}
  </div>);
}
