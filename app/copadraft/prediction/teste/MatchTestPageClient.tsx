"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type RoundEvent = {
  id: number;
  minute: string;
  text: string;
  tone: "neutral" | "good" | "warn";
};

const FAKE_EVENTS: RoundEvent[] = [
  { id: 1, minute: "00:40", text: "Round 1 - Argentina venceu no clutch 1v2.", tone: "good" },
  { id: 2, minute: "01:28", text: "Round 2 - Brasil forca eco e empata a serie.", tone: "neutral" },
  { id: 3, minute: "02:11", text: "Timeout tatico solicitado por Argentina.", tone: "warn" },
  { id: 4, minute: "03:02", text: "Round 3 - Brasil abre vantagem economica.", tone: "good" },
];

function eventToneClass(tone: RoundEvent["tone"]) {
  if (tone === "good") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (tone === "warn") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";
}

export default function MatchTestPageClient() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [denyReason, setDenyReason] = useState("Acesso restrito para Admin 1.");
  const [selectedChoice, setSelectedChoice] = useState<"Argentina" | "Empate" | "Brasil">("Argentina");
  const [pointsAmount, setPointsAmount] = useState(120);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const raw = localStorage.getItem("faceit_user");
        if (!raw) {
          setDenyReason("Voce precisa estar logado com FACEIT.");
          setHasAccess(false);
          return;
        }

        const user = JSON.parse(raw);
        const guid = String(user?.faceit_guid || "").trim();
        if (!guid) {
          setDenyReason("FACEIT GUID nao encontrado na sessao.");
          setHasAccess(false);
          return;
        }

        const res = await fetch(`/api/copadraft/prediction?faceit_guid=${encodeURIComponent(guid)}`);
        const data = await res.json();

        if (!data?.ok || !data?.isAdmin1) {
          setDenyReason("Somente Admin nivel 1 pode acessar esta pagina de teste.");
          setHasAccess(false);
          return;
        }

        setHasAccess(true);
      } catch {
        setDenyReason("Nao foi possivel validar acesso de administrador.");
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, []);

  const projected = useMemo(() => {
    const odds = selectedChoice === "Empate" ? 1.5 : 2.0;
    return {
      odds,
      retorno: Math.round(pointsAmount * odds),
    };
  }, [selectedChoice, pointsAmount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold">Validando acesso Admin 1...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-500/40 bg-red-950/30 p-6">
          <p className="text-red-300 text-xs font-bold tracking-widest uppercase mb-2">Acesso Negado</p>
          <h1 className="text-2xl font-black mb-2">Area de teste bloqueada</h1>
          <p className="text-zinc-300">{denyReason}</p>
          <Link href="/copadraft/prediction" className="inline-block mt-5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">
            Voltar para Prediction
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">Pagina de teste</p>
            <h1 className="text-3xl font-black">Simulacao Dentro da Partida</h1>
          </div>
          <Link href="/copadraft/prediction" className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">
            Voltar
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-zinc-400">Match ID</p>
                <p className="font-bold text-cyan-300">TEST-2026-ARG-BRA-BO1</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                AO VIVO (TESTE)
              </span>
            </div>

            <div className="grid grid-cols-3 items-center text-center mb-6">
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Image src="/selecoes/argentina.jpg" alt="Argentina" width={26} height={18} className="rounded-sm border border-zinc-600" />
                  <p className="text-lg font-black">Argentina</p>
                </div>
                <p className="text-5xl font-black text-yellow-300">7</p>
              </div>
              <div className="text-zinc-500 font-bold">VS</div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Image src="/selecoes/brasil.jpg" alt="Brasil" width={26} height={18} className="rounded-sm border border-zinc-600" />
                  <p className="text-lg font-black">Brasil</p>
                </div>
                <p className="text-5xl font-black text-yellow-300">6</p>
              </div>
            </div>

            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-3">Feed da Partida (Mock)</h2>
            <div className="space-y-2">
              {FAKE_EVENTS.map((evt) => (
                <div key={evt.id} className={`rounded-lg border p-3 ${eventToneClass(evt.tone)}`}>
                  <p className="text-xs opacity-80">{evt.minute}</p>
                  <p className="font-semibold">{evt.text}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-black mb-4">Painel de Aposta (Preview)</h2>

            <p className="text-xs text-zinc-400 mb-2">Escolha de resultado</p>
            <div className="space-y-2 mb-4">
              {(["Argentina", "Empate", "Brasil"] as const).map((choice) => {
                const odds = choice === "Empate" ? 1.5 : 2.0;
                const active = selectedChoice === choice;
                return (
                  <button
                    key={choice}
                    onClick={() => setSelectedChoice(choice)}
                    className={`w-full rounded-lg px-3 py-2 border text-left ${
                      active ? "border-blue-400 bg-blue-500/20" : "border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/70"
                    }`}
                  >
                    <span className="font-bold">{choice}</span>
                    <span className="float-right text-green-300 font-semibold">{odds.toFixed(2)}x</span>
                  </button>
                );
              })}
            </div>

            <label className="text-xs text-zinc-400">Pontos apostados</label>
            <input
              type="number"
              min={1}
              value={pointsAmount}
              onChange={(e) => setPointsAmount(Math.max(1, Number(e.target.value || 1)))}
              className="mt-1 mb-4 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2"
            />

            <div className="rounded-lg bg-zinc-800/70 border border-zinc-700 p-3 text-sm space-y-1">
              <p>
                <span className="text-zinc-400">Odds:</span> <span className="font-bold text-yellow-300">{projected.odds.toFixed(2)}x</span>
              </p>
              <p>
                <span className="text-zinc-400">Retorno projetado:</span> <span className="font-bold text-emerald-300">{projected.retorno} pts</span>
              </p>
            </div>

            <button className="w-full mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 font-black">
              Simular Confirmacao
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
