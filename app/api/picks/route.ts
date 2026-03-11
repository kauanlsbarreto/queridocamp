import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

type Env = {
  DB_PRINCIPAL: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1481321464547377224/dlWkywyCkGRbOrTZRMDLa2SDiYV1FeEXHy8c2xbbW67H8XIGkm8bsw9ac-ZI_gNUfTO5";

async function sendDiscordLog(message: string) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (error) {
    console.error("Erro ao enviar log para o Discord:", error);
  }
}

export async function POST(request: Request) {
  let connection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const body = await request.json();
    const {
      action,
      nickname,
      slotIndex,
      team,
      phase,
      faceit_guid,
      targetStatus,
      adminLevel,
      targetNickname,
      type,
      phase: targetPhase
    } = body;

    if (!nickname)
      return NextResponse.json({ error: "Nickname required" }, { status: 400 });

    if (action === "load") {
      let rows: RowDataPacket[] = [];

      if (faceit_guid) {
        [rows] = await connection.query("SELECT * FROM escolhas WHERE faceit_guid = ?", [faceit_guid]);
      }

      if ((!rows || rows.length === 0) && nickname) {
        [rows] = await connection.query("SELECT * FROM escolhas WHERE nickname = ?", [nickname]);
      }
      return NextResponse.json((rows as RowDataPacket[])[0] || {});
    }

    if (action === "save") {
      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
      const [rows] = await connection.query(
        `SELECT ${lockCol} FROM escolhas WHERE nickname = ?`,
        [nickname]
      );

      if ((rows as RowDataPacket[])[0]?.[lockCol])
        return NextResponse.json({ error: "Fase bloqueada" }, { status: 403 });

      const idx = typeof slotIndex === "string" ? parseInt(slotIndex) : slotIndex;
      const col = `${phase}_${idx + 1}`;
      const teamJson = team ? JSON.stringify(team) : null;

      await connection.query(
        `INSERT INTO escolhas (nickname, faceit_guid, ${col})
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE ${col} = ?, faceit_guid = ?`,
        [nickname, faceit_guid || null, teamJson, teamJson, faceit_guid || null] as any
      );

      const phaseName = phase === 'slot' ? 'Quartas de Final' : phase === 'semi' ? 'Semi-Finais' : 'Grande Final';
      let logMsg = "";
      if (team) {
        logMsg = ` **Pick Adicionado/Atualizado**\n **Usuário:** ${nickname}\n **Time:** ${team.team_name}\n **Etapa:** ${phaseName} (Slot ${idx + 1})`;
      } else {
        logMsg = ` **Pick Removido**\n **Usuário:** ${nickname}\n **Etapa:** ${phaseName} (Slot ${idx + 1})`;
      }
      
      if (ctx && (ctx as any).waitUntil) {
        (ctx as any).waitUntil(sendDiscordLog(logMsg));
      } else {
        await sendDiscordLog(logMsg);
      }

      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "lock") {
      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
      await connection.query(
        `UPDATE escolhas SET ${lockCol} = 1 WHERE nickname = ?`,
        [nickname] as any
      );

      const phaseName = phase === 'slot' ? 'Quartas de Final' : phase === 'semi' ? 'Semi-Finais' : 'Grande Final';
      const logMsg = ` **Fase Confirmada**\n **Usuário:** ${nickname}\n **Etapa:** ${phaseName}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "admin_toggle_global") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
      await connection.query(
        `UPDATE escolhas SET ${lockCol} = ?`,
        [targetStatus] as any
      );

      const phaseName = phase === 'slot' ? 'Quartas de Final' : phase === 'semi' ? 'Semi-Finais' : 'Grande Final';
      const statusText = targetStatus ? "BLOQUEADO 🔒" : "DESBLOQUEADO 🔓";
      const logMsg = ` **Admin: Alteração Global**\n **Admin:** ${nickname}\n **Etapa:** ${phaseName}\n**Status:** ${statusText}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "admin_manage_user") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      if (!targetNickname)
        return NextResponse.json({ error: "Nickname alvo não informado" }, { status: 400 });

      const phaseToUse = targetPhase || phase;
      if (!phaseToUse) return NextResponse.json({ error: "Fase não informada" }, { status: 400 });

      if (type === "unlock") {
        const lockCol = phaseToUse === "slot" ? "locked" : `${phaseToUse}_locked`;
        await connection.query(
          `UPDATE escolhas SET ${lockCol} = 0 WHERE nickname = ?`,
          [targetNickname] as any
        );
      } else if (type === "clear") {
        let updateQuery = "";
        if (phaseToUse === "slot")
          updateQuery =
            "slot_1=NULL, slot_2=NULL, slot_3=NULL, slot_4=NULL, slot_5=NULL, slot_6=NULL, slot_7=NULL, slot_8=NULL, locked=0";
        else if (phaseToUse === "semi")
          updateQuery = "semi_1=NULL, semi_2=NULL, semi_3=NULL, semi_4=NULL, semi_locked=0";
        else if (phaseToUse === "final")
          updateQuery = "final_1=NULL, final_2=NULL, final_locked=0";

        if (updateQuery)
          await connection.query(
            `UPDATE escolhas SET ${updateQuery} WHERE nickname = ?`,
            [targetNickname] as any
          );
      }

      const phaseName = phaseToUse === 'slot' ? 'Quartas de Final' : phaseToUse === 'semi' ? 'Semi-Finais' : 'Grande Final';
      const actionText = type === "unlock" ? "Destravou fase" : "Limpou e Destravou fase";
      const logMsg = ` **Admin: Gerenciar Usuário**\n **Admin:** ${nickname}\n **Alvo:** ${targetNickname}\n **Ação:** ${actionText}\n **Etapa:** ${phaseName}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
