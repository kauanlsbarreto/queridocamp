"use client";

const mockMessages = [
  { id: "1", nickname: "TIME A", body: "rush b agora", createdAt: "2026-03-17T20:15:00.000Z" },
  { id: "2", nickname: "TIME B", body: "segura meio", createdAt: "2026-03-17T20:15:08.000Z" },
  { id: "3", nickname: "TIME A", body: "smoke janela", createdAt: "2026-03-17T20:15:14.000Z" },
  { id: "4", nickname: "TIME B", body: "boa, round nosso", createdAt: "2026-03-17T20:15:29.000Z" },
];

function formatClock(isoDate: string) {
  const date = new Date(isoDate);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ChatOverlayTestPage() {
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
      <div
        style={{
          width: "min(560px, 94vw)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          borderRadius: "14px",
          border: "1px solid rgba(247, 207, 102, 0.72)",
          background: "linear-gradient(180deg, rgba(10, 7, 2, 0.9), rgba(7, 5, 2, 0.84))",
          boxShadow: "inset 0 0 0 1px rgba(128, 88, 16, 0.36), 0 0 20px rgba(247, 207, 102, 0.15)",
        }}
      >
        {mockMessages.map((message) => (
          <div
            key={message.id}
            style={{
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
                textTransform: "uppercase",
              }}
            >
              {message.nickname}
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "#ffffff",
                fontWeight: 600,
                lineHeight: 1.25,
              }}
            >
              {message.body}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
