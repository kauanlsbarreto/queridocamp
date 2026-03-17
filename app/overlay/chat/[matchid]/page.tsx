"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

interface OverlayChatMessage {
  id: string;
  body: string;
  nickname: string;
  createdAt: string;
}

interface OverlayChatResponse {
  roomId: string | null;
  error?: string;
  messages: OverlayChatMessage[];
}

function formatClock(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MatchChatOverlayPage() {
  const params = useParams();
  const matchId = params.matchid as string;

  const [messages, setMessages] = useState<OverlayChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("faceit_user");
      if (!raw) return;
      const user = JSON.parse(raw);
      const token = user?.accessToken || user?.access_token || "";
      if (token) setAccessToken(String(token));
    } catch (err) {
      console.error("Erro ao ler token Faceit do localStorage:", err);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch(`/api/overlay/chat/${matchId}`, {
        cache: "no-store",
        headers,
      });
      const data = (await response.json()) as OverlayChatResponse;

      if (!response.ok) {
        setError(data.error || "Falha ao buscar chat");
        setLoading(false);
        return;
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(data.error || null);
    } catch (err) {
      console.error("Erro ao buscar chat do overlay:", err);
      setError("Falha ao atualizar chat");
    } finally {
      setLoading(false);
    }
  }, [accessToken, matchId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const visibleMessages = useMemo(() => messages.slice(-8), [messages]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "transparent",
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: "20px",
        overflow: "hidden",
      }}
    >
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          width: "min(560px, 94vw)",
          maxHeight: "62vh",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          borderRadius: "14px",
          border: "1px solid rgba(247, 207, 102, 0.72)",
          background: "linear-gradient(180deg, rgba(10, 7, 2, 0.9), rgba(7, 5, 2, 0.84))",
          boxShadow: "inset 0 0 0 1px rgba(128, 88, 16, 0.36), 0 0 20px rgba(247, 207, 102, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "8px",
            borderBottom: "1px solid rgba(247, 207, 102, 0.2)",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "0.08em",
              fontWeight: 800,
              textTransform: "uppercase",
              color: "#f7cf66",
            }}
          >
            Chat da partida
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "rgba(255,255,255,0.7)",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            match: {matchId.slice(0, 14)}
          </span>
        </div>

        {loading ? (
          <div style={{ color: "#f7cf66", fontSize: "13px", fontWeight: 700 }}>Carregando chat...</div>
        ) : error ? (
          <div style={{ color: "#fca5a5", fontSize: "13px", fontWeight: 700 }}>{error}</div>
        ) : !accessToken ? (
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>
            Faça login com Faceit para liberar o chat da partida.
          </div>
        ) : visibleMessages.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>
            Nenhuma mensagem de player ainda.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              overflowY: "auto",
              paddingRight: "2px",
            }}
          >
            {visibleMessages.map((message) => (
              <div
                key={message.id}
                style={{
                  animation: "slideIn .22s ease-out",
                  display: "grid",
                  gridTemplateColumns: "auto auto 1fr",
                  gap: "8px",
                  alignItems: "baseline",
                  background: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(247, 207, 102, 0.18)",
                  borderRadius: "8px",
                  padding: "7px 9px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.56)",
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {formatClock(message.createdAt)}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#f7cf66",
                    fontWeight: 800,
                    maxWidth: "150px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textTransform: "uppercase",
                  }}
                  title={message.nickname}
                >
                  {message.nickname}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#ffffff",
                    fontWeight: 600,
                    lineHeight: 1.25,
                    wordBreak: "break-word",
                  }}
                >
                  {message.body}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
