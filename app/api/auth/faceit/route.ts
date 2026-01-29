import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, codeVerifier } = await req.json()

    if (!code || !codeVerifier) {
      return NextResponse.json({ error: 'Code and codeVerifier are required' }, { status: 400 })
    }

    const clientId = process.env.FACEIT_CLIENT_ID
    const clientSecret = process.env.FACEIT_CLIENT_SECRET
    const redirectUri = process.env.FACEIT_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'Missing Faceit credentials' }, { status: 500 })
    }

    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

    const formData = new URLSearchParams()
    formData.append('grant_type', 'authorization_code')
    formData.append('code', code)
    formData.append('redirect_uri', redirectUri)
    formData.append('code_verifier', codeVerifier)

    const tokenRes = await fetch('https://api.faceit.com/auth/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      return NextResponse.json({ error: tokenData }, { status: tokenRes.status })
    }

    return NextResponse.json(tokenData)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
