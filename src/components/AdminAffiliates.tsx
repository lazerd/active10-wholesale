"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const B = "#0072BC", BL = "#0088DD", GR = "#00B894";
const SITE = "https://wholesale.getactive10.com";

type Row = {
  id: string; name: string; email: string; slug: string;
  commission_rate: number; commission_rule: string; commission_base: string; status: string;
  referredCount: number; payableEarned: number; pendingEarned: number; paidOut: number; owed: number;
};

const RULES = [["lifetime", "Lifetime — all orders"], ["first_order", "First order only"], ["12_months", "First 12 months"]];

export default function AdminAffiliates() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", slug: "", rate: "15", rule: "lifetime", base: "subtotal" });

  const call = useCallback(async (payload: any) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const r = await fetch("/api/affiliate/admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return r.json();
  }, []);

  const load = useCallback(async () => { setLoading(true); const d = await call({ action: "list" }); if (d.ok) setRows(d.affiliates); else setMsg({ t: d.error || "Failed to load", ok: false }); setLoading(false); }, [call]);
  useEffect(() => { load(); }, [load]);

  const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const btnP: React.CSSProperties = { padding: "10px 20px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 14px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.7)", fontSize: 12, cursor: "pointer" };
  const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16 };
  const lbl: React.CSSProperties = { display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" };

  const create = async () => {
    if (busy) return;
    if (!form.name || !form.email) { setMsg({ t: "Name and email are required.", ok: false }); return; }
    setBusy(true); setMsg(null);
    const d = await call({ action: "create", name: form.name, email: form.email, slug: form.slug || form.name, commission_rate: Number(form.rate) / 100, commission_rule: form.rule, commission_base: form.base });
    setBusy(false);
    if (d.ok) { setAdding(false); setForm({ name: "", email: "", slug: "", rate: "15", rule: "lifetime", base: "subtotal" }); setMsg({ t: "Affiliate created — login + referral link emailed.", ok: true }); load(); }
    else setMsg({ t: d.error || "Failed to create affiliate", ok: false });
  };

  const updateField = async (id: string, patch: any) => { const d = await call({ action: "update", id, ...patch }); if (d.ok) load(); else setMsg({ t: d.error || "Update failed", ok: false }); };

  const recordPayout = async (a: Row) => {
    const def = a.owed > 0 ? a.owed.toFixed(2) : "";
    const amtStr = window.prompt(`Record a payout to ${a.name}.\nCommission owed: $${a.owed.toFixed(2)}\n\nAmount paid ($):`, def);
    if (!amtStr) return;
    const amount = parseFloat(amtStr);
    if (!(amount > 0)) { setMsg({ t: "Enter a valid amount.", ok: false }); return; }
    const note = window.prompt("Optional note (e.g. 'June check #1042'):", "") || "";
    const d = await call({ action: "payout", affiliate_id: a.id, amount, note });
    if (d.ok) { setMsg({ t: `Recorded $${amount.toFixed(2)} payout to ${a.name}.`, ok: true }); load(); } else setMsg({ t: d.error || "Payout failed", ok: false });
  };

  const remove = async (a: Row) => { if (!confirm(`Remove affiliate ${a.name}? Their referred customers stay, but stop being credited to them.`)) return; const d = await call({ action: "delete", id: a.id }); if (d.ok) load(); else setMsg({ t: d.error || "Delete failed", ok: false }); };

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Influencers & referrers earning commission on the practices they bring in.</div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={load} style={btnS}>↻ Refresh</button><button onClick={() => { setAdding(!adding); setMsg(null); }} style={btnP}>➕ Add Affiliate</button></div>
    </div>

    {msg && <div style={{ background: msg.ok ? `${GR}15` : "rgba(255,80,80,.1)", border: `1px solid ${msg.ok ? GR : "#FF6B6B"}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.ok ? GR : "#FF6B6B" }}>{msg.t}</div>}

    {adding && (<div style={{ ...card, padding: 24, marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>New Affiliate</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div><label style={lbl}>Full Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>Email *</label><input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>Referral Code (link slug)</label><input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="e.g. cymerint → /r/cymerint" style={inp} /></div>
        <div><label style={lbl}>Commission %</label><input type="number" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} style={inp} /></div>
        <div><label style={lbl}>Commission Rule</label><select value={form.rule} onChange={e => setForm(p => ({ ...p, rule: e.target.value }))} style={inp}>{RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label style={lbl}>Commission Base</label><select value={form.base} onChange={e => setForm(p => ({ ...p, base: e.target.value }))} style={inp}><option value="subtotal">Order subtotal (product value)</option><option value="total">Order total (incl. fees)</option></select></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}><button onClick={() => setAdding(false)} style={btnS}>Cancel</button><button onClick={create} disabled={busy} style={{ ...btnP, opacity: busy ? .5 : 1 }}>{busy ? "Creating…" : "Create & Email Login"}</button></div>
    </div>)}

    {loading ? <p style={{ color: "rgba(255,255,255,.4)", padding: 30, textAlign: "center" }}>Loading…</p>
      : rows.length === 0 ? <div style={{ ...card, padding: 40, textAlign: "center", color: "rgba(255,255,255,.45)" }}>No affiliates yet. Add one to start your referral engine.</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{rows.map(a => (
        <div key={a.id} style={{ ...card, padding: "18px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{a.name} {a.status !== "active" && <span style={{ fontSize: 11, color: "#FFC940", fontWeight: 600 }}>· PAUSED</span>}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{a.email}</div>
              <a href={`${SITE}/r/${a.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BL, textDecoration: "none" }}>{SITE.replace("https://", "")}/r/{a.slug}</a>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              {[["Referred", String(a.referredCount), "rgba(255,255,255,.85)"], ["Owed", `$${a.owed.toFixed(2)}`, GR], ["Pending", `$${a.pendingEarned.toFixed(2)}`, "#FFC940"], ["Paid", `$${a.paidOut.toFixed(2)}`, "rgba(255,255,255,.6)"]].map(([l, v, c], i) => (
                <div key={i} style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div><div style={{ fontSize: 17, fontWeight: 800, color: c as string }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${B}15`, paddingTop: 14 }}>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Rate</label>
            <input type="number" defaultValue={Math.round(a.commission_rate * 100)} onBlur={e => { const v = Number(e.target.value) / 100; if (v !== a.commission_rate) updateField(a.id, { commission_rate: v }); }} style={{ width: 60, padding: "6px 8px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 6, color: "white", fontSize: 13 }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>%</span>
            <select value={a.commission_rule} onChange={e => updateField(a.id, { commission_rule: e.target.value })} style={{ padding: "6px 8px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 6, color: "white", fontSize: 12 }}>{RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button onClick={() => updateField(a.id, { status: a.status === "active" ? "paused" : "active" })} style={btnS}>{a.status === "active" ? "⏸ Pause" : "▶ Activate"}</button>
            <button onClick={() => recordPayout(a)} style={{ ...btnS, color: GR, borderColor: `${GR}55` }}>💵 Record Payout</button>
            <button onClick={() => remove(a)} style={{ ...btnS, color: "#FF6B6B", borderColor: "rgba(255,80,80,.3)", marginLeft: "auto" }}>Remove</button>
          </div>
        </div>
      ))}</div>}
  </div>);
}
