import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const h = req.headers;
  const ip =
    h.get('cf-connecting-ip') ||
    h.get('x-forwarded-for') ||
    h.get('x-real-ip') ||
    'IP não encontrado';
  return NextResponse.json({ ip });
}