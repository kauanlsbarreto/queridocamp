"use client";

import { useState, useEffect, useRef } from "react";

export type TeamCapitao = {
  nome_time: string;
  capitao_guid: string;
  capitao_id: number;
};

export type TeamMember = {
  faceit_guid: string;
  team_id: number;
};

export type JogoRow = {
  rodada: number;
  time1: string;
  time2: string;
  placar: string | null;
};

export type MatchRow = {
  id: number;
  challenger_team_id: number;
  challenged_team_id: number;
  rodada: number | null;
  proposed_date: string | null;
  proposed_time: string | null;
  message: string | null;
  status: string;
  counter_date: string | null;
  counter_time: string | null;
  counter_message: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

type Props = {
  teamsCapitaes: TeamCapitao[];
  teamMembers: TeamMember[];
  jogos: JogoRow[];
  matches: MatchRow[];
};

function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem("faceit_user");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "–";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtTime(t: string | null) {
  if (!t) return "–";
  return t.slice(0, 5);
}

function normalizeDateBR(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidDateBR(value: string) {
  const text = String(value || "").trim();
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function dateBRToIso(value: string) {
  const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoToDateBR(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function normalizeTime24(value: string) {
  const raw = String(value || "").replace(/[^0-9:]/g, "").slice(0, 5);
  if (raw.length <= 2) return raw;
  if (raw[2] === ":") return raw;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
}

function isValidTime24(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
}

function normalizeTeamName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  accepted: "Confirmado",
  declined: "Recusado",
  counter_proposal: "Contraproposta",
  cancelled: "Cancelado",
  finished: "Finalizado",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "border-yellow-400/50 bg-yellow-400/10 text-yellow-200",
  accepted: "border-green-400/50 bg-green-400/10 text-green-300",
  declined: "border-red-400/50 bg-red-400/10 text-red-300",
  counter_proposal: "border-blue-400/50 bg-blue-400/10 text-blue-200",
  cancelled: "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
  finished: "border-purple-400/50 bg-purple-400/10 text-purple-300",
};

function TeamFlag({
  teamName,
  size = "md",
}: {
  teamName: string;
  size?: "sm" | "md" | "lg";
}) {
  const [idx, setIdx] = useState(0);
  const lower = teamName.toLowerCase();
  const norm = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const candidates = [
    `/selecoes/${encodeURIComponent(lower)}.jpg`,
    `/selecoes/${encodeURIComponent(norm)}.jpg`,
    `/selecoes/${encodeURIComponent(lower)}.png`,
    `/selecoes/${encodeURIComponent(norm)}.png`,
  ];
  const cls =
    size === "sm"
      ? "h-7 w-10 rounded border border-white/20 object-cover"
      : size === "lg"
      ? "h-16 w-24 rounded-xl border border-white/20 object-cover shadow-md"
      : "h-11 w-16 rounded-lg border border-white/20 object-cover shadow";

  return (
    <img
      src={candidates[idx] ?? candidates[0]}
      alt={teamName}
      className={cls}
      onError={() => setIdx((p) => Math.min(p + 1, candidates.length - 1))}
    />
  );
}

function ProposalModal({
  title,
  subtitle,
  submitLabel = "Enviar Proposta",
  initialDate = "",
  initialTime = "",
  originalProposal,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  submitLabel?: string;
  initialDate?: string;
  initialTime?: string;
  originalProposal?: { date: string | null; time: string | null };
  onClose: () => void;
  onSubmit: (date: string, time: string, msg: string) => Promise<void>;
}) {
  const [date, setDate] = useState(isoToDateBR(initialDate));
  const [time, setTime] = useState(initialTime);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const validDate = isValidDateBR(date);
  const validTime = isValidTime24(time);

  async function handle() {
    if (!validDate || !validTime) return;
    setLoading(true);
    try {
      await onSubmit(dateBRToIso(date), time, msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-300/30 bg-[#0a1628] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-white">{title}</p>
            <p className="mt-0.5 text-xs text-cyan-200/70">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="px-1 text-xl text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {originalProposal && (
            <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-3 text-xs text-blue-100">
              <div className="mb-1 font-bold uppercase tracking-[0.12em] text-blue-300">
                Proposta Atual
              </div>
              <div>
                {fmtDate(originalProposal.date)} as {fmtTime(originalProposal.time)}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Data (DD/MM/AAAA) *</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(normalizeDateBR(e.target.value))}
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className="w-full rounded-lg border border-white/20 bg-[#111f35] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            {!validDate && date && (
              <p className="mt-1 text-[11px] text-red-300">Use formato DD/MM/AAAA (ex: 05/08/2026)</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Horário (24h, Brasil) *</label>
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(normalizeTime24(e.target.value))}
              inputMode="numeric"
              placeholder="HH:mm"
              maxLength={5}
              className="w-full rounded-lg border border-white/20 bg-[#111f35] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
            {!validTime && time && (
              <p className="mt-1 text-[11px] text-red-300">Use formato 24h: HH:mm (ex: 21:30)</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Mensagem (opcional)
            </label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={3}
              placeholder="Ex: Podemos jogar após as 21h..."
              className="w-full resize-none rounded-lg border border-white/20 bg-[#111f35] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={handle}
            disabled={loading || !validDate || !validTime}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Enviando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function GameCard({
  jogo,
  myTeam,
  opponentName,
  opponentId,
  match,
  myTeamId,
  onPropose,
  onAction,
  onCounter,
}: {
  jogo: JogoRow;
  myTeam: TeamCapitao;
  opponentName: string;
  opponentId: number | undefined;
  match: MatchRow | undefined;
  myTeamId: number;
  onPropose: () => void;
  onAction: (
    matchId: number,
    action: "accept" | "decline" | "cancel"
  ) => Promise<void>;
  onCounter: (matchId: number) => void;
}) {
  const [acting, setActing] = useState<string | null>(null);

  async function doAction(id: number, action: "accept" | "decline" | "cancel") {
    setActing(action);
    try {
      await onAction(id, action);
    } finally {
      setActing(null);
    }
  }

  const isChallenger = match ? match.challenger_team_id === myTeamId : false;
  const isChallenged = match ? match.challenged_team_id === myTeamId : false;

  const myTurnToRespond =
    match?.status === "pending"
      ? isChallenged
      : match?.status === "counter_proposal"
      ? isChallenger
      : false;

  const waitingLabel =
    match?.status === "pending" && isChallenger
      ? "Aguardando resposta do adversário"
      : match?.status === "counter_proposal" && isChallenged
      ? "Aguardando resposta da sua contraproposta"
      : null;

  const showCounter =
    match?.status === "counter_proposal" && match.counter_date;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#071940]/90 to-[#0a2256]/80 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.4)] transition hover:border-cyan-400/20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.07),transparent_65%)]" />

      <div className="relative mb-3 flex items-center justify-between">
        <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          Rodada {jogo.rodada}
        </span>
        {match && (
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_COLOR[match.status] ?? STATUS_COLOR.pending}`}
          >
            {STATUS_LABEL[match.status] ?? match.status}
          </span>
        )}
      </div>

      <div className="relative flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-1 flex-col items-center gap-1 text-center">
          <TeamFlag teamName={myTeam.nome_time} />
          <span className="text-[11px] font-black uppercase tracking-wide text-white">
            {myTeam.nome_time}
          </span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/40 bg-[#050e28] shadow-[0_0_14px_rgba(34,211,238,0.25)]">
          <span className="text-[9px] font-black text-cyan-300">VS</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 text-center">
          <TeamFlag teamName={opponentName} />
          <span className="text-[11px] font-black uppercase tracking-wide text-white">
            {opponentName}
          </span>
        </div>
      </div>

      {match ? (
        <div className="relative space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                Proposta original
              </span>
            </div>
            <div className="text-white font-semibold">
              {fmtDate(match.proposed_date)} às {fmtTime(match.proposed_time)}
            </div>
            {match.message && (
              <div className="italic text-zinc-300">"{match.message}"</div>
            )}

            {showCounter && (
              <div className="mt-2 border-t border-blue-400/20 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-1">
                  Contraproposta
                </div>
                <div className="text-white font-semibold">
                  {fmtDate(match.counter_date)} às {fmtTime(match.counter_time)}
                </div>
                {match.counter_message && (
                  <div className="italic text-zinc-300">
                    "{match.counter_message}"
                  </div>
                )}
              </div>
            )}

            {/* Accepted */}
            {match.status === "accepted" && (
              <div className="mt-2 border-t border-green-400/20 pt-2 text-green-300 font-bold">
                ✓ Partida confirmada!
                {match.accepted_at && (
                  <span className="ml-2 text-[10px] font-normal text-green-400/70">
                    {match.accepted_at}
                  </span>
                )}
              </div>
            )}
          </div>

          {waitingLabel && (
            <p className="text-center text-[10px] uppercase tracking-widest text-zinc-400">
              {waitingLabel}
            </p>
          )}

          {/* Action buttons — my turn to respond */}
          {myTurnToRespond && match.status === "pending" && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => doAction(match.id, "accept")}
                disabled={!!acting}
                className="flex-1 rounded-lg border border-green-400/50 bg-green-500/20 px-3 py-2 text-xs font-bold text-green-200 transition hover:bg-green-500/30 disabled:opacity-50"
              >
                {acting === "accept" ? "..." : "✓ Aceitar"}
              </button>
              <button
                onClick={() => onCounter(match.id)}
                disabled={!!acting}
                className="flex-1 rounded-lg border border-blue-400/50 bg-blue-500/20 px-3 py-2 text-xs font-bold text-blue-200 transition hover:bg-blue-500/30 disabled:opacity-50"
              >
                ↩ Contraproposta
              </button>
              <button
                onClick={() => doAction(match.id, "decline")}
                disabled={!!acting}
                className="flex-1 rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {acting === "decline" ? "..." : "✕ Recusar"}
              </button>
            </div>
          )}

          {myTurnToRespond && match.status === "counter_proposal" && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => doAction(match.id, "accept")}
                disabled={!!acting}
                className="flex-1 rounded-lg border border-green-400/50 bg-green-500/20 px-3 py-2 text-xs font-bold text-green-200 transition hover:bg-green-500/30 disabled:opacity-50"
              >
                {acting === "accept" ? "..." : "✓ Aceitar contraproposta"}
              </button>
              <button
                onClick={() => doAction(match.id, "decline")}
                disabled={!!acting}
                className="flex-1 rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/30 disabled:opacity-50"
              >
                {acting === "decline" ? "..." : "✕ Recusar"}
              </button>
            </div>
          )}

          {isChallenger && match.status === "pending" && (
            <button
              onClick={() => doAction(match.id, "cancel")}
              disabled={!!acting}
              className="w-full rounded-lg border border-zinc-400/30 bg-zinc-500/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-500/20 disabled:opacity-50"
            >
              {acting === "cancel" ? "Cancelando..." : "Cancelar proposta"}
            </button>
          )}

          {["declined", "cancelled"].includes(match.status) && opponentId && (
            <button
              onClick={onPropose}
              className="w-full rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              + Nova proposta
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onPropose}
          disabled={!opponentId}
          className="relative w-full rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
        >
          + Propor horário
        </button>
      )}
    </div>
  );
}

export default function DesafiarPageClient({
  teamsCapitaes,
  teamMembers,
  jogos,
  matches: initialMatches,
}: Props) {
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const sentErrorFingerprintsRef = useRef<Set<string>>(new Set());

  type ProposalState = {
    open: boolean;
    rodada: number | null;
    opponentId: number | null;
    opponentName: string;
    actingTeamId: number | null;
  };
  const [proposalModal, setProposalModal] = useState<ProposalState>({
    open: false,
    rodada: null,
    opponentId: null,
    opponentName: "",
    actingTeamId: null,
  });

  const [counterModal, setCounterModal] = useState<{
    open: boolean;
    matchId: number | null;
    opponentName: string;
    originalDate: string | null;
    originalTime: string | null;
  }>({ open: false, matchId: null, opponentName: "", originalDate: null, originalTime: null });

  useEffect(() => {
    setUser(readStoredUser());

    try {
      const legacyKeys = ["rodadas_page_cache", "jogos_page_cache", "desafiar_matches_cache"];
      const hasLegacyCache = legacyKeys.some((key) => sessionStorage.getItem(key) !== null);
      if (!hasLegacyCache) return;

      setIsClearingCache(true);
      for (const key of legacyKeys) {
        sessionStorage.removeItem(key);
      }

      const timer = window.setTimeout(() => {
        window.location.reload();
      }, 900);

      return () => window.clearTimeout(timer);
    } catch {
      // ignore storage access errors
    }
  }, []);

  useEffect(() => {
    function sendClientError(payload: {
      kind: "error" | "unhandledrejection";
      message: string;
      stack?: string;
    }) {
      const identity = readStoredUser() || {};
      const fingerprint = `${payload.kind}:${payload.message}:${payload.stack || ""}`.slice(0, 300);
      if (sentErrorFingerprintsRef.current.has(fingerprint)) return;
      sentErrorFingerprintsRef.current.add(fingerprint);

      fetch("/copadraft/desafiar/api/error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: payload.kind,
          message: payload.message,
          stack: payload.stack || "",
          faceit_guid: String(identity?.faceit_guid || identity?.guid || "").trim().toLowerCase(),
          nickname: String(identity?.nickname || identity?.nick || "").trim(),
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
        keepalive: true,
      }).catch(() => {
        // avoid recursive error loops in the client
      });
    }

    function onWindowError(event: ErrorEvent) {
      sendClientError({
        kind: "error",
        message: String(event.message || "Client error"),
        stack: event.error?.stack ? String(event.error.stack) : "",
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const stack = reason instanceof Error ? reason.stack || "" : "";
      sendClientError({ kind: "unhandledrejection", message, stack });
    }

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const isAdmin1 = Number(user?.Admin || user?.admin || 0) === 1;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isAdmin1) return;
      if (e.key === "F2") {
        e.preventDefault();
        setAdminMode((prev) => {
          const next = !prev;
          setToast({ msg: next ? "Modo Admin ativado" : "Modo Admin desativado", ok: true });
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin1]);

  useEffect(() => {
    // Poll for match updates every 30s to see new challenges in real-time
    const pollMatches = async () => {
      try {
        const res = await fetch("/copadraft/desafiar/api");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.matches)) {
            setMatches(data.matches);
          }
        }
      } catch {
        // ignore fetch errors
      }
    };

    const interval = setInterval(pollMatches, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const myGuid = String(
    user?.faceit_guid || user?.guid || ""
  )
    .trim()
    .toLowerCase();

  const myTeamMember = myGuid
    ? teamMembers.find((m) => m.faceit_guid === myGuid)
    : undefined;

  const myTeam = myTeamMember
    ? teamsCapitaes.find((t) => t.capitao_id === myTeamMember.team_id)
    : undefined;

  const myGames = myTeam
    ? jogos.filter(
        (j) =>
          j.time1 === myTeam.nome_time || j.time2 === myTeam.nome_time
      )
    : [];

  const teamsByNormalizedName = new Map(
    teamsCapitaes.map((t) => [normalizeTeamName(t.nome_time), t])
  );

  function findMatch(rodada: number, opponentId: number | undefined) {
    if (!myTeam || !opponentId) return undefined;
    const myId = myTeam.capitao_id;
    return matches.find(
      (m) =>
        m.rodada === rodada &&
        ((m.challenger_team_id === myId && m.challenged_team_id === opponentId) ||
          (m.challenger_team_id === opponentId && m.challenged_team_id === myId))
    );
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
  }

  function upsertMatch(updated: MatchRow) {
    setMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === updated.id);
      let next: MatchRow[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = updated;
      } else {
        next = [updated, ...prev];
      }
      return next;
    });
  }

  function getTeamById(teamId: number) {
    return teamsCapitaes.find((t) => Number(t.capitao_id) === Number(teamId));
  }

  function findMatchByTeamIds(rodada: number, teamAId: number, teamBId: number) {
    return matches.find(
      (m) =>
        Number(m.rodada) === Number(rodada) &&
        ((Number(m.challenger_team_id) === Number(teamAId) && Number(m.challenged_team_id) === Number(teamBId)) ||
          (Number(m.challenger_team_id) === Number(teamBId) && Number(m.challenged_team_id) === Number(teamAId)))
    );
  }

  async function handlePropose(date: string, time: string, msg: string) {
    if (!myGuid || !proposalModal.opponentId) return;
    const res = await fetch("/copadraft/desafiar/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faceit_guid: myGuid,
        acting_team_id: proposalModal.actingTeamId,
        challenged_team_id: proposalModal.opponentId,
        rodada: proposalModal.rodada,
        proposed_date: date,
        proposed_time: time,
        message: msg || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Erro ao enviar proposta", false);
      return;
    }
    if (data.match) upsertMatch(data.match);
    showToast("Proposta enviada com sucesso!");
    setProposalModal({
      open: false,
      rodada: null,
      opponentId: null,
      opponentName: "",
      actingTeamId: null,
    });
  }

  function openAdminPropose(rodada: number, actingTeamId: number, challengedTeamId: number, challengedTeamName: string) {
    setProposalModal({
      open: true,
      rodada,
      opponentId: challengedTeamId,
      opponentName: challengedTeamName,
      actingTeamId,
    });
  }

  async function handleAction(
    matchId: number,
    action: "accept" | "decline" | "cancel"
  ) {
    if (!myGuid) return;
    const res = await fetch("/copadraft/desafiar/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faceit_guid: myGuid, match_id: matchId, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Erro", false);
      return;
    }
    if (data.match) upsertMatch(data.match);
    const labels: Record<string, string> = {
      accept: "Partida confirmada! ✓",
      decline: "Proposta recusada",
      cancel: "Proposta cancelada",
    };
    showToast(labels[action] ?? "Feito!");
  }

  async function handleCounter(date: string, time: string, msg: string) {
    if (!myGuid || !counterModal.matchId) return;
    const res = await fetch("/copadraft/desafiar/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        faceit_guid: myGuid,
        match_id: counterModal.matchId,
        action: "counter",
        counter_date: date,
        counter_time: time,
        counter_message: msg || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error ?? "Erro ao enviar contraproposta", false);
      return;
    }
    if (data.match) upsertMatch(data.match);
    showToast("Contraproposta enviada!");
    setCounterModal({ open: false, matchId: null, opponentName: "", originalDate: null, originalTime: null });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      {toast && (
        <div
          className={`fixed right-4 top-24 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-sm transition md:top-20 ${
            toast.ok
              ? "border-green-400/40 bg-green-500/20 text-green-100"
              : "border-red-400/40 bg-red-500/20 text-red-100"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="relative mx-auto max-w-4xl">
        {isClearingCache && (
          <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-amber-200">
            Limpando cache
          </div>
        )}

        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">
            Copa Draft
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
            Desafiar
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-cyan-100/70">
            Proponha horários para suas partidas e responda propostas do adversário.
          </p>
        </header>

        {!user ? (
          <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-10 text-center">
            <p className="text-zinc-400">
              Faça login com sua conta FACEIT para acessar esta área.
            </p>
          </div>
        ) : !myTeam ? (
          <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-10 text-center space-y-2">
            <p className="text-white font-semibold">
              Você não está em nenhum time
            </p>
            <p className="text-zinc-500 text-sm">
              Apenas jogadores que já estão em um time podem propor e responder horários.
              {isAdmin1 ? " Pressione F2 para abrir o modo admin." : ""}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
              <TeamFlag teamName={myTeam.nome_time} size="lg" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                  Seu Time
                </p>
                <p className="mt-0.5 text-2xl font-black text-white">
                  {myTeam.nome_time}
                </p>
              </div>
            </div>

            <div className="mb-2">
              <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
                Meus Jogos
              </h2>
              {myGames.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">
                  Nenhum jogo agendado no tabela <code>jogos</code> para o seu time.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myGames.map((jogo) => {
                    const opponentName =
                      jogo.time1 === myTeam.nome_time ? jogo.time2 : jogo.time1;
                    const opponentTeam = teamsByNormalizedName.get(
                      normalizeTeamName(opponentName)
                    );
                    const match = findMatch(jogo.rodada, opponentTeam?.capitao_id);

                    return (
                      <GameCard
                        key={`${jogo.rodada}-${opponentName}`}
                        jogo={jogo}
                        myTeam={myTeam}
                        opponentName={opponentName}
                        opponentId={opponentTeam?.capitao_id}
                        match={match}
                        myTeamId={myTeam.capitao_id}
                        onPropose={() =>
                          setProposalModal({
                            open: true,
                            rodada: jogo.rodada,
                            opponentId: opponentTeam?.capitao_id ?? null,
                            opponentName,
                            actingTeamId: null,
                          })
                        }
                        onAction={handleAction}
                        onCounter={(matchId) =>
                          {
                            const m = matches.find((x) => x.id === matchId);
                            setCounterModal({
                              open: true,
                              matchId,
                              opponentName,
                              originalDate: m?.proposed_date ?? null,
                              originalTime: m?.proposed_time ?? null,
                            });
                          }
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {isAdmin1 && adminMode && (
          <section className="mt-8 rounded-2xl border border-amber-400/30 bg-[#24190a]/60 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Modo Admin</p>
                <p className="text-sm text-amber-100/80">F2 para ativar/desativar</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {jogos.map((jogo, idx) => {
                const team1 = teamsByNormalizedName.get(normalizeTeamName(jogo.time1));
                const team2 = teamsByNormalizedName.get(normalizeTeamName(jogo.time2));
                const match = team1 && team2 ? findMatchByTeamIds(jogo.rodada, team1.capitao_id, team2.capitao_id) : undefined;

                return (
                  <div key={`${jogo.rodada}-${jogo.time1}-${jogo.time2}-${idx}`} className="rounded-xl border border-white/10 bg-[#0b1020]/80 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300">Rodada {jogo.rodada}</span>
                      {match ? (
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_COLOR[match.status] ?? STATUS_COLOR.pending}`}>
                          {STATUS_LABEL[match.status] ?? match.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">Sem proposta</span>
                      )}
                    </div>

                    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="text-center">
                        <TeamFlag teamName={jogo.time1} />
                        <p className="mt-1 text-[11px] font-bold uppercase text-white">{jogo.time1}</p>
                      </div>
                      <span className="text-[10px] font-black text-cyan-300">VS</span>
                      <div className="text-center">
                        <TeamFlag teamName={jogo.time2} />
                        <p className="mt-1 text-[11px] font-bold uppercase text-white">{jogo.time2}</p>
                      </div>
                    </div>

                    {match ? (
                      <div className="space-y-2">
                        <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200">
                          {fmtDate(match.proposed_date)} as {fmtTime(match.proposed_time)}
                        </div>
                        {match.status === "accepted" ? (
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() =>
                                setCounterModal({
                                  open: true,
                                  matchId: match.id,
                                  opponentName: `${jogo.time1} x ${jogo.time2}`,
                                  originalDate: match.proposed_date,
                                  originalTime: match.proposed_time,
                                })
                              }
                              className="rounded-md border border-amber-400/50 bg-amber-500/20 px-2 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
                            >
                              Alterar data
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleAction(match.id, "accept")} className="rounded-md border border-green-400/50 bg-green-500/20 px-2 py-1.5 text-xs font-bold text-green-200 hover:bg-green-500/30">Aceitar</button>
                            <button onClick={() => setCounterModal({ open: true, matchId: match.id, opponentName: `${jogo.time1} x ${jogo.time2}`, originalDate: match.proposed_date, originalTime: match.proposed_time })} className="rounded-md border border-blue-400/50 bg-blue-500/20 px-2 py-1.5 text-xs font-bold text-blue-200 hover:bg-blue-500/30">Contraproposta</button>
                            <button onClick={() => handleAction(match.id, "decline")} className="rounded-md border border-red-400/50 bg-red-500/20 px-2 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/30">Recusar</button>
                            <button onClick={() => handleAction(match.id, "cancel")} className="rounded-md border border-zinc-400/40 bg-zinc-500/10 px-2 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-500/20">Cancelar</button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => team1 && team2 && openAdminPropose(jogo.rodada, team1.capitao_id, team2.capitao_id, jogo.time2)}
                          disabled={!team1 || !team2}
                          className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                        >
                          Propor como {jogo.time1}
                        </button>
                        <button
                          onClick={() => team1 && team2 && openAdminPropose(jogo.rodada, team2.capitao_id, team1.capitao_id, jogo.time1)}
                          disabled={!team1 || !team2}
                          className="rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                        >
                          Propor como {jogo.time2}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Proposal modal */}
      {proposalModal.open && (
        <ProposalModal
          title="Propor Horário"
          subtitle={`Rodada ${proposalModal.rodada} · vs ${proposalModal.opponentName}`}
          onClose={() =>
            setProposalModal({
              open: false,
              rodada: null,
              opponentId: null,
              opponentName: "",
              actingTeamId: null,
            })
          }
          onSubmit={handlePropose}
        />
      )}

      {counterModal.open && (
        <ProposalModal
          title="Enviar Contraproposta"
          subtitle={`vs ${counterModal.opponentName}`}
          submitLabel="Enviar Contraproposta"
          initialDate={counterModal.originalDate ?? ""}
          initialTime={counterModal.originalTime ?? ""}
          originalProposal={{ date: counterModal.originalDate, time: counterModal.originalTime }}
          onClose={() =>
            setCounterModal({ open: false, matchId: null, opponentName: "", originalDate: null, originalTime: null })
          }
          onSubmit={handleCounter}
        />
      )}
    </main>
  );
}
