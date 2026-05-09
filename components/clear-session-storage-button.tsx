"use client";

import { useState } from "react";

export default function ClearSessionStorageButton() {
  const [isClearing, setIsClearing] = useState(false);

  function handleClearSessionStorage() {
    if (typeof window === "undefined") return;

    const confirmed = window.confirm("Limpar cache da sessao deste navegador agora?");
    if (!confirmed) return;

    setIsClearing(true);
    try {
      sessionStorage.clear();
      window.location.reload();
    } catch {
      setIsClearing(false);
      window.alert("Nao foi possivel limpar o cache da sessao.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClearSessionStorage}
      disabled={isClearing}
      title="Limpar Cache"
      className="fixed bottom-4 right-4 z-[9999] rounded-md border border-white/20 bg-black/75 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isClearing ? "Limpando..." : "Limpar cache da sessao"}
    </button>
  );
}
