"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", GR = "#00B894", AM = "#F5A623";

type SampleReq = {
  id: string; name: string | null; business: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null; type: string | null;
  status: string; created_at: string;
  tubes: number | null; packets: number | null; shipped_at: string | null;
  tracking: string | null; notes: string | null; ordered?: boolean; hasAccount?: boolean;
};

type Stats = {
  goalTubes: number; tubesShipped: number; packetsShipped: number;
  officesShipped: number; pending: number; converted: number; accounts: number; conversionRate: number | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : "";

export default function AdminSamples() {
  const [rows, setRows] = useState<SampleReq[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ tubes: string; packets: string; tracking: string }>({ tubes: "1", packets: "6", tracking: "" });

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/sample/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await call({ action: "list" });
    if (d.ok) { setRows(d.requests); setStats(d.stats); }
    setLoading(false);
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const toggleShipped = async (r: SampleReq) => {
    setBusy(r.id);
    const shipped = r.status !== "shipped";
    const d = await call({ action: "mark_shipped", id: r.id, shipped, tubes: r.tubes ?? 1, packets: r.packets ?? 6 });
    setBusy(null);
    if (d.ok) { await load(); }
  };

  const saveEdit = async (r: SampleReq) => {
    setBusy(r.id);
    const d = await call({
      action: "update", id: r.id,
      tubes: Number(draft.tubes) || 0, packets: Number(draft.packets) || 0, tracking: draft.tracking,
    });
    setBusy(null);
    setEditing(null);
    if (d.ok) await load();
  };

  const del = async (r: SampleReq) => {
    if (!confirm(`Remove sample request from ${r.business || r.name || r.email}?`)) return;
    await call({ action: "delete", id: r.id });
    await load();
  };

  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14 };
  const btnP: React.CSSProperties = { padding: "8px 14px", background: `linear-gradient(135deg,${GR},#00D2A0)`, border: "none", borderRadius: 9, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 9, color: "rgba(255,255,255,.7)", fontSize: 13, cursor: "pointer" };
  const input: React.CSSProperties = { background: "rgba(0,0,0,.25)", border: `1px solid ${B}44`, borderRadius: 7, color: "white", padding: "6px 9px", fontSize: 13, width: "100%" };
  const lab: React.CSSProperties = { fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", fontWeight: 700, marginBottom: 4 };

  if (loading) return <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>;

  const pct = stats ? Math.min(100, (stats.tubesShipped / stats.goalTubes) * 100) : 0;

  const header = stats ? (
    <div style={{ ...card, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>
            {stats.tubesShipped.toLocaleString()}
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,.4)" }}> / {stats.goalTubes.toLocaleString()} tubes</span>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
            {stats.officesShipped.toLocaleString()} {stats.officesShipped === 1 ? "practice" : "practices"} · {stats.packetsShipped.toLocaleString()} packets
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: stats.converted ? GR : "rgba(255,255,255,.35)", fontVariantNumeric: "tabular-nums" }}>
            {stats.converted}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.45)" }}>
            ordered after{stats.conversionRate !== null ? ` · ${(stats.conversionRate * 100).toFixed(0)}%` : ""}
          </div>
          {stats.accounts > stats.converted && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
              {stats.accounts} opened an account
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${GR},#00D2A0)`, transition: "width .4s ease" }} />
      </div>
      {stats.pending > 0 && (
        <div style={{ fontSize: 12.5, color: AM, fontWeight: 600 }}>{stats.pending} waiting to ship</div>
      )}
    </div>
  ) : null;

  if (rows.length === 0) return (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {header}
    <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>
      No sample requests yet. Share <strong style={{ color: "white" }}>wholesale.getactive10.com/sample</strong> in your outreach.
    </div>
  </div>);

  return (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {header}
    {rows.map((r) => {
      const addr = [r.address, [r.city, r.state].filter(Boolean).join(", "), r.zip].filter(Boolean).join(" · ");
      const shipped = r.status === "shipped";
      const isEditing = editing === r.id;
      return (<div key={r.id} style={{ ...card, padding: "16px 18px", opacity: shipped && !isEditing ? 0.75 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {r.business || r.name}
              {r.type ? <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.4)" }}>{r.type}</span> : null}
              {r.ordered
                ? <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: GR, border: `1px solid ${GR}55`, borderRadius: 99, padding: "2px 8px" }}>Ordered</span>
                : r.hasAccount
                  ? <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: AM, border: `1px solid ${AM}55`, borderRadius: 99, padding: "2px 8px" }}>Has account</span>
                  : null}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 3 }}>{r.name}{r.email ? ` · ${r.email}` : ""}{r.phone ? ` · ${r.phone}` : ""}</div>
            <div style={{ fontSize: 13, color: "white", marginTop: 6, fontWeight: 500 }}>📦 {addr || "No address"}</div>
            {shipped && !isEditing && (
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                {r.tubes ?? 1} tube{(r.tubes ?? 1) === 1 ? "" : "s"} · {r.packets ?? 6} packets
                {r.shipped_at ? ` · sent ${fmtDate(r.shipped_at)}` : ""}
                {r.tracking ? ` · ${r.tracking}` : ""}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {shipped && <span style={{ fontSize: 12, fontWeight: 700, color: GR }}>✓ Shipped</span>}
            <button onClick={() => toggleShipped(r)} disabled={busy === r.id} style={{ ...(shipped ? btnS : btnP), opacity: busy === r.id ? 0.5 : 1 }}>{shipped ? "Undo" : "Mark shipped"}</button>
            <button
              onClick={() => {
                if (isEditing) { setEditing(null); return; }
                setDraft({ tubes: String(r.tubes ?? 1), packets: String(r.packets ?? 6), tracking: r.tracking || "" });
                setEditing(r.id);
              }}
              style={btnS}
            >{isEditing ? "Cancel" : "Edit"}</button>
            <button onClick={() => del(r)} style={{ ...btnS, color: "#FF6B6B", borderColor: "rgba(255,80,80,.3)" }}>Remove</button>
          </div>
        </div>

        {isEditing && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "grid", gridTemplateColumns: "90px 90px 1fr auto", gap: 10, alignItems: "end" }}>
            <div>
              <div style={lab}>Tubes</div>
              <input style={input} type="number" min="0" value={draft.tubes} onChange={(e) => setDraft({ ...draft, tubes: e.target.value })} />
            </div>
            <div>
              <div style={lab}>Packets</div>
              <input style={input} type="number" min="0" value={draft.packets} onChange={(e) => setDraft({ ...draft, packets: e.target.value })} />
            </div>
            <div>
              <div style={lab}>Tracking number</div>
              <input style={input} value={draft.tracking} placeholder="USPS / UPS tracking" onChange={(e) => setDraft({ ...draft, tracking: e.target.value })} />
            </div>
            <button onClick={() => saveEdit(r)} disabled={busy === r.id} style={{ ...btnP, opacity: busy === r.id ? 0.5 : 1 }}>Save</button>
          </div>
        )}
      </div>);
    })}
  </div>);
}
