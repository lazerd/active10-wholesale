import { db, deckKey, loadSettings, ptParts } from "@/lib/growth/config";
import { variantStats, coldBudget, MIN_TRIAL, RETIRE_AFTER, VariantStat } from "@/lib/growth/abtest";

// The A/B scoreboard for cold letters. Same signed key as /swipe, so it opens from the digest on a phone.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const LANE: Record<string, string> = { chiro: "Chiropractors", club: "Tennis club pro shops" };

function Card({ v, k }: { v: VariantStat; k: string }) {
  const trial = v.status === "active" && v.sent < MIN_TRIAL;
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14, margin: "10px 0", background: v.status === "proposed" ? "#fffbea" : "#fff", opacity: v.status === "retired" ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <b style={{ fontSize: 16 }}>{v.name}</b>
        <span style={{ color: "#666" }}>{v.angle}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, padding: "2px 8px", borderRadius: 99, border: "1px solid #ccc" }}>
          {v.status === "proposed" ? "Waiting for your OK" : v.status === "retired" ? "Retired" : trial ? `Trial (${v.sent}/${MIN_TRIAL})` : "Live"}
        </span>
      </div>
      {v.status !== "proposed" && (
        <div style={{ display: "flex", gap: 18, margin: "8px 0", flexWrap: "wrap" }}>
          <span><b>{v.sent}</b> sent</span>
          <span><b>{v.replies}</b> replies ({pct(v.replies, v.sent)})</span>
          <span><b>{v.noThanks}</b> no thanks</span>
          {v.status === "active" && <span><b>{Math.round(v.pBest * 100)}%</b> chance it's the best</span>}
        </div>
      )}
      <details>
        <summary style={{ cursor: "pointer", color: "#0369a1" }}>Read the email</summary>
        <div style={{ marginTop: 8 }}><b>Subject:</b> {v.subject || "(the built-in subject)"}</div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#f7f7f7", padding: 10, borderRadius: 8 }}>{v.body || "(The original long founder letter, word for word.)"}</pre>
      </details>
      <form method="post" action={`/api/growth/abtests?k=${k}`} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="hidden" name="id" value={v.id} />
        {v.status === "proposed" && <><button name="action" value="approve" style={btn("#059669")}>Add to the test</button><button name="action" value="reject" style={btn("#999")}>No thanks</button></>}
        {v.status === "active" && <button name="action" value="retire" style={btn("#999")}>Stop testing this one</button>}
        {v.status === "retired" && <button name="action" value="restore" style={btn("#0369a1")}>Bring it back</button>}
      </form>
    </div>
  );
}
const btn = (bg: string) => ({ background: bg, color: "#fff", border: 0, borderRadius: 8, padding: "7px 14px", cursor: "pointer" });

export default async function ABTests({ searchParams }: { searchParams: { k?: string } }) {
  const k = searchParams.k || "";
  if (k !== deckKey()) return <main style={{ padding: 24, fontFamily: "system-ui" }}>This link isn't valid. Use the A/B link in your Active 10 email.</main>;
  const sb = db();
  const s = await loadSettings(sb);
  const stats = await variantStats(sb);
  const today = ptParts().date;
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
      <h1 style={{ margin: "0 0 4px" }}>Cold email A/B tests</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Cold letters send on their own: <b>{coldBudget(s, today)} a day</b> right now{s.cold_start_date ? ` (started ${s.cold_start_date})` : " (starts with the next plan)"}, going 5 → 10 → 15 → 20 → 25 week by week.
        Every version gets {MIN_TRIAL} sends first. After that, the ones earning replies get most of the volume, and after {RETIRE_AFTER} sends a version with under a 5% chance of being the best retires itself.
        Once a week a new challenger shows up here for your OK. Customer emails (restock, win-back, samples) still wait for you on the <a href={`/swipe?k=${k}`}>swipe deck</a>.
      </p>
      {["chiro", "club"].map((lane) => {
        const lv = stats.filter((v) => v.lane === lane).sort((a, b) => ({ proposed: 0, active: 1, retired: 2 } as any)[a.status] - ({ proposed: 0, active: 1, retired: 2 } as any)[b.status] || b.pBest - a.pBest);
        const tot = lv.reduce((n, v) => ({ s: n.s + v.sent, r: n.r + v.replies }), { s: 0, r: 0 });
        return (
          <section key={lane}>
            <h2 style={{ marginBottom: 0 }}>{LANE[lane]}</h2>
            <div style={{ color: "#666" }}>{tot.s} sent, {tot.r} replies ({pct(tot.r, tot.s)})</div>
            {lv.map((v) => <Card key={v.id} v={v} k={k} />)}
          </section>
        );
      })}
    </main>
  );
}
