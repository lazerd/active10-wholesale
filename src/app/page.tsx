"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AffiliateDashboard from "@/components/AffiliateDashboard";
import AdminAffiliates from "@/components/AdminAffiliates";
import AdminWinback from "@/components/AdminWinback";
import AdminRestock from "@/components/AdminRestock";
import AdminAbandoned from "@/components/AdminAbandoned";
import AdminReferrals from "@/components/AdminReferrals";
import CustomerReferral from "@/components/CustomerReferral";
import AdminOutreach from "@/components/AdminOutreach";
import AdminSamples from "@/components/AdminSamples";

const B = "#0072BC", BL = "#0088DD", BD = "#005A96", BBG = "#003A5C", BDP = "#00253D", GR = "#00B894";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

// Types
type Product = { id: string; name: string; subtitle: string; retail: number; img: string; badge: string | null; cat: string; color: string; sort_order: number };
type Customer = { id: string; user_id: string; name: string; email: string; phone?: string; address?: string; business: string; city: string; state?: string; zip?: string; type: string; status: string; total_orders: number; total_spent: number; last_order_at: string | null; created_at: string; qb_customer_id?: string | null };
type Application = { id: string; name: string; email: string; business: string; city: string; phone: string; type: string; status: string; created_at: string; address?: string };
type Order = { id: string; order_number: string; customer_id: string; customer_name: string; customer_email: string; items: OrderItem[]; subtotal: number; tier_name: string; tier_discount: number; discount_amount: number; cc_fee: number; total: number; pay_method: string; notes: string; status: string; created_at: string; qb_invoice_id?: string | null };
type OrderItem = { product_id: string; name: string; qty: number; unit_price: number; line_total: number };

function getTier(s: number) {
  if (s >= 1000) return { name: "ELITE", disc: 0.20, color: "#E8C76A", next: null, at: null };
  if (s >= 300) return { name: "PRO+", disc: 0.15, color: BL, next: "ELITE", at: 1000 };
  if (s >= 150) return { name: "PRO", disc: 0.10, color: GR, next: "PRO+", at: 300 };
  return { name: "STARTER", disc: 0, color: "#8899AA", next: "PRO", at: 150 };
}
const ws = (r: number) => Math.round(r * 0.5 * 100) / 100;
const fp = (r: number, d: number) => Math.round(ws(r) * (1 - d) * 100) / 100;

// Promo code: 20% off + free shipping, one redemption per customer (enforced server-side).
const PROMO_CODE = "DCAMEMBERSONLY";
const PROMO_DISCOUNT = 0.2;

const Img = ({ src, alt, color, style }: { src: string; alt: string; color: string; style?: React.CSSProperties }) => {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ ...style, background: color || "#f0ece8", display: "flex", alignItems: "center", justifyContent: "center", color: B, fontWeight: 700, fontSize: 13, textAlign: "center", padding: 8 }}>{alt}</div>;
  return <img src={src} alt={alt} style={style} onError={() => setErr(true)} />;
};

// Helper: compute processing fee for any pay method
const processingFee = (amount: number, method: string) => {
  if (method === "card") return Math.round(amount * 0.0299 * 100) / 100;
  if (method === "ach") return Math.round(amount * 0.01 * 100) / 100;
  return 0;
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [refSlug, setRefSlug] = useState("");
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [recs, setRecs] = useState<string[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [view, setView] = useState("shop");
  const [filter, setFilter] = useState("all");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [authView, setAuthView] = useState("login");
  const [orderNote, setOrderNote] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [appliedPct, setAppliedPct] = useState(0);
  const [appliedFreeShip, setAppliedFreeShip] = useState(false);
  const [appliedType, setAppliedType] = useState("");
  const [appliedSamples, setAppliedSamples] = useState(0);
  const [codeMsg, setCodeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [creditBalance, setCreditBalance] = useState<{ available: number; pending: number }>({ available: 0, pending: 0 });
  const [applyCreditOn, setApplyCreditOn] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [anim, setAnim] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState("customers");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [appSubmitted, setAppSubmitted] = useState(false);
  const [capToken, setCapToken] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [payMethod, setPayMethod] = useState("check");
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [appForm, setAppForm] = useState({ name: "", email: "", phone: "", business: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbLoading, setQbLoading] = useState<string | null>(null);
  const [qbMessage, setQbMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [manualItems, setManualItems] = useState<Record<string, { qty: number; price: number }>>({});
  const [manualNote, setManualNote] = useState("");
  const [manualPayMethod, setManualPayMethod] = useState("check");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editPayMethod, setEditPayMethod] = useState("check");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addCustForm, setAddCustForm] = useState({ name: "", email: "", phone: "", business: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" });
  const [addCustLoading, setAddCustLoading] = useState(false);
  const [addCustError, setAddCustError] = useState("");
  const [custSearch, setCustSearch] = useState("");
  const [custSearchFocused, setCustSearchFocused] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editCustForm, setEditCustForm] = useState({ name: "", email: "", phone: "", business: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" });
  const [editCustLoading, setEditCustLoading] = useState(false);
  const [editCustError, setEditCustError] = useState("");
  const [resetPwLoading, setResetPwLoading] = useState<string | null>(null);

  // ── AUTH ─────────────────────────────────────────────────────────────────
  // FIX: Strip any Supabase error params (e.g. otp_expired) from the URL
  // immediately on mount so they don't interfere with a fresh password login.
  // Also, only wipe the session state when the event is explicitly SIGNED_OUT —
  // not on every null-session event (which fires when an expired magic link is
  // detected in the URL even while a valid password session exists).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("error_code") || p.get("error_description")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // Capture an affiliate referral (?ref=slug or remembered from a /r/<slug> visit)
    let ref = p.get("ref") || "";
    try { if (!ref) ref = localStorage.getItem("a10_ref") || ""; else localStorage.setItem("a10_ref", ref); } catch {}
    if (ref) { setRefSlug(ref.toLowerCase()); setAuthView("apply"); if (p.get("ref")) window.history.replaceState({}, "", window.location.pathname); }
    // Capture a customer referral invite (?invite=code or remembered from /invite/<code>)
    let inv = p.get("invite") || "";
    try { if (!inv) inv = localStorage.getItem("a10_invite") || ""; else localStorage.setItem("a10_invite", inv); } catch {}
    if (inv) { setInviteCode(inv.toLowerCase()); setAuthView("apply"); if (p.get("invite")) window.history.replaceState({}, "", window.location.pathname); }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUserData(s);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        loadUserData(s);
      } else if (event === "SIGNED_OUT") {
        setLoading(false);
        setIsAdmin(false);
        setCustomer(null);
      }
      // For any other event with a null session (e.g. failed OTP exchange),
      // do nothing — preserve whatever session state we already have.
    });

    return () => subscription.unsubscribe();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => { supabase.from("products").select("*").eq("active", true).order("sort_order").then(({ data }) => { if (data) setProducts(data as Product[]); }); }, []);
  // Render the Cloudflare Turnstile (CAPTCHA) widget on the application form. No-op until
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so the form keeps working before keys are configured.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || authView !== "apply" || appSubmitted) return;
    let widgetId: unknown;
    let cancelled = false;
    const render = () => {
      const ts = (window as any).turnstile;
      const el = document.getElementById("cf-turnstile-apply");
      if (cancelled || !ts || !el || el.hasChildNodes()) return;
      widgetId = ts.render("#cf-turnstile-apply", {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: (t: string) => setCapToken(t),
        "expired-callback": () => setCapToken(""),
        "error-callback": () => setCapToken(""),
      });
    };
    let poll: ReturnType<typeof setInterval> | undefined;
    if ((window as any).turnstile) { render(); }
    else if (!document.getElementById("cf-turnstile-script")) {
      const s = document.createElement("script");
      s.id = "cf-turnstile-script";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    } else {
      poll = setInterval(() => { if ((window as any).turnstile) { if (poll) clearInterval(poll); render(); } }, 200);
    }
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      const ts = (window as any).turnstile;
      if (widgetId && ts) { try { ts.remove(widgetId); } catch {} }
      setCapToken("");
    };
  }, [authView, appSubmitted]);
  useEffect(() => { if (!customer) { setLastOrder(null); return; } let active = true; (async () => { const { data: s } = await supabase.auth.getSession(); const token = s.session?.access_token; if (!token) return; try { const r = await fetch("/api/my-last-order", { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (active) setLastOrder(d.order || null); } catch {} })(); return () => { active = false; }; }, [customer]);
  // Restore a saved (abandoned) cart when the customer returns, if their cart is empty.
  useEffect(() => { if (!customer || isAdmin || isAffiliate) return; if (Object.keys(cart).length > 0) return; let active = true; (async () => { const { data: s } = await supabase.auth.getSession(); const token = s.session?.access_token; if (!token) return; try { const r = await fetch("/api/cart/save", { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (active && d.items?.length) { const next: Record<string, number> = {}; for (const it of d.items) if (products.find(p => p.id === it.product_id)) next[it.product_id] = Number(it.qty || 0); if (Object.keys(next).length) setCart(next); } } catch {} })(); return () => { active = false; }; }, [customer, products]);
  // Persist the live cart (debounced) so abandoned carts can be recovered.
  useEffect(() => { if (!customer || isAdmin || isAffiliate) return; const t = setTimeout(async () => { const { data: s } = await supabase.auth.getSession(); const token = s.session?.access_token; if (!token) return; const payload = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => { const p = products.find(x => x.id === id); const up = p ? Math.round(p.retail * 0.5 * 100) / 100 : 0; return { product_id: id, name: p?.name || id, qty: q, unit_price: up, line_total: Math.round(up * q * 100) / 100 }; }); fetch("/api/cart/save", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: payload }) }).catch(() => {}); }, 1500); return () => clearTimeout(t); }, [cart, customer, products]);
  // Store-credit balance for the logged-in customer.
  useEffect(() => { if (!customer || isAdmin || isAffiliate) { setCreditBalance({ available: 0, pending: 0 }); return; } let active = true; (async () => { const { data: s } = await supabase.auth.getSession(); const token = s.session?.access_token; if (!token) return; try { const r = await fetch("/api/credit/balance", { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (active) setCreditBalance({ available: Number(d.available) || 0, pending: Number(d.pending) || 0 }); } catch {} })(); return () => { active = false; }; }, [customer, orderSuccess]);
  // Frequently-bought-together recommendations for the cart.
  useEffect(() => { if (view !== "cart") return; const ids = Object.entries(cart).filter(([, q]) => q > 0).map(([id]) => id); if (ids.length === 0) { setRecs([]); return; } let active = true; fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productIds: ids }) }).then(r => r.json()).then(d => { if (active) setRecs((d.productIds || []).filter((id: string) => !ids.includes(id))); }).catch(() => {}); return () => { active = false; }; }, [view, cart]);
  useEffect(() => { const p = new URLSearchParams(window.location.search); if (p.get("qb_connected") === "true") { setQbConnected(true); setQbMessage({ text: "QuickBooks connected successfully!", ok: true }); window.history.replaceState({}, "", window.location.pathname); } if (p.get("qb_error")) { setQbMessage({ text: `QuickBooks connection failed: ${p.get("qb_error")}`, ok: false }); window.history.replaceState({}, "", window.location.pathname); } if (p.get("gmail_connected") || p.get("gmail_error")) { window.history.replaceState({}, "", window.location.pathname); } fetch("/api/qb/status").then(r => r.json()).then(d => setQbConnected(d.connected)).catch(() => {}); }, []);

  const loadUserData = async (s: any) => { setLoading(true); const email = s.user.email; const { data: ad } = await supabase.from("admin_emails").select("email").eq("email", email).single(); setIsAdmin(!!ad); const { data: cd } = await supabase.from("customers").select("*").eq("email", email).single(); if (cd) setCustomer(cd as Customer); else setCustomer(null); if (!ad && !cd) { const { data: af } = await supabase.from("affiliates").select("id").limit(1); setIsAffiliate(!!(af && af.length)); } else setIsAffiliate(false); if (ad) await loadAdminData(); setLoading(false); };
  const loadAdminData = async () => { const [c, a, o] = await Promise.all([supabase.from("customers").select("*").order("total_spent", { ascending: false }), supabase.from("applications").select("*").order("created_at", { ascending: false }), supabase.from("orders").select("*").order("created_at", { ascending: false })]); if (c.data) setCustomers(c.data as Customer[]); if (a.data) setApplications(a.data as Application[]); if (o.data) setOrders(o.data as Order[]); };

  const items = Object.entries(cart).filter(([, q]) => q > 0);
  const wsSub = items.reduce((s, [id, q]) => s + (products.find(p => p.id === id)?.retail || 0) * 0.5 * q, 0);
  const tier = getTier(wsSub);
  // When a discount code is applied (members promo or a personal win-back code)
  // the customer gets the better of their tier discount or the code's discount,
  // plus free shipping if the code includes it.
  const codeDisc = appliedCode ? appliedPct : 0;
  const effDisc = Math.max(tier.disc, codeDisc);
  const codeBeatsTier = appliedCode && codeDisc > tier.disc;
  const codeFreeShip = appliedCode && appliedFreeShip;
  const total = items.reduce((s, [id, q]) => { const p = products.find(p => p.id === id); return s + (p ? fp(p.retail, effDisc) * q : 0); }, 0);
  const count = items.reduce((s, [, q]) => s + q, 0);
  const save = items.reduce((s, [id, q]) => { const p = products.find(p => p.id === id); return s + (p ? (p.retail - fp(p.retail, effDisc)) * q : 0); }, 0);
  const add = (id: string, d: number) => { setAnim(id); setTimeout(() => setAnim(null), 300); setCart(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) })); };
  const setQtyFn = (id: string, q: number) => setCart(p => ({ ...p, [id]: Math.max(0, q) }));
  const reorderLast = () => { if (!lastOrder) return; const next: Record<string, number> = {}; for (const it of lastOrder.items || []) { if (products.find(p => p.id === it.product_id)) next[it.product_id] = (next[it.product_id] || 0) + Number(it.qty || 0); } if (Object.keys(next).length === 0) { alert("Those products are no longer available to reorder."); return; } setCart(next); setView("cart"); };

  const changePassword = async () => { if (newPw.length < 6) { setPwMsg("Password must be at least 6 characters."); return; } const { error } = await supabase.auth.updateUser({ password: newPw }); if (!error) { setPwMsg("Password updated!"); setNewPw(""); setTimeout(() => { setShowChangePw(false); setPwMsg(""); }, 2000); } else setPwMsg("Error: " + error.message); };
  const forgotPassword = async () => { if (!resetEmail) { setResetMsg("Enter your email."); return; } const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: "https://wholesale.getactive10.com" }); if (!error) setResetMsg("Reset link sent! Check your inbox."); else setResetMsg("Error: " + error.message); };
  const login = async () => { setLoginError(""); const e = loginForm.email.trim().toLowerCase(), p = loginForm.password.trim(); if (!e || !p) { setLoginError("Please enter your credentials."); return; } const { error } = await supabase.auth.signInWithPassword({ email: e, password: p }); if (error) setLoginError(error.message === "Invalid login credentials" ? "Invalid email or password." : error.message); };
  const logout = async () => { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); setIsAffiliate(false); setCustomer(null); setLoginForm({ email: "", password: "" }); setView("shop"); setCart({}); setSelectedCustomer(null); setAppliedCode(""); setAppliedPct(0); setAppliedFreeShip(false); setAppliedType(""); setAppliedSamples(0); setApplyCreditOn(false); setCodeInput(""); setCodeMsg(null); };

  const submitApplication = async () => { if (TURNSTILE_SITE_KEY && !capToken) { alert("Please complete the verification challenge below."); return; } const r = { name: appForm.name, email: appForm.email, phone: appForm.phone, business: appForm.business, address: appForm.address, city: appForm.city, state: appForm.state, zip: appForm.zip, type: appForm.type, ...(refSlug ? { affiliate_slug: refSlug } : {}), ...(inviteCode ? { referred_by_code: inviteCode } : {}) }; try { const res = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, captchaToken: capToken }) }); const d = await res.json(); if (d.ok) { setAppSubmitted(true); fetch("/api/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "application", record: r }) }).catch(() => {}); } else { alert("Error: " + (d.error || "Could not submit application. Please try again.")); if (TURNSTILE_SITE_KEY) { try { (window as any).turnstile?.reset(); } catch {} setCapToken(""); } } } catch { alert("Could not submit application. Please check your connection and try again."); } };

  const applyCode = async () => {
    if (!customer || codeChecking) return;
    const code = codeInput.trim();
    if (!code) { setCodeMsg({ text: "Enter a code.", ok: false }); return; }
    setCodeChecking(true); setCodeMsg(null);
    try {
      const r = await fetch("/api/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, code }) });
      const d = await r.json();
      if (d.ok && Number(d.minOrder) > 0 && wsSub < Number(d.minOrder)) { setAppliedCode(""); setAppliedPct(0); setAppliedFreeShip(false); setAppliedType(""); setAppliedSamples(0); setCodeMsg({ text: `This welcome offer needs a $${Number(d.minOrder).toFixed(0)}+ order (you're at $${wsSub.toFixed(2)}). Add $${(Number(d.minOrder) - wsSub).toFixed(2)} more to unlock it.`, ok: false }); }
      else if (d.ok) { setAppliedCode(d.code || code.toUpperCase()); setAppliedPct(Number(d.discount) || 0); setAppliedFreeShip(!!d.freeShipping); setAppliedType(d.type || ""); setAppliedSamples(Number(d.samplePackets) || 0); setCodeMsg({ text: d.message || "Code applied!", ok: true }); }
      else { setAppliedCode(""); setAppliedPct(0); setAppliedFreeShip(false); setAppliedType(""); setAppliedSamples(0); setCodeMsg({ text: d.error || "Invalid code.", ok: false }); }
    } catch { setCodeMsg({ text: "Could not validate code. Try again.", ok: false }); }
    setCodeChecking(false);
  };
  const removeCode = () => { setAppliedCode(""); setAppliedPct(0); setAppliedFreeShip(false); setAppliedType(""); setAppliedSamples(0); setCodeInput(""); setCodeMsg(null); };

  const submitOrder = async () => {
    if (!customer || orderSubmitting) return;
    setOrderSubmitting(true);
    // Re-validate the promo code at submit time so a stale/duplicate redemption
    // can't slip through (one-time-use is enforced server-side).
    let useCode = appliedCode;
    if (appliedCode) {
      try {
        const r = await fetch("/api/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id, code: appliedCode }) });
        const d = await r.json();
        if (!d.ok) { useCode = ""; setAppliedCode(""); setCodeMsg({ text: d.error || "Code no longer valid.", ok: false }); setOrderSubmitting(false); return; }
        if (Number(d.minOrder) > 0 && wsSub < Number(d.minOrder)) { setCodeMsg({ text: `This welcome offer needs a $${Number(d.minOrder).toFixed(0)}+ order. Add $${(Number(d.minOrder) - wsSub).toFixed(2)} more.`, ok: false }); setOrderSubmitting(false); return; }
      } catch { setOrderSubmitting(false); alert("Could not verify your discount code. Please try again."); return; }
    }
    const oi: OrderItem[] = items.map(([id, q]) => { const p = products.find(p => p.id === id)!; const up = fp(p.retail, effDisc); return { product_id: id, name: p.name, qty: q, unit_price: up, line_total: up * q }; });
    const cf = processingFee(total, payMethod);
    const grossTotal = Math.round((total + cf) * 100) / 100;
    const creditToApply = applyCreditOn ? Math.min(creditBalance.available, grossTotal) : 0;
    const dueTotal = Math.round((grossTotal - creditToApply) * 100) / 100;
    const pctLabel = Math.round(appliedPct * 100);
    const shipTxt = codeFreeShip ? " + FREE SHIPPING" : "";
    const sampleTxt = appliedSamples > 0 ? ` 🎁 Include ${appliedSamples} free sample packets (welcome gift).` : "";
    const creditTxt = creditToApply > 0 ? ` 💳 $${creditToApply.toFixed(2)} account credit applied (amount due reflects this).` : "";
    const tierName = useCode ? (codeBeatsTier ? useCode : `${tier.name} + ${useCode}`) : tier.name;
    const notes = (useCode ? `🎟️ ${useCode} — ${pctLabel}% off${shipTxt}.` : "") + sampleTxt + creditTxt + (orderNote ? ` · ${orderNote}` : "");
    const { data, error } = await supabase.from("orders").insert({ order_number: "", customer_id: customer.id, customer_name: customer.name, customer_email: customer.email, items: oi, subtotal: Math.round(wsSub * 100) / 100, tier_name: tierName, tier_discount: effDisc, discount_amount: Math.round((wsSub - total) * 100) / 100, cc_fee: cf, total: dueTotal, pay_method: payMethod, notes: notes.trim() || null }).select().single();
    setOrderSubmitting(false);
    if (!error && data) {
      setOrderSuccess(true);
      if (creditToApply > 0) { const { data: s } = await supabase.auth.getSession(); const tk = s.session?.access_token; if (tk) await fetch("/api/credit/redeem", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ amount: creditToApply, orderId: data.id }) }).catch(() => {}); }
      if (useCode && appliedType === "winback") fetch("/api/winback/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: useCode, orderId: data.id, customerId: customer.id }) }).catch(() => {});
      supabase.auth.getSession().then(({ data: s }) => { const tk = s.session?.access_token; if (tk) fetch("/api/cart/save", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ items: [] }) }).catch(() => {}); });
      fetch("/api/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "order", record: { ...data, discount_code: useCode || null, free_shipping: !!(useCode && codeFreeShip), sample_packets: appliedSamples, credit_applied: creditToApply, customer_address: customer.address, customer_city: customer.city, customer_state: customer.state, customer_zip: customer.zip } }) }).catch(() => {});
    }
    else alert("Failed to submit order.");
  };

  const approveApp = async (id: string) => { const r = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: id, action: "approve" }) }); const d = await r.json(); if (d.ok) { setApplications(p => p.map(a => a.id === id ? { ...a, status: "approved" } : a)); loadAdminData(); } else alert("Error: " + (d.error || "Failed")); };
  const rejectApp = async (id: string) => { const r = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: id, action: "reject" }) }); const d = await r.json(); if (d.ok) setApplications(p => p.map(a => a.id === id ? { ...a, status: "rejected" } : a)); else alert("Error: " + (d.error || "Failed")); };
  const updateOrderStatus = async (id: string, st: string) => { await supabase.from("orders").update({ status: st }).eq("id", id); setOrders(p => p.map(o => o.id === id ? { ...o, status: st } : o)); if (["confirmed", "shipped", "delivered"].includes(st)) { const { data: s } = await supabase.auth.getSession(); const token = s.session?.access_token; if (token) fetch("/api/referral/qualify", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderId: id }) }).catch(() => {}); } };
const syncCustomerToQB = async (cid: string) => { setQbLoading(`cust-${cid}`); setQbMessage(null); try { const r = await fetch("/api/qb/sync-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: cid }) }); const d = await r.json(); if (d.success) { setQbMessage({ text: `✓ ${d.message}`, ok: true }); setCustomers(p => p.map(c => c.id === cid ? { ...c, qb_customer_id: d.qb_customer_id } : c)); if (selectedCustomer?.id === cid) setSelectedCustomer(p => p ? { ...p, qb_customer_id: d.qb_customer_id } : p); } else setQbMessage({ text: `Error: ${d.error}`, ok: false }); } catch { setQbMessage({ text: "Failed to connect to QuickBooks", ok: false }); } setQbLoading(null); };
const deleteCustomer = async (c: Customer) => { if (!confirm(`Delete ${c.name}? This will remove them and their login. This cannot be undone.`)) return; try { const r = await fetch("/api/delete-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id, userId: c.user_id }) }); const d = await r.json(); if (d.ok) { setCustomers(p => p.filter(x => x.id !== c.id)); setSelectedCustomer(null); } else alert("Error: " + (d.error || "Failed to delete")); } catch { alert("Error deleting customer"); } };
  const resetCustomerPassword = async (c: Customer) => { if (resetPwLoading) return; if (!confirm(`Send ${c.name} a new temporary password at ${c.email}? Their current password will stop working immediately.`)) return; setResetPwLoading(c.id); try { const r = await fetch("/api/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: c.id }) }); const d = await r.json(); if (d.ok) alert(`New temporary password emailed to ${c.email}.`); else alert("Error: " + (d.error || "Failed to reset password")); } catch { alert("Error resetting password"); } setResetPwLoading(null); };  const deleteOrder = async (id: string) => { if (!confirm("Delete this order? This cannot be undone.")) return; const { error } = await supabase.from("orders").delete().eq("id", id); if (!error) { setOrders(p => p.filter(o => o.id !== id)); setExpandedOrder(null); setEditingOrderId(null); } else alert("Error: " + error.message); };

  const startEditOrder = (o: Order) => { setEditingOrderId(o.id); setEditItems(o.items.map(i => ({ ...i }))); setEditNote(o.notes || ""); setEditPayMethod(o.pay_method || "check"); };
  const cancelEditOrder = () => { setEditingOrderId(null); setEditItems([]); setEditNote(""); };
  const updateEditItem = (idx: number, field: "qty" | "unit_price", value: number) => { setEditItems(p => p.map((item, i) => { if (i !== idx) return item; const u = { ...item, [field]: value }; u.line_total = u.qty * u.unit_price; return u; })); };
  const removeEditItem = (idx: number) => { setEditItems(p => p.filter((_, i) => i !== idx)); };
  const addProductToEdit = (pid: string) => { const p = products.find(x => x.id === pid); if (!p || editItems.find(i => i.product_id === pid)) return; const pr = p.retail * 0.5; setEditItems(prev => [...prev, { product_id: pid, name: p.name, qty: 1, unit_price: pr, line_total: pr }]); };
  const saveEditedOrder = async () => { if (!editingOrderId || editItems.length === 0) return; const sub = editItems.reduce((s, i) => s + i.line_total, 0); const cf = processingFee(sub, editPayMethod); const { error } = await supabase.from("orders").update({ items: editItems, subtotal: sub, total: sub + cf, cc_fee: cf, discount_amount: 0, tier_discount: 0, tier_name: "CUSTOM", pay_method: editPayMethod, notes: editNote || null }).eq("id", editingOrderId); if (!error) { setOrders(p => p.map(o => o.id === editingOrderId ? { ...o, items: editItems, subtotal: sub, total: sub + cf, cc_fee: cf, discount_amount: 0, tier_discount: 0, tier_name: "CUSTOM", pay_method: editPayMethod, notes: editNote } : o)); cancelEditOrder(); } else alert("Error: " + error.message); };

  const startManualOrder = () => { setCreatingOrder(true); setManualCustomerId(""); setManualItems({}); setManualNote(""); setManualPayMethod("check"); setCustSearch(""); };
  const setMIQty = (pid: string, qty: number) => { const p = products.find(x => x.id === pid); if (!p) return; setManualItems(prev => { if (qty <= 0) { const n = { ...prev }; delete n[pid]; return n; } return { ...prev, [pid]: { qty, price: prev[pid]?.price ?? p.retail * 0.5 } }; }); };
  const setMIPrice = (pid: string, price: number) => { setManualItems(prev => prev[pid] ? { ...prev, [pid]: { ...prev[pid], price } } : prev); };
const submitManualOrder = async () => { if (!manualCustomerId) { alert("Select a customer"); return; } const c = customers.find(x => x.id === manualCustomerId); if (!c) return; const ent = Object.entries(manualItems).filter(([, v]) => v.qty > 0); if (ent.length === 0) { alert("Add at least one product"); return; } const oi: OrderItem[] = ent.map(([id, v]) => { const p = products.find(x => x.id === id)!; return { product_id: id, name: p.name, qty: v.qty, unit_price: v.price, line_total: v.qty * v.price }; }); const sub = oi.reduce((s, i) => s + i.line_total, 0); const cf = processingFee(sub, manualPayMethod); const orderRecord = { order_number: "", customer_id: c.id, customer_name: c.name, customer_email: c.email, items: oi, subtotal: sub, tier_name: "ADMIN", tier_discount: 0, discount_amount: 0, cc_fee: cf, total: sub + cf, pay_method: manualPayMethod, notes: manualNote ? `[Admin] ${manualNote}` : "[Admin Order]" }; const { error } = await supabase.from("orders").insert(orderRecord); if (!error) { setCreatingOrder(false); loadAdminData(); fetch("/api/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "order", record: { ...orderRecord, customer_address: c.address, customer_city: c.city, customer_state: c.state, customer_zip: c.zip } }) }).catch(() => {}); } else alert("Error: " + (error?.message || "Unknown")); };
  const createQBInvoice = async (oid: string) => { setQbLoading(`ord-${oid}`); setQbMessage(null); try { const r = await fetch("/api/qb/create-invoice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: oid }) }); const d = await r.json(); if (d.success) { setQbMessage({ text: `✓ ${d.message}`, ok: true }); setOrders(p => p.map(o => o.id === oid ? { ...o, qb_invoice_id: d.qb_invoice_id } : o)); } else setQbMessage({ text: `Error: ${d.error}`, ok: false }); } catch { setQbMessage({ text: "Failed to create invoice", ok: false }); } setQbLoading(null); };
  const disconnectQB = async () => { if (!confirm("Disconnect QuickBooks?")) return; await fetch("/api/qb/disconnect", { method: "POST" }); setQbConnected(false); setQbMessage({ text: "QuickBooks disconnected", ok: true }); };

  const submitAddCustomer = async () => { if (addCustLoading) return; const f = addCustForm; if (!f.name || !f.email || !f.business || !f.city || !f.type) { setAddCustError("Please fill in all required fields."); return; } setAddCustLoading(true); setAddCustError(""); try { const r = await fetch("/api/add-customer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, email: f.email.trim().toLowerCase(), phone: f.phone, business: f.business, address: f.address, city: f.city, state: f.state, zip: f.zip, type: f.type }) }); const d = await r.json(); if (d.ok) { setAddingCustomer(false); setAddCustForm({ name: "", email: "", phone: "", business: "", address: "", city: "", state: "", zip: "", type: "Chiropractor" }); loadAdminData(); } else { setAddCustError(d.error || "Failed to add customer"); } } catch { setAddCustError("Something went wrong. Please try again."); } setAddCustLoading(false); };

  const exportCustomersCSV = () => { const en = customers.map(c => { const a = applications.find(x => x.email === c.email); return { Name: c.name, Email: c.email, Phone: c.phone || a?.phone || "", Business: c.business, Address: c.address || a?.address || "", City: c.city, Type: c.type, Status: c.status, "Total Orders": c.total_orders, "Total Spent": `$${c.total_spent.toFixed(2)}`, "Last Order": c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "Never", "Member Since": new Date(c.created_at).toLocaleDateString() }; }); if (!en.length) return; const h = Object.keys(en[0]); const rows = [h.join(","), ...en.map(r => h.map(k => { const v = String((r as any)[k]).replace(/"/g, '""'); return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v; }).join(","))]; const b = new Blob([rows.join("\n")], { type: "text/csv" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `active10-customers-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(u); };
  const startEditCustomer = (c: Customer) => {
    // Prefer the dedicated state/zip columns. Fall back to parsing the legacy
    // smooshed city field ("San Francisco, CA 94102") for customers created
    // before those columns were populated.
    let cityName = c.city || "";
    let state = c.state || "";
    let zip = c.zip || "";
    if (!state && !zip && cityName.includes(",")) {
      const parts = cityName.split(",");
      cityName = parts[0].trim();
      const rest = (parts[1] || "").trim().split(/\s+/);
      state = rest[0] || "";
      zip = rest[1] || "";
    }
    setEditCustForm({ name: c.name, email: c.email, phone: c.phone || "", business: c.business, address: c.address || "", city: cityName, state, zip, type: c.type });
    setEditingCustomer(true); setEditCustError("");
  };
  const cancelEditCustomer = () => { setEditingCustomer(false); setEditCustError(""); };
  const saveEditCustomer = async () => {
    if (!selectedCustomer || editCustLoading) return;
    if (!editCustForm.name || !editCustForm.email || !editCustForm.business) { setEditCustError("Name, email, and business are required."); return; }
    setEditCustLoading(true); setEditCustError("");
    const updates = { name: editCustForm.name, email: editCustForm.email, phone: editCustForm.phone, business: editCustForm.business, address: editCustForm.address, city: editCustForm.city, state: editCustForm.state, zip: editCustForm.zip, type: editCustForm.type };
    const { error } = await supabase.from("customers").update(updates).eq("id", selectedCustomer.id);
    if (!error) { const updated = { ...selectedCustomer, ...updates }; setSelectedCustomer(updated); setCustomers(p => p.map(c => c.id === selectedCustomer.id ? updated : c)); setEditingCustomer(false); }
    else { setEditCustError("Error: " + error.message); }
    setEditCustLoading(false);
  };
  const filtered = (filter === "all" ? products : products.filter(p => p.cat === filter)).filter(p => p.cat !== "kit");
  const bg: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(165deg, ${BDP} 0%, ${BBG} 40%, ${BD} 100%)`, fontFamily: "'DM Sans', sans-serif", color: "white" };
  const fonts = <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,500;9..40,700&family=Playfair+Display:wght@600;800&display=swap" rel="stylesheet" />;
  const css = <style>{`@keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}.ch:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(0,0,0,.35)}.ch{transition:all .25s ease}.bh:hover{filter:brightness(1.12)}.bh:active{transform:scale(.97)}input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}select option{color:#333;background:white;}`}</style>;
  const inp: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 10, color: "white", fontSize: 15, outline: "none", boxSizing: "border-box" };
  const btnD: React.CSSProperties = { padding: "8px 18px", background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, color: "#FF6B6B", fontWeight: 600, fontSize: 12, cursor: "pointer" };
  const btnP: React.CSSProperties = { padding: "10px 22px", background: `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 10, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnS: React.CSSProperties = { padding: "8px 16px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" };

  if (loading) return (<div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}{css}<div style={{ textAlign: "center", animation: "su .5s ease" }}><div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "white", margin: "0 auto 16px" }}>A10</div><p style={{ color: "rgba(255,255,255,.5)", fontSize: 14 }}>Loading...</p></div></div>);

  if (orderSuccess) return (<div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{fonts}{css}<div style={{ textAlign: "center", padding: 40, maxWidth: 500, animation: "su .5s ease" }}><div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36 }}>✓</div><h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 12 }}>Order Submitted!</h1><p style={{ color: "rgba(255,255,255,.7)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Your wholesale order has been sent to Active Formulations.</p><button onClick={() => { setOrderSuccess(false); setCart({}); setView("shop"); setAppliedCode(""); setAppliedPct(0); setAppliedFreeShip(false); setAppliedType(""); setAppliedSamples(0); setApplyCreditOn(false); setCodeInput(""); setCodeMsg(null); }} className="bh" style={{ ...btnP, padding: "14px 32px", fontSize: 15, fontWeight: 700 }}>Continue Shopping</button></div></div>);

  // LOGIN
  if (!session) return (
    <div style={{ ...bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>{fonts}{css}
      <div style={{ maxWidth: 420, width: "100%", animation: "su .5s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 8 }}><div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "white" }}>A10</div><span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.5px" }}>Active Formulations</span></div>
          <p style={{ color: "rgba(255,255,255,.4)", fontSize: 13, letterSpacing: "2.5px", textTransform: "uppercase", marginTop: 6 }}>Wholesale Portal</p>
        </div>
        {authView === "apply" ? (appSubmitted ? (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 40, textAlign: "center", animation: "su .5s ease" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${GR},#00D2A0)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>✓</div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 10 }}>Application Received!</h2>
            <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>Thank you for your interest in becoming an Active 10 wholesale partner.</p>
            <p style={{ color: "rgba(255,255,255,.45)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>Our team will review your application and get back to you within 24 hours.</p>
            <div style={{ background: `${B}15`, border: `1px solid ${B}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}><p style={{ color: BL, fontSize: 13, fontWeight: 500 }}>Questions? Email us at activeformulations@gmail.com</p></div>
            <button onClick={() => { setAppSubmitted(false); setAuthView("login"); }} className="bh" style={{ ...btnP, width: "100%", padding: 14, fontSize: 15, fontWeight: 700 }}>Back to Sign In</button>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Apply for Access</h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 24 }}>We'll review within 24 hours.</p>
            {[{ l: "Practice Name", k: "business" }, { l: "Full Name", k: "name" }, { l: "Email", k: "email" }, { l: "Phone", k: "phone" }, { l: "Street Address", k: "address" }, { l: "City", k: "city" }, { l: "State", k: "state" }, { l: "Zip Code", k: "zip" }].map(f => (<div key={f.k} style={{ marginBottom: 16 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{f.l}</label><input value={(appForm as any)[f.k]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm(p => ({ ...p, [f.k]: e.target.value }))} style={inp} /></div>))}
            <div style={{ marginBottom: 24 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Type</label><select value={appForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAppForm(p => ({ ...p, type: e.target.value }))} style={{ ...inp, color: "rgba(255,255,255,.7)" }}><option>Active 10 Wholesale Customer</option><option>Chiropractor</option><option>Physical Therapy</option><option>Massage Therapy</option><option>Medical Doctor</option><option>Other</option></select></div>
            {TURNSTILE_SITE_KEY && <div id="cf-turnstile-apply" style={{ marginBottom: 16, minHeight: 65 }} />}
            <button onClick={submitApplication} className="bh" style={{ ...btnP, width: "100%", padding: 14, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Submit Application</button>
            <button onClick={() => setAuthView("login")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>Already have an account? Sign in</button>
          </div>
        )) : (
          <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 20, padding: 32 }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, marginBottom: 8 }}>Welcome Back</h2>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 28 }}>Sign in to your wholesale account</p>
            {loginError && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{loginError}</div>}
            <div style={{ marginBottom: 16 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Email</label><input value={loginForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginForm(p => ({ ...p, email: e.target.value }))} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && login()} style={inp} placeholder="your@email.com" /></div>
            <div style={{ marginBottom: 24 }}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Password</label><div style={{ position: "relative" }}><input type={showPw ? "text" : "password"} value={loginForm.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && login()} style={{ ...inp, paddingRight: 44 }} placeholder="••••••••" /><button onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: showPw ? BL : "rgba(255,255,255,.35)", fontSize: 14 }}>{showPw ? "🙈" : "👁"}</button></div></div>
            <button onClick={login} className="bh" style={{ ...btnP, width: "100%", padding: 14, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Sign In</button>
            {resetMsg && <div style={{ background: resetMsg.includes("Error") ? "rgba(255,80,80,.1)" : `${GR}15`, border: resetMsg.includes("Error") ? "1px solid rgba(255,80,80,.3)" : `1px solid ${GR}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: resetMsg.includes("Error") ? "#FF6B6B" : GR }}>{resetMsg}</div>}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input value={resetEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="Enter your email" /><button onClick={forgotPassword} style={{ ...btnS, whiteSpace: "nowrap" }}>Reset Password</button></div>
            <button onClick={() => setAuthView("apply")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${B}33`, borderRadius: 10, color: "rgba(255,255,255,.6)", fontSize: 14, cursor: "pointer" }}>New? Apply for wholesale access</button>
          </div>
        )}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.2)", fontSize: 12, marginTop: 32 }}>Trusted by 200+ healthcare professionals</p>
      </div>
    </div>
  );

  // ===== ADMIN =====
  if (isAdmin) {
    const pending = applications.filter(a => a.status === "pending");
    const mOrd = orders.filter(o => { const d = new Date(o.created_at), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
    const mRev = mOrd.reduce((s, o) => s + o.total, 0);

    const renderExpanded = (o: Order) => {
      const isE = editingOrderId === o.id;
      return (<div style={{ background: "rgba(255,255,255,.02)", border: `1px solid ${B}55`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "18px 24px", animation: "su .25s ease" }}>
        {isE ? (<>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: `1px solid ${B}22` }}>{["Product", "Qty", "Unit Price", "Total", ""].map((h, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : i < 4 ? (i === 1 ? "center" : "right") : "center", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600, width: i === 4 ? 40 : i === 1 ? 80 : i === 2 ? 100 : undefined }}>{h}</th>)}</tr></thead>
          <tbody>{editItems.map((it, idx) => (<tr key={idx} style={{ borderBottom: `1px solid ${B}11` }}><td style={{ padding: "10px 0", fontSize: 14, fontWeight: 500 }}>{it.name}</td><td style={{ padding: "10px 4px" }}><input type="number" value={it.qty} onChange={e => updateEditItem(idx, "qty", parseInt(e.target.value) || 0)} style={{ width: 60, textAlign: "center", background: "rgba(255,255,255,.08)", border: `1px solid ${B}44`, borderRadius: 6, color: "white", padding: "6px 4px", fontSize: 13, outline: "none" }} /></td><td style={{ padding: "10px 4px", textAlign: "right" }}><input type="number" step="0.01" value={it.unit_price} onChange={e => updateEditItem(idx, "unit_price", parseFloat(e.target.value) || 0)} style={{ width: 80, textAlign: "right", background: "rgba(255,255,255,.08)", border: `1px solid ${B}44`, borderRadius: 6, color: "white", padding: "6px 4px", fontSize: 13, outline: "none" }} /></td><td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", fontWeight: 600, color: BL }}>${it.line_total.toFixed(2)}</td><td><button onClick={() => removeEditItem(idx)} style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button></td></tr>))}</tbody></table>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}><select onChange={e => { if (e.target.value) { addProductToEdit(e.target.value); e.target.value = ""; } }} style={{ ...inp, flex: 1, padding: "8px 12px", fontSize: 13 }}><option value="">+ Add product...</option>{products.filter(p => !editItems.find(i => i.product_id === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}><input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Notes..." style={{ ...inp, flex: 1, padding: "8px 12px", fontSize: 13 }} /><select value={editPayMethod} onChange={e => setEditPayMethod(e.target.value)} style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: 13 }}><option value="check">Check</option><option value="card">Card (+2.99%)</option><option value="ach">ACH (+1%)</option></select></div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}><div><span style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>New Total: </span><span style={{ fontSize: 20, fontWeight: 700, color: BL }}>${(editItems.reduce((s, i) => s + i.line_total, 0) + processingFee(editItems.reduce((s, i) => s + i.line_total, 0), editPayMethod)).toFixed(2)}</span></div><div style={{ display: "flex", gap: 8 }}><button onClick={cancelEditOrder} style={btnS}>Cancel</button><button onClick={saveEditedOrder} className="bh" style={{ ...btnP, background: `linear-gradient(135deg,${GR},#00D2A0)` }}>Save Changes</button></div></div>
        </>) : (<>
          <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: `1px solid ${B}22` }}>{["Product", "Qty", "Unit Price", "Line Total"].map((h, i) => <th key={i} style={{ textAlign: i === 0 ? "left" : i === 1 ? "center" : "right", padding: "8px 0", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>{o.items.map((it: OrderItem, idx: number) => (<tr key={idx} style={{ borderBottom: `1px solid ${B}11` }}><td style={{ padding: "10px 0", fontSize: 14, fontWeight: 500 }}>{it.name}</td><td style={{ padding: "10px 0", fontSize: 14, textAlign: "center", color: "rgba(255,255,255,.7)" }}>{it.qty}</td><td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", color: "rgba(255,255,255,.7)" }}>${it.unit_price.toFixed(2)}</td><td style={{ padding: "10px 0", fontSize: 14, textAlign: "right", fontWeight: 600, color: BL }}>${it.line_total.toFixed(2)}</td></tr>))}</tbody></table>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "rgba(255,255,255,.4)" }}>Subtotal</span><span>${o.subtotal.toFixed(2)}</span></div>
            {o.discount_amount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: GR }}>{o.tier_name} Discount ({(o.tier_discount * 100).toFixed(0)}%)</span><span style={{ color: GR }}>-${o.discount_amount.toFixed(2)}</span></div>}
            {o.cc_fee > 0 && o.pay_method === "ach" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#73D13D" }}>ACH Fee (1%)</span><span style={{ color: "#73D13D" }}>+${o.cc_fee.toFixed(2)}</span></div>}
            {o.cc_fee > 0 && o.pay_method === "card" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#FFA940" }}>CC Fee (2.99%)</span><span style={{ color: "#FFA940" }}>+${o.cc_fee.toFixed(2)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginTop: 4 }}><span>Total</span><span style={{ color: BL }}>${o.total.toFixed(2)}</span></div>
            {o.notes && <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,.03)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,.4)" }}>📝 {o.notes}</div>}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B}22`, display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={() => startEditOrder(o)} className="bh" style={btnS}>✏️ Edit Order</button><button onClick={() => deleteOrder(o.id)} style={btnD}>🗑 Delete</button></div>
        </>)}
      </div>);
    };

    const renderOrdRow = (o: Order, i: number) => (<div key={o.id} style={{ animation: `su .4s ease ${i * .05}s both` }}>
      <div onClick={() => { setExpandedOrder(expandedOrder === o.id ? null : o.id); if (editingOrderId && editingOrderId !== o.id) cancelEditOrder(); }} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${expandedOrder === o.id ? `${B}55` : `${B}22`}`, borderRadius: expandedOrder === o.id ? "14px 14px 0 0" : 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, cursor: "pointer", transition: "all .2s" }}>
        <div><div style={{ fontWeight: 700, fontSize: 15 }}>{o.order_number}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{o.customer_name} · {o.items.reduce((s: number, i: OrderItem) => s + i.qty, 0)} items · {o.pay_method === "card" ? "💳 Card" : o.pay_method === "ach" ? "🏦 ACH" : "📄 Check"}</div>{o.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>Note: {o.notes}</div>}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {qbConnected && <button onClick={e => { e.stopPropagation(); createQBInvoice(o.id); }} disabled={!!o.qb_invoice_id || qbLoading === `ord-${o.id}`} style={{ padding: "4px 10px", borderRadius: 6, border: o.qb_invoice_id ? "1px solid rgba(0,184,148,.3)" : "1px solid rgba(72,187,120,.3)", background: o.qb_invoice_id ? "rgba(0,184,148,.1)" : "rgba(72,187,120,.1)", color: o.qb_invoice_id ? "#00B894" : "#48BB78", fontSize: 11, fontWeight: 600, cursor: o.qb_invoice_id ? "default" : "pointer", opacity: qbLoading === `ord-${o.id}` ? 0.5 : 1, whiteSpace: "nowrap" }}>{qbLoading === `ord-${o.id}` ? "..." : o.qb_invoice_id ? "✓ Invoiced" : "📗 Invoice"}</button>}
          <select value={o.status} onClick={(e: React.MouseEvent) => e.stopPropagation()} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateOrderStatus(o.id, e.target.value)} style={{ padding: "6px 10px", background: "rgba(255,255,255,.06)", border: `1px solid ${B}33`, borderRadius: 8, color: "white", fontSize: 12, cursor: "pointer" }}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select>
          <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 18, color: BL }}>${o.total.toFixed(2)}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>{new Date(o.created_at).toLocaleDateString()}</div></div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", transition: "transform .2s", transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
        </div>
      </div>
      {expandedOrder === o.id && renderExpanded(o)}
    </div>);

    // MANUAL ORDER VIEW
    if (creatingOrder) {
      const me = Object.entries(manualItems).filter(([, v]) => v.qty > 0);
      const ms = me.reduce((s, [, v]) => s + v.qty * v.price, 0);
      const mc = processingFee(ms, manualPayMethod);
      return (<div style={bg}>{fonts}{css}
        <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}><div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>Create Manual Order</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1px", textTransform: "uppercase" }}>Admin</div></div></div><button onClick={() => setCreatingOrder(false)} style={btnS}>← Back</button></div></header>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 80px" }}>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "20px 24px", marginBottom: 20, animation: "su .4s ease" }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 8, fontWeight: 600 }}>Customer</label>
            {manualCustomerId && !custSearchFocused ? (() => { const sc = customers.find(c => c.id === manualCustomerId); return sc ? (<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: `${B}15`, border: `1px solid ${B}44`, borderRadius: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: BL }}>{sc.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><div><div style={{ fontWeight: 600, fontSize: 14 }}>{sc.name}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{sc.business} · {sc.city}</div></div></div><button onClick={() => { setManualCustomerId(""); setCustSearch(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>×</button></div>) : null; })() : (<div style={{ position: "relative" }}>
              <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if (manualCustomerId) setManualCustomerId(""); }} onFocus={() => setCustSearchFocused(true)} onBlur={() => setTimeout(() => setCustSearchFocused(false), 200)} style={{ ...inp, fontSize: 14 }} placeholder="Search by name or business..." autoFocus={custSearchFocused} />
              {custSearchFocused && (() => { const q = custSearch.toLowerCase(); const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name)); const filtered = q ? sorted.filter(c => c.name.toLowerCase().includes(q) || c.business.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : sorted; return filtered.length > 0 ? (<div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: BBG, border: `1px solid ${B}44`, borderRadius: "0 0 10px 10px", maxHeight: 260, overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,.4)" }}>{filtered.map(c => (<div key={c.id} onMouseDown={() => { setManualCustomerId(c.id); setCustSearch(c.name + " — " + c.business); setCustSearchFocused(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", transition: "background .15s" }} onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = `${B}22`} onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = "transparent"}><div style={{ width: 32, height: 32, borderRadius: 8, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: BL, flexShrink: 0 }}>{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business} · {c.city}</div></div></div>))}</div>) : custSearch ? (<div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: BBG, border: `1px solid ${B}44`, borderRadius: "0 0 10px 10px", padding: "16px", textAlign: "center", color: "rgba(255,255,255,.35)", fontSize: 13 }}>No customers found</div>) : null; })()}
            </div>)}
          </div>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "20px 24px", marginBottom: 20, animation: "su .4s ease .05s both" }}>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 14, fontWeight: 600 }}>Products</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{products.map(p => { const mi = manualItems[p.id]; const q = mi?.qty || 0; const pr = mi?.price ?? p.retail * 0.5; return (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: q > 0 ? `${B}11` : "transparent", border: `1px solid ${q > 0 ? `${B}44` : `${B}15`}`, borderRadius: 12, transition: "all .2s" }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Img src={p.img} alt={p.name} color={p.color} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>Retail: ${p.retail} · WS: ${(p.retail * 0.5).toFixed(2)}</div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>$</span><input type="number" step="0.01" value={pr} onChange={e => setMIPrice(p.id, parseFloat(e.target.value) || 0)} style={{ width: 70, textAlign: "right", background: "rgba(255,255,255,.08)", border: `1px solid ${B}33`, borderRadius: 6, color: "white", padding: "6px 8px", fontSize: 13, outline: "none" }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>×</span>
                <button onClick={() => setMIQty(p.id, q - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "rgba(255,255,255,.08)", color: "white", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <input type="number" value={q} onChange={e => setMIQty(p.id, parseInt(e.target.value) || 0)} style={{ width: 40, textAlign: "center", background: "rgba(255,255,255,.08)", border: `1px solid ${B}33`, borderRadius: 6, color: "white", padding: "6px 2px", fontSize: 14, fontWeight: 700, outline: "none" }} />
                <button onClick={() => setMIQty(p.id, q + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: `${B}33`, color: BL, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                {q > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: BL, minWidth: 60, textAlign: "right" }}>${(q * pr).toFixed(2)}</span>}
              </div>
            </div>); })}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "20px 24px", animation: "su .4s ease .1s both" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}><div style={{ flex: 1, minWidth: 200 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6, fontWeight: 600 }}>Notes</label><input value={manualNote} onChange={e => setManualNote(e.target.value)} style={inp} placeholder="Optional notes..." /></div><div style={{ minWidth: 160 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6, fontWeight: 600 }}>Payment</label><select value={manualPayMethod} onChange={e => setManualPayMethod(e.target.value)} style={inp}><option value="check">Check</option><option value="card">Card (+2.99%)</option><option value="ach">ACH (+1%)</option></select></div></div>
            <div style={{ borderTop: `1px solid ${B}22`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>{me.length > 0 && <><div style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>{me.reduce((s, [, v]) => s + v.qty, 0)} items · ${ms.toFixed(2)}{mc > 0 ? ` + $${mc.toFixed(2)} fee` : ""}</div><div style={{ fontSize: 22, fontWeight: 800, color: BL }}>${(ms + mc).toFixed(2)}</div></>}</div>
              <button onClick={submitManualOrder} className="bh" disabled={!manualCustomerId || me.length === 0} style={{ ...btnP, padding: "14px 32px", fontSize: 15, fontWeight: 700, opacity: !manualCustomerId || me.length === 0 ? 0.4 : 1 }}>Create Order</button>
            </div>
          </div>
        </div>
      </div>);
    }

    // MAIN ADMIN
    return (<div style={bg}>{fonts}{css}
      <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}><div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>Active 10 Wholesale</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1px", textTransform: "uppercase" }}>Admin</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={loadAdminData} className="bh" style={btnS}>↻ Refresh</button><button onClick={logout} className="bh" style={btnS}>Log Out</button></div></div></header>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 28 }}>{[{ l: "Pending Apps", v: pending.length, c: "#FFA940" }, { l: "Active Customers", v: customers.filter(c => c.status === "active").length, c: GR }, { l: "Orders (Month)", v: mOrd.length, c: BL }, { l: "Revenue (Month)", v: `$${mRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, c: "#E8C76A" }].map((s, i) => (<div key={i} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 20px", animation: `su .5s ease ${i * .07}s both` }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 6 }}>{s.l}</div><div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div></div>))}</div>

        <div style={{ background: qbConnected ? "rgba(0,184,148,.08)" : "rgba(255,255,255,.04)", border: `1px solid ${qbConnected ? "rgba(0,184,148,.25)" : "rgba(0,114,188,.2)"}`, borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>📗</span><div><div style={{ fontSize: 13, fontWeight: 600, color: qbConnected ? "#00B894" : "rgba(255,255,255,.6)" }}>QuickBooks {qbConnected ? "Connected" : "Not Connected"}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{qbConnected ? "Sync customers & create invoices" : "Connect to push data to QBO"}</div></div></div>{qbConnected ? <button onClick={disconnectQB} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,80,80,.3)", background: "rgba(255,80,80,.08)", color: "#FF6B6B", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Disconnect</button> : <a href="/api/qb/connect" style={{ padding: "8px 18px", borderRadius: 8, background: "linear-gradient(135deg,#2CA01C,#48BB78)", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Connect QuickBooks</a>}</div>
        {qbMessage && <div style={{ background: qbMessage.ok ? "rgba(0,184,148,.1)" : "rgba(255,80,80,.1)", border: `1px solid ${qbMessage.ok ? "rgba(0,184,148,.3)" : "rgba(255,80,80,.3)"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: qbMessage.ok ? "#00B894" : "#FF6B6B", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{qbMessage.text}</span><button onClick={() => setQbMessage(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>×</button></div>}

        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,.03)", borderRadius: 12, padding: 4 }}>{["customers", "applicants", "orders", "affiliates", "winback", "restock", "abandoned", "referrals", "outreach", "samples"].map(t => <button key={t} onClick={() => { setAdminTab(t); setSelectedCustomer(null); setExpandedOrder(null); setEditingOrderId(null); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: adminTab === t ? `${B}33` : "transparent", color: adminTab === t ? "white" : "rgba(255,255,255,.5)", fontWeight: 600, fontSize: 11.5, cursor: "pointer", textTransform: "capitalize", transition: "all .2s", whiteSpace: "nowrap" }}>{t === "winback" ? "Win-Back" : t === "abandoned" ? "Carts" : t === "outreach" ? "Outreach" : t === "samples" ? "Samples" : t}{t === "applicants" && pending.length > 0 ? ` (${pending.length})` : ""}</button>)}</div>

        {adminTab === "customers" && !selectedCustomer && (<div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}><button onClick={() => { setAddingCustomer(true); setAddCustError(""); }} className="bh" style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><span>➕</span> Add Customer</button><button onClick={exportCustomersCSV} className="bh" style={{ ...btnS, display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 15 }}>📥</span> Export (CSV)</button></div>
          {addingCustomer && (<div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 16, padding: 28, marginBottom: 20, animation: "su .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Customer</h3><button onClick={() => setAddingCustomer(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 20, cursor: "pointer" }}>×</button></div>
            {addCustError && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{addCustError}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[{ l: "Practice Name *", k: "business" }, { l: "Full Name *", k: "name" }, { l: "Email *", k: "email" }, { l: "Phone", k: "phone" }, { l: "Street Address", k: "address" }, { l: "City *", k: "city" }, { l: "State", k: "state" }, { l: "Zip Code", k: "zip" }].map(f => (<div key={f.k}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{f.l}</label><input value={(addCustForm as any)[f.k]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddCustForm(p => ({ ...p, [f.k]: e.target.value }))} style={inp} /></div>))}
              <div><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Type *</label><select value={addCustForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAddCustForm(p => ({ ...p, type: e.target.value }))} style={{ ...inp, color: "rgba(255,255,255,.7)" }}><option>Active 10 Wholesale Customer</option><option>Chiropractor</option><option>Physical Therapy</option><option>Massage Therapy</option><option>Medical Doctor</option><option>Other</option></select></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}><button onClick={() => setAddingCustomer(false)} style={btnS}>Cancel</button><button onClick={submitAddCustomer} disabled={addCustLoading} className="bh" style={{ ...btnP, opacity: addCustLoading ? 0.5 : 1 }}>{addCustLoading ? "Adding..." : "Add Customer"}</button></div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 12 }}>A welcome email with login credentials will be sent to the customer.</p>
          </div>)}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <input value={customerSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerSearch(e.target.value)} placeholder="🔍  Search by name, business, email, or city..." style={{ ...inp, fontSize: 14, paddingRight: customerSearch ? 40 : 14 }} />
            {customerSearch && <button onClick={() => setCustomerSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 18, cursor: "pointer", padding: "0 6px" }} aria-label="Clear search">×</button>}
          </div>
          {(() => { const q = customerSearch.trim().toLowerCase(); const filtered = q ? customers.filter(c => [c.name, c.business, c.email, c.city, c.phone].some(f => (f || "").toLowerCase().includes(q))) : customers; return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{customers.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No customers yet</div>}
            {customers.length > 0 && filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No customers match &ldquo;{customerSearch}&rdquo;</div>}
            {filtered.map((c, i) => (<div key={c.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all .2s", animation: `su .4s ease ${i * .05}s both` }} onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.borderColor = `${B}55`} onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.borderColor = `${B}22`}>
              <div onClick={() => setSelectedCustomer(c)} style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: BL }}>{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div><div><div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>{c.business} · {c.city}</div></div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {qbConnected && <button onClick={e => { e.stopPropagation(); syncCustomerToQB(c.id); }} disabled={!!c.qb_customer_id || qbLoading === `cust-${c.id}`} style={{ padding: "4px 10px", borderRadius: 6, border: c.qb_customer_id ? "1px solid rgba(0,184,148,.3)" : `1px solid ${B}44`, background: c.qb_customer_id ? "rgba(0,184,148,.1)" : `${B}15`, color: c.qb_customer_id ? "#00B894" : BL, fontSize: 11, fontWeight: 600, cursor: c.qb_customer_id ? "default" : "pointer", opacity: qbLoading === `cust-${c.id}` ? 0.5 : 1, whiteSpace: "nowrap" }}>{qbLoading === `cust-${c.id}` ? "..." : c.qb_customer_id ? "✓ In QB" : "→ QB"}</button>}
                <div onClick={() => setSelectedCustomer(c)} style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: 16, color: BL }}>${c.total_spent.toLocaleString()}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>{c.total_orders} orders</div></div>
              </div>
            </div>))}
          </div>
          ); })()}
        </div>)}

        {adminTab === "customers" && selectedCustomer && (() => { const ap = applications.find(a => a.email === selectedCustomer.email); const ph = selectedCustomer.phone || ap?.phone || "—"; const ad = selectedCustomer.address || ap?.address || ""; const co = orders.filter(o => o.customer_id === selectedCustomer.id); return (<div style={{ animation: "su .4s ease" }}>
          <button onClick={() => setSelectedCustomer(null)} style={{ ...btnS, marginBottom: 20 }}>← Back</button>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 18, padding: 28, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: `${B}22`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: BL }}>{selectedCustomer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
              <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontSize: 22, fontWeight: 800 }}>{selectedCustomer.name}</div><div style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>{selectedCustomer.business}</div></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {qbConnected && <button onClick={() => syncCustomerToQB(selectedCustomer.id)} disabled={!!selectedCustomer.qb_customer_id || qbLoading === `cust-${selectedCustomer.id}`} className="bh" style={{ padding: "8px 16px", borderRadius: 8, border: selectedCustomer.qb_customer_id ? "1px solid rgba(0,184,148,.3)" : `1px solid ${B}44`, background: selectedCustomer.qb_customer_id ? "rgba(0,184,148,.1)" : `${B}15`, color: selectedCustomer.qb_customer_id ? "#00B894" : BL, fontSize: 12, fontWeight: 600, cursor: selectedCustomer.qb_customer_id ? "default" : "pointer", opacity: qbLoading === `cust-${selectedCustomer.id}` ? 0.5 : 1 }}>{qbLoading === `cust-${selectedCustomer.id}` ? "..." : selectedCustomer.qb_customer_id ? "✓ In QB" : "📗 Send to QB"}</button>}
                <div style={{ padding: "6px 14px", borderRadius: 8, background: selectedCustomer.status === "active" ? `${GR}22` : "rgba(255,160,64,.15)", color: selectedCustomer.status === "active" ? GR : "#FFA940", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{selectedCustomer.status}</div>
                <button onClick={() => startEditCustomer(selectedCustomer)} className="bh" style={{ ...btnS, color: BL, borderColor: `${B}66` }}>✏️ Edit</button>
                <button onClick={() => resetCustomerPassword(selectedCustomer)} disabled={resetPwLoading === selectedCustomer.id} className="bh" style={{ ...btnS, color: BL, borderColor: `${B}66`, opacity: resetPwLoading === selectedCustomer.id ? 0.5 : 1 }}>{resetPwLoading === selectedCustomer.id ? "Sending..." : "🔑 Reset Password"}</button>
                <button onClick={() => deleteCustomer(selectedCustomer)} style={btnD}>🗑 Delete</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 20 }}>{[{ i: "📧", l: "Email", v: selectedCustomer.email, c: BL }, { i: "📱", l: "Phone", v: ph, c: "rgba(255,255,255,.8)" }, { i: "📍", l: "Address", v: ad ? `${ad}, ${selectedCustomer.city}` : selectedCustomer.city, c: "rgba(255,255,255,.8)" }, { i: "🏥", l: "Type", v: selectedCustomer.type, c: "rgba(255,255,255,.8)" }].map((f, i) => <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{f.i} {f.l}</div><div style={{ fontSize: 14, fontWeight: 500, color: f.c, wordBreak: "break-all" }}>{f.v}</div></div>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>{[{ l: "Total Spent", v: `$${selectedCustomer.total_spent.toLocaleString()}`, c: "#E8C76A" }, { l: "Orders", v: selectedCustomer.total_orders, c: BL }, { l: "Since", v: new Date(selectedCustomer.created_at).toLocaleDateString(), c: "rgba(255,255,255,.7)" }, { l: "Last Order", v: selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString() : "Never", c: GR }].map((s, i) => <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 12, padding: "14px 16px" }}><div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{s.l}</div><div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div></div>)}</div>
          </div>
          {editingCustomer && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${B}33`, animation: "su .3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: BL }}>✏️ Edit Customer</h3>
                  <button onClick={cancelEditCustomer} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 20, cursor: "pointer" }}>×</button>
                </div>
                {editCustError && <div style={{ background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FF6B6B" }}>{editCustError}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[{ l: "Full Name *", k: "name" }, { l: "Practice Name *", k: "business" }, { l: "Email *", k: "email" }, { l: "Phone", k: "phone" }, { l: "Street Address", k: "address" }, { l: "City", k: "city" }, { l: "State", k: "state" }, { l: "Zip Code", k: "zip" }].map(f => (
                    <div key={f.k}><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>{f.l}</label>
                    <input value={(editCustForm as any)[f.k]} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCustForm(p => ({ ...p, [f.k]: e.target.value }))} style={inp} /></div>
                  ))}
                  <div><label style={{ display: "block", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Type</label>
                  <select value={editCustForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditCustForm(p => ({ ...p, type: e.target.value }))} style={{ ...inp, color: "rgba(255,255,255,.7)" }}><option>Active 10 Wholesale Customer</option><option>Chiropractor</option><option>Physical Therapy</option><option>Massage Therapy</option><option>Medical Doctor</option><option>Other</option></select></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                  <button onClick={cancelEditCustomer} style={btnS}>Cancel</button>
                  <button onClick={saveEditCustomer} disabled={editCustLoading} className="bh" style={{ ...btnP, opacity: editCustLoading ? 0.5 : 1 }}>{editCustLoading ? "Saving..." : "Save Changes"}</button>
                </div>
              </div>
            )}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Orders ({co.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{co.map((o, i) => renderOrdRow(o, i))}{co.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,.3)" }}>No orders</div>}</div>
        </div>); })()}

        {adminTab === "applicants" && (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{applications.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No applications</div>}
          {applications.map(a => (<div key={a.id} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, animation: "su .4s ease" }}>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div><div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>{a.business} · {a.type} · {a.city}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>{a.email} · {a.phone} · {new Date(a.created_at).toLocaleDateString()}</div></div>
            {a.status === "pending" ? <div style={{ display: "flex", gap: 8 }}><button onClick={() => approveApp(a.id)} className="bh" style={{ padding: "10px 20px", background: `linear-gradient(135deg,${GR},#00D2A0)`, border: "none", borderRadius: 8, color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Approve</button><button onClick={() => rejectApp(a.id)} className="bh" style={btnD}>Reject</button></div> : <div style={{ padding: "6px 14px", borderRadius: 8, background: a.status === "approved" ? `${GR}22` : "rgba(255,80,80,.12)", color: a.status === "approved" ? GR : "#FF6B6B", fontSize: 12, fontWeight: 600, textTransform: "capitalize" }}>{a.status}</div>}
          </div>))}</div>)}

        {adminTab === "orders" && (<div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}><button onClick={startManualOrder} className="bh" style={{ ...btnP, display: "flex", alignItems: "center", gap: 6 }}><span>➕</span> Create Order</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{orders.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.4)" }}>No orders</div>}{orders.map((o, i) => renderOrdRow(o, i))}</div>
        </div>)}

        {adminTab === "affiliates" && <AdminAffiliates />}
        {adminTab === "winback" && <AdminWinback />}
        {adminTab === "restock" && <AdminRestock />}
        {adminTab === "abandoned" && <AdminAbandoned />}
        {adminTab === "referrals" && <AdminReferrals />}
        {adminTab === "outreach" && <AdminOutreach />}
        {adminTab === "samples" && <AdminSamples />}
      </div>
    </div>);
  }

  // ===== AFFILIATE PORTAL =====
  if (isAffiliate) return <AffiliateDashboard onLogout={logout} />;

  // ===== REFER & EARN =====
  if (view === "refer") return <CustomerReferral onBack={() => setView("shop")} />;

  // ===== SHOP =====
  const orderFee = processingFee(total, payMethod);
  const orderTotal = total + orderFee;
  const creditToApply = applyCreditOn ? Math.min(creditBalance.available, Math.round(orderTotal * 100) / 100) : 0;
  const dueTotal = Math.round((orderTotal - creditToApply) * 100) / 100;

  return (<div style={bg}>{fonts}{css}
    <header style={{ borderBottom: `1px solid ${B}22`, padding: "14px 24px", position: "sticky", top: 0, zIndex: 100, background: `${BDP}EE`, backdropFilter: "blur(20px)" }}><div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${B},${BL})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12 }}>A10</div><div><div style={{ fontSize: 16, fontWeight: 700 }}>Active Formulations</div><div style={{ fontSize: 11, color: BL, letterSpacing: "1.5px", textTransform: "uppercase" }}>Wholesale</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 12 }}>{customer && <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Hi, {customer.name.split(" ")[0]}</span>}{customer && <button onClick={() => setView("refer")} className="bh" style={{ padding: "6px 12px", background: `${GR}18`, border: `1px solid ${GR}44`, borderRadius: 8, color: GR, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🎁 Refer &amp; Earn{creditBalance.available > 0 ? ` · $${creditBalance.available.toFixed(0)}` : ""}</button>}<button onClick={() => setShowChangePw(!showChangePw)} style={{ padding: "6px 12px", background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer" }}>Change Password</button><button onClick={logout} style={{ padding: "6px 12px", background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 12, cursor: "pointer" }}>Log Out</button><button onClick={() => setView(view === "cart" ? "shop" : "cart")} className="bh" style={{ padding: "10px 20px", background: count > 0 ? `linear-gradient(135deg,${B},${BL})` : "rgba(255,255,255,.06)", border: count > 0 ? "none" : `1px solid ${B}33`, borderRadius: 10, color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>🛒 {count > 0 ? `${count} · $${total.toFixed(2)}` : "Cart"}</button></div></div></header>
    {showChangePw && <div style={{ maxWidth: 400, margin: "20px auto", padding: "20px 24px", background: "rgba(255,255,255,.04)", border: `1px solid ${B}33`, borderRadius: 16 }}><h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Change Password</h3>{pwMsg && <div style={{ background: pwMsg.includes("Error") ? "rgba(255,80,80,.1)" : `${GR}15`, border: pwMsg.includes("Error") ? "1px solid rgba(255,80,80,.3)" : `1px solid ${GR}33`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: pwMsg.includes("Error") ? "#FF6B6B" : GR }}>{pwMsg}</div>}<div style={{ display: "flex", gap: 8 }}><input type="password" value={newPw} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPw(e.target.value)} placeholder="New password (min 6 chars)" style={{ ...inp, flex: 1 }} /><button onClick={changePassword} className="bh" style={{ ...btnP, whiteSpace: "nowrap" }}>Update</button></div></div>}
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 100px" }}>
      {view === "shop" && lastOrder && lastOrder.items && lastOrder.items.length > 0 && (
        <div style={{ background: `linear-gradient(135deg,${B}22,${BL}11)`, border: `1px solid ${B}55`, borderRadius: 16, padding: "16px 22px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, animation: "su .5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 26 }}>🔄</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Order Again</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)" }}>Your last order{lastOrder.created_at ? ` (${new Date(lastOrder.created_at).toLocaleDateString()})` : ""}: {lastOrder.items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0)} items · {lastOrder.items.map((i: any) => i.name).slice(0, 3).join(", ")}{lastOrder.items.length > 3 ? "…" : ""}</div>
            </div>
          </div>
          <button onClick={reorderLast} className="bh" style={{ ...btnP, padding: "12px 24px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Reorder These →</button>
        </div>
      )}
      {view === "shop" && customer && customer.total_orders === 0 && (() => {
        const inCart = (cart["dca-intro-kit"] || 0) > 0;
        return (<div style={{ background: `linear-gradient(135deg,${B}22,${GR}18)`, border: `1px solid ${GR}55`, borderRadius: 16, padding: "18px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, animation: "su .5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30 }}>🎾</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>New-customer intro kit — $99</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 2, lineHeight: 1.5 }}>3 Active 10 PLUS CBD tubes + 3 CBD roll-ons + 10 sample packets. About $120 at normal wholesale, ~$240 retail on your shelf. First order only.</div>
            </div>
          </div>
          {inCart
            ? <button onClick={() => setView("cart")} className="bh" style={{ ...btnP, background: `linear-gradient(135deg,${GR},#00D2A0)`, padding: "12px 22px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>✓ In cart — checkout →</button>
            : <button onClick={() => setCart(p => ({ ...p, "dca-intro-kit": 1 }))} className="bh" style={{ ...btnP, padding: "12px 22px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Add intro kit — $99</button>}
        </div>);
      })()}
      {view === "shop" && <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: "18px 24px", marginBottom: 24, animation: "su .5s ease" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ padding: "6px 14px", borderRadius: 8, background: `${tier.color}22`, color: tier.color, fontWeight: 700, fontSize: 12, letterSpacing: "1px" }}>{tier.name}</div><div><div style={{ fontSize: 14, fontWeight: 500 }}>{tier.disc > 0 ? `${(50 + tier.disc * 50).toFixed(0)}% off retail` : "50% off retail"}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>Subtotal: ${wsSub.toFixed(2)}</div></div></div>{tier.next && <div style={{ fontSize: 13, color: BL, fontWeight: 500 }}>${((tier.at || 0) - wsSub).toFixed(2)} more for {tier.next} →</div>}</div><div style={{ marginTop: 12, display: "flex", gap: 4 }}>{[{ n: "STARTER", a: 0, c: "#8899AA" }, { n: "PRO", a: 150, c: GR }, { n: "PRO+", a: 300, c: BL }, { n: "ELITE", a: 1000, c: "#E8C76A" }].map((t, i) => <div key={i} style={{ flex: 1, textAlign: "center" }}><div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)", overflow: "hidden", marginBottom: 6 }}><div style={{ height: "100%", borderRadius: 2, background: wsSub >= t.a ? t.c : "transparent", transition: "all .5s" }} /></div><span style={{ fontSize: 10, color: wsSub >= t.a ? t.c : "rgba(255,255,255,.25)", fontWeight: wsSub >= t.a ? 600 : 400 }}>{t.n}</span></div>)}</div></div>}
      {view === "shop" && <><div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>{[["all", "All"], ["plus", "PLUS (CBD)"], ["original", "Original"], ["wellness", "Wellness"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 18px", borderRadius: 10, border: filter === k ? `1px solid ${B}88` : `1px solid ${B}22`, background: filter === k ? `${B}22` : "transparent", color: filter === k ? BL : "rgba(255,255,255,.5)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .2s" }}>{l}</button>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18 }}>{filtered.map((p, i) => { const q = cart[p.id] || 0, f = fp(p.retail, tier.disc); return (<div key={p.id} className="ch" style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 18, overflow: "hidden", animation: `su .5s ease ${i * .05}s both` }}><div style={{ position: "relative", paddingTop: "80%", background: p.color }}><Img src={p.img} alt={p.name} color={p.color} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", maxWidth: "70%", maxHeight: "70%", objectFit: "contain" }} />{p.badge && <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 9px", borderRadius: 6, background: p.badge === "CBD" ? `linear-gradient(135deg,${GR},#00D2A0)` : `linear-gradient(135deg,${B},${BL})`, color: "white", fontSize: 10, fontWeight: 700 }}>{p.badge}</div>}</div><div style={{ padding: "14px 16px 16px" }}><h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, lineHeight: 1.3 }}>{p.name}</h3><p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12 }}>{p.subtitle}</p><div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}><span style={{ fontSize: 20, fontWeight: 700, color: BL }}>${f.toFixed(2)}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,.3)", textDecoration: "line-through" }}>${p.retail}</span><span style={{ fontSize: 10, color: GR, fontWeight: 600 }}>{Math.round((1 - f / p.retail) * 100)}% off</span></div>{q === 0 ? <button onClick={() => add(p.id, 1)} className="bh" style={{ width: "100%", padding: 10, background: `${B}15`, border: `1px solid ${B}44`, borderRadius: 10, color: BL, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ Add to Order</button> : <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: 3 }}><button onClick={() => add(p.id, -1)} className="bh" style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "rgba(255,255,255,.08)", color: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button><input type="number" value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQtyFn(p.id, parseInt(e.target.value) || 0)} style={{ flex: 1, textAlign: "center", background: "none", border: "none", color: "white", fontSize: 16, fontWeight: 700, outline: "none", width: 36 }} /><button onClick={() => add(p.id, 1)} className="bh" style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: `${B}33`, color: BL, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: anim === p.id ? "pu .3s ease" : "none" }}>+</button></div>}</div></div>); })}</div></>}
      {view === "cart" && <div style={{ maxWidth: 700, margin: "0 auto", animation: "su .4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28 }}>Your Order</h2><button onClick={() => setView("shop")} style={btnS}>← Shopping</button></div>
        {items.length === 0 ? <div style={{ textAlign: "center", padding: 60, background: "rgba(255,255,255,.03)", borderRadius: 16, border: `1px solid ${B}22` }}><p style={{ fontSize: 40, marginBottom: 12 }}>🛒</p><p style={{ color: "rgba(255,255,255,.5)" }}>Cart is empty</p><button onClick={() => setView("shop")} className="bh" style={{ ...btnP, marginTop: 20 }}>Browse Products</button></div> : <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>{items.map(([id, q]) => { const p = products.find(x => x.id === id); if (!p) return null; const f = fp(p.retail, effDisc); return (<div key={id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 14, padding: 14 }}><div style={{ width: 56, height: 56, borderRadius: 10, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Img src={p.img} alt={p.name} color={p.color} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{p.subtitle}</div><div style={{ fontSize: 13, color: BL, fontWeight: 600, marginTop: 2 }}>${f.toFixed(2)} ea</div></div><div style={{ display: "flex", alignItems: "center", gap: 6 }}><button onClick={() => add(id, -1)} className="bh" style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: "rgba(255,255,255,.08)", color: "white", fontSize: 15, cursor: "pointer" }}>−</button><span style={{ fontWeight: 700, fontSize: 15, minWidth: 20, textAlign: "center" }}>{q}</span><button onClick={() => add(id, 1)} className="bh" style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: `${B}33`, color: BL, fontSize: 15, cursor: "pointer" }}>+</button></div><div style={{ fontWeight: 700, fontSize: 15, minWidth: 65, textAlign: "right" }}>${(f * q).toFixed(2)}</div></div>); })}</div>
          {tier.next && (() => { const gap = Math.max(0, (tier.at || 0) - wsSub); const nextDisc = getTier(tier.at || 0).disc; const rp = recs.find(id => products.find(p => p.id === id)); const rpObj = rp ? products.find(p => p.id === rp) : null; return gap > 0 ? (
            <div style={{ background: `linear-gradient(135deg,#E8C76A22,${BL}11)`, border: `1px solid #E8C76A55`, borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 22 }}>🎯</span><div><div style={{ fontSize: 14, fontWeight: 700, color: "#E8C76A" }}>Add ${gap.toFixed(2)} to unlock {tier.next} — {Math.round(nextDisc * 100)}% off your entire order</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>The bigger discount applies to everything in your cart.</div></div></div>
              {rpObj && <button onClick={() => add(rpObj.id, 1)} className="bh" style={{ ...btnP, whiteSpace: "nowrap" }}>+ Add {rpObj.name}</button>}
            </div>) : null; })()}
          {recs.length > 0 && <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".8px", marginBottom: 10 }}>Frequently bought together</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{recs.map(id => { const p = products.find(x => x.id === id); if (!p) return null; const f = fp(p.retail, effDisc); return (<div key={id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 12, padding: "8px 12px", flex: "1 1 220px" }}><div style={{ width: 40, height: 40, borderRadius: 8, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><Img src={p.img} alt={p.name} color={p.color} style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div><div style={{ fontSize: 12, color: BL, fontWeight: 600 }}>${f.toFixed(2)} ea</div></div><button onClick={() => add(id, 1)} className="bh" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: `${B}33`, color: BL, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>+</button></div>); })}</div>
          </div>}
          <div style={{ marginBottom: 20 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".8px" }}>Order Notes</label><textarea value={orderNote} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOrderNote(e.target.value)} placeholder="Special instructions..." rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} /></div>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${appliedCode ? GR : B}22`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".8px" }}>Discount Code</label>
            {appliedCode ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", background: `${GR}15`, border: `1px solid ${GR}44`, borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>🎟️</span><div><div style={{ fontWeight: 700, fontSize: 14, color: GR, letterSpacing: ".5px" }}>{appliedCode}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>{Math.round(appliedPct * 100)}% off{appliedFreeShip ? " + free shipping" : ""}{appliedSamples > 0 ? ` + ${appliedSamples} samples` : ""} applied</div></div></div>
                <button onClick={removeCode} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Remove</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={codeInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCodeInput(e.target.value.toUpperCase())} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && applyCode()} placeholder="Enter code" style={{ ...inp, flex: 1, letterSpacing: ".5px" }} />
                <button onClick={applyCode} disabled={codeChecking} className="bh" style={{ ...btnP, whiteSpace: "nowrap", opacity: codeChecking ? 0.5 : 1 }}>{codeChecking ? "Checking..." : "Apply"}</button>
              </div>
            )}
            {codeMsg && <div style={{ marginTop: 10, fontSize: 13, color: codeMsg.ok ? GR : "#FF6B6B" }}>{codeMsg.ok ? "✓ " : "✕ "}{codeMsg.text}</div>}
          </div>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22, marginBottom: 16 }}><label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".8px" }}>Payment Method</label><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{[{ v: "check", l: "Pay by Check", s: "No additional fees" }, { v: "card", l: "Pay by Credit Card", s: "2.99% processing fee" }, { v: "ach", l: "Pay by ACH Transfer", s: "1% processing fee" }].map(pm => <label key={pm.v} onClick={() => setPayMethod(pm.v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: payMethod === pm.v ? `2px solid ${BL}` : `1px solid ${B}33`, background: payMethod === pm.v ? `${B}15` : "transparent", cursor: "pointer", transition: "all .2s" }}><div style={{ width: 22, height: 22, borderRadius: "50%", border: payMethod === pm.v ? `2px solid ${BL}` : "2px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{payMethod === pm.v && <div style={{ width: 12, height: 12, borderRadius: "50%", background: BL }} />}</div><div><div style={{ fontWeight: 600, fontSize: 14 }}>{pm.l}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 2 }}>{pm.s}</div></div></label>)}</div></div>
          <div style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${B}22`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "rgba(255,255,255,.5)" }}>Retail</span><span style={{ textDecoration: "line-through", color: "rgba(255,255,255,.3)" }}>${items.reduce((s, [id, q]) => s + (products.find(p => p.id === id)?.retail || 0) * q, 0).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "rgba(255,255,255,.5)" }}>Wholesale (50%)</span><span>${wsSub.toFixed(2)}</span></div>
            {effDisc > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: GR }}>{codeBeatsTier ? `${appliedCode} (${Math.round(appliedPct * 100)}% off)` : `${tier.name} (${(tier.disc * 100).toFixed(0)}% off)`}</span><span style={{ color: GR }}>-${(wsSub - total).toFixed(2)}</span></div>}
            {codeFreeShip && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: GR }}>🚚 Shipping</span><span style={{ color: GR, fontWeight: 600 }}>FREE</span></div>}
            {appliedSamples > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: GR }}>🎁 {appliedSamples} sample packets</span><span style={{ color: GR, fontWeight: 600 }}>FREE</span></div>}
            {payMethod === "card" && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "#FFA940" }}>Credit Card Fee (2.99%)</span><span style={{ color: "#FFA940" }}>+${orderFee.toFixed(2)}</span></div>}
            {payMethod === "ach" && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}><span style={{ color: "#73D13D" }}>ACH Transfer Fee (1%)</span><span style={{ color: "#73D13D" }}>+${orderFee.toFixed(2)}</span></div>}
            {creditBalance.available > 0 && <label onClick={() => setApplyCreditOn(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginTop: 8, borderRadius: 10, border: `1px solid ${applyCreditOn ? GR : `${B}33`}`, background: applyCreditOn ? `${GR}12` : "transparent", cursor: "pointer" }}><div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${applyCreditOn ? GR : "rgba(255,255,255,.25)"}`, background: applyCreditOn ? GR : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#00253D", fontSize: 13, fontWeight: 900 }}>{applyCreditOn ? "✓" : ""}</div><div><div style={{ fontSize: 14, fontWeight: 600 }}>Apply account credit</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>You have ${creditBalance.available.toFixed(2)} available</div></div></label>}
            {creditToApply > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 14 }}><span style={{ color: GR }}>💳 Account credit</span><span style={{ color: GR }}>-${creditToApply.toFixed(2)}</span></div>}
            <div style={{ borderTop: `1px solid ${B}22`, paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 16, fontWeight: 600 }}>{creditToApply > 0 ? "Amount Due" : "Subtotal"}</span><span style={{ fontSize: 26, fontWeight: 800, color: BL }}>${dueTotal.toFixed(2)}</span></div>
            <div style={{ background: `${GR}15`, border: `1px solid ${GR}33`, borderRadius: 10, padding: "9px 14px", marginTop: 12, fontSize: 13, color: GR, fontWeight: 500 }}>💰 Saving ${save.toFixed(2)} off retail</div>
          </div>
          {codeFreeShip ? <div style={{ background: `${GR}12`, border: `1px solid ${GR}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}><span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🚚</span><div><p style={{ fontSize: 13, color: GR, fontWeight: 600, marginBottom: 2 }}>Free shipping included</p><p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.5 }}>Your {appliedCode} code covers shipping on this order.</p></div></div> : <div style={{ background: "rgba(255,180,0,.08)", border: "1px solid rgba(255,180,0,.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}><span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📦</span><div><p style={{ fontSize: 13, color: "#FFC940", fontWeight: 600, marginBottom: 2 }}>Shipping calculated separately</p><p style={{ fontSize: 12, color: "rgba(255,200,64,.6)", lineHeight: 1.5 }}>A shipping charge will be added to your invoice.</p></div></div>}
          {wsSub < 50 ? <div style={{ textAlign: "center", padding: 14, background: "rgba(255,80,80,.08)", borderRadius: 12, border: "1px solid rgba(255,80,80,.15)", color: "#FF6B6B", fontSize: 14 }}>Minimum $50 — add ${(50 - wsSub).toFixed(2)} more</div> : <button onClick={submitOrder} disabled={orderSubmitting} className="bh" style={{ width: "100%", padding: 15, background: orderSubmitting ? "rgba(255,255,255,.1)" : `linear-gradient(135deg,${B},${BL})`, border: "none", borderRadius: 12, color: "white", fontWeight: 800, fontSize: 16, cursor: orderSubmitting ? "not-allowed" : "pointer" }}>{orderSubmitting ? "Submitting..." : `Submit Order · $${dueTotal.toFixed(2)}`}</button>}
        </>}
      </div>}
    </div>
  </div>);
}
