import rawTimes from "@/copadraft-times.json";

export type CopaDraftTeamPlayer = {
  nickname: string;
  faceit_guid: string;
};

export type CopaDraftTeam = {
  nome_time: string;
  jogadores: CopaDraftTeamPlayer[];
};

export function getCopaDraftTimes(): CopaDraftTeam[] {
  if (!Array.isArray(rawTimes)) return [];
  return rawTimes as CopaDraftTeam[];
}

export function getTeamNameByCaptainGuidMap(): Map<string, string> {
  const map = new Map<string, string>();
  const teams = getCopaDraftTimes();

  for (const team of teams) {
    const teamName = String(team?.nome_time || "").trim();
    const captainGuid = String(team?.jogadores?.[0]?.faceit_guid || "")
      .trim()
      .toLowerCase();

    if (teamName && captainGuid) {
      map.set(captainGuid, teamName);
    }
  }

  return map;
}
