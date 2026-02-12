import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
export const runtime = 'edge';

export const revalidate = 0; 

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    const lastUpdate = (rows as any[])[0]?.value || new Date().toISOString();
    return NextResponse.json({ lastUpdate })
  } catch (error) {
    return NextResponse.json({ lastUpdate: new Date().toISOString() })
  }
}
