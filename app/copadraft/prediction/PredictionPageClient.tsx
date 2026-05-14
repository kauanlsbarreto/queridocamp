"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Game = { jogo_id: number; data: string; hora: string; time1: string; time2: string };
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

export default function PredictionPageClient() {
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [closedGames, setClosedGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isAdmin1, setIsAdmin1] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"games" | "closed" | "my">("games");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [teamChoice, setTeamChoice] = useState("");
  const [pointsAmount, setPointsAmount] = useState("");
  const [betting, setBetting] = useState(false);
  const [cashingOutId, setCashingOutId] = useState<number | null>(null);

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

  const loadData = async (guid: string) => {
    try {
      // Fetch only games list (without access-gated palpites payload)
      const gamesRes = await fetch(`/api/copadraft/palpites?faceit_guid=${encodeURIComponent(guid)}&games_only=1`);
      const gamesData = await gamesRes.json();
      if (gamesData.ok && gamesData.games) {
        const now = new Date();
        const allGames = Array.isArray(gamesData.games) ? gamesData.games : [];
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
      }

      // Fetch user's predictions
      const predRes = await fetch(`/api/copadraft/prediction?faceit_guid=${encodeURIComponent(guid)}`);
      const predData = await predRes.json();
      if (predData.ok) {
        setPredictions(Array.isArray(predData.myPredictions) ? predData.myPredictions : []);
        setIsAdmin1(Boolean(predData.isAdmin1));
        if (Number.isFinite(Number(predData.currentPoints))) {
          setUser((prev: any) => (prev ? { ...prev, points: Number(predData.currentPoints) } : prev));
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

  const handlePredict = async () => {
    if (!selectedGame || !teamChoice || !pointsAmount || !user) return;

    const points = Number(pointsAmount);
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
        </div>

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
                        <p className="text-gray-400 mb-1">Odds</p>
                        <p className="font-bold text-yellow-400">{Number(p.odds).toFixed(2)}x</p>
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
                    { label: selectedGame.time1, odds: 2.00 },
                    { label: "Empate", odds: 1.50 },
                    { label: selectedGame.time2, odds: 2.00 },
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
                        {odds.toFixed(2)}x
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
                  max={user.points}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
                  placeholder={`Máximo: ${user.points}`}
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
      </div>
    </div>
  );
}
