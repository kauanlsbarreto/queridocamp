import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { code, code_verifier } = await req.json()

  const tokenRes = await fetch(
    'https://api.faceit.com/auth/v1/oauth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_FACEIT_CLIENT_ID!,
        redirect_uri: process.env.NEXT_PUBLIC_FACEIT_REDIRECT_URI!,
        code,
        code_verifier,
      }),
    }
  )

  const token = await tokenRes.json()
  if (!tokenRes.ok) {
    return NextResponse.json(token, { status: 400 })
  }

  const profileRes = await fetch(
    'https://api.faceit.com/auth/v1/resources/userinfo',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  )

  const profile = await profileRes.json()

  return NextResponse.json({
    id: profile.sub,
    name: profile.nickname,
    avatar: profile.picture,
    loginTime: Date.now(),
  })
}
