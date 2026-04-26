import type { Dispatch, SetStateAction } from "react";

export interface Skin {
	weapon_defindex?: number;
	weapon_name?: string;
	paint?: string | number;
	image: string;
	paint_name?: string;
	legacy_model?: boolean;
	agent_name?: string;
	name?: string;
	id?: string;
	team?: number;
	model?: string;
}

export type FaceitUser = {
	id?: number;
	ID?: number;
	faceit_guid?: string;
	steam_id_64?: string;
};

export type Catalog = {
	skins: Skin[];
	gloves: Skin[];
	music: Skin[];
	collectibles: Skin[];
	agents: Skin[];
	stickers: Skin[];
	keychains: Skin[];
};

export type LoadoutResponse = {
	ok: boolean;
	steamid: string;
	loadout: {
		skins: Array<{
			weapon_team: number;
			weapon_defindex: number;
			weapon_paint_id: number;
			weapon_wear: number;
			weapon_seed: number;
			weapon_stattrak: number;
			weapon_stattrak_count: number;
			weapon_nametag: string | null;
			weapon_sticker_0: string | null;
			weapon_sticker_1: string | null;
			weapon_sticker_2: string | null;
			weapon_sticker_3: string | null;
			weapon_sticker_4: string | null;
			weapon_keychain: string | null;
		}>;
		knives: Array<{ weapon_team: number; knife: string }>;
		gloves: Array<{ weapon_team: number; weapon_defindex: number }>;
		music: Array<{ weapon_team: number; music_id: number }>;
		pins: Array<{ weapon_team: number; id: number }>;
		agents: { agent_ct: string | null; agent_t: string | null } | null;
	};
};

export type GridCellProps = {
	filtered: Skin[];
	setConfigSkin: Dispatch<SetStateAction<Skin | null>>;
	setShowConfig: Dispatch<SetStateAction<boolean>>;
	onQuickSave: (item: Skin) => void;
	isSelected: (item: Skin) => boolean;
	tab: string;
};
