"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PremiumCard from "@/components/premium-card";

type FaceitUser = {
  faceit_guid?: string;
};

type PaymentStatus = "pending" | "approved" | "cancelled" | "expired" | "failed";

type PaymentOperation = {
  operationCode: string;
  status: PaymentStatus;
  itemNome: string;
  amount: number;
  checkoutUrl: string | null;
  expiresAt: string;
  cancelReason: string | null;
  mpPaymentId: string | null;
};

export default function LojaPagamentoPage() {
  const searchParams = useSearchParams();

  const itemId = useMemo(() => Number(searchParams.get("item") || 0), [searchParams]);
  const operationFromQuery = useMemo(() => String(searchParams.get("op") || "").trim(), [searchParams]);
  const resultFromQuery = useMemo(() => String(searchParams.get("result") || "").trim(), [searchParams]);
  const paymentIdFromQuery = useMemo(() => String(searchParams.get("payment_id") || "").trim(), [searchParams]);

  const [faceitGuid, setFaceitGuid] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [operationCode, setOperationCode] = useState(operationFromQuery);
  const [operation, setOperation] = useState<PaymentOperation | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [autoRedirectStarted, setAutoRedirectStarted] = useState(false);
  const [autoRedirectFailed, setAutoRedirectFailed] = useState(false);

  const isPending = operation?.status === "pending";

  const fetchStatus = useCallback(
    async (code: string, guid: string, paymentId?: string) => {
      const query = new URLSearchParams({ operation: code, faceit_guid: guid });
      if (paymentId) query.set("payment_id", paymentId);

      const res = await fetch(`/api/loja/pagamento/status?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Não foi possível consultar o status do pagamento.");
      }

      setOperation(data.operation as PaymentOperation);
      return data.operation as PaymentOperation;
    },
    [],
  );

  const initializeOperation = useCallback(
    async (guid: string) => {
      if (operationFromQuery) {
        setOperationCode(operationFromQuery);
        return;
      }

      if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error("Item inválido para pagamento.");
      }

      setCreating(true);
      const res = await fetch("/api/loja/pagamento/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, faceit_guid: guid }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Erro ao iniciar o pagamento com Mercado Pago.");
      }

      setOperationCode(String(data.operationCode || ""));
      setOperation((prev) => ({
        operationCode: String(data.operationCode || ""),
        status: "pending",
        itemNome: String(data?.item?.nome || prev?.itemNome || ""),
        amount: Number(data?.item?.preco || prev?.amount || 0),
        checkoutUrl: String(data.checkoutUrl || ""),
        expiresAt: String(data.expiresAt || new Date().toISOString()),
        cancelReason: null,
        mpPaymentId: null,
      }));
    },
    [itemId, operationFromQuery],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("faceit_user");
    if (!raw) {
      setError("Você precisa estar logado com Faceit para pagar.");
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as FaceitUser;
      const guid = String(parsed?.faceit_guid || "").trim();
      if (!guid) {
        setError("Faceit GUID não encontrado no login atual.");
        setLoading(false);
        return;
      }
      setFaceitGuid(guid);
    } catch {
      setError("Sessão inválida. Faça login novamente.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!faceitGuid) return;

    let cancelled = false;

    const run = async () => {
      setError("");
      try {
        await initializeOperation(faceitGuid);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao preparar pagamento.");
        }
      } finally {
        if (!cancelled) {
          setCreating(false);
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [faceitGuid, initializeOperation]);

  useEffect(() => {
    if (!operationCode || !faceitGuid) return;

    let interval: NodeJS.Timeout | null = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        const op = await fetchStatus(operationCode, faceitGuid, paymentIdFromQuery);
        if (!cancelled && op.status === "pending") {
          interval = setTimeout(refresh, 7000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
          interval = setTimeout(refresh, 9000);
        }
      }
    };

    refresh();

    return () => {
      cancelled = true;
      if (interval) clearTimeout(interval);
    };
  }, [operationCode, faceitGuid, fetchStatus, paymentIdFromQuery]);

  useEffect(() => {
    if (!operation?.expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const expires = new Date(operation.expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((expires - now) / 1000));
      setRemainingSeconds(diff);
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [operation?.expiresAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autoRedirectStarted) return;
    if (!operation?.checkoutUrl) return;
    if (operation.status !== "pending") return;

    // Apenas no fluxo inicial (clique em comprar), sem loop no retorno do Mercado Pago.
    const isInitialBuyFlow = !operationFromQuery && !resultFromQuery && itemId > 0;
    if (!isInitialBuyFlow) return;

    setAutoRedirectStarted(true);
    const opened = window.open(operation.checkoutUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Alguns navegadores bloqueiam pop-up automático fora de gesto direto.
      setAutoRedirectFailed(true);
    }
  }, [autoRedirectStarted, itemId, operation?.checkoutUrl, operation?.status, operationFromQuery, resultFromQuery]);

  const formattedTime = useMemo(() => {
    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, [remainingSeconds]);

  return (
    <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
      <div className="container mx-auto max-w-4xl px-4">
        <PremiumCard>
          <div className="space-y-4 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Mercado Pago Checkout Pro</p>
            <h1 className="text-3xl font-black uppercase text-white">Pagamento da Loja</h1>
            <p className="text-sm text-zinc-300">
              Esta área usa Checkout Pro para pagamentos em reais. A operação expira automaticamente em 5 minutos.
            </p>

            {(loading || creating) && (
              <div className="rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-zinc-300">
                Preparando pagamento...
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-400">
                {error}
              </div>
            )}

            {operation && (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-zinc-400">Operação</p>
                  <p className="font-mono text-sm text-zinc-200">{operation.operationCode}</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    Item: <span className="font-bold text-white">{operation.itemNome}</span>
                  </p>
                  <p className="text-sm text-zinc-300">
                    Valor: <span className="font-bold text-gold">R$ {Number(operation.amount || 0).toFixed(2)}</span>
                  </p>
                </div>

                {isPending && (
                  <div className="rounded-lg border border-gold/30 bg-gold/10 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wide text-gold">Tempo restante</p>
                    <p className="mt-1 text-3xl font-black text-white">{formattedTime}</p>
                    <p className="mt-2 text-xs text-zinc-300">
                      Se o pagamento não for aprovado até o fim do tempo, a operação será cancelada automaticamente.
                    </p>
                    {autoRedirectStarted && (
                      <p className="mt-2 text-xs font-semibold text-gold">
                        {autoRedirectFailed
                          ? "Seu navegador bloqueou a nova guia. Use o botão abaixo para abrir o Mercado Pago."
                          : "Nova guia do Mercado Pago aberta. Finalize o pagamento e volte para acompanhar o status aqui."}
                      </p>
                    )}
                  </div>
                )}

                {operation.status === "approved" && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-300">
                    Pagamento confirmado com sucesso. Sua compra foi registrada.
                  </div>
                )}

                {(operation.status === "cancelled" || operation.status === "expired" || operation.status === "failed") && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                    Operação cancelada.
                    {operation.cancelReason ? ` Motivo: ${operation.cancelReason}` : ""}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {operation.checkoutUrl && operation.status === "pending" && (
                    <a
                      href={operation.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black transition hover:opacity-90"
                    >
                      Abrir Mercado Pago
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (operationCode && faceitGuid) {
                        fetchStatus(operationCode, faceitGuid, paymentIdFromQuery).catch((err) => {
                          setError(err instanceof Error ? err.message : "Erro ao atualizar status.");
                        });
                      }
                    }}
                    className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
                  >
                    Atualizar Status
                  </button>

                  <Link
                    href="/loja"
                    className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
                  >
                    Voltar para Loja
                  </Link>
                </div>
              </div>
            )}
          </div>
        </PremiumCard>
      </div>
    </section>
  );
}
