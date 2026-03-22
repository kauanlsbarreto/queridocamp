import Link from 'next/link';
import Image from 'next/image';
import { Trophy, Crown, ArrowLeft, Medal } from 'lucide-react';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, Env } from '@/lib/db';
import { ensureTableExists, getAdminReferencePicks, getAccuracyRanking, getTop8Teams } from '../ranking-data';

export const revalidate = 86400;

export default async function RedondoRankingPage() {
  let connection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    if (!env.DB_PRINCIPAL) {
      throw new Error('DB_PRINCIPAL não definido no Cloudflare Env');
    }

    connection = await createMainConnection(env);
    await ensureTableExists(connection);

    const [top8Teams, adminReference] = await Promise.all([
      getTop8Teams(connection),
      getAdminReferencePicks(connection),
    ]);

    const ranking = await getAccuracyRanking(connection, env, top8Teams, adminReference);

    return (
      <main className="min-h-screen bg-black text-white">
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-500/80">Redondo</p>
              <h1 className="mt-2 text-4xl font-black uppercase italic tracking-tight text-white md:text-5xl">Ranking</h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-500">
                Todos os players que participaram aparecem aqui, ordenados por acertos em Quartas, Semi, Final e Ganhador.
              </p>
            </div>

            <Link
              href="/redondo"
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-300 transition-all hover:border-amber-500/30 hover:text-white"
            >
              <ArrowLeft size={14} /> Voltar para Redondo
            </Link>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,10,0.96))] p-5 md:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80">Classificação Geral</p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">Mais acertos do Redondo</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                <Trophy size={14} /> {ranking.length} participantes
              </div>
            </div>

            <div className="space-y-3">
              {ranking.map((entry) => (
                <div
                  key={entry.nickname}
                  className={`flex flex-wrap items-center gap-3 rounded-[1.5rem] border px-4 py-4 transition-all md:flex-nowrap ${entry.isLeader ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/8 bg-white/[0.03]'}`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${entry.rank === 1 ? 'border-amber-400/40 bg-amber-500/15 text-amber-300' : entry.rank === 2 ? 'border-zinc-300/20 bg-zinc-300/10 text-zinc-200' : entry.rank === 3 ? 'border-orange-400/30 bg-orange-500/10 text-orange-300' : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                    {entry.rank <= 3 ? <Medal size={18} /> : entry.rank}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-0.5">
                    <Image
                      src={entry.avatar || '/images/cs2-player.png'}
                      alt={entry.nickname}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-[0.9rem] object-cover"
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-black uppercase tracking-wide text-white">{entry.nickname}</p>
                      {entry.isLeader && <Crown size={16} className="shrink-0 text-amber-400" />}
                    </div>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Quartas {entry.quarterHits}/8 • Semi {entry.semiHits}/4 • Final {entry.finalHits}/2 • Ganhador {entry.winnerHit ? '1/1' : '0/1'}
                    </p>
                  </div>

                  <div className="ml-auto flex items-center gap-6">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-bold uppercase text-zinc-500 md:grid-cols-4">
                      <span>Q {entry.quarterHits}/8</span>
                      <span>S {entry.semiHits}/4</span>
                      <span>F {entry.finalHits}/2</span>
                      <span>G {entry.winnerHit ? '1/1' : '0/1'}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black italic leading-none text-white">{entry.totalHits}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">acertos</p>
                    </div>
                  </div>
                </div>
              ))}

              {ranking.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-zinc-500">
                  Nenhum participante encontrado no ranking.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  } finally {
    if (connection) await connection.end();
  }
}