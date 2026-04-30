"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PremiumCard from "@/components/premium-card";

type PaymentStatusResponse = {
  status?: string;
  isFinal?: boolean;
  message?: string;
};

function normalizeStatus(statusRaw: unknown) {
  return String(statusRaw || "").toUpperCase();
}

function getTitle(status: string, loading: boolean, hasPaymentId: boolean) {
  if (!hasPaymentId) return "Pagamento invalido";
  if (loading) return "Confirmando pagamento";
  if (status === "PAID") return "Pagamento aprovado";
  if (status === "EXPIRED") return "Pagamento expirado";
  if (status === "DECLINED") return "Pagamento recusado";
  if (status === "CANCELED") return "Pagamento cancelado";
  if (status === "FAILED") return "Pagamento nao concluido";
  if (["PENDING", "WAITING", "IN_ANALYSIS"].includes(status)) return "Pagamento em processamento";
  return "Status do pagamento";
}

function getMessage(status: string, loading: boolean, error: string | null, hasPaymentId: boolean) {
  if (!hasPaymentId) {
    return "Nao foi possivel identificar o pagamento. Volte para a loja e tente novamente.";
  }
  if (error) return error;
  if (loading) {
    return "Estamos consultando o status no PagBank. Isso pode levar alguns segundos.";
  }
  if (status === "PAID") {
    return "Seu pagamento foi confirmado. Se voce foi redirecionado pelo PagBank, pode voltar para a loja agora.";
  }
  if (status === "EXPIRED") {
    return "O tempo para concluir o pagamento expirou. Gere um novo pagamento na loja.";
  }
  if (status === "DECLINED") {
    return "O PagBank informou que o pagamento foi recusado.";
  }
  if (status === "CANCELED") {
    return "O pagamento foi cancelado.";
  }
  if (status === "FAILED") {
    return "Nao foi possivel confirmar este pagamento.";
  }
  return "Pagamento ainda em processamento. Aguarde alguns segundos ou volte para a loja para tentar novamente.";
}

export default function LojaPagamentoPage() {
  const searchParams = useSearchParams();
  const paymentId = Number(searchParams.get("paymentId") || 0);
  const hasPaymentId = Number.isFinite(paymentId) && paymentId > 0;

  const [loading, setLoading] = useState<boolean>(hasPaymentId);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("PENDING");

  useEffect(() => {
    if (!hasPaymentId) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const syncStatus = async () => {
      try {
        const response = await fetch(`/api/loja/pagamento/status?paymentId=${paymentId}`);
        const data = (await response.json().catch(() => ({}))) as PaymentStatusResponse;

        if (cancelled) return;

        if (!response.ok) {
          setError(data?.message || "Falha ao consultar status do pagamento.");
          setLoading(false);
          if (intervalId) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }

        const nextStatus = normalizeStatus(data?.status);
        const isFinal = Boolean(data?.isFinal);

        setStatus(nextStatus || "PENDING");
        setError(null);
        setLoading(false);

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "LOJA_PAGAMENTO_RETORNO",
              paymentId,
              status: nextStatus,
              isFinal,
            },
            window.location.origin,
          );
        }

        if (isFinal && intervalId) {
          window.clearInterval(intervalId);
          intervalId = null;
          if (window.opener) {
            window.setTimeout(() => {
              window.close();
            }, 1200);
          }
        }
      } catch {
        if (cancelled) return;
        setError("Erro de rede ao consultar status do pagamento.");
        setLoading(false);
      }
    };

    void syncStatus();
    intervalId = window.setInterval(syncStatus, 5000);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [hasPaymentId, paymentId]);

  const title = useMemo(() => getTitle(status, loading, hasPaymentId), [status, loading, hasPaymentId]);
  const message = useMemo(
    () => getMessage(status, loading, error, hasPaymentId),
    [status, loading, error, hasPaymentId],
  );

  return (
    <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <PremiumCard>
          <div className="space-y-4 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Loja</p>
            <h1 className="text-3xl font-black uppercase text-white">{title}</h1>
            <p className="text-sm text-zinc-300">{message}</p>
            {hasPaymentId ? (
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pagamento #{paymentId}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/loja"
                className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black transition hover:opacity-90"
              >
                Voltar para Loja
              </Link>
              {typeof window !== "undefined" && window.opener ? (
                <button
                  type="button"
                  onClick={() => window.close()}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black uppercase text-zinc-100 transition hover:border-zinc-500"
                >
                  Fechar Janela
                </button>
              ) : null}
            </div>
          </div>
        </PremiumCard>
      </div>
    </section>
  );
}
