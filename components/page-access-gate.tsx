"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import FaceitLogin from "./FaceitLogin";
import type { UserProfile as FaceitUser } from "./user-profile";

export type PageAccessLevel = 0 | 1 | 2;

type PageAccessGateProps = {
  level: PageAccessLevel;
  children: ReactNode;
  adminMinLevel?: number;
  loginRequiredTitle?: string;
  restrictedTitle?: string;
};

function readFaceitUser(): FaceitUser | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("faceit_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as FaceitUser;
  } catch {
    return null;
  }
}

function getAdminLevel(user: FaceitUser | null): number {
  if (!user) return 0;

  const rawLevel = user.admin ?? user.Admin ?? 0;
  const level = Number(rawLevel);
  return Number.isFinite(level) ? level : 0;
}

function isFaceitLogged(user: FaceitUser | null): boolean {
  if (!user) return false;

  return Boolean(user.faceit_guid || user.nickname || user.id);
}

export default function PageAccessGate({
  level,
  children,
  adminMinLevel = 1,
  loginRequiredTitle = "Voce precisa logar com a Faceit",
  restrictedTitle = "Acesso restrito",
}: PageAccessGateProps) {
  const [user, setUser] = useState<FaceitUser | null>(null);

  const syncUserFromStorage = useCallback(() => {
    setUser(readFaceitUser());
  }, []);

  useEffect(() => {
    syncUserFromStorage();

    const onAuthUpdate = () => {
      syncUserFromStorage();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "faceit_user") {
        syncUserFromStorage();
      }
    };

    window.addEventListener("faceit_auth_updated", onAuthUpdate);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("faceit_auth_updated", onAuthUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncUserFromStorage]);

  const logged = useMemo(() => isFaceitLogged(user), [user]);
  const adminLevel = useMemo(() => getAdminLevel(user), [user]);

  const canAccess = useMemo(() => {
    if (level === 0) return true;
    if (level === 1) return logged;
    return logged && adminLevel >= adminMinLevel;
  }, [adminLevel, adminMinLevel, level, logged]);

  if (canAccess) {
    return <>{children}</>;
  }

  if (level === 1) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#10151d] p-6 text-center text-white">
        <h2 className="text-xl font-bold">{loginRequiredTitle}</h2>
        <p className="mt-2 text-sm text-white/75">Para continuar, faca login com sua conta Faceit.</p>

        <div className="mt-5 flex justify-center">
          <FaceitLogin user={user} onAuthChange={syncUserFromStorage} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-400/30 bg-red-950/20 p-6 text-center text-white">
      <h2 className="text-xl font-bold text-red-300">{restrictedTitle}</h2>
      <p className="mt-2 text-sm text-red-100/80">Acesso Restrito.</p>
      {!logged && <p className="mt-2 text-sm text-red-100/70">Faca login na Faceit para validar seu nivel de acesso.</p>}
      {logged && adminLevel < adminMinLevel && (
        <p className="mt-2 text-sm text-red-100/70">Seu nivel atual nao possui permissao para acessar esta area.</p>
      )}
    </div>
  );
}
