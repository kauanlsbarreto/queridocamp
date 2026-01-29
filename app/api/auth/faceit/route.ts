import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code, code_verifier } = await req.json() 

    if (!code || !code_verifier) {
      return NextResponse.json({ error: 'Faltam parâmetros code ou code_verifier' }, { status: 400 })
    }

    const clientId = '6104e222-cee5-4c67-90c0-035196f28528'
    const clientSecret = 'gEgxmcKLvU5NxH6bGKBOFo4q8L2deM8TzTWPsaGp'
    const redirectUri = 'https://queridocamp.com.br/faceit/callback'

    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

    const formData = new URLSearchParams()
    formData.append('grant_type', 'authorization_code')
    formData.append('code', code)
    formData.append('redirect_uri', redirectUri)
    formData.append('code_verifier', code_verifier)

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

    const userRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const userInfo = await userRes.json()

    return NextResponse.json({
      nickname: userInfo.nickname,
      avatar: userInfo.picture, 
      guid: userInfo.guid
    })
    
  } catch (err) {
    console.error('Erro na API Auth:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}