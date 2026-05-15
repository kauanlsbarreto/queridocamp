function toSteamId(value: unknown) {
	return String(value || "").trim();
}

export function buildTeamStatsKillCountIndex(payload: any) {
	const index: Record<string, number> = {};
	const events = Array.isArray(payload?.kills) ? payload.kills : [];

	for (const event of events) {
		const killerSteamId = toSteamId(event?.killerSteamId);
		if (!killerSteamId) continue;
		index[killerSteamId] = (index[killerSteamId] || 0) + 1;
	}

	return index;
}
