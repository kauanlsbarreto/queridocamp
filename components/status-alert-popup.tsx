"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type SessionUser = {
  faceit_guid?: string;
  admin?: number;
  Admin?: number;
};

type ErrorRow = {
  source: "service" | "login";
  service: string;
  page: string;
  error: string;
  timestamp: string;
};

type StatusPayload = {
  errors: ErrorRow[];
};

const FIVE_MINUTES = 5 * 60 * 1000;

export default function StatusAlertPopup() {
  const [visible, setVisible] = useState(false);
  const [faceitGuid, setFaceitGuid] = useState<string>("");
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [dismissedSignature, setDismissedSignature] = useState<string>("");

  const currentSignature = useMemo(() => {
    return errors.slice(0, 5).map((e) => `${e.source}|${e.service}|${e.error}|${e.timestamp}`).join("::");
  }, [errors]);

  useEffect(() => {
    const syncUser = () => {
      const stored = localStorage.getItem("faceit_user");
      if (!stored) {
        setFaceitGuid("");
        setVisible(false);
        setErrors([]);
        return;
      }

      try {
        const user = JSON.parse(stored) as SessionUser;
        const level = Number(user.admin ?? user.Admin ?? 0);
        if ((level === 1 || level === 2) && user.faceit_guid) {
          setFaceitGuid(user.faceit_guid);
          return;
        }
      } catch {
      }

      setFaceitGuid("");
      setVisible(false);
      setErrors([]);
    };

    syncUser();
    window.addEventListener("faceit_auth_updated", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("faceit_auth_updated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    if (!faceitGuid) return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/status?faceit_guid=${encodeURIComponent(faceitGuid)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setVisible(false);
            setErrors([]);
          }
          return;
        }

        const payload = (await res.json()) as StatusPayload;
        if (cancelled) return;

        const nextErrors = Array.isArray(payload.errors) ? payload.errors : [];
        setErrors(nextErrors);
      } catch {
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, FIVE_MINUTES);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [faceitGuid]);

  useEffect(() => {
    if (!faceitGuid) {
      setVisible(false);
      return;
    }

    if (errors.length === 0) {
      setVisible(false);
      setDismissedSignature("");
      return;
    }

    if (currentSignature && currentSignature !== dismissedSignature) {
      setVisible(true);
    }
  }, [errors, faceitGuid, currentSignature, dismissedSignature]);

  if (!visible || errors.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[92vw] max-w-md rounded-2xl border border-red-500/40 bg-[#2b1010]/95 backdrop-blur-xl shadow-2xl shadow-black/50">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-red-500/20 p-2 border border-red-400/30">
              <AlertTriangle size={16} className="text-red-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-red-200 font-black">Alerta de Status</p>
              <h3 className="text-sm font-bold text-white mt-0.5">
                Foram detectados {errors.length} erro(s) nas verificações
              </h3>
              <p className="text-xs text-zinc-300 mt-1">
                {errors[0].service}: {errors[0].error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDismissedSignature(currentSignature);
              setVisible(false);
            }}
            className="inline-flex items-center justify-center rounded-md border border-white/20 p-1.5 text-zinc-200 hover:text-white hover:bg-white/10"
            aria-label="Fechar alerta"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
