import { createMainConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import RodadasPageClient from "./RodadasPageClient";
import type { Jogo } from "./RodadasPageClient";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const revalidate = 60;

let cachedRodadasData: {
	expiresAt: number;
	data: Jogo[];
} | null = null;

async function loadJogos(env: Env): Promise<Jogo[]> {
  let connection: any = null;
  try {
    connection = await createMainConnection(env);
    const [rows] = await connection.query(
      "SELECT rodada, time1, time2, placar FROM jogos ORDER BY rodada ASC, time1 ASC"
    );
    if (!Array.isArray(rows)) return [];
    return (rows as any[]).map((row) => ({
      rodada: Number(row.rodada),
      time1: String(row.time1 || ""),
      time2: String(row.time2 || ""),
      placar: row.placar != null ? String(row.placar) : null,
    }));
  } catch (err) {
    console.error("[copadraft/rodadas] erro ao carregar jogos:", err);
    throw err; // propaga para não cachear falha de DB
  } finally {
    await connection?.end?.();
  }
}

export default async function RodadasPage() {
  let jogos: Jogo[] = [];
  const now = Date.now();

  try {
    const env = await getRuntimeEnv() as Env;
    
    if (cachedRodadasData && cachedRodadasData.expiresAt > now) {
      jogos = cachedRodadasData.data;
    } else {
      jogos = await loadJogos(env);
      // Só cacheia quando DB respondeu com sucesso (loadJogos lança em caso de erro)
      cachedRodadasData = {
        expiresAt: now + 60000,
        data: jogos,
      };
    }
  } catch (err) {
    console.error("[copadraft/rodadas] erro na página:", err);
    // em build/prerender sem DB disponível, renderiza vazio sem cachear
  }

  return <RodadasPageClient jogos={jogos} />;
}
