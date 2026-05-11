"use client";

import { useMemo, useState } from "react";

type TeamFlagImageProps = {
  teamName: string;
};

export default function TeamFlagImage({ teamName }: TeamFlagImageProps) {
  const [index, setIndex] = useState(0);

  const candidates = useMemo(() => {
    const lower = String(teamName || "").toLowerCase();
    const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const encLower = encodeURIComponent(lower);
    const encNorm = encodeURIComponent(normalized);

    return [
      `/selecoes/${encLower}.jpg`,
      `/selecoes/${encNorm}.jpg`,
      `/selecoes/${encLower}.png`,
      `/selecoes/${encNorm}.png`,
      `/selecoes/${encLower}.webp`,
      `/selecoes/${encNorm}.webp`,
    ];
  }, [teamName]);

  return (
    <img
      src={candidates[index]}
      alt={teamName}
      className="h-6 w-9 rounded-sm border border-white/25 object-cover"
      onError={() => {
        setIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });
      }}
    />
  );
}
