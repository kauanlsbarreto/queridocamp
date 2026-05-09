import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import type { ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

type Env = {
  DB_PRINCIPAL: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  DB_JOGADORES: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

export async function PUT(request: Request) {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const { userId, adicionados } = await request.json();

    if (!userId) {
      await connection.end();
      return NextResponse.json(
        { message: "User ID is required" },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "UPDATE players SET adicionados = ? WHERE id = ?",
      [adicionados, userId]
    );

    await connection.end();

    return NextResponse.json({ message: "Success" });
  } catch {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
