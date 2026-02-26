import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  const headersList = headers();
  const ip = headersList.get('cf-connecting-ip') || headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'IP não encontrado';
  return NextResponse.json({ ip });
}