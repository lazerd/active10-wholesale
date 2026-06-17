"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", GR = "#00B894";

type SampleReq = { id: string; name: string | null; business: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; type: string | null; status: string; created_at: string };

export default function AdminSamples() {
  const [rows, setRows] = useState<SampleReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/sample/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) setRows(d.requests); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const toggleShipped = async (r: SampleReq) => { setBusy(r.id); const shipped = r.status !== "shipped"; const d = await call({ action: "mark_shipped", id: r.id, shipped }); setBusy(null); if (d.ok) setRows((x) => x.map((y) => y.id === r.id ? { ...y, status: d.status } : y)); };
  const del = async (r: SampleReq) => { if (!confirm(`Remove sample request from ${r.business || r.name || r.email}?`)) return; await call({ action: "delete", id: r.id }); setRows((x) => x.filter((y) => y.id !== r.id)); };

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnP: React.CSSProperties = { padding: "8px 14px", background: `linear-gradient(135deg,${GR},#00D2A0)`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 9, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer" };

  const pending = rows.filter((r) => r.status !== "shipped").length;

  if (loading) return <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>;
  if (rows.length === 0) return <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No sample requests yet. Share <strong style={{ color: "white" }}>wholesale.getactive10.com/sample</strong> in your outreach.</div>;

  return (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 2 }}>{pending} to ship · {rows.length} total</div>
    {rows.map((r) => {
      const addr = [r.address, [r.city, r.state].filter(Boolean).join(", "), r.zip].filter(Boolean).join(" · ");
      const shipped = r.status === "shipped";
      return (<div key={r.id} style={{ ...card, padding: "16px 18px", opacity: shipped ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.business || r.name}{r.type ? <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.4)", marginLeft: 8 }}>{r.type}</span> : null}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 3 }}>{r.name}{r.email ? ` · ${r.email}` : ""}{r.phone ? ` · ${r.phone}` : ""}</div>
            <div style={{ fontSize: 13, color: "white", marginTop: 6, fontWeight: 500 }}>📦 {addr || "No address"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {shipped && <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>✓ Shipped</span>}
            <button onClick={() => toggleShipped(r)} disabled={busy === r.id} style={{ ...(shipped ? btnS : btnP), opacity: busy === r.id ? 0.5 : 1 }}>{shipped ? "Undo" : "Mark shipped"}</button>
            <button onClick={() => del(r)} style={{ ...btnS, color: "#FF6B6B", borderColor: "rgba(255,80,80,.3)" }}>Remove</button>
          </div>
        </div>
      </div>);
    })}
  </div>);
}
