import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

const WITHDRAWN_TEAMS = ["NeshaStore", "Alfajor Solucoes", "Alfajor Soluções"];
const AUTO_RELOCK_AT_UTC = Date.parse("2026-03-28T12:00:00.000Z"); // 09:00 Brasília (UTC-3)

function normalizeTeamName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isKnockoutPhase(phase: string) {
  return phase === "semi" || phase === "final" || phase === "winner";
}

function parsePickJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value as any;
}

function hasPhasePicks(row: RowDataPacket | undefined, phase: string) {
  if (!row) return false;
  if (phase === "semi") return Boolean(row.semi_1 || row.semi_2 || row.semi_3 || row.semi_4);
  if (phase === "final") return Boolean(row.final_1 || row.final_2);
  if (phase === "winner") return Boolean(row.winner_1);
  return false;
}

async function getTournamentGateContext(connection: any) {
  const [rows] = await connection.query(
    "SELECT team_name, vitorias, derrotas, sp, df FROM team_config"
  ) as [RowDataPacket[], any];

  const withdrawnSet = new Set(WITHDRAWN_TEAMS.map(normalizeTeamName));
  const activeTeams = rows.filter((team) => !withdrawnSet.has(normalizeTeamName(String(team.team_name || ""))));
  const allActiveCompleted17 =
    activeTeams.length > 0 &&
    activeTeams.every((team) => Number(team.vitorias || 0) + Number(team.derrotas || 0) >= 34);

  const top8Names = [...activeTeams]
    .sort((a, b) => {
      const spDiff = Number(b.sp || 0) - Number(a.sp || 0);
      if (spDiff !== 0) return spDiff;
      return Number(b.df || 0) - Number(a.df || 0);
    })
    .slice(0, 8)
    .map((team) => normalizeTeamName(String(team.team_name || "")));

  return {
    allActiveCompleted17,
    relockReached: Date.now() >= AUTO_RELOCK_AT_UTC,
    top8Set: new Set(top8Names),
  };
}

function getUserTop8Hits(row: RowDataPacket | undefined, top8Set: Set<string>) {
  if (!row) return 0;
  let hits = 0;
  for (let i = 1; i <= 8; i++) {
    const team = parsePickJson(row[`slot_${i}`]);
    const teamName = normalizeTeamName(String(team?.team_name || ""));
    if (teamName && top8Set.has(teamName)) hits++;
  }
  return hits;
}

function shouldPhaseBeLocked(
  phase: string,
  row: RowDataPacket | undefined,
  gate: { allActiveCompleted17: boolean; relockReached: boolean; top8Set: Set<string> }
) {
  const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
  const dbLocked = Boolean(row?.[lockCol]);

  if (gate.relockReached) return true; // Bloqueio geral após o prazo

  // Regra especial: se acertou 5 ou mais, libera as fases de mata-mata imediatamente na resposta (sem precisar de F5)
  if (isKnockoutPhase(phase)) {
    const hits = getUserTop8Hits(row, gate.top8Set);
    if (hits >= 5) return false;
  }

  return dbLocked; // Fora do prazo ou sem atingir acertos, respeita o status individual no banco
}

async function triggerBackgroundUpdates(env: Env, gate: any, logMsg?: string) {
  // Lógica de sincronização global do banco de dados em segundo plano
  const runBackgroundUpdates = async () => {
    let bgConn: any;
    try {
      bgConn = await createMainConnection(env);
      
      // 1. Atualizar Locks Globais se necessário
      if (gate.relockReached) {
        await bgConn.query(
          "UPDATE escolhas SET locked = 1, semi_locked = 1, final_locked = 1, winner_locked = 1"
        );
      } else {
        // Sincroniza apenas nicknames para não pesar a query
        const [rows] = await bgConn.query(
          "SELECT * FROM escolhas"
        ) as [RowDataPacket[], any];

        for (const row of rows) {
          const hits = getUserTop8Hits(row, gate.top8Set);
          const isUnlocked = hits >= 5;
          await bgConn.query(
            "UPDATE escolhas SET semi_locked = IF(semi_locked=1, ?, semi_locked), final_locked = IF(final_locked=1, ?, final_locked), winner_locked = IF(winner_locked=1, ?, winner_locked) WHERE nickname = ?",
            [!isUnlocked, !isUnlocked, !isUnlocked, row.nickname]
          );
        }
      }

      // 2. Enviar Log do Discord
      if (logMsg) await sendDiscordLog(logMsg);

      // 3. Revalidar cache do ranking
      revalidatePath("/redondo");

    } catch (e) {
      console.error("Background update error:", e);
    } finally {
      if (bgConn) await bgConn.end();
    }
  };

  runBackgroundUpdates(); // Em desenvolvimento local, roda de forma assíncrona
}

function getPhaseName(phase: string) {
  if (phase === "slot") return "Quartas de Final";
  if (phase === "semi") return "Semi-Finais";
  if (phase === "final") return "Grande Final";
  if (phase === "winner") return "Ganhador";
  return phase;
}

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
    const env = await getRuntimeEnv();

    connection = await createMainConnection(env);

    const body = await request.json();
    const gate = await getTournamentGateContext(connection);

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
      phase: targetPhase,
      officialResults
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

      const row = (rows as RowDataPacket[])[0] || {};
      const semiLocked = shouldPhaseBeLocked("semi", row, gate);
      const finalLocked = shouldPhaseBeLocked("final", row, gate);
      const winnerLocked = shouldPhaseBeLocked("winner", row, gate);

      return NextResponse.json({
        ...row,
        semi_locked: semiLocked,
        final_locked: finalLocked,
        winner_locked: winnerLocked,
      });
    }

    if (action === "save") {
      const [userRows] = await connection.query(
        "SELECT * FROM escolhas WHERE nickname = ? LIMIT 1",
        [nickname]
      ) as [RowDataPacket[], any];
      const userRow = userRows[0];

      if (shouldPhaseBeLocked(phase, userRow, gate)) {
        const errorMsg = gate.relockReached
          ? "Fase bloqueada para todos (prazo encerrado em 28/03/2026 09:00)."
          : "Fase bloqueada.";
        return NextResponse.json({ error: errorMsg }, { status: 403 });
      }

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

      // Dispara atualizações de segundo plano (Discord, Locks, Cache) sem esperar
      await triggerBackgroundUpdates(env, gate, logMsg);

      return NextResponse.json({ success: true });
    }

    if (action === "lock") {
      const [userRows] = await connection.query(
        "SELECT * FROM escolhas WHERE nickname = ? LIMIT 1",
        [nickname]
      ) as [RowDataPacket[], any];
      const userRow = userRows[0];

      if (shouldPhaseBeLocked(phase, userRow, gate)) {
        const errorMsg = gate.relockReached
          ? "Fase bloqueada para todos (prazo encerrado em 28/03/2026 09:00)."
          : "Fase bloqueada.";
        return NextResponse.json({ error: errorMsg }, { status: 403 });
      }

      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
      await connection.query(
        `UPDATE escolhas SET ${lockCol} = 1 WHERE nickname = ?`,
        [nickname] as any
      );

      const phaseName = getPhaseName(phase);
      const logMsg = ` **Fase Confirmada**\n **Usuário:** ${nickname}\n **Etapa:** ${phaseName}`;
      
      await triggerBackgroundUpdates(env, gate, logMsg);

      return NextResponse.json({ success: true });
    }

    if (action === "admin_toggle_global") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

      if (isKnockoutPhase(phase) && gate.relockReached && !targetStatus) {
        return NextResponse.json(
          { error: "Prazo encerrado: semis/final/ganhador estão bloqueados para todos." },
          { status: 403 }
        );
      }

      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;
      await connection.query(
        `UPDATE escolhas SET ${lockCol} = ?`,
        [targetStatus] as any
      );

      const phaseName = getPhaseName(phase);
      const statusText = targetStatus ? "BLOQUEADO 🔒" : "DESBLOQUEADO 🔓";
      const logMsg = ` **Admin: Alteração Global**\n **Admin:** ${nickname}\n **Etapa:** ${phaseName}\n**Status:** ${statusText}`;
      await sendDiscordLog(logMsg);

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
        jogadoresConn = await createMainConnection(env);
        const [fpRows]: any = await jogadoresConn.query(
          `SELECT faceit_nickname, faceit_guid FROM faceit_players WHERE faceit_guid IS NOT NULL AND faceit_guid != ''`
        );
        faceitPlayers = fpRows as { faceit_nickname: string; faceit_guid: string }[];
      } catch (e) {
        console.error("Erro ao conectar banco de dados:", e);
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
      await sendDiscordLog(logMsg);

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
      await sendDiscordLog(logMsg);

      return NextResponse.json({
        success: true,
        total: (participants as any[]).length,
        updated,
        alreadyHad,
        missingPlayersCount: missingPlayers.length,
        missingPlayers
      });
    }

    if (action === "award_pickem_achievements") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2)
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

      if (!officialResults)
        return NextResponse.json({ error: "Resultados oficiais não informados" }, { status: 400 });

      const top8Set = new Set((officialResults.top8Teams || []).map(normalizeTeamName));
      const topSemiSet = new Set((officialResults.topSemiTeams || []).map(normalizeTeamName));
      const topFinalSet = new Set((officialResults.topFinalTeams || []).map(normalizeTeamName));
      const topWinnerNorm = normalizeTeamName(officialResults.topWinner || "");

      const [participants]: any = await connection.query(`SELECT * FROM escolhas`);

      let awardedCount = 0;
      const logDetails: string[] = [];

      for (const row of participants) {
        const achievements: { code: string; label: string; image: string }[] = [];

        // 1. Quartas de Final (5 a 8 acertos)
        let qHits = 0;
        for (let i = 1; i <= 8; i++) {
          const t = parsePickJson(row[`slot_${i}`]);
          if (t && top8Set.has(normalizeTeamName(t.team_name))) qHits++;
        }
        if (qHits >= 5) {
          achievements.push({
            code: `QCS-PICK${qHits}`,
            label: `Acertei ${qHits} palpites do redondo`,
            image: `/premiredondo/acertou${qHits}.png`
          });
        }

        // 2. Semifinal (Acertou os 4 times)
        let sHits = 0;
        for (let i = 1; i <= 4; i++) {
          const t = parsePickJson(row[`semi_${i}`]);
          if (t && topSemiSet.has(normalizeTeamName(t.team_name))) sHits++;
        }
        if (sHits === 4) {
          achievements.push({
            code: `QCS-PICKSEMI`,
            label: `Acertei o palpite da SemiFinal`,
            image: `/premiredondo/semifinal.png`
          });
        }

        // 3. Final (Acertou os 2 times)
        let fHits = 0;
        for (let i = 1; i <= 2; i++) {
          const t = parsePickJson(row[`final_${i}`]);
          if (t && topFinalSet.has(normalizeTeamName(t.team_name))) fHits++;
        }
        if (fHits === 2) {
          achievements.push({
            code: `QCS-PICKFINAL`,
            label: `Acertei o palpite da Final`,
            image: `/premiredondo/finalistas.png`
          });
        }

        // 4. Ganhador
        const winnerPick = parsePickJson(row.winner_1);
        if (winnerPick && normalizeTeamName(winnerPick.team_name) === topWinnerNorm) {
          achievements.push({
            code: `QCS-PICKWINNER`,
            label: `Acerteio o ganhador do Querido Draft 2026.1`,
            image: `/premiredondo/ganhador.png`
          });
        }

        if (achievements.length > 0) {
          let player: any = null;
          const [pByGuid]: any = row.faceit_guid ? await connection.query(`SELECT id, adicionados FROM players WHERE faceit_guid = ?`, [row.faceit_guid]) : [[]];
          if (pByGuid.length) player = pByGuid[0];
          else {
            const [pByNick]: any = await connection.query(`SELECT id, adicionados FROM players WHERE nickname = ?`, [row.nickname]);
            if (pByNick.length) player = pByNick[0];
          }

          if (player) {
            const currentCodes = String(player.adicionados || "").split(',').map((s: string) => s.trim()).filter(Boolean);
            const newToGive = achievements.filter(a => !currentCodes.includes(a.code));

            if (newToGive.length > 0) {
              for (const ach of newToGive) {
                await connection.query(
                  `INSERT INTO adicionados (codigo, imagem, label) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE imagem = VALUES(imagem), label = VALUES(label)`,
                  [ach.code, ach.image, ach.label]
                );
              }
              const updatedCodes = [...currentCodes, ...newToGive.map(a => a.code)].join(',');
              await connection.query(`UPDATE players SET adicionados = ? WHERE id = ?`, [updatedCodes, player.id]);
              awardedCount++;
              logDetails.push(`**${row.nickname}**: ${newToGive.map(a => a.code).join(', ')}`);
            }
          }
        }
      }

      const logMsg = ` **Admin: Premiar Acertos**\n **Admin:** ${nickname}\n **Jogadores Premiados:** ${awardedCount}\n **Detalhes:**\n${logDetails.join('\n') || 'nenhum'}`;
      await triggerBackgroundUpdates(env, gate, logMsg);

      return NextResponse.json({ success: true, awardedCount, total: participants.length });
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
      await sendDiscordLog(logMsg);

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
