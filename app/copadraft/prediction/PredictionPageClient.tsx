"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Game = { jogo_id: number; data: string; hora: string; time1: string; time2: string };
type LiveOdds = Record<string, number>;
type LiveCounts = Record<string, number>;
type AdminBoardEntry = {
  match_id: number;
  time1: string;
  time2: string;
  openCount?: number;
  manualEligible?: boolean;
  manualBlockedReason?: string | null;
  counts: { time1: number; draw: number; time2: number; total: number };
  bettors?: { time1: string[]; draw: string[]; time2: string[] };
};
type Prediction = {
  id: number;
  match_id: string;
  team_chosen: string;
  points_predicted: number;
  odds: number;
  status: string;
  result_points: number | null;
  is_cashed_out?: number;
  cashout_at?: string | null;
  created_at: string;
  game_date?: string | null;
  game_time?: string | null;
  time1?: string | null;
  time2?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  WON: "Ganha",
  LOST: "Perdida",
  DRAW: "Empate",
};

const TEAM_FLAG_BY_NAME: Record<string, string> = {
  argentina: "/selecoes/argentina.jpg",
  alemanha: "/selecoes/alemanha.jpg",
  mexico: "/selecoes/m%C3%A9xico.jpg",
  holanda: "/selecoes/holanda.jpg",
  franca: "/selecoes/fran%C3%A7a.jpg",
  inglaterra: "/selecoes/inglaterra.jpg",
  brasil: "/selecoes/brasil.jpg",
  italia: "/selecoes/it%C3%A1lia.jpg",
  portugal: "/selecoes/portugal.jpg",
  espanha: "/selecoes/espanha.jpg",
  japao: "/selecoes/jap%C3%A3o.jpg",
  croacia: "/selecoes/cro%C3%A1cia.jpg",
  belgica: "/selecoes/b%C3%A9lgica.jpg",
  uruguai: "/selecoes/uruguai.jpg",
};

function normalizeTeamKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTeamFlagSrc(teamName: string) {
  const key = normalizeTeamKey(teamName);
  return TEAM_FLAG_BY_NAME[key] || "/placeholder-logo.png";
}

function getPredictionSchedule(matchId: string, gameDate?: string | null, gameTime?: string | null) {
  const legacyDate = matchId.includes("::") ? matchId.split("::")[0] : "";
  const rawDate = (gameDate || legacyDate || "").trim();
  const rawTime = (gameTime || "").trim();
  const dateObj = rawDate ? new Date(`${rawDate}T${rawTime || "00:00"}:00`) : null;

  if (dateObj && Number.isFinite(dateObj.getTime())) {
    return {
      date: dateObj.toLocaleDateString("pt-BR"),
      time: rawTime || dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  }

  return {
    date: rawDate || "Data indisponível",
    time: rawTime || "--:--",
  };
}

function getPredictionTeams(prediction: Prediction) {
  if (prediction.time1 && prediction.time2) {
    return { time1: prediction.time1, time2: prediction.time2 };
  }
  return { time1: "Time 1", time2: "Time 2" };
}

function formatOddsAsPoints(odds: number) {
  const value = Number(odds);
  const multiplierLabel = Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0,00";
  return `x ${multiplierLabel} pontos`;
}

export default function PredictionPageClient() {
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [closedGames, setClosedGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [adminLevel, setAdminLevel] = useState(0);
  const [adminBoardByMatchId, setAdminBoardByMatchId] = useState<Record<number, AdminBoardEntry>>({});
  const [isAdmin1, setIsAdmin1] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"games" | "closed" | "my" | "admin">("games");
  const [adminTab, setAdminTab] = useState<"upcoming" | "past">("upcoming");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [liveOddsByMatchId, setLiveOddsByMatchId] = useState<Record<number, LiveOdds>>({});
  const [liveCountsByMatchId, setLiveCountsByMatchId] = useState<Record<number, LiveCounts>>({});
  const [teamChoice, setTeamChoice] = useState("");
  const [pointsAmount, setPointsAmount] = useState("");
  const [betting, setBetting] = useState(false);
  const [cashingOutId, setCashingOutId] = useState<number | null>(null);
  const [adminProcessingMatchId, setAdminProcessingMatchId] = useState<number | null>(null);
  const [adminPayoutModalGame, setAdminPayoutModalGame] = useState<Game | null>(null);
  const [adminWinnerChoice, setAdminWinnerChoice] = useState<string>("");

  const openPredictions = predictions.filter((p) => {
    const isOpenStatus = String(p.status || "").toUpperCase() === "OPEN";
    const notCashedOut = Number(p.is_cashed_out || 0) !== 1;

    const rawDate = String(p.game_date || "").trim();
    const rawTime = String(p.game_time || "00:00").trim() || "00:00";
    if (!rawDate) return isOpenStatus && notCashedOut;

    const gameDate = new Date(`${rawDate}T${rawTime}:00`);
    const notClosedByTime = Number.isFinite(gameDate.getTime()) ? gameDate > new Date() : true;

    return isOpenStatus && notCashedOut && notClosedByTime;
  });

  useEffect(() => {
    const stored = localStorage.getItem("faceit_user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        loadData(u.faceit_guid);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchOddsForGame = async (game: Game): Promise<{ odds: LiveOdds; counts: LiveCounts } | null> => {
    try {
      const res = await fetch(
        `/api/copadraft/prediction?action=market_odds&match_id=${encodeURIComponent(String(game.jogo_id))}&time1=${encodeURIComponent(game.time1)}&time2=${encodeURIComponent(game.time2)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.odds) return null;
      return {
        odds: data.odds as LiveOdds,
        counts: (data.counts || {}) as LiveCounts,
      };
    } catch {
      return null;
    }
  };

  const loadData = async (guid: string) => {
    try {
      // Fetch only games list (without access-gated palpites payload)
      const gamesRes = await fetch(`/api/copadraft/palpites?faceit_guid=${encodeURIComponent(guid)}&games_only=1`);
      const gamesData = await gamesRes.json();
      if (gamesData.ok && gamesData.games) {
        const now = new Date();
        const allGames: Game[] = Array.isArray(gamesData.games) ? (gamesData.games as Game[]) : [];
        const upcoming = allGames.filter((g: Game) => {
          const gameDate = new Date(`${g.data}T${g.hora}:00`);
          return gameDate > now;
        });
        const closed = allGames.filter((g: Game) => {
          const gameDate = new Date(`${g.data}T${g.hora}:00`);
          return gameDate <= now;
        });

        closed.sort((a, b) => {
          const aTime = new Date(`${a.data}T${a.hora}:00`).getTime();
          const bTime = new Date(`${b.data}T${b.hora}:00`).getTime();
          return bTime - aTime;
        });

        setGames(upcoming);
        setClosedGames(closed);

        // Refresh odds board in background for visible upcoming games.
        const oddsEntries = await Promise.all(
          upcoming.map(async (game: Game) => {
            const market = await fetchOddsForGame(game);
            return [Number(game.jogo_id), market] as const;
          })
        );
        const nextOdds: Record<number, LiveOdds> = {};
        const nextCounts: Record<number, LiveCounts> = {};
        for (const [matchId, market] of oddsEntries) {
          if (market?.odds) nextOdds[matchId] = market.odds;
          if (market?.counts) nextCounts[matchId] = market.counts;
        }
        setLiveOddsByMatchId(nextOdds);
        setLiveCountsByMatchId(nextCounts);
      }

      // Fetch user's predictions
      const predRes = await fetch(`/api/copadraft/prediction?faceit_guid=${encodeURIComponent(guid)}`);
      const predData = await predRes.json();
      if (predData.ok) {
        setPredictions(Array.isArray(predData.myPredictions) ? predData.myPredictions : []);
        setIsAdmin1(Boolean(predData.isAdmin1));
        setAdminLevel(Number(predData.adminLevel || 0));
        if (Number.isFinite(Number(predData.currentPoints))) {
          setUser((prev: any) => (prev ? { ...prev, points: Number(predData.currentPoints) } : prev));
        }

        const parsedAdminLevel = Number(predData.adminLevel || 0);
        if (parsedAdminLevel >= 1 && parsedAdminLevel <= 5) {
          const boardRes = await fetch(
            `/api/copadraft/prediction?action=admin_board&faceit_guid=${encodeURIComponent(guid)}`,
            { cache: "no-store" }
          );
          const boardData = await boardRes.json().catch(() => ({}));
          if (boardRes.ok && boardData?.ok && Array.isArray(boardData.matches)) {
            const nextBoard: Record<number, AdminBoardEntry> = {};
            for (const item of boardData.matches as AdminBoardEntry[]) {
              const id = Number(item?.match_id || 0);
              if (id > 0) nextBoard[id] = item;
            }
            setAdminBoardByMatchId(nextBoard);
          }
        } else {
          setAdminBoardByMatchId({});
        }
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const guid = String(user?.faceit_guid || "").trim();
    if (!guid) return;

    const intervalId = setInterval(() => {
      loadData(guid);
    }, 8000);

    return () => clearInterval(intervalId);
  }, [user?.faceit_guid]);

  useEffect(() => {
    if (!selectedGame) return;

    let cancelled = false;
    const refresh = async () => {
      const market = await fetchOddsForGame(selectedGame);
      if (cancelled || !market) return;
      setLiveOddsByMatchId((prev) => ({ ...prev, [Number(selectedGame.jogo_id)]: market.odds }));
      setLiveCountsByMatchId((prev) => ({ ...prev, [Number(selectedGame.jogo_id)]: market.counts }));
    };

    refresh();
    const id = window.setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedGame]);

  const handlePredict = async () => {
    if (!selectedGame || !teamChoice || !pointsAmount || !user) return;

    const points = Number(pointsAmount);
    if (!Number.isFinite(points) || points < 10) {
      alert("A previsão mínima é de 10 moedas.");
      return;
    }
    if (points > (user.points || 0)) {
      alert(`Você tem ${user.points} pontos disponíveis`);
      return;
    }

    try {
      setBetting(true);
      const res = await fetch("/api/copadraft/prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceit_guid: user.faceit_guid,
          match_id: String(selectedGame.jogo_id),
          time1: selectedGame.time1,
          time2: selectedGame.time2,
          team_chosen: teamChoice,
          points_predicted: points,
          player_id: user.id,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert("Previsão realizada!");
        setUser({ ...user, points: user.points - points });
        setSelectedGame(null);
        setTeamChoice("");
        setPointsAmount("");
        loadData(user.faceit_guid);
      } else {
        alert(data.message || "Erro ao fazer previsão");
      }
    } finally {
      setBetting(false);
    }
  };

  const handleCashOut = async (predictionId: number) => {
    if (!user?.faceit_guid) return;
    const confirmed = window.confirm("Confirmar cash out? Os pontos serão devolvidos para quem fez a previsão.");
    if (!confirmed) return;

    try {
      setCashingOutId(predictionId);
      const res = await fetch("/api/copadraft/prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cashout",
          requester_faceit_guid: user.faceit_guid,
          prediction_id: predictionId,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        alert(data.message || "Falha ao executar cash out");
        return;
      }

      alert("Cash out realizado!");
      loadData(user.faceit_guid);
    } catch (error) {
      console.error("Erro no cash out:", error);
      alert("Erro ao executar cash out");
    } finally {
      setCashingOutId(null);
    }
  };

  const handleAdminManualSettlement = async (params: {
    game: Game;
    mode: "payout" | "refund";
    winningChoice?: string;
  }) => {
    if (!user?.faceit_guid) return;

    const gameId = Number(params.game.jogo_id);
    if (!Number.isFinite(gameId) || gameId <= 0) return;

    try {
      setAdminProcessingMatchId(gameId);
      const res = await fetch("/api/copadraft/prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_match_result",
          requester_faceit_guid: user.faceit_guid,
          mode: params.mode,
          match_id: String(gameId),
          winning_choice: params.winningChoice,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        alert(data?.message || "Falha ao processar ação manual de admin.");
        return;
      }

      if (params.mode === "payout") {
        alert(
          `Pagamento concluído. Processadas: ${Number(data?.processedCount || 0)} | Ganhas: ${Number(data?.wonCount || 0)} | Perdidas: ${Number(data?.lostCount || 0)}`
        );
      } else {
        alert(`Devolução concluída. Processadas: ${Number(data?.processedCount || 0)} | Devolvidas: ${Number(data?.refundedCount || 0)}`);
      }

      await loadData(user.faceit_guid);
    } catch (error) {
      console.error("Erro ao processar settlement manual:", error);
      alert("Erro ao processar ação manual de admin.");
    } finally {
      setAdminProcessingMatchId(null);
    }
  };

  const openPayoutModal = (game: Game) => {
    setAdminPayoutModalGame(game);
    setAdminWinnerChoice("");
  };

  const closePayoutModal = () => {
    setAdminPayoutModalGame(null);
    setAdminWinnerChoice("");
  };

  const confirmAdminRefund = async (game: Game) => {
    const confirmed = window.confirm(
      `Confirmar DEVOLUCAO manual para ${game.time1} x ${game.time2}?\n\nTodos os palpites abertos desse jogo vao receber estorno.`
    );
    if (!confirmed) return;
    await handleAdminManualSettlement({ game, mode: "refund" });
  };

  const confirmAdminPayout = async () => {
    if (!adminPayoutModalGame || !adminWinnerChoice) return;

    await handleAdminManualSettlement({
      game: adminPayoutModalGame,
      mode: "payout",
      winningChoice: adminWinnerChoice,
    });

    closePayoutModal();
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-gray-400">Você precisa estar conectado com FACEIT.</p>
        </div>
      </div>
    );
  }

  const canViewAdminBoard = adminLevel >= 1 && adminLevel <= 5;
  const adminGames = adminTab === "upcoming" ? games : closedGames;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Prediction</h1>
          
          {/* Points Display */}
          <div className="flex items-center gap-2 bg-blue-600 px-4 py-3 rounded-lg inline-flex">
            <Image src="/moeda.png" alt="Points" width={20} height={20} />
            <span className="font-semibold text-lg">{user.points || 0}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setTab("games")}
            className={`pb-4 px-4 font-bold ${tab === "games" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"}`}
          >
            Jogos ({games.length})
          </button>
          <button
            onClick={() => setTab("my")}
            className={`pb-4 px-4 font-bold ${tab === "my" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"}`}
          >
            Minhas Previsões ({openPredictions.length})
          </button>
          <button
            onClick={() => setTab("closed")}
            className={`pb-4 px-4 font-bold ${tab === "closed" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"}`}
          >
            Encerradas ({closedGames.length})
          </button>
          {canViewAdminBoard && (
            <button
              onClick={() => setTab("admin")}
              className={`pb-4 px-4 font-bold ${tab === "admin" ? "border-b-2 border-blue-500 text-blue-400" : "text-gray-400"}`}
            >
              Admin
            </button>
          )}
        </div>

        {/* Admin Tab */}
        {tab === "admin" && canViewAdminBoard && (
          <div className="grid gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => setAdminTab("upcoming")}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${adminTab === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}
              >
                Próximos Jogos ({games.length})
              </button>
              <button
                onClick={() => setAdminTab("past")}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${adminTab === "past" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300"}`}
              >
                Jogos Passados ({closedGames.length})
              </button>
            </div>

            {adminGames.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-lg text-gray-400">Nenhum jogo nesta aba</div>
            ) : (
              adminGames.map((game, idx) => {
                const board = adminBoardByMatchId[Number(game.jogo_id)];
                const counts = board?.counts || { time1: 0, draw: 0, time2: 0, total: 0 };
                const openCount = Number(board?.openCount || counts.total || 0);
                const manualEligible = Boolean(board?.manualEligible) && openCount > 0;
                const isProcessingThisMatch = adminProcessingMatchId === Number(game.jogo_id);
                const showManualActions = adminLevel === 1 && adminTab === "past";
                return (
                  <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">{game.hora} • {game.data}</div>
                    <div className="text-xs text-cyan-300 mb-2">Match ID: {game.jogo_id}</div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-bold">{game.time1}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-bold">{game.time2}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div className="bg-gray-700/70 rounded p-2">
                        <p className="text-gray-300">{game.time1}</p>
                        <p className="font-bold">Quantidade: {counts.time1}</p>
                        {adminLevel === 1 && board?.bettors?.time1 && board.bettors.time1.length > 0 && (
                          <p className="text-xs text-gray-300 mt-1">Quem: {board.bettors.time1.join(", ")}</p>
                        )}
                      </div>
                      <div className="bg-gray-700/70 rounded p-2">
                        <p className="text-gray-300">Empate</p>
                        <p className="font-bold">Quantidade: {counts.draw}</p>
                        {adminLevel === 1 && board?.bettors?.draw && board.bettors.draw.length > 0 && (
                          <p className="text-xs text-gray-300 mt-1">Quem: {board.bettors.draw.join(", ")}</p>
                        )}
                      </div>
                      <div className="bg-gray-700/70 rounded p-2">
                        <p className="text-gray-300">{game.time2}</p>
                        <p className="font-bold">Quantidade: {counts.time2}</p>
                        {adminLevel === 1 && board?.bettors?.time2 && board.bettors.time2.length > 0 && (
                          <p className="text-xs text-gray-300 mt-1">Quem: {board.bettors.time2.join(", ")}</p>
                        )}
                      </div>
                    </div>

                    {showManualActions && (
                      <div className="mt-4 border-t border-gray-700 pt-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200">
                            Abertas: {openCount}
                          </span>
                          {!manualEligible && (
                            <span className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 border border-red-700/50">
                              {board?.manualBlockedReason || "Jogo indisponível para ação manual"}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openPayoutModal(game)}
                            disabled={!manualEligible || isProcessingThisMatch}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-bold"
                          >
                            {isProcessingThisMatch ? "Processando..." : "Pagar"}
                          </button>
                          <button
                            onClick={() => confirmAdminRefund(game)}
                            disabled={!manualEligible || isProcessingThisMatch}
                            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-bold"
                          >
                            {isProcessingThisMatch ? "Processando..." : "Devolver"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Games Tab */}
        {tab === "games" && (
          <div className="grid gap-4">
            {games.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-lg text-gray-400">Nenhum jogo disponível</div>
            ) : (
              games.map((game, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-1">{game.hora} • {game.data}</div>
                    <div className="text-xs text-cyan-300 mb-2">Match ID: {game.jogo_id}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold flex items-center gap-2">
                        <Image
                          src={getTeamFlagSrc(game.time1)}
                          alt={`Bandeira ${game.time1}`}
                          width={22}
                          height={16}
                          className="rounded-sm border border-gray-600"
                        />
                        <span>{game.time1}</span>
                      </span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-bold flex items-center gap-2">
                        <Image
                          src={getTeamFlagSrc(game.time2)}
                          alt={`Bandeira ${game.time2}`}
                          width={22}
                          height={16}
                          className="rounded-sm border border-gray-600"
                        />
                        <span>{game.time2}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-700 px-2 py-1 rounded">
                        {game.time1}: {formatOddsAsPoints(liveOddsByMatchId[Number(game.jogo_id)]?.[game.time1] ?? 2.0)}
                      </span>
                      <span className="bg-gray-700 px-2 py-1 rounded">
                        Empate: {formatOddsAsPoints(liveOddsByMatchId[Number(game.jogo_id)]?.["Empate"] ?? 1.5)}
                      </span>
                      <span className="bg-gray-700 px-2 py-1 rounded">
                        {game.time2}: {formatOddsAsPoints(liveOddsByMatchId[Number(game.jogo_id)]?.[game.time2] ?? 2.0)}

                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedGame(game)}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-bold"
                  >
                    Prever
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Closed Games Tab */}
        {tab === "closed" && (
          <div className="grid gap-4">
            {closedGames.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-lg text-gray-400">Nenhum jogo encerrado</div>
            ) : (
              closedGames.map((game, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-1">{game.hora} • {game.data}</div>
                    <div className="text-xs text-cyan-300 mb-2">Match ID: {game.jogo_id}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold flex items-center gap-2">
                        <Image
                          src={getTeamFlagSrc(game.time1)}
                          alt={`Bandeira ${game.time1}`}
                          width={22}
                          height={16}
                          className="rounded-sm border border-gray-600"
                        />
                        <span>{game.time1}</span>
                      </span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-bold flex items-center gap-2">
                        <Image
                          src={getTeamFlagSrc(game.time2)}
                          alt={`Bandeira ${game.time2}`}
                          width={22}
                          height={16}
                          className="rounded-sm border border-gray-600"
                        />
                        <span>{game.time2}</span>
                      </span>
                    </div>
                  </div>
                  <span className="bg-red-600/20 text-red-300 border border-red-500/40 px-4 py-2 rounded-lg text-sm font-bold">
                    Encerrada
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* My Predictions Tab */}
        {tab === "my" && (
          <div className="grid gap-4">
            {openPredictions.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-lg text-gray-400">Nenhuma previsão em aberto</div>
            ) : (
              openPredictions.map((p) => {
                const schedule = getPredictionSchedule(p.match_id, p.game_date, p.game_time);
                const teams = getPredictionTeams(p);
                const statusLabel = Number(p.is_cashed_out || 0) === 1 ? "Estornado" : STATUS_LABELS[p.status] || p.status;

                return (
                  <div
                    key={p.id}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/80 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600/20 text-blue-300 border border-blue-500/40">
                        {statusLabel}
                      </span>
                    </div>

                    {isAdmin1 && Number(p.is_cashed_out || 0) !== 1 && String(p.status || "").toUpperCase() === "OPEN" && (
                      <div className="mb-4">
                        <button
                          onClick={() => handleCashOut(p.id)}
                          disabled={cashingOutId === p.id}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold text-sm"
                        >
                          {cashingOutId === p.id ? "Processando cash out..." : "Cash Out"}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-800/70 rounded-lg p-3 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Time 1</p>
                        <p className="font-bold flex items-center gap-2">
                          <Image
                            src={getTeamFlagSrc(teams.time1)}
                            alt={`Bandeira ${teams.time1}`}
                            width={22}
                            height={16}
                            className="rounded-sm border border-gray-600"
                          />
                          <span>{teams.time1}</span>
                        </p>
                      </div>
                      <div className="bg-gray-800/70 rounded-lg p-3 border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Time 2</p>
                        <p className="font-bold flex items-center gap-2">
                          <Image
                            src={getTeamFlagSrc(teams.time2)}
                            alt={`Bandeira ${teams.time2}`}
                            width={22}
                            height={16}
                            className="rounded-sm border border-gray-600"
                          />
                          <span>{teams.time2}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-gray-400 mb-1">Escolha</p>
                        <p className="font-bold">{p.team_chosen}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-gray-400 mb-1">Quanto colocado</p>
                        <p className="font-bold text-green-400">{p.points_predicted} pts</p>
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-gray-400 mb-1">Pontuação</p>
                        <p className="font-bold text-yellow-400">{formatOddsAsPoints(p.odds)}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded-lg p-3">
                        <p className="text-gray-400 mb-1">Retorno</p>
                        <p className="font-bold text-cyan-300">
                          {p.result_points == null ? "-" : `${p.result_points} pts`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Prediction Modal */}
        {selectedGame && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">Fazer Previsão</h2>

              <div className="mb-6">
                <p className="text-gray-400 mb-2">Jogo</p>
                <p className="font-bold text-lg">{selectedGame.time1} vs {selectedGame.time2}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold mb-3">Escolha o resultado</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    {
                      label: selectedGame.time1,
                      odds: liveOddsByMatchId[Number(selectedGame.jogo_id)]?.[selectedGame.time1] ?? 2.0,
                    },
                    {
                      label: "Empate",
                      odds: liveOddsByMatchId[Number(selectedGame.jogo_id)]?.["Empate"] ?? 1.5,
                    },
                    {
                      label: selectedGame.time2,
                      odds: liveOddsByMatchId[Number(selectedGame.jogo_id)]?.[selectedGame.time2] ?? 2.0,
                    },
                  ] as { label: string; odds: number }[]).map(({ label, odds }) => (
                    <button
                      key={label}
                      onClick={() => setTeamChoice(label)}
                      className={`p-3 rounded-lg font-bold text-sm flex flex-col items-center gap-1 ${
                        label === "Empate"
                          ? teamChoice === label
                            ? "bg-yellow-600"
                            : "bg-gray-700 hover:bg-gray-600 text-yellow-400"
                          : teamChoice === label
                          ? "bg-blue-600"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      <span>{label === "Empate" ? "🤝 Empate" : label}</span>
                      <span className={`text-xs font-normal ${teamChoice === label ? "text-white/80" : "text-green-400"}`}>
                        {formatOddsAsPoints(odds)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold mb-2">Quantos pontos?</label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  min={10}
                  max={user.points}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
                  placeholder={`Mínimo: 10 | Máximo: ${user.points}`}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedGame(null);
                    setTeamChoice("");
                    setPointsAmount("");
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePredict}
                  disabled={betting || !teamChoice || !pointsAmount}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold"
                >
                  {betting ? "Processando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {adminPayoutModalGame && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
              <h2 className="text-xl font-bold mb-2">Pagamento Manual</h2>
              <p className="text-sm text-gray-300 mb-4">
                Selecione o resultado de <span className="font-bold">{adminPayoutModalGame.time1}</span> x{" "}
                <span className="font-bold">{adminPayoutModalGame.time2}</span> para pagar somente quem acertou.
              </p>

              <div className="grid grid-cols-1 gap-2 mb-5">
                {[
                  adminPayoutModalGame.time1,
                  "Empate",
                  adminPayoutModalGame.time2,
                ].map((choice) => (
                  <button
                    key={choice}
                    onClick={() => setAdminWinnerChoice(choice)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      adminWinnerChoice === choice
                        ? "bg-blue-600 border-blue-400 text-white"
                        : "bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600"
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closePayoutModal}
                  disabled={adminProcessingMatchId === Number(adminPayoutModalGame.jogo_id)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAdminPayout}
                  disabled={!adminWinnerChoice || adminProcessingMatchId === Number(adminPayoutModalGame.jogo_id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg font-bold"
                >
                  {adminProcessingMatchId === Number(adminPayoutModalGame.jogo_id) ? "Processando..." : "Confirmar Pagamento"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
