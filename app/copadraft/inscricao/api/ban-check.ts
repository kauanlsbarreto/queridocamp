import { NextRequest, NextResponse } from "next/server";
import { createMainConnection } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { faceit_guid } = await req.json();
  if (!faceit_guid) {
    return NextResponse.json({ banned: false });
  }
  try {
    const conn = await createMainConnection(process.env as any);
    const [rows] = await conn.query(
      "SELECT ban FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceit_guid]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as { ban: number };
      if (row.ban === 1) {
        return NextResponse.json({
          banned: true,
          message: "Você está banido de 1 Campeonato Draft. Se achar que é um erro, fale com a Administração."
        });
      }
    }
    return NextResponse.json({ banned: false });
  } catch (e) {
    return NextResponse.json({ banned: false });
  }
}
