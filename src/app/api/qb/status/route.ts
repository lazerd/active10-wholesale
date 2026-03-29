import { NextResponse } from "next/server";
import { getQBTokens } from "../lib";

export async function GET() {
  try {
    const tokens = await getQBTokens();
    if (!tokens) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({ connected: true, realmId: tokens.realm_id });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
