"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, ServerCrash } from "lucide-react";

type ServiceState = "operational" | "degraded" | "down";

type ServiceCheck = {
  id: string;
  name: string;
  status: ServiceState;
  httpStatus: number | null;
  latencyMs: number | null;
  message: string;
  checkedAt: string;
  pages: string[];
};

type ErrorRow = {
  source: "service" | "login";
  service: string;
  page: string;
  error: string;
  timestamp: string;
};

type StatusResponse = {
  allOperational: boolean;
  availability: number;
  checkedAt: string;
  snapshotUpdatedAt?: string;
  services: ServiceCheck[];
  errors: ErrorRow[];
};

type SessionUser = {
  faceit_guid?: string;
  admin?: number;
  Admin?: number;
};

function formatStatus(status: ServiceState) {
  if (status === "operational") return "100% Operacional";
  if (status === "degraded") return "Instável";
  return "Indisponível";
}

function statusClass(status: ServiceState) {
  if (status === "operational") {
    return "text-emerald-300 bg-emerald-500/15 border-emerald-400/30";
  }
  if (status === "degraded") {
    return "text-amber-300 bg-amber-500/15 border-amber-400/30";
  }
  return "text-red-300 bg-red-500/15 border-red-400/30";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function StatusPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [faceitGuid, setFaceitGuid] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<StatusResponse | null>(null);

  const fetchStatus = async (guid: string, options?: { silent?: boolean; refresh?: boolean }) => {
    if (!guid) return;
    const silent = options?.silent ?? false;
    const refresh = options?.refresh ?? false;

    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/status?faceit_guid=${encodeURIComponent(guid)}${refresh ? "&refresh=1" : ""}`,
        {
        cache: "no-store",
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          setAuthorized(false);
          setData(null);
          return;
        }
        throw new Error(payload?.error || "Falha ao consultar status.");
      }

      const payload = (await response.json()) as StatusResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao consultar status.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem("faceit_user");
    if (!stored) {
      setAuthorized(false);
      return;
    }

    let parsed: SessionUser;
    try {
      parsed = JSON.parse(stored) as SessionUser;
    } catch {
      setAuthorized(false);
      return;
    }

    const guid = parsed.faceit_guid || "";
    const level = Number(parsed.admin ?? parsed.Admin ?? 0);

    if (!guid || (level !== 1 && level !== 2)) {
      setAuthorized(false);
      return;
    }

    setFaceitGuid(guid);
    setAuthorized(true);
    // Entrada na página usa snapshot em cache global.
    fetchStatus(guid, { refresh: false });
  }, []);

  const totalServices = data?.services.length ?? 0;
  const lastUpdateLabel = data
    ? formatDate(data.snapshotUpdatedAt || data.checkedAt)
    : "-";
  const downServices = useMemo(
    () => data?.services.filter((service) => service.status !== "operational").length ?? 0,
    [data]
  );

  if (authorized === null) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center pt-24">
        <p className="text-zinc-300 uppercase tracking-widest text-sm">Carregando status...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center px-4">
        <div className="max-w-xl w-full border border-red-500/30 bg-red-950/20 rounded-2xl p-8 text-center">
          <ServerCrash className="mx-auto mb-4 text-red-400" size={34} />
          <h1 className="text-2xl font-black uppercase italic tracking-tight text-red-200">Acesso negado</h1>
          <p className="mt-3 text-sm text-zinc-300">
            Apenas Admin 1 e Admin 2 podem visualizar a página <span className="text-gold font-bold">/status</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pt-24 pb-16 px-4 relative">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-gold/15 via-gold/5 to-transparent" />
        <div className="absolute -top-24 right-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto space-y-6 relative">
        <div className="relative overflow-hidden rounded-2xl border border-gold/20 glass-gold p-6">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight">Status de Infraestrutura</h1>
              <p className="mt-2 text-zinc-300 text-sm">
                Monitoramento de API Faceit, Railway, GitHub e site no Cloudflare.
              </p>
              <p className="mt-2 text-xs text-zinc-400 uppercase tracking-widest">
                Última atualização: <span className="text-gold font-bold">{lastUpdateLabel}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchStatus(faceitGuid, { refresh: true })}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 border border-gold/40 bg-gold/10 hover:bg-gold/20 transition-colors text-gold font-bold uppercase text-xs tracking-wider disabled:opacity-60"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Disponibilidade</p>
            <p className="mt-1 text-3xl font-black text-gold">{data?.availability ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Serviços</p>
            <p className="mt-1 text-3xl font-black">{totalServices}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Com Problema</p>
            <p className="mt-1 text-3xl font-black text-red-300">{downServices}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
            <span className="font-bold uppercase text-xs tracking-widest">Falha:</span> {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 bg-zinc-900 border-b border-zinc-800">
            <h2 className="text-lg font-black uppercase tracking-tight">Status dos Serviços</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-4 py-3 text-left">Serviço</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">HTTP</th>
                  <th className="px-4 py-3 text-left">Latência</th>
                  <th className="px-4 py-3 text-left">Páginas afetadas</th>
                  <th className="px-4 py-3 text-left">Detalhes</th>
                  <th className="px-4 py-3 text-left">Última checagem</th>
                </tr>
              </thead>
              <tbody>
                {data?.services.map((service) => (
                  <tr key={service.id} className="border-t border-zinc-800 bg-zinc-900/40">
                    <td className="px-4 py-3 font-bold text-white">{service.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase ${statusClass(service.status)}`}>
                        {service.status === "operational" ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <AlertTriangle size={13} />
                        )}
                        {formatStatus(service.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{service.httpStatus ?? "-"}</td>
                    <td className="px-4 py-3 text-zinc-300">{service.latencyMs !== null ? `${service.latencyMs}ms` : "-"}</td>
                    <td className="px-4 py-3 text-zinc-400">{service.pages.join(", ")}</td>
                    <td className="px-4 py-3 text-zinc-300">{service.message}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(service.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="px-5 py-4 bg-zinc-900 border-b border-zinc-800">
            <h2 className="text-lg font-black uppercase tracking-tight">Tabela de Erros</h2>
            <p className="text-xs text-zinc-500 mt-1">Erros detectados nos serviços e falhas registradas de login.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-4 py-3 text-left">Fonte</th>
                  <th className="px-4 py-3 text-left">Serviço</th>
                  <th className="px-4 py-3 text-left">Página(s)</th>
                  <th className="px-4 py-3 text-left">Erro</th>
                  <th className="px-4 py-3 text-left">Horário</th>
                </tr>
              </thead>
              <tbody>
                {data && data.errors.length > 0 ? (
                  data.errors.map((row, index) => (
                    <tr key={`${row.service}-${index}`} className="border-t border-zinc-800 bg-zinc-900/30">
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[11px] font-bold uppercase">
                          {row.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">{row.service}</td>
                      <td className="px-4 py-3 text-zinc-300">{row.page}</td>
                      <td className="px-4 py-3 text-red-200">{row.error}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDate(row.timestamp)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 italic">
                      Nenhum erro registrado no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
