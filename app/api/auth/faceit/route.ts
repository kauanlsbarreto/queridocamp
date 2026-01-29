import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, codeVerifier } = await req.json()

    if (!code || !codeVerifier) {
      return NextResponse.json({ error: 'Code and codeVerifier are required' }, { status: 400 })
    }

    const clientId = '6104e222-cee5-4c67-90c0-035196f28528'
    const clientSecret = 'gEgxmcKLvU5NxH6bGKBOFo4q8L2deM8TzTWPsaGp'
    const redirectUri = 'https://queridocamp.com.br/faceit/callback'

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