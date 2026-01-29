import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, code_verifier } = body

    // Validação rigorosa dos parâmetros recebidos
    if (!code || !code_verifier) {
      return NextResponse.json(
        { error: 'Faltam parâmetros code ou code_verifier no corpo da requisição' }, 
        { status: 400 }
      )
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

    // 1. Troca o código pelo Access Token
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
      return NextResponse.json({ error: 'Erro ao obter token da FACEIT', details: tokenData }, { status: tokenRes.status })
    }

    // 2. Busca informações do perfil (Nickname e Foto)
    // Isso evita que o frontend fique com dados vazios logo após o login
    const userRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const userInfo = await userRes.json()

    // Retorna o objeto formatado para o componente UserProfile
    return NextResponse.json({
      nickname: userInfo.nickname,
      avatar: userInfo.picture, // A FACEIT chama a foto de 'picture'
      guid: userInfo.guid
    })
    
  } catch (err) {
    console.error('Erro interno na API Auth:', err)
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 })
  }
}