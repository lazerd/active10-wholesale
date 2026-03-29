import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const QB_BASE =
  process.env.QB_ENVIRONMENT === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";

export async function getQBTokens() {
  const { data, error } = await supabase
    .from("qb_tokens")
    .select("*")
    .eq("id", "default")
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
        ).toString("base64")}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: data.refresh_token,
      }),
    });

    if (!refreshRes.ok) {
      console.error("QB token refresh failed:", await refreshRes.text());
      return null;
    }

    const newTokens = await refreshRes.json();
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    await supabase.from("qb_tokens").update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", "default");

    return {
      access_token: newTokens.access_token,
      realm_id: data.realm_id,
    };
  }

  return {
    access_token: data.access_token,
    realm_id: data.realm_id,
  };
}

export async function qbApi(
  realmId: string,
  accessToken: string,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
) {
  const url = `${QB_BASE}/v3/company/${realmId}/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`QB API error [${method} ${endpoint}]:`, errText);
    throw new Error(`QB API error: ${res.status} - ${errText}`);
  }

  return res.json();
}
