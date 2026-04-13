import { NextRequest, NextResponse } from "next/server"
import { CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, CTRADER_TOKEN_URL } from "@/lib/ctrader-config"

export async function POST(request: NextRequest) {
  const { code, redirectUri } = await request.json()

  if (!code || !redirectUri) {
    return NextResponse.json({ error: "Missing code or redirectUri" }, { status: 400 })
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: CTRADER_CLIENT_ID,
    client_secret: CTRADER_CLIENT_SECRET,
  })

  const response = await fetch(`${CTRADER_TOKEN_URL}?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  if (!response.ok) {
    const text = await response.text()
    return NextResponse.json({ error: "Token exchange failed", details: text }, { status: response.status })
  }

  const data = await response.json()
  return NextResponse.json(data)
}
