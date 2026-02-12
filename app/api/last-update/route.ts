import { NextResponse } from 'next/server'
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db'

export const revalidate = 0; 

export async function GET() {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    const lastUpdate = (rows as any[])[0]?.value || new Date().toISOString();
    return NextResponse.json({ lastUpdate })
  } catch (error) {
    return NextResponse.json({ lastUpdate: new Date().toISOString() })
  }
}
