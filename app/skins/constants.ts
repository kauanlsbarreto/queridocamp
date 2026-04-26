export const WEAPON_CATEGORIES: Record<string, string> = {
	weapon_ak47: "Rifles",
	weapon_aug: "Rifles",
	weapon_awp: "Rifles",
	weapon_m4a1: "Rifles",
	weapon_m4a1_silencer: "Rifles",
	weapon_famas: "Rifles",
	weapon_galilar: "Rifles",
	weapon_sg556: "Rifles",
	weapon_ssg08: "Rifles",
	weapon_scar20: "Rifles",
	weapon_g3sg1: "Rifles",
	weapon_mac10: "SMGs",
	weapon_mp7: "SMGs",
	weapon_mp5sd: "SMGs",
	weapon_mp9: "SMGs",
	weapon_p90: "SMGs",
	weapon_bizon: "SMGs",
	weapon_ump45: "SMGs",
	weapon_mag7: "Heavy",
	weapon_nova: "Heavy",
	weapon_sawedoff: "Heavy",
	weapon_xm1014: "Heavy",
	weapon_m249: "Heavy",
	weapon_negev: "Heavy",
	weapon_deagle: "Pistols",
	weapon_elite: "Pistols",
	weapon_fiveseven: "Pistols",
	weapon_glock: "Pistols",
	weapon_p2000: "Pistols",
	weapon_p250: "Pistols",
	weapon_usp_silencer: "Pistols",
	weapon_tec9: "Pistols",
	weapon_cz75a: "Pistols",
	weapon_revolver: "Pistols",
	weapon_hkp2000: "Pistols",
	weapon_knife: "Knives",
	weapon_bayonet: "Knives",
	weapon_knife_karambit: "Knives",
	weapon_knife_m9_bayonet: "Knives",
	weapon_knife_butterfly: "Knives",
	weapon_knife_falchion: "Knives",
	weapon_knife_push: "Knives",
	weapon_knife_survival_bowie: "Knives",
	weapon_knife_ursus: "Knives",
	weapon_knife_tactical: "Knives",
	weapon_knife_stiletto: "Knives",
	weapon_knife_widowmaker: "Knives",
};

export const TEAM_TR = 2;
export const TEAM_CT = 3;

type TeamRule = "tr" | "ct" | "both";

const weaponTeamRules: Record<string, TeamRule> = {
	weapon_awp: "both",
	weapon_famas: "ct",
	weapon_m4a1: "ct",
	weapon_m4a1_silencer: "ct",
	weapon_galilar: "tr",
	weapon_ak47: "tr",
	weapon_mac10: "tr",
	weapon_ump45: "ct",
	weapon_mp9: "ct",
	weapon_p90: "ct",
	weapon_deagle: "both",
	weapon_glock: "tr",
	weapon_usp_silencer: "ct",
	weapon_tec9: "tr",
	weapon_cz75a: "both",
	weapon_fiveseven: "ct",
	weapon_nova: "ct",
	weapon_xm1014: "ct",
	weapon_m249: "both",
	weapon_negev: "both",
	weapon_revolver: "both",
	weapon_p250: "both",
	weapon_elite: "both",
	weapon_p2000: "ct",
	weapon_hkp2000: "ct",
};

export const SKIN_TABS = [
	{ key: "skins", label: "Skins", file: "skins" },
	{ key: "agents", label: "Agentes", file: "agents" },
	{ key: "gloves", label: "Luvas", file: "gloves" },
	{ key: "music", label: "Kit de musica", file: "music" },
	{ key: "collectibles", label: "Pins", file: "collectibles" },
] as const;

export const getAllowedTeamsForWeapon = (weaponName?: string): number[] => {
	const normalized = (weaponName || "").toLowerCase();
	if (normalized.includes("knife") || normalized.includes("glove")) {
		return [TEAM_TR, TEAM_CT];
	}

	const rule = weaponTeamRules[normalized] ?? "both";
	if (rule === "tr") return [TEAM_TR];
	if (rule === "ct") return [TEAM_CT];
	return [TEAM_TR, TEAM_CT];
};
