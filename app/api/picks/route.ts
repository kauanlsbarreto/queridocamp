import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

function getPhaseName(phase: string) {
  if (phase === "slot") return "Quartas de Final";
  if (phase === "semi") return "Semi-Finais";
  if (phase === "final") return "Grande Final";
  if (phase === "winner") return "Ganhador";
  return phase;
}

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

      const phaseName = getPhaseName(phase);
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

      const phaseName = getPhaseName(phase);
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

      const phaseName = getPhaseName(phase);
      const statusText = targetStatus ? "BLOQUEADO 🔒" : "DESBLOQUEADO 🔓";
      const logMsg = ` **Admin: Alteração Global**\n **Admin:** ${nickname}\n **Etapa:** ${phaseName}\n**Status:** ${statusText}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "sync_guids") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

      const [missing]: any = await connection.query(
        `SELECT nickname FROM escolhas WHERE faceit_guid IS NULL OR faceit_guid = ''`
      );

      const similarity = (a: string, b: string): number => {
        const s1 = a.toLowerCase();
        const s2 = b.toLowerCase();
        if (s1 === s2) return 1;
        const longer = s1.length >= s2.length ? s1 : s2;
        const shorter = s1.length >= s2.length ? s2 : s1;
        if (longer.length === 0) return 1;
        const costs: number[] = [];
        for (let i = 0; i <= shorter.length; i++) {
          let lastValue = i;
          for (let j = 0; j <= longer.length; j++) {
            if (i === 0) { costs[j] = j; }
            else if (j > 0) {
              let newValue = costs[j - 1];
              if (shorter[i - 1] !== longer[j - 1])
                newValue = Math.min(newValue, lastValue, costs[j]) + 1;
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
          if (i > 0) costs[longer.length] = lastValue;
        }
        return (longer.length - costs[longer.length]) / longer.length;
      }

      let jogadoresConn: any = null;
      let faceitPlayers: { faceit_nickname: string; faceit_guid: string }[] = [];
      try {
        jogadoresConn = await createJogadoresConnection(ctx.env as any);
        const [fpRows]: any = await jogadoresConn.query(
          `SELECT faceit_nickname, faceit_guid FROM faceit_players WHERE faceit_guid IS NOT NULL AND faceit_guid != ''`
        );
        faceitPlayers = fpRows as { faceit_nickname: string; faceit_guid: string }[];
      } catch (e) {
        console.error("Erro ao conectar DB_JOGADORES:", e);
      }

      let updated = 0;
      let notFound = 0;
      const notFoundList: string[] = [];

      for (const row of missing as { nickname: string }[]) {
        const [players]: any = await connection.query(
          `SELECT faceit_guid FROM players WHERE nickname = ? LIMIT 1`,
          [row.nickname]
        );
        if (players.length && players[0].faceit_guid) {
          await connection.query(
            `UPDATE escolhas SET faceit_guid = ? WHERE nickname = ?`,
            [players[0].faceit_guid, row.nickname]
          );
          updated++;
          continue;
        }

        const exactFp = faceitPlayers.find(
          fp => fp.faceit_nickname.toLowerCase() === row.nickname.toLowerCase()
        );
        if (exactFp) {
          await connection.query(
            `UPDATE escolhas SET faceit_guid = ? WHERE nickname = ?`,
            [exactFp.faceit_guid, row.nickname]
          );
          updated++;
          continue;
        }

        let bestMatch: { faceit_nickname: string; faceit_guid: string } | null = null;
        let bestScore = 0;
        for (const fp of faceitPlayers) {
          const score = similarity(row.nickname, fp.faceit_nickname);
          if (score > bestScore) { bestScore = score; bestMatch = fp; }
        }
        if (bestScore >= 0.8 && bestMatch) {
          await connection.query(
            `UPDATE escolhas SET faceit_guid = ? WHERE nickname = ?`,
            [bestMatch.faceit_guid, row.nickname]
          );
          updated++;
          continue;
        }

        notFound++;
        notFoundList.push(row.nickname);
      }

      if (jogadoresConn) await jogadoresConn.end().catch(console.error);

      const logMsg = ` **Admin: Sync GUIDs**\n **Admin:** ${nickname}\n **Atualizados:** ${updated}\n **Não encontrados (${notFound}):** ${notFoundList.join(", ") || "nenhum"}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      return NextResponse.json({ success: true, updated, notFound, notFoundList, total: (missing as any[]).length });
    }

    if (action === "award_redondop") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

      const [participants]: any = await connection.query(
        `SELECT e.nickname, e.faceit_guid FROM escolhas e`
      );

      let updated = 0;
      let alreadyHad = 0;
      const missingPlayers: string[] = [];

      for (const row of participants as { nickname: string; faceit_guid: string | null }[]) {
        let playerId: number | null = null;
        let adicionados: string | null = null;

        // 1) Try by faceit_guid first
        if (row.faceit_guid) {
          const [byGuidRows]: any = await connection.query(
            `SELECT id, adicionados FROM players WHERE faceit_guid = ? LIMIT 1`,
            [row.faceit_guid]
          );
          if (byGuidRows.length) {
            playerId = byGuidRows[0].id;
            adicionados = byGuidRows[0].adicionados;
          }
        }

        // 2) Fallback by nickname
        if (!playerId) {
          const [byNickRows]: any = await connection.query(
            `SELECT id, adicionados FROM players WHERE nickname = ? LIMIT 1`,
            [row.nickname]
          );
          if (byNickRows.length) {
            playerId = byNickRows[0].id;
            adicionados = byNickRows[0].adicionados;
          }
        }

        if (!playerId) {
          missingPlayers.push(row.nickname);
          continue;
        }

        const currentCodes = String(adicionados || "")
          .split(/[,;|\n]/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (currentCodes.includes("QCS-REDONDOP")) {
          alreadyHad++;
          continue;
        }

        currentCodes.push("QCS-REDONDOP");
        await connection.query(
          `UPDATE players SET adicionados = ? WHERE id = ?`,
          [currentCodes.join(","), playerId]
        );
        updated++;
      }

      const logMsg = ` **Admin: Premiar Redondo**\n **Admin:** ${nickname}\n **Atualizados:** ${updated}\n **Já tinham:** ${alreadyHad}\n **Sem player vinculado:** ${missingPlayers.length}`;
      if (ctx && (ctx as any).waitUntil) (ctx as any).waitUntil(sendDiscordLog(logMsg));
      else await sendDiscordLog(logMsg);

      return NextResponse.json({
        success: true,
        total: (participants as any[]).length,
        updated,
        alreadyHad,
        missingPlayersCount: missingPlayers.length,
        missingPlayers
      });
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
        else if (phaseToUse === "winner")
          updateQuery = "winner_1=NULL, winner_locked=0";

        if (updateQuery)
          await connection.query(
            `UPDATE escolhas SET ${updateQuery} WHERE nickname = ?`,
            [targetNickname] as any
          );
      }

      const phaseName = getPhaseName(phaseToUse);
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
