import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { code, code_verifier } = await req.json()

    const tokenRes = await fetch(
      'https://accounts.faceit.com/accounts/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.NEXT_PUBLIC_FACEIT_CLIENT_ID!,
          redirect_uri: process.env.NEXT_PUBLIC_FACEIT_REDIRECT_URI!,
          code,
          code_verifier,
        }),
      }
    )

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error('Erro token FACEIT:', tokenData)
      return NextResponse.json(tokenData, { status: 400 })
    }

    const profileRes = await fetch(
      'https://api.faceit.com/auth/v1/resources/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    )

    const profile = await profileRes.json()

    if (!profileRes.ok) {
      return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 400 })
    }

    return NextResponse.json({
      id: profile.sub,
      name: profile.nickname,
      avatar: profile.picture || null,
      loginTime: Date.now(),
    })
  } catch (err) {
    console.error('Erro interno FACEIT auth:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
