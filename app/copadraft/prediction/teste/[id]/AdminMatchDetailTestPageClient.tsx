"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MatchDetailPageClient from "../../../jogos/[id]/MatchDetailPageClient";

export default function AdminMatchDetailTestPageClient() {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [denyReason, setDenyReason] = useState("Acesso restrito para Admin 1.");

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-lg font-bold">Validando acesso Admin 1...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-xl">
          <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-gray-400 mb-6">{denyReason}</p>
          <Link href="/copadraft/prediction" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-bold">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  return <MatchDetailPageClient />;
}
