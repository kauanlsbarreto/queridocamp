"use client";

import { useCallback, useState } from "react";
import RankingTable, { type Team } from "./ranking-table";
import UpdateTimer from "@/components/update-timer";

type ClassificacaoLiveProps = {
  initialTeams: Team[];
  initialLastUpdate: string;
};

type ClassificacaoApiResponse = {
  teams: Team[];
  lastUpdate: string;
};

export default function ClassificacaoLive({ initialTeams, initialLastUpdate }: ClassificacaoLiveProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [lastUpdate, setLastUpdate] = useState<string>(initialLastUpdate);

  const refreshClassification = useCallback(async () => {
    const response = await fetch("/api/classificacao", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Falha ao atualizar a classificacao em segundo plano");
    }

    const data = await response.json() as ClassificacaoApiResponse;
    setTeams(data.teams || []);
    if (data.lastUpdate) {
      setLastUpdate(data.lastUpdate);
    }
  }, []);

  return (
    <>
      <UpdateTimer lastUpdate={lastUpdate} onRefresh={refreshClassification} />
      <RankingTable teams={teams} />
    </>
  );
}
