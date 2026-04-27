
	"use client";

	import { useEffect, useMemo, useState } from "react";
	import { Dialog } from "@/components/ui/dialog";
	import { Switch } from "@/components/ui/switch";
	import {
		Select,
		SelectTrigger,
		SelectContent,
		SelectItem,
		SelectValue,
	} from "@/components/ui/select";
	import { Grid } from "react-window";
	import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
	import { SkinGridCell } from "./SkinGridCell";
	import {
		getAllowedTeamsForWeapon,
		SKIN_TABS,
		TEAM_CT,
		TEAM_TR,
		WEAPON_CATEGORIES,
	} from "./constants";
	import type { Catalog, FaceitUser, GridCellProps, LoadoutResponse, Skin } from "./types";

	export default function SkinsPage() {
		type TeamSelection = number | "both";

		const floatPresets: Array<{ label: string; value: number; min: number; max: number }> = [
			{ label: "FN", value: 0.03, min: 0.0, max: 0.07 },
			{ label: "MW", value: 0.11, min: 0.07, max: 0.15 },
			{ label: "FT", value: 0.265, min: 0.15, max: 0.38 },
			{ label: "WW", value: 0.415, min: 0.38, max: 0.45 },
			{ label: "BS", value: 0.725, min: 0.45, max: 1.0 },
		];

		const KNIFE_DEFINDEXES = [500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 525, 526];

		type SaveSettingsPayload = {
			wear: number;
			seed: number;
			stattrak: boolean;
			nametag: string;
			teams?: number[];
			stickers?: string[];
			keychain?: string;
		};

		const getFloatTier = (value: number): string => {
			if (value < 0.07) return "FN";
			if (value < 0.15) return "MW";
			if (value < 0.38) return "FT";
			if (value < 0.45) return "WW";
			return "BS";
		};

		const [tab, setTab] = useState("skins");
		const [data, setData] = useState<Skin[]>([]);
		const [loading, setLoading] = useState(true);
		const [lang, setLang] = useState<"pt-BR" | "en">("pt-BR");
		const [showConfig, setShowConfig] = useState(false);
		const [configSkin, setConfigSkin] = useState<Skin | null>(null);
		const [float, setFloat] = useState("0.0001");
		const [pattern, setPattern] = useState("0");
		const [stattrak, setStattrak] = useState(false);
		const [stattrakCount, setStattrakCount] = useState(0);
		const [nameTag, setNameTag] = useState("");
		const [saving, setSaving] = useState(false);
		const [selectedTeam, setSelectedTeam] = useState<TeamSelection>(TEAM_TR);
		const [loadout, setLoadout] = useState<LoadoutResponse | null>(null);
		const [loadoutLoading, setLoadoutLoading] = useState(false);
		const [catalog, setCatalog] = useState<Catalog>({
			skins: [],
			gloves: [],
			music: [],
			collectibles: [],
			agents: [],
			stickers: [],
			keychains: [],
		});
		const [categoryFilter, setCategoryFilter] = useState<string>("");
		const [weaponFilter, setWeaponFilter] = useState<string>("");
		const [weaponSearch, setWeaponSearch] = useState("");
		const [gloveSearch, setGloveSearch] = useState("");
		const [gloveCategoryFilter, setGloveCategoryFilter] = useState("");
		const [confirmItem, setConfirmItem] = useState<Skin | null>(null);
		const [confirmTab, setConfirmTab] = useState<string>("");
		const [modalInnerTab, setModalInnerTab] = useState<"config" | "stickers" | "keychains">("config");
		const [skinStickers, setSkinStickers] = useState<Array<Skin | null>>([null, null, null, null, null]);
		const [skinKeychain, setSkinKeychain] = useState<Skin | null>(null);
		const [activeStickerSlot, setActiveStickerSlot] = useState<number>(0);
		const [stickerSearch, setStickerSearch] = useState("");
		const [keychainSearch, setKeychainSearch] = useState("");
		const [showGlovesModal, setShowGlovesModal] = useState(false);
		const [selectedGlove, setSelectedGlove] = useState<Skin | null>(null);
		const [gloveTeamSelection, setGloveTeamSelection] = useState<TeamSelection | null>(null);
		const [showKnifeModal, setShowKnifeModal] = useState(false);
		const [selectedKnife, setSelectedKnife] = useState<Skin | null>(null);
		const [knifeTeamSelection, setKnifeTeamSelection] = useState<TeamSelection>("both");

		const closeConfigModal = () => {
			setShowConfig(false);
			setConfigSkin(null);
		};

		const getCurrentUser = (): FaceitUser | null => {
			if (typeof window === "undefined") return null;
			const raw = localStorage.getItem("faceit_user");
			if (!raw) return null;
			try {
				return JSON.parse(raw) as FaceitUser;
			} catch {
				return null;
			}
		};

		const syncSteamIdIfNeeded = async (user: FaceitUser): Promise<FaceitUser> => {
			if (!user.faceit_guid || user.steam_id_64) return user;

			const playerId = Number(user.id ?? user.ID);
			const res = await fetch("/api/players/sync-steamid", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: Number.isFinite(playerId) ? playerId : undefined,
					faceit_guid: user.faceit_guid,
				}),
				cache: "no-store",
			});

			if (!res.ok) return user;
			const json = (await res.json()) as { steamid?: string };
			if (!json?.steamid) return user;

			const updated = { ...user, steam_id_64: json.steamid };
			localStorage.setItem("faceit_user", JSON.stringify(updated));
			return updated;
		};

		const saveSelection = async (selectedItem: Skin, selectedTab: string, teamOverride?: TeamSelection) => {
			if (saving) return;
			const user = getCurrentUser();
			if (!user?.faceit_guid) {
				alert("Faça login com a FACEIT para salvar sua seleção.");
				return;
			}

			setSaving(true);
			try {
				const resolvedUser = await syncSteamIdIfNeeded(user);
				const wear = Number(float);
				const seed = Number(pattern);
				const allowedTeams = getAllowedTeamsForWeapon(selectedItem.weapon_name);
				
				// Para luvas, salva no lado escolhido ou em ambos os lados
				const teamsToSave = selectedTab === "gloves"
					? (teamOverride === "both"
						? [TEAM_TR, TEAM_CT]
						: [Number(teamOverride ?? allowedTeams[0] ?? TEAM_TR)])
					: (
						selectedTab === "skins"
							? teamOverride !== undefined
								? (teamOverride === "both" ? [TEAM_TR, TEAM_CT] : [Number(teamOverride)])
								: allowedTeams.length === 1
									? allowedTeams
									: selectedTeam === "both"
										? [TEAM_TR, TEAM_CT]
										: [selectedTeam]
							: undefined
					);

				const settingsPayload: SaveSettingsPayload = {
					wear: Number.isFinite(wear) ? wear : 0.000001,
					seed: Number.isFinite(seed) ? seed : 0,
					stattrak,
					nametag: nameTag,
					teams: teamsToSave,
					stickers:
						selectedTab === "skins"
							// Inverte para weapon_sticker_0 ser o 4o slot (index 3)
							? [...skinStickers].reverse().map((s) => {
									if (!s) return "0;0;0;0;0;0;0";
									const id = Number(s.weapon_defindex ?? s.id ?? 0);
									return id > 0 ? `${id};0;0;0;0;0;0` : "0;0;0;0;0;0;0";
							  })
							: undefined,
					keychain:
						selectedTab === "skins"
							? (() => {
									if (!skinKeychain) return "0;0;0;0;0";
									const id = Number(skinKeychain.weapon_defindex ?? skinKeychain.id ?? 0);
									return id > 0 ? `${id};0;0;0;0` : "0;0;0;0;0";
							  })()
							: undefined,
				};

				const response = await fetch("/api/weaponpaints/save", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						tab: selectedTab,
						steamid: resolvedUser.steam_id_64,
						faceit_guid: resolvedUser.steam_id_64 ? undefined : resolvedUser.faceit_guid,
						item: selectedItem,
						settings: settingsPayload,
					}),
				});

				if (!response.ok) {
					const err = (await response.json().catch(() => ({}))) as { message?: string };
					throw new Error(err.message || "Falha ao salvar seleção.");
				}

				if (teamsToSave && teamsToSave.length > 0) {
					setLoadout((prev) => {
						if (!prev) return prev;

						const weaponDefindex = Number(selectedItem.weapon_defindex ?? -1);
						const weaponPaintId = Number(selectedItem.paint ?? -1);
						if (weaponDefindex <= 0 || weaponPaintId < 0) return prev;

						const mergedSkins = [
							...prev.loadout.skins.filter(
								(s) => !(s.weapon_defindex === weaponDefindex && teamsToSave.includes(s.weapon_team)),
							),
							...teamsToSave.map((team) => ({
								weapon_team: team,
								weapon_defindex: weaponDefindex,
								weapon_paint_id: weaponPaintId,
								weapon_wear: settingsPayload.wear,
								weapon_seed: settingsPayload.seed,
								weapon_stattrak: settingsPayload.stattrak ? 1 : 0,
								weapon_stattrak_count: stattrakCount,
								weapon_nametag: settingsPayload.nametag || null,
								weapon_sticker_0: settingsPayload.stickers?.[0] ?? null,
								weapon_sticker_1: settingsPayload.stickers?.[1] ?? null,
								weapon_sticker_2: settingsPayload.stickers?.[2] ?? null,
								weapon_sticker_3: settingsPayload.stickers?.[3] ?? null,
								weapon_sticker_4: null,
								weapon_keychain: settingsPayload.keychain ?? null,
							})),
						];

						const mergedGloves =
							selectedTab === "gloves"
								? [
									...prev.loadout.gloves.filter((g) => !teamsToSave.includes(g.weapon_team)),
									...teamsToSave.map((team) => ({ weapon_team: team, weapon_defindex: weaponDefindex })),
								]
								: prev.loadout.gloves;

						return {
							...prev,
							loadout: {
								...prev.loadout,
								skins: mergedSkins,
								gloves: mergedGloves,
							},
						};
					});
				}

				if (selectedTab === "skins") {
					closeConfigModal();
				}
				if (selectedTab === "skins" && showKnifeModal) {
					setShowKnifeModal(false);
					setSelectedKnife(null);
					setKnifeTeamSelection("both");
				}
				if (selectedTab === "gloves") {
					setShowGlovesModal(false);
					setSelectedGlove(null);
					setGloveTeamSelection(null);
				}
				void fetchLoadout();
			} catch (error) {
				alert(error instanceof Error ? error.message : "Erro ao salvar seleção.");
			} finally {
				setSaving(false);
			}
		};

		const fetchLoadout = async () => {
			const user = getCurrentUser();
			if (!user?.faceit_guid) {
				setLoadout(null);
				return;
			}

			setLoadoutLoading(true);
			try {
				const resolvedUser = await syncSteamIdIfNeeded(user);
				const query = new URLSearchParams();
				if (resolvedUser.steam_id_64) query.set("steamid", resolvedUser.steam_id_64);
				if (!resolvedUser.steam_id_64 && resolvedUser.faceit_guid) query.set("faceit_guid", resolvedUser.faceit_guid);

				const response = await fetch(`/api/weaponpaints/loadout?${query.toString()}`, {
					cache: "no-store",
				});

				if (!response.ok) {
					setLoadout(null);
					return;
				}

				const json = (await response.json()) as LoadoutResponse;
				setLoadout(json);
			} catch {
				setLoadout(null);
			} finally {
				setLoadoutLoading(false);
			}
		};

		const categories = SKIN_TABS;

		useEffect(() => {
			const file = categories.find((c) => c.key === tab)?.file;
			if (!file) return;
			setLoading(true);
			const fileLang = tab === "agents" ? "en" : lang;
			fetch(`/skins-data/${file}_${fileLang}.json`)
				.then((res) => res.json())
				.then((result: Skin[]) => {
					setData(result);
					setLoading(false);
				})
				.catch(() => setLoading(false));
		}, [tab, lang]);

		useEffect(() => {
			let active = true;
			   Promise.all([
				   fetch(`/skins-data/skins_${lang}.json`).then((r) => r.json()),
				   fetch(`/skins-data/gloves_${lang}.json`).then((r) => r.json()),
				   fetch(`/skins-data/music_${lang}.json`).then((r) => r.json()),
				   fetch(`/skins-data/collectibles_${lang}.json`).then((r) => r.json()),
				   fetch(`/skins-data/agents_en.json`).then((r) => r.json()),
				   fetch(`/skins-data/stickers_${lang}.json`).then((r) => r.json()).catch(() => []),
				   fetch(`/skins-data/keychains_${lang}.json`).then((r) => r.json()).catch(() => []),
				   fetch(`/skins-data/stickers_en.json`).then((r) => r.json()).catch(() => []),
				   fetch(`/skins-data/keychains_en.json`).then((r) => r.json()).catch(() => []),
			   ])
				   .then(([
					   skinsJson,
					   glovesJson,
					   musicJson,
					   collectiblesJson,
					   agentsJson,
					   stickersJson,
					   keychainsJson,
					   stickersEnJson,
					   keychainsEnJson,
				   ]) => {
					   if (!active) return;
					   // Mesclar stickers e keychains, removendo duplicatas por id
					   const mergeById = (arr1: any[], arr2: any[]) => {
						   const map = new Map();
						   [...arr1, ...arr2].forEach((item) => {
							   if (!item) return;
							   map.set(item.id || item.weapon_defindex || item.name, item);
						   });
						   return Array.from(map.values());
					   };
					   setCatalog({
						   skins: skinsJson as Skin[],
						   gloves: glovesJson as Skin[],
						   music: musicJson as Skin[],
						   collectibles: collectiblesJson as Skin[],
						   agents: agentsJson as Skin[],
						   stickers: mergeById(stickersJson as Skin[], stickersEnJson as Skin[]),
						   keychains: mergeById(keychainsJson as Skin[], keychainsEnJson as Skin[]),
					   });
				   })
				   .catch(() => {
					   if (!active) return;
					   setCatalog({ skins: [], gloves: [], music: [], collectibles: [], agents: [], stickers: [], keychains: [] });
				   });

			return () => {
				active = false;
			};
		}, [lang]);

		useEffect(() => {
			const user = getCurrentUser();
			if (!user) return;
			void syncSteamIdIfNeeded(user);
			void fetchLoadout();

			// Auto-refresh loadout a cada 30 segundos
			const interval = setInterval(() => {
				void fetchLoadout();
			}, 10000);

			return () => clearInterval(interval);
		}, []);

		const selectedSkinKeys = useMemo(
			() =>
				new Set(
					(loadout?.loadout.skins || []).map(
						(s) => `${s.weapon_defindex}:${s.weapon_paint_id}`,
					),
				),
			[loadout],
		);

		const selectedGloves = useMemo(
			() => {
				// Para luvas, cria chaves combinando defindex + paint_id dos items salvo em skins
				// (já que luvas são salvas também em wp_player_skins)
				const gloveKeys = new Set<string>();
				if (loadout?.loadout.skins) {
					// Procura por items que são luvas (weapon_defindex: 4725, 5027, 5030-5035)
					const gloveDefindexes = [4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035];
					loadout.loadout.skins.forEach((s) => {
						if (gloveDefindexes.includes(s.weapon_defindex)) {
							gloveKeys.add(`${s.weapon_defindex}:${s.weapon_paint_id}`);
						}
					});
				}
				return gloveKeys;
			},
			[loadout],
		);

		const selectedMusic = useMemo(
			() => new Set((loadout?.loadout.music || []).map((m) => m.music_id)),
			[loadout],
		);

		const selectedPins = useMemo(
			() => new Set((loadout?.loadout.pins || []).map((p) => p.id)),
			[loadout],
		);

		const isSelectedItem = (item: Skin): boolean => {
			if (tab === "skins") {
				const def = Number(item.weapon_defindex ?? -1);
				const paint = Number(item.paint ?? -1);
				return selectedSkinKeys.has(`${def}:${paint}`);
			}
			if (tab === "gloves") {
				const def = Number(item.weapon_defindex ?? -1);
				const paint = Number(item.paint ?? -1);
				return selectedGloves.has(`${def}:${paint}`);
			}
			if (tab === "music") {
				return selectedMusic.has(Number(item.id ?? -1));
			}
			if (tab === "collectibles") {
				return selectedPins.has(Number(item.id ?? -1));
			}
			if (tab === "agents") {
				const ct = loadout?.loadout.agents?.agent_ct ?? null;
				const t = loadout?.loadout.agents?.agent_t ?? null;
				const team = Number(item.team ?? 0);
				if (team === 3) return (item.model || "null") === (ct || "null");
				if (team === 2) return (item.model || "null") === (t || "null");
			}
			return false;
		};

		useEffect(() => {
			if (!configSkin) {
				setModalInnerTab("config");
				setActiveStickerSlot(0);
				setStickerSearch("");
				setKeychainSearch("");
				return;
			}
			setModalInnerTab("config");
			setActiveStickerSlot(0);
			setStickerSearch("");
			setKeychainSearch("");
		}, [configSkin]);

		useEffect(() => {
			if (!configSkin) return;

			const allowedTeams = getAllowedTeamsForWeapon(configSkin.weapon_name);
			if (allowedTeams.length === 1 && selectedTeam !== allowedTeams[0]) {
				setSelectedTeam(allowedTeams[0]);
				return;
			}

			if (allowedTeams.length > 1 && selectedTeam !== "both" && !allowedTeams.includes(selectedTeam as number)) {
				setSelectedTeam(allowedTeams[0]);
				return;
			}

			const activeTeam = selectedTeam === "both" ? allowedTeams[0] : (selectedTeam as number);

			if (!loadout) {
				setFloat("0.0001");
				setPattern("0");
				setStattrak(false);
				setStattrakCount(0);
				setNameTag("");
				setSkinStickers([null, null, null, null]);
				setSkinKeychain(null);
				return;
			}

			const def = Number(configSkin.weapon_defindex ?? -1);
			const paint = Number(configSkin.paint ?? -1);

			const exact = loadout.loadout.skins.find(
				(s) =>
					s.weapon_team === activeTeam &&
					s.weapon_defindex === def &&
					s.weapon_paint_id === paint,
			);
			const byDefindex = loadout.loadout.skins.find(
				(s) => s.weapon_team === activeTeam && s.weapon_defindex === def,
			);
			const selected = exact || byDefindex;

			if (!selected) {
				setFloat("0.0001");
				setPattern("0");
				setStattrak(false);
				setStattrakCount(0);
				setNameTag("");
				setSkinStickers([null, null, null, null]);
				setSkinKeychain(null);
				return;
			}

			setFloat(String(selected.weapon_wear ?? 0.000001));
			setPattern(String(selected.weapon_seed ?? 0));
			setStattrak(Boolean(selected.weapon_stattrak));
			setStattrakCount(Number(selected.weapon_stattrak_count ?? 0));
			setNameTag(selected.weapon_nametag || "");

			// Load sticker slots from saved loadout
			const stickerKeys = [
				"weapon_sticker_0",
				"weapon_sticker_1",
				"weapon_sticker_2",
				"weapon_sticker_3",
			] as const;
			const newStickers: Array<Skin | null> = [null, null, null, null];
			for (let i = 0; i < 4; i++) {
				const val = selected[stickerKeys[i]];
				if (val) {
					const stickerId = Number(val.split(";")[0]);
					if (stickerId > 0) {
						// Mapeamento inverso: sticker_0 -> slot 4 (index 3)
						newStickers[3 - i] =
							catalog.stickers.find(
								(s) => Number(s.weapon_defindex ?? s.id ?? -1) === stickerId,
							) ?? null;
					}
				}
			}
			setSkinStickers(newStickers);

			const keychainVal = selected.weapon_keychain;
			if (keychainVal) {
				const keychainId = Number(keychainVal.split(";")[0]);
				setSkinKeychain(
					keychainId > 0
						? (catalog.keychains.find(
								(k) => Number(k.weapon_defindex ?? k.id ?? -1) === keychainId,
							) ?? null)
						: null,
				);
			} else {
				setSkinKeychain(null);
			}
		}, [configSkin, loadout, selectedTeam, catalog]);

		const deleteLoadoutItem = async (deleteData: {
			type: string;
			weapon_team?: number;
			weapon_defindex?: number;
		}) => {
			const user = getCurrentUser();
			if (!user?.faceit_guid) return;
			const resolvedUser = await syncSteamIdIfNeeded(user);
			await fetch("/api/weaponpaints/loadout", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...deleteData,
					faceit_guid: resolvedUser.faceit_guid,
					steamid: resolvedUser.steam_id_64,
				}),
			});
			await fetchLoadout();
		};

		type LoadoutCard = {
			key: string;
			title: string;
			subtitle: string;
			image: string;
			deleteData: { type: string; weapon_team?: number; weapon_defindex?: number };
		};

		const loadoutCards = useMemo(() => {
			if (!loadout) return [] as LoadoutCard[];

			const cards: LoadoutCard[] = [];
			const gloveDefindexes = new Set([4725, 5027, 5030, 5031, 5032, 5033, 5034, 5035]);
			const knifeDefindexes = new Set([500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 525, 526]);

			for (const s of loadout.loadout.skins) {
				if (gloveDefindexes.has(s.weapon_defindex) || knifeDefindexes.has(s.weapon_defindex)) continue;
				const item = catalog.skins.find(
					(i) =>
						Number(i.weapon_defindex) === s.weapon_defindex &&
						Number(i.paint) === s.weapon_paint_id,
				);
				cards.push({
					key: `skin-${s.weapon_team}-${s.weapon_defindex}`,
					title: item?.paint_name || `Skin ${s.weapon_defindex}:${s.weapon_paint_id}`,
					subtitle: s.weapon_team === 2 ? "T" : "CT",
					image: item?.image || "",
					deleteData: { type: "skin", weapon_team: s.weapon_team, weapon_defindex: s.weapon_defindex },
				});
			}

			for (const k of loadout.loadout.knives) {
				const knifeTemplate = catalog.skins.find((i) => i.weapon_name === k.knife);
				const knifeDefindex = Number(knifeTemplate?.weapon_defindex ?? -1);
				const knifeSkin = loadout.loadout.skins.find(
					(s) => s.weapon_team === k.weapon_team && s.weapon_defindex === knifeDefindex,
				);
				const item = catalog.skins.find(
					(i) =>
						Number(i.weapon_defindex) === knifeDefindex &&
						Number(i.paint ?? -1) === Number(knifeSkin?.weapon_paint_id ?? -1),
				) || knifeTemplate;
				cards.push({
					key: `knife-${k.weapon_team}`,
					title: item?.paint_name || k.knife,
					subtitle: k.weapon_team === 2 ? "T" : "CT",
					image: item?.image || "",
					deleteData: { type: "knife", weapon_team: k.weapon_team, weapon_defindex: knifeDefindex > 0 ? knifeDefindex : undefined },
				});
			}

			for (const g of loadout.loadout.gloves) {
				const gloveSkin = loadout.loadout.skins.find(
					(s) => s.weapon_team === g.weapon_team && s.weapon_defindex === g.weapon_defindex,
				);
				const item = catalog.gloves.find(
					(i) =>
						Number(i.weapon_defindex) === g.weapon_defindex &&
						Number(i.paint ?? -1) === Number(gloveSkin?.weapon_paint_id ?? -1),
				) || catalog.gloves.find((i) => Number(i.weapon_defindex) === g.weapon_defindex);
				cards.push({
					key: `glove-${g.weapon_team}`,
					title: item?.paint_name || `Glove ${g.weapon_defindex}${gloveSkin ? `:${gloveSkin.weapon_paint_id}` : ""}`,
					subtitle: g.weapon_team === 2 ? "T" : "CT",
					image: item?.image || "",
					deleteData: { type: "glove", weapon_team: g.weapon_team, weapon_defindex: g.weapon_defindex },
				});
			}

			for (const m of loadout.loadout.music) {
				const item = catalog.music.find((i) => Number(i.id) === m.music_id);
				cards.push({
					key: `music-${m.weapon_team}`,
					title: item?.name || `Music ${m.music_id}`,
					subtitle: m.weapon_team === 2 ? "T" : "CT",
					image: item?.image || "",
					deleteData: { type: "music", weapon_team: m.weapon_team },
				});
			}

			for (const p of loadout.loadout.pins) {
				const item = catalog.collectibles.find((i) => Number(i.id) === p.id);
				cards.push({
					key: `pin-${p.weapon_team}`,
					title: item?.name || `Pin ${p.id}`,
					subtitle: p.weapon_team === 2 ? "T" : "CT",
					image: item?.image || "",
					deleteData: { type: "pin", weapon_team: p.weapon_team },
				});
			}

			if (loadout.loadout.agents?.agent_ct !== undefined) {
				const ctModel = loadout.loadout.agents.agent_ct || "null";
				const ctItem = catalog.agents.find(
					(i) => Number(i.team) === 3 && (i.model || "null") === ctModel,
				);
				cards.push({
					key: "agent-ct",
					title: ctItem?.agent_name || "Agent CT",
					subtitle: "CT",
					image: ctItem?.image || "",
					deleteData: { type: "agent" },
				});
			}

			if (loadout.loadout.agents?.agent_t !== undefined) {
				const tModel = loadout.loadout.agents.agent_t || "null";
				const tItem = catalog.agents.find(
					(i) => Number(i.team) === 2 && (i.model || "null") === tModel,
				);
				cards.push({
					key: "agent-t",
					title: tItem?.agent_name || "Agent T",
					subtitle: "T",
					image: tItem?.image || "",
					deleteData: { type: "agent" },
				});
			}

			return cards;
		}, [catalog, loadout]);

		let filtered = data;
		if (tab === "skins") {
			if (categoryFilter) {
				// Filtra skins que pertencem à categoria selecionada
				filtered = filtered.filter((s) => {
					const weaponCategory = weaponToCategoryMap.get(s.weapon_name ?? "") || "Outros";
					return weaponCategory === categoryFilter;
				});
			}
			if (weaponFilter) {
				// Filtra pelo nome da arma específico
				filtered = filtered.filter((s) => s.weapon_name === weaponFilter);
			}
			if (weaponSearch) {
				// Busca textual no nome da pintura
				filtered = filtered.filter((s) =>
					(s.paint_name || "").toLowerCase().includes(weaponSearch.toLowerCase()),
				);
			}
		}
		if (tab === "gloves") {
			if (gloveCategoryFilter) {
				// Mapeamento de tipo de luva para weapon_defindex
				const gloveTypeMap: Record<string, number> = {
					"Sport Gloves": 5030,
					"Driver Gloves": 5031,
					"Hand Wraps": 5032,
					"Moto Gloves": 5033,
					"Specialist Gloves": 5034,
					"Hydra Gloves": 5035,
					"Bloodhound Gloves": 5027,
					"Broken Fang Gloves": 4725,
				};
				const targetDefindex = gloveTypeMap[gloveCategoryFilter];
				if (targetDefindex) {
					filtered = filtered.filter((s) => Number(s.weapon_defindex ?? -1) === targetDefindex);
				}
			}
			if (gloveSearch) {
				filtered = filtered.filter((s) =>
					(s.paint_name || "").toLowerCase().includes(gloveSearch.toLowerCase()),
				);
			}
		}

		// Extrai weapons únicos do JSON diretamente
		const allWeapons = useMemo(
			() => Array.from(new Set(data.map((s) => s.weapon_name))).filter(Boolean) as string[],
			[data],
		);

		// Cria mapa dinâmico weapon_name -> categoria baseado nos dados reais
		const weaponToCategoryMap = useMemo(() => {
			const map = new Map<string, string>();
			allWeapons.forEach((weapon) => {
				const category = WEAPON_CATEGORIES[weapon] || "Outros";
				map.set(weapon, category);
			});
			return map;
		}, [allWeapons]);

		const KNIFE_LABELS: Record<string, { en: string; pt: string }> = {
			weapon_knife_karambit: { en: "★ Karambit", pt: "★ Karambit" },
			weapon_knife_m9_bayonet: { en: "★ M9 Bayonet", pt: "★ Baioneta M9" },
			weapon_bayonet: { en: "★ Bayonet", pt: "★ Baioneta" },
			weapon_knife_butterfly: { en: "★ Butterfly Knife", pt: "★ Canivete Butterfly" },
			weapon_knife_widowmaker: { en: "★ Talon Knife", pt: "★ Faca Talon" },
			weapon_knife_skeleton: { en: "★ Skeleton Knife", pt: "★ Faca Esqueleto" },
			weapon_knife_outdoor: { en: "★ Nomad Knife", pt: "★ Faca Nomad" },
			weapon_knife_cord: { en: "★ Paracord Knife", pt: "★ Faca Paracord" },
			weapon_knife_css: { en: "★ Classic Knife", pt: "★ Faca Classica" },
			weapon_knife_kukri: { en: "★ Kukri Knife", pt: "★ Faca Kukri" },
			weapon_knife_stiletto: { en: "★ Stiletto Knife", pt: "★ Faca Stiletto" },
			weapon_knife_ursus: { en: "★ Ursus Knife", pt: "★ Faca Ursus" },
			weapon_knife_tactical: { en: "★ Huntsman Knife", pt: "★ Faca Huntsman" },
			weapon_knife_survival_bowie: { en: "★ Bowie Knife", pt: "★ Faca Bowie" },
			weapon_knife_falchion: { en: "★ Falchion Knife", pt: "★ Faca Falchion" },
			weapon_knife_flip: { en: "★ Flip Knife", pt: "★ Faca de Sobrevivencia" },
			weapon_knife_gut: { en: "★ Gut Knife", pt: "★ Faca de Esfolar" },
			weapon_knife_canis: { en: "★ Survival Knife", pt: "★ Faca de Sobrevivencia" },
			weapon_knife_gypsy_jackknife: { en: "★ Navaja Knife", pt: "★ Canivete Navaja" },
			weapon_knife_push: { en: "★ Shadow Daggers", pt: "★ Adagas Sombrias" },
		};
		const getWeaponDisplayName = (weaponName: string) => {
			const knifeLabel = KNIFE_LABELS[weaponName];
			if (knifeLabel) return lang === "pt-BR" ? knifeLabel.pt : knifeLabel.en;
			return weaponName.replace("weapon_", "").toUpperCase();
		};
		// Agrupa categorias únicas pelos weapons que existem nos dados
		const allCategories = useMemo(
			() => Array.from(new Set(allWeapons.map((w) => weaponToCategoryMap.get(w) || "Outros"))),
			[allWeapons, weaponToCategoryMap],
		);

		const gridRows = Math.ceil(filtered.length / 4);
		const floatValue = Number(float);
		const safeFloatValue = Number.isFinite(floatValue) ? Math.min(Math.max(floatValue, 0), 1) : 0.0001;
		const floatTier = getFloatTier(safeFloatValue);
		const isKnifeConfigSkin = Boolean(
			configSkin && tab === "skins" && KNIFE_DEFINDEXES.includes(Number(configSkin.weapon_defindex ?? -1)),
		);

		// eslint-disable-next-line react-hooks/exhaustive-deps
		const isSkinAlreadySaved = useMemo(() => {
			if (!configSkin || !loadout) return false;
			const def = Number(configSkin.weapon_defindex ?? -1);
			const activeTeam = selectedTeam === "both" ? 0 : Number(selectedTeam);
			
			// Verifica se já existe QUALQUER pintura para esta arma neste time
			// Se activeTeam for 0 (ambos), verificamos se existe em qualquer um dos dois
			return loadout.loadout.skins.some(
				(s) => s.weapon_defindex === def && (activeTeam === 0 || s.weapon_team === activeTeam)
			);
		}, [configSkin, loadout, selectedTeam]);

		const buttonText = useMemo(() => {
			if (saving) return "Salvando...";
			
			// Se a skin já existe no loadout ou se o usuário configurou algo (adesivos/chaveiro)
			const hasAdditions = skinStickers.some(s => s !== null) || skinKeychain !== null;
			
			if (isSkinAlreadySaved || hasAdditions) return "✎  Editar";
			return "+ Adicionar";
		}, [saving, isSkinAlreadySaved, skinStickers, skinKeychain]);

		return (
			<div className="w-full min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
				<div className="container mx-auto py-8">
					<div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
						<div className="mb-2 flex items-center justify-between">
							<h2 className="text-lg font-semibold text-orange-300">Meu Loadout</h2>
							<button
								className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
								onClick={() => void fetchLoadout()}
								disabled={loadoutLoading}
							>
								{loadoutLoading ? "Atualizando..." : "Atualizar"}
							</button>
						</div>

						{loadout ? (
							<div>
								<div className="mb-3 text-xs text-zinc-400">SteamID: <span className="font-mono text-zinc-200">{loadout.steamid}</span></div>
								<div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
									{loadoutCards.map((card) => (
										<div key={card.key} className="relative rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center">
											<button
												className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-zinc-500 hover:bg-red-900/40 hover:text-red-400"
												title="Remover"
												onClick={() => void deleteLoadoutItem(card.deleteData)}
											>
												✕
											</button>
											{card.image ? (
												<img src={card.image} alt={card.title} className="mx-auto mb-2 h-14 w-14 object-contain" />
											) : (
												<div className="mx-auto mb-2 h-14 w-14 rounded bg-zinc-900" />
											)}
											<div className="text-xs font-semibold text-zinc-100 line-clamp-2">{card.title}</div>
											<div className="text-[10px] text-zinc-400 mt-1">{card.subtitle}</div>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="text-sm text-zinc-400">Nenhum loadout encontrado para o usuário atual.</div>
						)}
					</div>

					<Tabs defaultValue={tab} value={tab} onValueChange={setTab} className="mb-6">
						<TabsList className="flex w-full justify-between bg-zinc-900 rounded-lg p-1 mb-4">
							{categories.map((cat) => (
								<TabsTrigger
									key={cat.key}
									value={cat.key}
									className="flex-1 text-lg font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-orange-400"
								>
									{cat.label}
								</TabsTrigger>
							))}
							<div className="flex items-center ml-4 gap-2">
								<span className="text-xs">Idioma:</span>
								<Select value={lang} onValueChange={(v) => setLang(v as "pt-BR" | "en")}>
									<SelectTrigger className="w-20 h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="pt-BR">Português</SelectItem>
										<SelectItem value="en">Ingles</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</TabsList>

						<div className="flex gap-8">
							{tab === "skins" && (
								<aside className="w-64 bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex-shrink-0">
									<div className="mb-6">
										<div className="font-bold mb-2 text-orange-400">Categorias</div>
										<div className="flex flex-col gap-1">
											{allCategories.map((cat) => (
												<label key={cat} className="flex items-center gap-2 cursor-pointer">
													<input
														type="radio"
														className="accent-orange-500"
														checked={categoryFilter === cat}
														onChange={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
													/>
													<span>{cat}</span>
												</label>
											))}
										</div>
									</div>
									<div>
										<div className="font-bold mb-2 text-orange-400">Armas</div>
										<input
											type="text"
											placeholder="Buscar armas..."
											className="w-full mb-2 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-white"
											value={weaponSearch}
											onChange={(e) => setWeaponSearch(e.target.value)}
										/>
										<div className="max-h-48 overflow-y-auto flex flex-col gap-1">
											{allWeapons
												.filter((w) => {
													if (!weaponSearch) return true;
													const term = weaponSearch.toLowerCase();
													return w.toLowerCase().includes(term) || getWeaponDisplayName(w).toLowerCase().includes(term);
												})
												.map((w) => (
													<label key={w} className="flex items-center gap-2 cursor-pointer">
														<input
															type="radio"
															className="accent-orange-500"
															checked={weaponFilter === w}
															onChange={() => setWeaponFilter(weaponFilter === w ? "" : w)}
														/>
														<span>{getWeaponDisplayName(w)}</span>
													</label>
												))}
										</div>
									</div>
								</aside>
							)}

							{tab === "gloves" && (
								<aside className="w-56 flex-shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
									<div className="mb-4">
										<div className="mb-2 font-bold text-orange-400">Tipo</div>
										<div className="flex flex-col gap-1">
											<label className="flex cursor-pointer items-center gap-2">
												<input
													type="radio"
													className="accent-orange-500"
													checked={gloveCategoryFilter === ""}
													onChange={() => setGloveCategoryFilter("")}
												/>
												<span>Todos</span>
											</label>
											{/* Tipos de luva fixos, conforme solicitado */}
											{[
												{ label: "Sport Gloves", value: "Sport Gloves", defindex: 5030 },
												{ label: "Driver Gloves", value: "Driver Gloves", defindex: 5031 },
												{ label: "Hand Wraps", value: "Hand Wraps", defindex: 5032 },
												{ label: "Moto Gloves", value: "Moto Gloves", defindex: 5033 },
												{ label: "Specialist Gloves", value: "Specialist Gloves", defindex: 5034 },
												{ label: "Hydra Gloves", value: "Hydra Gloves", defindex: 5035 },
												{ label: "Bloodhound Gloves", value: "Bloodhound Gloves", defindex: 5027 },
												{ label: "Broken Fang Gloves", value: "Broken Fang Gloves", defindex: 4725 },
											].map(({ label, value }) => (
												<label key={value} className="flex cursor-pointer items-center gap-2">
													<input
														type="radio"
														className="accent-orange-500"
														checked={gloveCategoryFilter === value}
														onChange={() => {
															setGloveCategoryFilter(gloveCategoryFilter === value ? "" : value);
														}}
													/>
													<span className="text-sm">{label}</span>
												</label>
											))}
										</div>
									</div>
									<div>
										<div className="mb-2 font-bold text-orange-400">Buscar</div>
										<input
											type="text"
											placeholder="Buscar luvas..."
											className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-white"
											value={gloveSearch}
											onChange={(e) => setGloveSearch(e.target.value)}
										/>
									</div>
								</aside>
							)}

							<div className="flex-1">
								{loading ? (
									<div className="p-8">Carregando...</div>
								) : (
									<Grid<GridCellProps>
										columnCount={4}
										rowCount={gridRows}
										columnWidth={260}
										rowHeight={340}
										cellComponent={SkinGridCell}
										cellProps={{
											filtered,
											setConfigSkin: (item) => {
												if (tab === "gloves") {
													setConfigSkin(item);
													setShowConfig(true);
												} else {
													setConfigSkin(item);
													setShowConfig(true);
												}
											},
											setShowConfig,
											onQuickSave: (item) => {
												if (tab === "music" || tab === "collectibles") {
													setConfirmItem(item);
													setConfirmTab(tab);
												} else if (tab === "gloves") {
													// Abre o modal de seleção de side para luvas
													setSelectedGlove(item);
													setGloveTeamSelection(null);
													setShowGlovesModal(true);
												} else if (tab === "skins" && Number(item.weapon_defindex ?? -1) > 0 && [500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 525, 526].includes(Number(item.weapon_defindex))) {
													setSelectedKnife(item);
													setKnifeTeamSelection("both");
													setFloat("0.0001");
													setPattern("0");
													setStattrak(false);
													setStattrakCount(0);
													setNameTag("");
													setShowKnifeModal(true);
												} else {
													void saveSelection(item, tab);
												}
											},
											isSelected: isSelectedItem,
											tab,
										}}
										style={{ height: 900, width: 1100, overflowX: "auto" }}
									/>
								)}
							</div>
						</div>


						   <Dialog open={showConfig} onOpenChange={(open) => {
							   if (!open) closeConfigModal();
						   }}>
							   {configSkin && (
								   <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6">
									   <div className="flex h-[800px] w-full max-w-[1440px] overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl">
										   {/* LEFT: Preview panel */}
										   <div className="flex w-[480px] flex-shrink-0 flex-col bg-[#0d0f16]">
											   <div className="px-5 pt-5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
												   Pré-visualização
											   </div>
											   <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-2">
												   <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(200,80,0,0.18)_0%,_transparent_70%)]" />
												   <img
													   src={configSkin.image}
													   alt={configSkin.paint_name}
													   className="relative z-10 max-h-44 w-full object-contain drop-shadow-2xl"
												   />
											   </div>
											   <div className="px-5 pb-3 text-center text-base font-bold text-white">
												   {configSkin.paint_name}
											   </div>
											   {tab === "skins" && (
											   <div className="grid grid-cols-4 gap-3 px-5 pb-3">
												   {[0, 1, 2, 3].map((i) => (
													   <button
														   key={i}
														   type="button"
														   className={`flex h-14 items-center justify-center rounded-md border-2 border-dashed text-xs transition ${
															   skinStickers[i]
																   ? "border-zinc-600 bg-zinc-800/60"
																   : "border-zinc-700/50 bg-zinc-900/30 text-zinc-600 hover:border-zinc-500"
														   }`}
														   onClick={() => {
															   setModalInnerTab("stickers");
															   setActiveStickerSlot(i);
														   }}
													   >
														   {skinStickers[i] ? (
															   <img
																   src={skinStickers[i]!.image}
																   alt=""
																   className="h-10 w-10 object-contain"
															   />
														   ) : (
															   <span>Slot {i + 1}</span>
														   )}
													   </button>
												   ))}
											   </div>
											   )}
											   <div className="flex divide-x divide-zinc-800 border-t border-zinc-800 bg-zinc-950/50">
												   {([
													   ["StatTrak™", stattrak ? "Ativo" : "—"],
													   ["Float", safeFloatValue.toFixed(4)],
													   ["Pattern", `#${pattern || "0"}`],
													   ["Team", selectedTeam === "both" ? "both" : selectedTeam === TEAM_TR ? "TR" : "CT"],
												   ] as [string, string][]).map(([label, value]) => (
													   <div key={label} className="flex flex-1 flex-col items-center py-2">
														   <span className="text-[9px] uppercase text-zinc-600">{label}</span>
														   <span className="text-[10px] font-semibold text-zinc-300">{value}</span>
													   </div>
												   ))}
											   </div>
											   <button
												   type="button"
												   className="mx-4 my-3 rounded-lg bg-orange-600 py-3 font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
												   onClick={() => {
													   if (!configSkin) return;
													   void saveSelection(configSkin, "skins");
												   }}
												   disabled={saving}
											   >
												   {buttonText}
											   </button>
										   </div>
										   {/* RIGHT: Config panel */}
										   <div className="flex flex-1 flex-col bg-[#13161e] min-w-0">
											   <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 pt-3 pb-0">
												   <div className="flex gap-1">
													   {(
														   isKnifeConfigSkin
															   ? [["config", "Configurações"]]
															   : [["config", "Configurações"], ["stickers", "Adesivos"], ["keychains", "Chaveiros"]]
													   ).map(([key, label]) => (
														   <button
															   key={key}
															   type="button"
															   className={`rounded-t px-5 py-2.5 text-sm font-semibold transition ${
																   modalInnerTab === key
																	   ? "bg-zinc-800 text-white"
																	   : "text-zinc-500 hover:text-zinc-300"
															   }`}
															   onClick={() => setModalInnerTab(key as "config" | "stickers" | "keychains")}
														   >
															   {label}
														   </button>
													   ))}
												   </div>
												   <button
													   type="button"
													   className="mb-1 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
													   onClick={closeConfigModal}
												   >
													   ✕
												   </button>
											   </div>
											   <div className="flex-1 overflow-y-auto px-6 py-5 min-w-0">
												   {/* — Configurações — */}
												   {modalInnerTab === "config" && tab === "gloves" && (
													   <div className="space-y-5">
														   {/* Side selector */}
														   {(() => {
															   const allowedTeams = getAllowedTeamsForWeapon(configSkin.weapon_name);
															   if (allowedTeams.length === 1) return null;
															   return (
																   <div>
																	   <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Lado</div>
																	   <div className="flex gap-2">
																		   {[
																			   [TEAM_TR, "TR"],
																			   [TEAM_CT, "CT"],
																			   ["both", "Ambos"],
																		   ].map(([val, label]) => (
																			   <button
																				   key={String(val)}
																				   type="button"
																				   className={`rounded-md border px-4 py-1.5 text-sm font-medium transition ${
																					   selectedTeam === val
																						   ? "border-orange-500 bg-orange-600/20 text-orange-300"
																						   : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
																				   }`}
																				   onClick={() => setSelectedTeam(val as typeof selectedTeam)}
																			   >
																				   {label as string}
																			   </button>
																		   ))}
																	   </div>
																   </div>
															   );
														   })()}
													   </div>
												   )}
												   {modalInnerTab === "config" && tab !== "gloves" && (
													   <div className="space-y-5">
														   {tab === "skins" && (
															   <>
																   <div>
																	   <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Lado</div>
																	   <div className="flex gap-2">
																		   {[[TEAM_TR, "TR"], [TEAM_CT, "CT"], ["both", "Ambos"]].map(([val, label]) => (
																			   <button
																				   key={String(val)}
																				   type="button"
																				   className={`rounded-md border px-4 py-1.5 text-sm font-medium transition ${
																					   selectedTeam === val
																						   ? "border-orange-500 bg-orange-600/20 text-orange-300"
																						   : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
																				 }`}
																				 onClick={() => setSelectedTeam(val as TeamSelection)}
																			   >
																				   {label as string}
																			   </button>
																		   ))}
																	   </div>
																   </div>

																   <div>
																	   <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Float ({floatTier})</div>
																	   <div className="mb-3 flex flex-wrap gap-2">
																		   {floatPresets.map((preset) => (
																			   <button
																				   key={preset.label}
																				   type="button"
																				   className={`rounded border px-2 py-1 text-xs transition ${
																					   safeFloatValue >= preset.min && safeFloatValue < preset.max
																						   ? "border-orange-500 bg-orange-600/20 text-orange-300"
																						   : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-orange-500"
																				 }`}
																				 onClick={() => setFloat(String(preset.value))}
																			   >
																				   {preset.label}
																			   </button>
																		   ))}
																	   </div>
																	   <input
																		   type="range"
																		   min="0"
																		   max="1"
																		   step="0.0001"
																		   value={safeFloatValue}
																		   onChange={(e) => setFloat(e.target.value)}
																		   className="w-full accent-orange-500"
																	   />
																	   <input
																		   type="number"
																		   step="0.0001"
																		   min="0"
																		   max="1"
																		   value={float}
																		   onChange={(e) => setFloat(e.target.value)}
																		   className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
																	   />
																   </div>

																   <div>
																	   <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Pattern</div>
																	   <input
																		   type="number"
																		   min="0"
																		   max="999"
																		   value={pattern}
																		   onChange={(e) => setPattern(e.target.value)}
																		   className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
																	   />
																   </div>

																   <div className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2">
																	   <span className="text-sm text-zinc-300">StatTrak™</span>
																	   <Switch checked={stattrak} onCheckedChange={setStattrak} />
																   </div>

																   <div>
																	   <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Nametag</div>
																	   <input
																		   type="text"
																		   maxLength={128}
																		   value={nameTag}
																		   onChange={(e) => setNameTag(e.target.value)}
																		   className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
																		   placeholder="Opcional"
																	   />
																   </div>
															   </>
														   )}
													   </div>
												   )}
												   {/* — Adesivos — */}
												   {modalInnerTab === "stickers" && tab === "skins" && (
													   <div>
														   <div className="mb-4 flex gap-2">
															   {[0, 1, 2, 3].map((i) => (
																   <button
																	   key={i}
																	   type="button"
																	   className={`flex flex-1 flex-col items-center rounded-md border p-2 text-xs transition ${
																		   activeStickerSlot === i
																			   ? "border-orange-500 bg-orange-600/20"
																			   : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
																	   }`}
																	   onClick={() => setActiveStickerSlot(i)}
																   >
																	   {skinStickers[i] ? (
																		   <>
																			   <img
																				   src={skinStickers[i]!.image}
																				   alt=""
																				   className="mb-1 h-8 w-8 object-contain"
																			   />
																			   <span className="line-clamp-1 text-[9px] text-zinc-300">
																				   {skinStickers[i]!.paint_name || skinStickers[i]!.name}
																			   </span>
																		   </>
																	   ) : (
																		   <span className="flex h-8 items-center text-zinc-500">#{i + 1}</span>
																	   )}
																   </button>
															   ))}
														   </div>
														   {/* Botão X para remover adesivo do slot ativo */}
														   <div className="relative grid grid-cols-5 gap-3 mb-3">
															   {[0, 1, 2, 3].map((i) => (
																   <div key={i} className="relative flex flex-col items-center">
																	   {skinStickers[i] && activeStickerSlot === i && (
																		   <button
																			   type="button"
																			   className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs text-red-400 hover:bg-red-500 hover:text-white border border-zinc-700 shadow"
																			   title="Remover adesivo"
																			   onClick={() => {
																				   const updated = [...skinStickers];
																				   updated[i] = null;
																				   setSkinStickers(updated);
																			   }}
																		   >
																			   ×
																		   </button>
																	   )}
																	   {/* ...existing code for sticker preview... */}
																   </div>
															   ))}
														   </div>
														   <input
															   type="text"
															   placeholder="Buscar adesivo..."
															   className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-orange-500 focus:outline-none"
															   value={stickerSearch}
															   onChange={(e) => setStickerSearch(e.target.value)}
														   />
														   {catalog.stickers.length === 0 ? (
															   <p className="text-sm text-zinc-500">Nenhum adesivo disponível no catálogo.</p>
														   ) : (
															   <div className="grid max-h-[520px] grid-cols-7 gap-3 overflow-y-auto pr-1">
																   {catalog.stickers
																	   .filter((s) =>
																		   !stickerSearch ||
																		   (s.paint_name || s.name || "")
																			   .toLowerCase()
																			   .includes(stickerSearch.toLowerCase()),
																	   )
																	   .map((s) => (
																		   <button
																			   key={s.id || s.name}
																			   type="button"
																			   className="rounded-md border border-zinc-700 bg-zinc-800 p-2 text-center transition hover:border-orange-500"
																			   onClick={() => {
																				   const updated = [...skinStickers];
																				   updated[activeStickerSlot] = s;
																				   setSkinStickers(updated);
																			   }}
																		   >
																			   <img
																				   src={s.image}
																				   alt={s.paint_name || s.name}
																				   className="mx-auto h-16 w-16 object-contain"
																				   loading="lazy"
																			   />
																			   <div className="truncate text-xs text-zinc-300">{s.paint_name || s.name}</div>
																		   </button>
																	   ))}
															   </div>
														   )}
													   </div>
												   )}
												   {/* — Chaveiros — */}
												   {modalInnerTab === "keychains" && tab === "skins" && (
													   <div>
														   <div className="mb-4 flex items-center gap-3">
															   <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
																   {skinKeychain ? (
																	   <img
																		   src={skinKeychain.image}
																		   alt={skinKeychain.paint_name || skinKeychain.name}
																		   className="h-16 w-16 object-contain"
																	   />
																   ) : (
																	   <span className="text-xs text-zinc-500">Vazio</span>
																   )}
															   </div>
															   <div className="flex-1">
																   <div className="font-semibold text-zinc-200">
																	   {skinKeychain
																		   ? skinKeychain.paint_name || skinKeychain.name
																		   : "Nenhum chaveiro selecionado"}
																   </div>
																   {skinKeychain && (
																	   <button
																		   type="button"
																		   className="mt-1 text-xs text-red-400 hover:text-red-300"
																		   onClick={() => setSkinKeychain(null)}
																	   >
																		   Remover
																	   </button>
																   )}
															   </div>
														   </div>
														   <input
															   type="text"
															   placeholder="Buscar chaveiro..."
															   className="mb-3 w-full rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-orange-500 focus:outline-none"
															   value={keychainSearch}
															   onChange={(e) => setKeychainSearch(e.target.value)}
														   />
														   {catalog.keychains.length === 0 ? (
															   <p className="text-sm text-zinc-500">Nenhum chaveiro disponível no catálogo.</p>
														   ) : (
															   <div className="grid max-h-[520px] grid-cols-7 gap-3 overflow-y-auto pr-1">
																   {catalog.keychains
																	   .filter((k) =>
																		   !keychainSearch ||
																		   (k.paint_name || k.name || "")
																			   .toLowerCase()
																			   .includes(keychainSearch.toLowerCase()),
																	   )
																	   .map((k) => (
																		   <button
																			   key={k.id || k.name}
																			   type="button"
																			   className={`rounded-md border p-2 text-center transition ${
																				   skinKeychain === k
																					   ? "border-orange-500 bg-orange-600/20"
																					   : "border-zinc-700 bg-zinc-800 hover:border-orange-500"
																			   }`}
																			   onClick={() => setSkinKeychain(k)}
																		   >
																			   <img
																				   src={k.image}
																				   alt={k.paint_name || k.name}
																				   className="mx-auto h-16 w-16 object-contain"
																				   loading="lazy"
																			   />
																			   <div className="truncate text-xs text-zinc-300">{k.paint_name || k.name}</div>
																		   </button>
																	   ))}
															   </div>
														   )}
													   </div>
												   )}
											   </div>
										   </div>
									   </div>
								   </div>
							   )}
						   </Dialog>

						{/* Confirmation dialog for Music / Pins */}
						{confirmItem && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
								<div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-lg">
									<div className="mb-4 flex gap-4">
										{confirmItem.image && (
											<img
												src={confirmItem.image}
												alt={confirmItem.paint_name || confirmItem.name}
												className="h-16 w-16 rounded object-contain bg-zinc-800"
											/>
										)}
										<div>
											<div className="font-semibold text-orange-200">
												{confirmItem.paint_name || confirmItem.name}
											</div>
											<div className="text-sm text-zinc-400">
												Deseja salvar esta seleção?
											</div>
										</div>
									</div>
									<div className="flex justify-end gap-2">
										<button
											type="button"
											className="rounded bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
											onClick={() => {
												setConfirmItem(null);
												setConfirmTab("");
											}}
										>
											Cancelar
										</button>
										<button
											type="button"
											className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 disabled:opacity-50"
											disabled={saving}
											onClick={() => {
												void saveSelection(confirmItem, confirmTab).then(() => {
													setConfirmItem(null);
													setConfirmTab("");
												});
											}}
										>
											{saving ? "Salvando..." : "Confirmar"}
										</button>
									</div>
								</div>
							</div>
						)}
					</Tabs>
				</div>

				{/* Modal para seleção de lado - Luvas */}
				{showGlovesModal && selectedGlove && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
						<div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-8 shadow-lg">
							<div className="mb-6 text-center">
								<img
									src={selectedGlove.image}
									alt={selectedGlove.paint_name}
									className="mx-auto mb-4 h-24 w-24 rounded object-contain bg-zinc-800 p-2"
								/>
								<h3 className="text-lg font-semibold text-white">{selectedGlove.paint_name}</h3>
								<p className="mt-2 text-sm text-zinc-400">Selecione qual lado deseja usar</p>
							</div>

							<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
								<button
									type="button"
									className={`rounded-lg py-3 px-4 font-semibold transition ${
										gloveTeamSelection === TEAM_TR
											? "bg-red-600 text-white"
											: "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-red-500"
									}`}
									onClick={() => setGloveTeamSelection(TEAM_TR)}
								>
								  Terrorista
								</button>
								<button
									type="button"
									className={`rounded-lg py-3 px-4 font-semibold transition ${
										gloveTeamSelection === TEAM_CT
											? "bg-blue-600 text-white"
											: "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-blue-500"
									}`}
									onClick={() => setGloveTeamSelection(TEAM_CT)}
								>
									Counter-Terrorista
								</button>
								<button
									type="button"
									className={`rounded-lg py-3 px-4 font-semibold transition ${
										gloveTeamSelection === "both"
											? "bg-orange-600 text-white"
											: "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-orange-500"
									}`}
									onClick={() => setGloveTeamSelection("both")}
								>
									Ambos (T + CT)
								</button>
							</div>

							<div className="flex justify-end gap-2">
								<button
									type="button"
									className="rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600 transition"
									onClick={() => {
										setShowGlovesModal(false);
										setSelectedGlove(null);
										setGloveTeamSelection(null);
									}}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 transition disabled:opacity-50"
									disabled={!gloveTeamSelection || saving}
									onClick={() => {
										if (gloveTeamSelection && selectedGlove) {
											void saveSelection(selectedGlove, "gloves", gloveTeamSelection);
										}
									}}
								>
									{saving ? "Salvando..." : "Confirmar"}
								</button>
							</div>
						</div>
					</div>
				)}

				{showKnifeModal && selectedKnife && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
						<div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
							<div className="mb-4 flex items-center gap-4">
								<img
									src={selectedKnife.image}
									alt={selectedKnife.paint_name}
									className="h-20 w-20 rounded bg-zinc-800 p-2 object-contain"
								/>
								<div>
									<h3 className="text-lg font-semibold text-white">{selectedKnife.paint_name}</h3>
									<p className="text-sm text-zinc-400">Configurar faca e lado (CT/TR/Ambos)</p>
								</div>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Float</label>
									<input
										type="number"
										step="0.0001"
										min="0"
										max="1"
										value={float}
										onChange={(e) => setFloat(e.target.value)}
										className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
									/>
								</div>
								<div>
									<label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Pattern</label>
									<input
										type="number"
										min="0"
										max="999"
										value={pattern}
										onChange={(e) => setPattern(e.target.value)}
										className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
									/>
								</div>
								<div className="md:col-span-2">
									<label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Nametag</label>
									<input
										type="text"
										value={nameTag}
										onChange={(e) => setNameTag(e.target.value)}
										maxLength={128}
										className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
										placeholder="Opcional"
									/>
								</div>
								<div className="md:col-span-2 flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2">
									<span className="text-sm text-zinc-300">StatTrak</span>
									<Switch checked={stattrak} onCheckedChange={setStattrak} />
								</div>
							</div>

							<div className="mt-5">
								<div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">Lado</div>
								<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
									{[
										[TEAM_TR, "TR"],
										[TEAM_CT, "CT"],
										["both", "Ambos"],
									].map(([val, label]) => (
										<button
											key={String(val)}
											type="button"
											className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
												knifeTeamSelection === val
													? "border-orange-500 bg-orange-600/20 text-orange-300"
													: "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
											}`}
											onClick={() => setKnifeTeamSelection(val as TeamSelection)}
										>
											{label as string}
										</button>
									))}
								</div>
							</div>

							<div className="mt-6 flex justify-end gap-2">
								<button
									type="button"
									className="rounded bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600"
									onClick={() => {
										setShowKnifeModal(false);
										setSelectedKnife(null);
										setKnifeTeamSelection("both");
									}}
								>
									Cancelar
								</button>
								<button
									type="button"
									className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 disabled:opacity-50"
									disabled={saving}
									onClick={() => {
										void saveSelection(selectedKnife, "skins", knifeTeamSelection);
									}}
								>
									{saving ? "Salvando..." : "Salvar Faca"}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	}
