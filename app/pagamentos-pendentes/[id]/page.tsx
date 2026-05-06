"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PremiumCard from "@/components/premium-card";
import PageAccessGate from "@/components/page-access-gate";

type StoredFaceitUser = {
  id?: number | string;
  ID?: number | string;
  faceit_guid?: string;
};

type PaymentItem = {
  id: number;
  paymentRef: string;
  itemName: string;
  method: string;
  amountCents: number;
  status: string;
  isPending: boolean;
  isFinal: boolean;
  expiresAt: string | null;
  createdAt: string;
  checkoutUrl?: string;
  pix?: {
    qrCodeImageUrl?: string;
    qrCodeText?: string;
  };
};

function parseRouteId(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value || "").trim();
  const digits = normalized.replace(/\D/g, "");
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function getUserFromStorage(): StoredFaceitUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("faceit_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredFaceitUser;
  } catch {
    return null;
  }
}

function getNumericUserId(user: StoredFaceitUser | null) {
  const parsed = Number(user?.id ?? user?.ID);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function formatAmountBRL(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeMethod(value: string) {
  const method = String(value || "").toUpperCase();
  if (method === "CREDIT_CARD") return "Cartao de Credito";
  if (method === "PIX") return "PIX";
  return method || "-";
}

export default function PagamentosPendentesPage() {
  const params = useParams<{ id: string }>();
  const routeId = useMemo(() => parseRouteId(params?.id), [params]);

  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [faceitGuid, setFaceitGuid] = useState("");
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  const loadPayments = async (guid: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/loja/pagamento/minhas?faceit_guid=${encodeURIComponent(guid)}`, {
        headers: { "x-faceit-guid": guid },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPayments([]);
        setError(data?.message || "Nao foi possivel carregar pagamentos pendentes.");
        return;
      }

      const all = Array.isArray(data?.payments) ? (data.payments as PaymentItem[]) : [];
      setPayments(all.filter((payment) => Boolean(payment.isPending)));
    } catch {
      setPayments([]);
      setError("Erro inesperado ao carregar pagamentos pendentes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncAuth = () => {
      const user = getUserFromStorage();
      const userId = getNumericUserId(user);
      const guid = String(user?.faceit_guid || "").trim();

      setAllowed(Boolean(routeId && userId && routeId === userId));
      setFaceitGuid(guid);
      setReady(true);
    };

    syncAuth();
    window.addEventListener("faceit_auth_updated", syncAuth);
    window.addEventListener("storage", syncAuth);

    return () => {
      window.removeEventListener("faceit_auth_updated", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, [routeId]);

  useEffect(() => {
    if (!ready) return;
    if (!allowed || !faceitGuid) {
      setLoading(false);
      setPayments([]);
      return;
    }

    void loadPayments(faceitGuid);
  }, [allowed, faceitGuid, ready]);

  const handleDeletePending = async (paymentId: number) => {
    if (!faceitGuid) return;

    setDeletingPaymentId(paymentId);
    setError("");

    try {
      const res = await fetch("/api/loja/pagamento/excluir-pendente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          faceit_guid: faceitGuid,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Nao foi possivel excluir o pagamento pendente.");
        return;
      }

      setPayments((prev) => prev.filter((payment) => payment.id !== paymentId));
    } catch {
      setError("Erro inesperado ao excluir o pagamento pendente.");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <PageAccessGate level={1}>
      <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
        <div className="container mx-auto max-w-5xl px-4 space-y-6">
          <PremiumCard>
            <div className="p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Loja</p>
              <h1 className="mt-1 text-3xl font-black uppercase text-white">Pagamentos Pendentes</h1>
              <p className="mt-2 text-sm text-zinc-400">Acompanhe pagamentos ainda em analise ou aguardando confirmacao.</p>
              <div className="mt-4">
                <Link
                  href="/loja"
                  className="inline-flex rounded-lg border border-gold bg-gold px-4 py-2 text-xs font-black uppercase text-black"
                >
                  Voltar para Loja
                </Link>
              </div>
            </div>
          </PremiumCard>

          {ready && !allowed && (
            <PremiumCard>
              <div className="p-6 text-sm font-semibold text-red-300">
                Acesso negado: este caminho pertence a outro ID.
              </div>
            </PremiumCard>
          )}

          {allowed && error && (
            <PremiumCard>
              <div className="p-6 text-sm font-semibold text-red-300">{error}</div>
            </PremiumCard>
          )}

          {allowed && loading && (
            <PremiumCard>
              <div className="p-6 text-sm text-zinc-300">Carregando pagamentos pendentes...</div>
            </PremiumCard>
          )}

          {allowed && !loading && !payments.length && !error && (
            <PremiumCard>
              <div className="p-6 text-sm text-zinc-300">Nao ha pagamentos pendentes para seu usuario.</div>
            </PremiumCard>
          )}

          {allowed && !loading && payments.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {payments.map((payment) => (
                <PremiumCard key={payment.id}>
                  <div className="space-y-2 p-5">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pagamento #{payment.id}</p>
                    <h2 className="text-lg font-black uppercase text-white">{payment.itemName}</h2>
                    <p className="text-sm text-zinc-300">Valor: {formatAmountBRL(payment.amountCents)}</p>
                    <p className="text-sm text-zinc-300">Metodo: {normalizeMethod(payment.method)}</p>
                    <p className="text-sm text-zinc-300">Status: {payment.status}</p>
                    <p className="text-xs text-zinc-500">Criado em: {formatDateTime(payment.createdAt)}</p>
                    <p className="text-xs text-zinc-500">Expira em: {formatDateTime(payment.expiresAt)}</p>

                    {payment.checkoutUrl ? (
                      <a
                        href={payment.checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded-md border border-gold/50 bg-gold/10 px-3 py-2 text-xs font-black uppercase text-gold"
                      >
                        Continuar Pagamento
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleDeletePending(payment.id)}
                      disabled={deletingPaymentId === payment.id}
                      className="inline-flex rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-black uppercase text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingPaymentId === payment.id ? "Excluindo..." : "Excluir Pendencia"}
                    </button>
                  </div>
                </PremiumCard>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageAccessGate>
  );
}
