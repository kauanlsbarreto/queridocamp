import { getCopaDraftTimes } from "@/lib/copadraft-times";

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function isPlayerInTeam(faceitGuid: string, teamName: string) {
  const wantedGuid = String(faceitGuid || "").trim().toLowerCase();
  const wantedTeam = normalizeText(teamName);
  if (!wantedGuid || !wantedTeam) return false;

  const teams = getCopaDraftTimes();
  const team = teams.find((item) => normalizeText(item?.nome_time) === wantedTeam);
  if (!team) return false;

  return (team.jogadores || []).some(
    (player) => String(player?.faceit_guid || "").trim().toLowerCase() === wantedGuid
  );
}

export function getPlayerTeamSlot(faceitGuid: string, teamName: string) {
  const wantedGuid = String(faceitGuid || "").trim().toLowerCase();
  const wantedTeam = normalizeText(teamName);
  if (!wantedGuid || !wantedTeam) return null;

  const teams = getCopaDraftTimes();
  const team = teams.find((item) => normalizeText(item?.nome_time) === wantedTeam);
  if (!team) return null;

  const slot = (team.jogadores || []).findIndex(
    (player) => String(player?.faceit_guid || "").trim().toLowerCase() === wantedGuid
  );

  if (slot < 0 || slot > 4) return null;
  return slot;
}
