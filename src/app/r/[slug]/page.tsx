"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";

// Referral entry point. Captures the affiliate slug, remembers it, and sends
// the visitor to the application form with the ref attached.
export default function ReferralLanding() {
  const params = useParams();
  const slug = String((params?.slug as string) || "").toLowerCase();

  useEffect(() => {
    if (slug) {
      try {
        localStorage.setItem("a10_ref", slug);
      } catch {}
    }
    window.location.replace(slug ? `/?ref=${encodeURIComponent(slug)}` : "/");
  }, [slug]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(165deg,#00253D,#003A5C)", color: "white", fontFamily: "'DM Sans',sans-serif" }}>
      <p style={{ opacity: 0.6 }}>Taking you to Active 10 Wholesale…</p>
    </div>
  );
}
