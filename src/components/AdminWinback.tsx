"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";

type Offer = { id: string; code: string; discount_pct: number; free_shipping: boolean; subject: string; body: string; reason: string; status: string; expires_at: string | null };
type Dormant = { id: string; name: string; email: string; business: string | null; city: string | null; daysSinceLastOrder: number; totalSpent: number; orderCount: number; topProduct: string | null; offer: Offer | null };
type Funnel = { dormantCount: number; drafted: number; sent: number; redeemed: number; revenueRecovered: number };

export default function AdminWinback() {
  const [rows, setRows] = useState<Dormant[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { pct: string; subject: string; free: boolean }>>({});
  const [preview, setPreview] = useState<string | null>(null);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/winback/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) { setRows(d.dormant); setFunnel(d.funnel); } else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnP: React.CSSProperties = { padding: "9px 18px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };
  const sIn: React.CSSProperties = { background: "rgba(255,255,255,.07)", border: `1px solid ${B}33`, borderRadius: 6, color: "white", padding: "7px 10px", fontSize: 13, outline: "none" };

  const generate = async (id: string) => { setBusy(id); setMsg(null); const d = await call({ action: "generate", customerId: id }); setBusy(null); if (d.ok) load(); else setMsg({ t: d.error || "Failed to generate", ok: false }); };
  const regenerate = generate;
  const send = async (o: Offer) => {
    if (!confirm("Send this comeback offer email now?")) return;
    setBusy(o.id); setMsg(null);
    const e = edit[o.id];
    if (e) await call({ action: "update", offerId: o.id, discount_pct: Number(e.pct) / 100, free_shipping: e.free, subject: e.subject });
    const d = await call({ action: "send", offerId: o.id });
    setBusy(null);
    if (d.ok) { setMsg({ t: "Offer sent! 📧", ok: true }); load(); } else setMsg({ t: d.error || "Send failed", ok: false });
  };
  const discard = async (o: Offer) => { if (!confirm("Discard this draft?")) return; const d = await call({ action: "delete", offerId: o.id }); if (d.ok) load(); else setMsg({ t: d.error || "Failed", ok: false }); };

  const ed = (o: Offer) => edit[o.id] || { pct: String(Math.round(o.discount_pct * 100)), subject: o.subject || "", free: o.free_shipping };
  const setEd = (id: string, patch: any) => setEdit((p) => ({ ...p, [id]: { ...ed(rows.find((r) => r.offer?.id === id)!.offer!), ...p[id], ...patch } }));

  const stat = (label: string, value: string, color: string) => (
    <div style={{ ...card, padding: "16px 18px" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div></div>
  );

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Customers who haven't ordered in 90+ days. Generate a suggested comeback offer, tweak it, and send when you're happy.</div>
      <button onClick={load} style={btnS}>↻ Refresh</button>
    </div>

    {funnel && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
      {stat("Dormant", String(funnel.dormantCount), "#FFA940")}
      {stat("Drafted", String(funnel.drafted), BL)}
      {stat("Sent", String(funnel.sent), "rgba(255,255,255,.85)")}
      {stat("Redeemed", String(funnel.redeemed), GR)}
      {stat("Revenue Recovered", `$${funnel.revenueRecovered.toFixed(2)}`, GR)}
    </div>}

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>🎉 No dormant customers — everyone's ordered recently!</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{rows.map((c) => {
        const o = c.offer;
        const months = Math.round(c.daysSinceLastOrder / 30);
        return (<div key={c.id} style={{ ...card, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.business || c.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.name} · {c.email}</div>
              <div style={{ fontSize: 12, color: "#FFA940", marginTop: 3 }}>Last order {months} mo ago · {c.orderCount} orders · ${c.totalSpent.toFixed(0)} lifetime{c.topProduct ? ` · ♥ ${c.topProduct}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!o && <button onClick={() => generate(c.id)} disabled={busy === c.id} style={{ ...btnP, opacity: busy === c.id ? .5 : 1 }}>{busy === c.id ? "Thinking…" : "✨ Generate Offer"}</button>}
              {o && o.status === "redeemed" && <span style={{ color: GR, fontWeight: 700, fontSize: 14 }}>🎉 Redeemed</span>}
              {o && o.status === "sent" && <span style={{ color: BL, fontWeight: 600, fontSize: 13 }}>📧 Sent · code {o.code}</span>}
            </div>
          </div>

          {o && o.status === "draft" && (<div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}15` }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 10, fontStyle: "italic" }}>💡 {o.reason}</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>Discount <input type="number" value={ed(o).pct} onChange={(e) => setEd(o.id, { pct: e.target.value })} style={{ ...sIn, width: 56, marginLeft: 6 }} />%</label>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={ed(o).free} onChange={(e) => setEd(o.id, { free: e.target.checked })} /> Free shipping</label>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>Code: <strong style={{ color: "white" }}>{o.code}</strong></span>
            </div>
            <div style={{ marginBottom: 12 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 4 }}>Subject line</label><input value={ed(o).subject} onChange={(e) => setEd(o.id, { subject: e.target.value })} style={{ ...sIn, width: "100%", boxSizing: "border-box" }} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => send(o)} disabled={busy === o.id} style={{ ...btnP, background: `linear-gradient(135deg,${GR},#00D2A0)`, opacity: busy === o.id ? .5 : 1 }}>{busy === o.id ? "Sending…" : "✓ Approve & Send"}</button>
              <button onClick={() => setPreview(o.body)} style={btnS}>👁 Preview Email</button>
              <button onClick={() => regenerate(c.id)} style={btnS}>↻ Regenerate</button>
              <button onClick={() => discard(o)} style={{ ...btnS, color: "#FF6B6B", borderColor: "rgba(255,80,80,.3)", marginLeft: "auto" }}>Discard</button>
            </div>
          </div>)}
        </div>);
      })}</div>}

    {preview && (<div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "85vh", overflow: "auto", position: "relative" }}>
        <button onClick={() => setPreview(null)} style={{ position: "sticky", top: 10, left: "100%", margin: 10, background: "#0072BC", color: "white", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>×</button>
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </div>)}
  </div>);
}
