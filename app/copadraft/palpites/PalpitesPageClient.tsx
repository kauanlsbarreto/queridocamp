"use client";

import { useEffect, useMemo, useState } from "react";

type Game = {
  jogo_id: number;
  data: string;
  hora: string;
  time1: string;
  time2: string;
};

type StoredPalpite = {
  id: number;
  faceit_guid: string;
  data: string;
  jogo_id: number;
  palpite_mapa1: string | null;
  palpite_mapa2: string | null;
  palpite_mapa3: string | null;
};

type MyPalpiteStatus = "AGUARDANDO" | "CERTO" | "ERRADO";

type MyPalpite = {
  id: number;
  jogo_id: number;
  data: string;
  hora: string;
  time1: string;
  time2: string;
  palpite: string | null;
  resultado: string | null;
  status: MyPalpiteStatus;
};

type ApiResponse = {
  ok: boolean;
  hasAccess?: boolean;
  accessReason?: string;
  games: Game[];
  lockedDates: string[];
  existingPalpites: StoredPalpite[];
  myPalpites?: MyPalpite[];
  message?: string;
};

type PaymentStatusResponse = {
  ok?: boolean;
  hasAccess?: boolean;
  status?: string;
  message?: string;
  checkoutUrl?: string;
  pix?: {
    qrCodeImageUrl?: string;
    qrCodeText?: string;
  };
};

type PaymentInfo = {
  paymentId: number;
  status: string;
  checkoutUrl: string;
  qrCodeImageUrl: string;
  qrCodeText: string;
};

type PalpiteValues = {
  score1: string;
  score2: string;
};

function parseSerie(value: string | null | undefined): PalpiteValues {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\s*x\s*(\d{1,2})$/i);
  if (!match) return { score1: "", score2: "" };
  return {
    score1: match[1],
    score2: match[2],
  };
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "").slice(0, 2);
}

function toMinutes(hhmm: string) {
  const raw = String(hhmm || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function isGameClosed(date: string, hora: string, todayIso: string, nowMinutes: number) {
  if (!date) return false;
  if (date < todayIso) return true;
  if (date > todayIso) return false;
  const gameMinutes = toMinutes(hora);
  if (gameMinutes === null) return false;
  return nowMinutes >= gameMinutes;
}

function dateLabel(date: string) {
  const raw = String(date || "").trim();
  if (!raw) return "-";
  const parsed = new Date(`${raw}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function paymentStatusLabel(statusRaw: string) {
  const status = String(statusRaw || "").toUpperCase();
  if (status === "PENDING") return "Pendente";
  if (status === "WAITING") return "Aguardando pagamento";
  if (status === "IN_ANALYSIS") return "Em analise";
  if (status === "PAID") return "Pago";
  if (status === "DECLINED") return "Recusado";
  if (status === "CANCELED") return "Cancelado";
  if (status === "EXPIRED") return "Expirado";
  if (status === "FAILED") return "Falhou";
  return status || "Desconhecido";
}

function myPalpiteStatusLabel(statusRaw: MyPalpiteStatus) {
  if (statusRaw === "CERTO") return "Acertou";
  if (statusRaw === "ERRADO") return "Errou";
  return "Aguardando resultado";
}

function myPalpiteStatusClass(statusRaw: MyPalpiteStatus) {
  if (statusRaw === "CERTO") return "border-emerald-300/50 bg-emerald-300/10 text-emerald-200";
  if (statusRaw === "ERRADO") return "border-rose-300/50 bg-rose-300/10 text-rose-200";
  return "border-zinc-300/40 bg-zinc-300/10 text-zinc-200";
}

function TeamFlag({ teamName }: { teamName: string }) {
  const [index, setIndex] = useState(0);
  const lower = String(teamName || "").toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const encLower = encodeURIComponent(lower);
  const encNorm = encodeURIComponent(normalized);
  const candidates = [
    `/selecoes/${encLower}.jpg`,
    `/selecoes/${encNorm}.jpg`,
    `/selecoes/${encLower}.png`,
    `/selecoes/${encNorm}.png`,
  ];

  return (
    <img
      src={candidates[index] ?? candidates[0]}
      alt={teamName}
      className="h-10 w-14 rounded-md border border-white/20 object-cover md:h-12 md:w-16"
      onError={() => {
        setIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });
      }}
    />
  );
}

export default function PalpitesPageClient() {
  const [faceitGuid, setFaceitGuid] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "mine">("upcoming");
  const [games, setGames] = useState<Game[]>([]);
  const [myPalpites, setMyPalpites] = useState<MyPalpite[]>([]);
  const [submittedKeys, setSubmittedKeys] = useState<Record<string, true>>({});
  const [form, setForm] = useState<Record<string, PalpiteValues>>({});
  const [loading, setLoading] = useState(true);
  const [sendingGameKey, setSendingGameKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("faceit_user");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { faceit_guid?: string };
      const guid = String(parsed?.faceit_guid || "").trim().toLowerCase();
      if (guid) setFaceitGuid(guid);
    } catch {
      // ignore localStorage parsing errors
    }
  }, []);

  useEffect(() => {
    void loadData(faceitGuid);
  }, [faceitGuid]);

  useEffect(() => {
    if (!paymentInfo || !faceitGuid) return;

    const status = String(paymentInfo.status || "").toUpperCase();
    if (!["PENDING", "WAITING", "IN_ANALYSIS"].includes(status)) return;

    const timer = window.setInterval(() => {
      void refreshPaymentStatus(paymentInfo.paymentId);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [paymentInfo, faceitGuid]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadData(guid: string) {
    setLoading(true);
    setFeedback("");

    try {
      const search = guid ? `?faceit_guid=${encodeURIComponent(guid)}` : "";
      const res = await fetch(`/api/copadraft/palpites${search}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !data.ok) {
        setFeedback(data?.message || "Falha ao carregar dados de palpites.");
        setGames([]);
        setMyPalpites([]);
        setSubmittedKeys({});
        setForm({});
        return;
      }

      const granted = Boolean(data.hasAccess);
      setHasAccess(granted);
      setAccessReason(String(data.accessReason || ""));

      if (!granted) {
        setGames([]);
        setMyPalpites([]);
        setSubmittedKeys({});
        setForm({});
        return;
      }

      const loadedGames = Array.isArray(data.games) ? data.games : [];
      const loadedExisting = Array.isArray(data.existingPalpites) ? data.existingPalpites : [];
      const loadedMine = Array.isArray(data.myPalpites) ? data.myPalpites : [];

      const gameDateById = new Map<number, string>();
      for (const game of loadedGames) {
        gameDateById.set(Number(game.jogo_id || 0), String(game.data || "").slice(0, 10));
      }

      const nextForm: Record<string, PalpiteValues> = {};
      for (const game of loadedGames) {
        const key = `${game.data}::${game.jogo_id}`;
        nextForm[key] = { score1: "", score2: "" };
      }

      for (const row of loadedExisting) {
        const fallbackDate = gameDateById.get(Number(row.jogo_id || 0)) || "";
        const keyDate = String(row.data || "").slice(0, 10) || fallbackDate;
        if (!keyDate) continue;
        const key = `${keyDate}::${row.jogo_id}`;
        nextForm[key] = parseSerie(row.palpite_mapa1);
      }

      const nextSubmittedKeys: Record<string, true> = {};
      for (const row of loadedExisting) {
        const fallbackDate = gameDateById.get(Number(row.jogo_id || 0)) || "";
        const keyDate = String(row.data || "").slice(0, 10) || fallbackDate;
        if (!keyDate) continue;
        const key = `${keyDate}::${row.jogo_id}`;
        nextSubmittedKeys[key] = true;
      }

      setGames(loadedGames);
      setMyPalpites(loadedMine);
      setSubmittedKeys(nextSubmittedKeys);
      setForm(nextForm);
    } catch {
      setFeedback("Erro inesperado ao carregar os palpites.");
      setGames([]);
      setMyPalpites([]);
      setSubmittedKeys({});
      setForm({});
    } finally {
      setLoading(false);
    }
  }

  function setValue(date: string, jogoId: number, field: "score1" | "score2", value: string) {
    const key = `${date}::${jogoId}`;
    setForm((prev) => ({
      ...prev,
      [key]: {
        score1: field === "score1" ? onlyDigits(value) : prev[key]?.score1 || "",
        score2: field === "score2" ? onlyDigits(value) : prev[key]?.score2 || "",
      },
    }));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const game of games) {
      const key = String(game.data || "").slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(game);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [games]);

  const todayIso = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const upcomingGrouped = useMemo(
    () => grouped.filter(([date]) => date >= todayIso),
    [grouped, todayIso]
  );

  const pastGrouped = useMemo(
    () => grouped.filter(([date]) => date < todayIso).slice().reverse(),
    [grouped, todayIso]
  );

  const activeGrouped = activeTab === "upcoming" ? upcomingGrouped : pastGrouped;

  const upcomingCount = useMemo(
    () => upcomingGrouped.reduce((acc, [, dayGames]) => acc + dayGames.length, 0),
    [upcomingGrouped]
  );

  const pastCount = useMemo(
    () => pastGrouped.reduce((acc, [, dayGames]) => acc + dayGames.length, 0),
    [pastGrouped]
  );

  const myCount = myPalpites.length;

  async function submitGame(date: string, game: Game) {
    if (!hasAccess) {
      setFeedback("Acesso bloqueado. Efetue o pagamento para liberar palpites.");
      return;
    }

    if (!faceitGuid) {
      setFeedback("Informe seu Faceit ID para enviar palpite.");
      return;
    }

    const gameKey = `${date}::${game.jogo_id}`;

    if (submittedKeys[gameKey]) {
      setFeedback("Voce ja enviou palpite para este jogo.");
      return;
    }

    if (isGameClosed(game.data, game.hora, todayIso, nowMinutes)) {
      setFeedback("Palpite encerrado para este jogo.");
      return;
    }

    const values = form[gameKey] || {
      score1: "",
      score2: "",
    };

    const payload = [
      {
        jogo_id: game.jogo_id,
        palpite_serie: values.score1 && values.score2 ? `${values.score1}x${values.score2}` : "",
      },
    ];

    setSendingGameKey(gameKey);
    setFeedback("");

    try {
      const res = await fetch("/api/copadraft/palpites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceit_guid: faceitGuid,
          data: date,
          palpites: payload,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; locked?: boolean };

      if (!res.ok || !data.ok) {
        if (res.status === 403) {
          setHasAccess(false);
          setFeedback(data?.message || "Acesso bloqueado. Efetue o pagamento para liberar palpites.");
          return;
        }
        if (res.status === 409 || data.locked) {
          setSubmittedKeys((prev) => ({ ...prev, [gameKey]: true }));
          setFeedback("Voce ja enviou palpite para este jogo.");
          return;
        }
        setFeedback(data?.message || "Falha ao enviar palpites.");
        return;
      }

      setSubmittedKeys((prev) => ({ ...prev, [gameKey]: true }));
      setFeedback("Palpite enviado com sucesso!");
    } catch {
      setFeedback("Erro inesperado ao enviar palpites.");
    } finally {
      setSendingGameKey(null);
    }
  }

  async function createAccessPayment() {
    if (!faceitGuid) {
      setFeedback("Faca login com Faceit para continuar.");
      return;
    }

    setIsCreatingPayment(true);
    setFeedback("");

    try {
      const res = await fetch("/api/copadraft/palpites/pagamento/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceit_guid: faceitGuid,
          payment_method: paymentMethod,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        alreadyUnlocked?: boolean;
        paymentId?: number;
        status?: string;
        checkoutUrl?: string;
        pix?: { qrCodeImageUrl?: string; qrCodeText?: string };
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setFeedback(data?.message || "Falha ao iniciar pagamento.");
        return;
      }

      if (data.alreadyUnlocked) {
        setHasAccess(true);
        setPaymentInfo(null);
        await loadData(faceitGuid);
        setFeedback("Palpites liberados com sucesso!");
        return;
      }

      const nextPayment: PaymentInfo = {
        paymentId: Number(data.paymentId || 0),
        status: String(data.status || "PENDING").toUpperCase(),
        checkoutUrl: String(data.checkoutUrl || ""),
        qrCodeImageUrl: String(data.pix?.qrCodeImageUrl || ""),
        qrCodeText: String(data.pix?.qrCodeText || ""),
      };
      setPaymentInfo(nextPayment);

      if (paymentMethod === "CREDIT_CARD" && nextPayment.checkoutUrl) {
        window.open(nextPayment.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setFeedback("Erro inesperado ao iniciar pagamento.");
    } finally {
      setIsCreatingPayment(false);
    }
  }

  async function refreshPaymentStatus(paymentId: number) {
    if (!faceitGuid || !paymentId) return;

    try {
      const res = await fetch(
        `/api/copadraft/palpites/pagamento/status?paymentId=${paymentId}&faceit_guid=${encodeURIComponent(faceitGuid)}`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as PaymentStatusResponse;

      if (!res.ok || !data.ok) {
        return;
      }

      const status = String(data.status || "PENDING").toUpperCase();
      setPaymentInfo((prev) => {
        if (!prev || prev.paymentId !== paymentId) return prev;
        return {
          ...prev,
          status,
          checkoutUrl: String(data.checkoutUrl || prev.checkoutUrl || ""),
          qrCodeImageUrl: String(data.pix?.qrCodeImageUrl || prev.qrCodeImageUrl || ""),
          qrCodeText: String(data.pix?.qrCodeText || prev.qrCodeText || ""),
        };
      });

      if (data.hasAccess) {
        setHasAccess(true);
        setPaymentInfo(null);
        await loadData(faceitGuid);
        setFeedback("Pagamento confirmado. Palpites liberados!");
      }
    } catch {
      // ignore polling errors
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">Copa Draft</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Palpites</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-cyan-100/80 md:text-base">
            Informe seu palpite da serie (ex.: 1x1, 2x0) para cada jogo do dia.
          </p>
        </header>

        {!faceitGuid ? (
          <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-sm text-amber-200">
            Faceit ID nao encontrado no login. Faca login para enviar palpites.
          </div>
        ) : null}

        {feedback ? (
          <div className="mb-4 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">{feedback}</div>
        ) : null}

        {!loading && !hasAccess ? (
          <section className="rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-5 shadow-[0_24px_55px_rgba(0,0,0,0.35)] md:p-6">
            <h2 className="text-lg font-black uppercase tracking-wide text-cyan-100">Acesso aos Palpites</h2>
            <p className="mt-2 text-sm text-cyan-100/80">
              Apenas jogadores com que efetuaram o pagamento pode da palpite
              Para liberar, efetue o pagamento de <strong>R$ 15,00</strong>.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-cyan-300/25 bg-[linear-gradient(155deg,rgba(14,165,233,0.14),rgba(8,47,73,0.18))] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/90">Como Funciona</p>
                <p className="mt-2 text-sm text-zinc-100">
                  Cada participante faz um palpite por jogo, tentando acertar o placar final da serie.
                </p>
              </article>

              <article className="rounded-xl border border-emerald-300/25 bg-[linear-gradient(155deg,rgba(16,185,129,0.14),rgba(6,78,59,0.18))] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/90">Inscricao</p>
                <p className="mt-2 text-sm text-zinc-100">
                  Valor fixo de <strong>R$ 15,00</strong> por participante.
                </p>
                <p className="mt-2 text-xs text-zinc-300">
                  Todo valor arrecadado entra na premiacao da edição.
                </p>
              </article>

              <article className="rounded-xl border border-amber-300/25 bg-[linear-gradient(155deg,rgba(251,191,36,0.14),rgba(120,53,15,0.2))] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/90">Premiacao</p>
                <p className="mt-2 text-sm text-zinc-100">
                  O ganhador leva <strong>70% do total arrecadado</strong>.
                </p>
                <p className="mt-2 text-xs text-zinc-300">
                  Alem do premio em dinheiro, leva o card de Mestre dos Palpites.
                </p>
              </article>

              <article className="rounded-xl border border-fuchsia-300/25 bg-[linear-gradient(155deg,rgba(217,70,239,0.14),rgba(112,26,117,0.2))] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200/90">Dicas</p>
                <p className="mt-2 text-xs text-zinc-200">
                  1. So e permitido um palpite por jogador por jogo.
                </p>
                <p className="mt-1 text-xs text-zinc-200">
                  2. Fique atento aos horarios para nao perder a chance de palpitar.
                </p>
              </article>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("PIX")}
                className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  paymentMethod === "PIX"
                    ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                    : "border-white/15 bg-white/5 text-zinc-300"
                }`}
              >
                PIX
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("CREDIT_CARD")}
                className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  paymentMethod === "CREDIT_CARD"
                    ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                    : "border-white/15 bg-white/5 text-zinc-300"
                }`}
              >
                Cartao de credito
              </button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={isCreatingPayment || !faceitGuid}
                onClick={() => void createAccessPayment()}
                className="rounded-lg border border-cyan-300/60 bg-cyan-400/15 px-4 py-2 text-xs font-black uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCreatingPayment ? "Iniciando pagamento..." : "Pagar R$ 15,00"}
              </button>
            </div>

            {paymentInfo ? (
              <div className="mt-5 rounded-xl border border-cyan-300/25 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wider text-cyan-200">
                  Status do pagamento: <span className="font-black text-cyan-100">{paymentStatusLabel(paymentInfo.status)}</span>
                </p>

                {paymentInfo.qrCodeImageUrl ? (
                  <img
                    src={paymentInfo.qrCodeImageUrl}
                    alt="QR Code PIX"
                    className="mt-3 h-44 w-44 rounded-lg border border-white/10 bg-white p-2"
                  />
                ) : null}

                {paymentInfo.qrCodeText ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs text-cyan-100/80">Codigo PIX copia e cola</p>
                    <textarea
                      readOnly
                      value={paymentInfo.qrCodeText}
                      className="h-24 w-full rounded-md border border-white/15 bg-[#040b21] p-2 text-xs text-zinc-200"
                    />
                  </div>
                ) : null}

                {paymentInfo.checkoutUrl ? (
                  <a
                    href={paymentInfo.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-lg border border-cyan-300/60 bg-cyan-400/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-cyan-100 hover:bg-cyan-400/25"
                  >
                    Abrir pagamento no cartao
                  </a>
                ) : null}
              </div>
            ) : null}

            {accessReason === "LOGIN_REQUIRED" ? (
              <p className="mt-4 text-xs text-amber-200">Faca login para continuar.</p>
            ) : null}
          </section>
        ) : null}

        {!loading && !hasAccess ? null : (
          <>
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,3fr)_340px] lg:items-start lg:gap-8">
        <div className="hidden lg:block" />
        <div className="w-full lg:max-w-3xl lg:justify-self-end">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "upcoming"
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-cyan-300/40"
            }`}
          >
            Proximos Jogos ({upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("past")}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "past"
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-cyan-300/40"
            }`}
          >
            Jogos ja passados ({pastCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mine")}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "mine"
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-cyan-300/40"
            }`}
          >
            Meus Palpites ({myCount})
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-8 text-center text-zinc-300">Carregando jogos...</div>
        ) : activeTab === "mine" ? (
          myPalpites.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-8 text-center text-zinc-300">
              Voce ainda nao enviou palpites.
            </div>
          ) : (
            <div className="grid gap-3">
              {myPalpites.map((item) => (
                <article
                  key={`${item.id}::${item.jogo_id}`}
                  className="rounded-xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_18px_36px_rgba(0,0,0,0.3)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-100">
                      {item.time1} x {item.time2}
                    </h3>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${myPalpiteStatusClass(item.status)}`}
                    >
                      {myPalpiteStatusLabel(item.status)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-zinc-300">
                    {dateLabel(item.data)} {item.hora ? `as ${item.hora}` : ""}
                  </p>

                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="uppercase tracking-wider text-zinc-400">Seu palpite</p>
                      <p className="mt-1 text-sm font-black text-cyan-100">{item.palpite || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="uppercase tracking-wider text-zinc-400">Resultado oficial</p>
                      <p className="mt-1 text-sm font-black text-cyan-100">{item.resultado || "Aguardando"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : activeGrouped.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-8 text-center text-zinc-300">
            {activeTab === "upcoming"
              ? "Nenhum proximo jogo disponivel para palpites."
              : "Nenhum jogo passado encontrado."}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeGrouped.map(([date, dateGames]) => {
              const isLocked = dateGames.every((game) => submittedKeys[`${date}::${game.jogo_id}`]);
              const isPastDate = date < todayIso;
              const areAllGamesClosed = dateGames.every((game) => isGameClosed(game.data, game.hora, todayIso, nowMinutes));

              return (
                <section key={date} className="rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] md:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wider text-cyan-200 md:text-base">{dateLabel(date)}</h2>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        isPastDate || areAllGamesClosed
                          ? "border-zinc-300/40 bg-zinc-300/10 text-zinc-200"
                          : isLocked
                            ? "border-amber-300/50 bg-amber-300/10 text-amber-200"
                            : "border-emerald-300/50 bg-emerald-300/10 text-emerald-200"
                      }`}
                    >
                      {isPastDate || areAllGamesClosed ? "Palpite encerrado" : isLocked ? "Palpite bloqueado" : "Aguardando envio"}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="mx-auto w-fit border-separate border-spacing-y-1.5 text-sm">
                      <thead>
                        <tr className="text-center text-[11px] uppercase tracking-wider text-zinc-300">
                          <th className="px-1 py-1">Jogo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateGames.map((game) => {
                          const key = `${date}::${game.jogo_id}`;
                          const values = form[key] || {
                            score1: "",
                            score2: "",
                          };
                          const gameClosed = isGameClosed(game.data, game.hora, todayIso, nowMinutes);
                          const isSent = Boolean(submittedKeys[key]);
                          const isSendingThisGame = sendingGameKey === key;
                          const disabled = isSent || isSendingThisGame || gameClosed;

                          return (
                            <tr key={key} className="rounded-lg border border-white/10 bg-black/20">
                              <td className="px-2 py-2 text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200/90">
                                    {game.hora || "-"}
                                  </span>

                                  <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl border border-cyan-300/25 bg-[linear-gradient(145deg,rgba(4,11,33,0.96),rgba(3,9,30,0.92))] px-3 py-2 shadow-[0_8px_28px_rgba(2,10,30,0.45)] backdrop-blur-sm md:gap-3 md:px-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <TeamFlag teamName={game.time1} />
                                    <span className="max-w-[88px] truncate text-[11px] font-bold uppercase tracking-wide text-cyan-100/90 md:max-w-[120px]">
                                      {game.time1}
                                    </span>
                                  </div>

                                  <div className="flex flex-col items-center gap-1.5">
                                    <div className="flex items-center gap-1.5 rounded-xl bg-[#02071b]/80 px-2 py-1.5 md:px-2.5">
                                      <input
                                        value={values.score1}
                                        onChange={(event) => setValue(date, game.jogo_id, "score1", event.target.value)}
                                        placeholder="1"
                                        inputMode="numeric"
                                        maxLength={2}
                                        disabled={disabled}
                                        className="w-10 rounded-md border border-cyan-300/20 bg-[#010513] px-2 py-1 text-center text-sm font-black text-white outline-none transition focus:border-cyan-300/55 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.12)] placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                                      />
                                      <span className="text-xs font-black uppercase tracking-wider text-cyan-300">x</span>
                                      <input
                                        value={values.score2}
                                        onChange={(event) => setValue(date, game.jogo_id, "score2", event.target.value)}
                                        placeholder="1"
                                        inputMode="numeric"
                                        maxLength={2}
                                        disabled={disabled}
                                        className="w-10 rounded-md border border-cyan-300/20 bg-[#010513] px-2 py-1 text-center text-sm font-black text-white outline-none transition focus:border-cyan-300/55 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.12)] placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      disabled={disabled || !faceitGuid}
                                      onClick={() => void submitGame(date, game)}
                                      className="rounded-md border border-cyan-300/45 bg-cyan-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-55"
                                    >
                                      {gameClosed ? "Encerrado" : isSent ? "Enviado" : isSendingThisGame ? "Enviando" : "Enviar"}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 min-w-0">
                                    <TeamFlag teamName={game.time2} />
                                    <span className="max-w-[88px] truncate text-[11px] font-bold uppercase tracking-wide text-cyan-100/90 md:max-w-[120px]">
                                      {game.time2}
                                    </span>
                                  </div>
                                </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                </section>
              );
            })}
          </div>
        )}
        </div>

        <aside className="w-full lg:sticky lg:top-4 lg:w-[340px] lg:justify-self-end">
          <section className="rounded-2xl border border-cyan-300/30 bg-[#061a3a]/90 p-4 shadow-[0_24px_45px_rgba(0,0,0,0.35)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/90">Como Palpitar</p>
            <h3 className="mt-1 text-sm font-black uppercase tracking-wider text-cyan-100">Passo a passo rapido</h3>

            <div className="mt-3 space-y-2 text-xs text-zinc-200">
              <p>
                <span className="font-black text-cyan-100">1.</span> Escolha a aba <strong>Proximos Jogos</strong>.
              </p>
              <p>
                <span className="font-black text-cyan-100">2.</span> Em cada partida, preencha o placar da serie no formato <strong>x</strong>.
              </p>
              <p>
                <span className="font-black text-cyan-100">3.</span> Clique em <strong>Enviar</strong> para registrar o palpite daquele jogo.
              </p>
              <p>
                <span className="font-black text-cyan-100">4.</span> Depois acompanhe em <strong>Meus Palpites</strong> se acertou, errou ou aguarda resultado.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">
              Dica: voce so pode enviar um palpite por jogo, entao revise antes de confirmar.
            </div>
          </section>
        </aside>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
