"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AlertTriangle,
	Cog,
	Swords,
	RefreshCw,
	Send,
	Server,
	TerminalSquare,
} from "lucide-react";

import PageAccessGate from "@/components/page-access-gate";
import PremiumCard from "@/components/premium-card";
import SectionTitle from "@/components/section-title";

const SERVER_ID = "69e25c29817337ed7e1ff91c";
const SERVER_IP = "169.150.198.104:25527";
const SERVER_PASSWORD = "skn123";
const STEAM_CONNECT_URL = `steam://run/730//+connect ${SERVER_IP}`;
const CONSOLE_CONNECT_COMMAND = `connect ${SERVER_IP}; password ${SERVER_PASSWORD}`;

type GameMode = "competitive" | "casual" | "arms_race" | "ffa_deathmatch" | "retakes" | "wingman" | "custom";
type MapsSource = "mapgroup" | "workshop_collection" | "workshop_single_map";

type ServerConfigForm = {
	game_mode: GameMode;
	maps_source: MapsSource;
	mapgroup: string;
	mapgroup_start_map: string;
	workshop_map_id: string;
};

function normalizeConsoleLines(payload: unknown): string[] {
	if (!payload) return [];

	if (Array.isArray(payload)) {
		return payload.map((line) => String(line)).filter(Boolean);
	}

	if (typeof payload === "string") {
		return payload.split("\n").map((line) => line.trimEnd()).filter(Boolean);
	}

	if (typeof payload === "object") {
		const source = payload as Record<string, unknown>;
		const keys = ["lines", "console", "backlog", "output", "data"];

		for (const key of keys) {
			const value = source[key];
			if (Array.isArray(value)) return value.map((line) => String(line)).filter(Boolean);
			if (typeof value === "string") {
				return value.split("\n").map((line) => line.trimEnd()).filter(Boolean);
			}
		}
	}

	return [];
}

function removeConsoleTimestampPrefix(line: string): string {
	return line.replace(/^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}:\s*/, "").trim();
}

function parsePlayersFromStatus(lines: string[]): number | null {
	if (lines.length === 0) return null;

	const normalized = lines.map(removeConsoleTimestampPrefix);

	for (let i = normalized.length - 1; i >= 0; i -= 1) {
		const line = normalized[i];
		const humansMatch = line.match(/players\s*:\s*(\d+)\s+humans?/i);
		if (humansMatch) {
			return Number(humansMatch[1]);
		}
	}

	let startIndex = -1;
	for (let i = normalized.length - 1; i >= 0; i -= 1) {
		if (normalized[i].toLowerCase().includes("---------players--------")) {
			startIndex = i;
			break;
		}
	}

	if (startIndex < 0) return null;

	let count = 0;
	for (let i = startIndex + 1; i < normalized.length; i += 1) {
		const line = normalized[i];
		if (!line) continue;

		const lower = line.toLowerCase();
		if (line.includes("#end") || lower.includes("--- sourcetv")) {
			break;
		}

		if (lower.includes("id") && lower.includes("ping") && lower.includes("name")) {
			continue;
		}

		if (lower.startsWith("message repeated")) {
			continue;
		}

		const idMatch = line.match(/^(\d+)\s+/);
		if (!idMatch) continue;

		if (idMatch[1] === "65535") {
			continue;
		}

		count += 1;
	}

	return count;
}

function formatNumber(value: number | null | undefined, suffix = "") {
	if (typeof value !== "number" || !Number.isFinite(value)) return "-";
	return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

export default function ServidorPage() {
	const [consoleLines, setConsoleLines] = useState<string[]>([]);
	const [loadingConsole, setLoadingConsole] = useState(true);
	const [consoleError, setConsoleError] = useState("");
	const [consoleCommand, setConsoleCommand] = useState("");
	const [sendingCommand, setSendingCommand] = useState(false);
	const [lastConsoleRefresh, setLastConsoleRefresh] = useState<string>("");
	const [lastStatusCommandAt, setLastStatusCommandAt] = useState<string>("");
	const [autoScrollToBottom, setAutoScrollToBottom] = useState(true);
	const [configForm, setConfigForm] = useState<ServerConfigForm>({
		game_mode: "custom",
		maps_source: "mapgroup",
		mapgroup: "",
		mapgroup_start_map: "",
		workshop_map_id: "",
	});
	const [loadingConfig, setLoadingConfig] = useState(true);
	const [savingConfig, setSavingConfig] = useState(false);
	const [configError, setConfigError] = useState("");
	const [configSuccess, setConfigSuccess] = useState("");
	const [faceitGuid, setFaceitGuid] = useState("");
	const [lvlServidor, setLvlServidor] = useState(0);
	const [accessResolved, setAccessResolved] = useState(false);
	const [applyingPreset, setApplyingPreset] = useState<"1v1" | "mix" | null>(null);

	const consoleRef = useRef<HTMLPreElement | null>(null);
	const canUseRestrictedAreas = lvlServidor === 1 || lvlServidor === 2;
	const canUseLevel1Preset = lvlServidor === 1;

	const fetchConsole = useCallback(async () => {
		try {
			const response = await fetch(`/api/servidor/dathost?action=console&server_id=${SERVER_ID}&max_lines=220`, {
				cache: "no-store",
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || "Falha ao carregar console.");
			}

			const lines = normalizeConsoleLines(data?.console);
			setConsoleLines(lines.slice(-220));
			setConsoleError("");
			setLastConsoleRefresh(new Date().toLocaleTimeString("pt-BR"));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erro ao atualizar console.";
			setConsoleError(message);
		} finally {
			setLoadingConsole(false);
		}
	}, []);

	const postConsoleCommand = useCallback(async (line: string, silent = false) => {
		try {
			const response = await fetch("/api/servidor/dathost", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					server_id: SERVER_ID,
					line,
				}),
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || "Falha ao enviar comando.");
			}

			if (line.trim().toLowerCase() === "status") {
				setLastStatusCommandAt(new Date().toLocaleTimeString("pt-BR"));
			}

			return true;
		} catch (error) {
			if (!silent) {
				const message = error instanceof Error ? error.message : "Erro ao enviar comando.";
				setConsoleError(message);
			}
			return false;
		}
	}, []);

	const fetchServerSettings = useCallback(async () => {
		try {
			const response = await fetch(`/api/servidor/dathost?action=server-settings&server_id=${SERVER_ID}`, {
				cache: "no-store",
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || "Falha ao carregar configuracoes do servidor.");
			}

			const settings = (data?.settings || {}) as Record<string, string>;
			const mapsSource = (settings.maps_source as MapsSource) || "mapgroup";
			const workshopMapId = mapsSource === "workshop_single_map"
				? settings.workshop_single_map_id || ""
				: settings.workshop_collection_start_map_id || "";

			setConfigForm({
				game_mode: ((settings.game_mode as GameMode) || "custom"),
				maps_source: mapsSource,
				mapgroup: settings.mapgroup || "",
				mapgroup_start_map: settings.mapgroup_start_map || "",
				workshop_map_id: workshopMapId,
			});

			setConfigError("");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erro ao carregar configuracoes.";
			setConfigError(message);
		} finally {
			setLoadingConfig(false);
		}
	}, []);

	const fetchServerAccess = useCallback(async (guid: string) => {
		if (!guid) {
			setLvlServidor(0);
			setAccessResolved(true);
			return;
		}

		try {
			const response = await fetch(`/api/servidor/dathost?action=access&faceit_guid=${encodeURIComponent(guid)}`, {
				cache: "no-store",
				headers: {
					"x-faceit-guid": guid,
				},
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				setLvlServidor(0);
				setAccessResolved(true);
				return;
			}

			setLvlServidor(Number(data?.lvlservidor || 0));
			setAccessResolved(true);
		} catch {
			setLvlServidor(0);
			setAccessResolved(true);
		}
	}, []);

	const saveServerSettings = useCallback(async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		try {
			setSavingConfig(true);
			setConfigError("");
			setConfigSuccess("");

			const response = await fetch("/api/servidor/dathost", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					server_id: SERVER_ID,
					...configForm,
					start_map: configForm.mapgroup_start_map,
				}),
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || "Falha ao salvar configuracao.");
			}

			setConfigSuccess("Configuracao salva com sucesso. O servidor pode reiniciar para aplicar as mudancas.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Erro ao salvar configuracao.";
			setConfigError(message);
		} finally {
			setSavingConfig(false);
		}
	}, [configForm]);

	const applyModePreset = useCallback(async (mode: "1v1" | "mix") => {
		if (!canUseLevel1Preset) return;

		try {
			setApplyingPreset(mode);

			await fetch("/api/servidor/dathost", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(faceitGuid ? { "x-faceit-guid": faceitGuid } : {}),
				},
				body: JSON.stringify({
					action: "apply-mode-preset",
					mode,
					server_id: SERVER_ID,
					faceit_guid: faceitGuid,
				}),
			});

			setLoadingConfig(true);
			void fetchServerSettings();
			window.setTimeout(() => {
				void fetchConsole();
			}, 1000);
		} finally {
			setApplyingPreset(null);
		}
	}, [canUseLevel1Preset, faceitGuid, fetchConsole, fetchServerSettings]);

	useEffect(() => {
		const readFaceitGuid = () => {
			try {
				const raw = localStorage.getItem("faceit_user");
				if (!raw) {
					setFaceitGuid("");
					return;
				}

				const parsed = JSON.parse(raw) as { faceit_guid?: string };
				setFaceitGuid(String(parsed?.faceit_guid || "").trim());
			} catch {
				setFaceitGuid("");
			}
		};

		readFaceitGuid();

		const onStorage = (event: StorageEvent) => {
			if (!event.key || event.key === "faceit_user") {
				readFaceitGuid();
			}
		};

		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	useEffect(() => {
		void fetchServerAccess(faceitGuid);
	}, [faceitGuid, fetchServerAccess]);

	useEffect(() => {
		if (!accessResolved) return;

		if (canUseRestrictedAreas) {
			setLoadingConfig(true);
			void fetchServerSettings();
		} else {
			setLoadingConfig(false);
		}
	}, [accessResolved, canUseRestrictedAreas, fetchServerSettings]);

	useEffect(() => {
		if (!accessResolved) return;

		fetchConsole();

		if (canUseRestrictedAreas) {
			void (async () => {
				const ok = await postConsoleCommand("status", true);
				if (ok) {
					window.setTimeout(() => {
						void fetchConsole();
					}, 600);
				}
			})();
		}

		const consolePollMs = canUseRestrictedAreas ? 3500 : 60 * 60 * 1000;
		const consoleTimer = window.setInterval(fetchConsole, consolePollMs);

		let statusTimer: number | null = null;
		if (canUseRestrictedAreas) {
			statusTimer = window.setInterval(() => {
				void (async () => {
					const ok = await postConsoleCommand("status", true);
					if (ok) {
						window.setTimeout(() => {
							void fetchConsole();
						}, 700);
					}
				})();
			}, 15000);
		}

		return () => {
			window.clearInterval(consoleTimer);
			if (statusTimer) window.clearInterval(statusTimer);
		};
	}, [accessResolved, canUseRestrictedAreas, fetchConsole, postConsoleCommand]);

	useEffect(() => {
		if (!autoScrollToBottom) return;
		if (!consoleRef.current) return;

		consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
	}, [consoleLines, autoScrollToBottom]);

	const sendConsoleCommand = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const line = consoleCommand.trim();
			if (!line) return;

			try {
				setSendingCommand(true);
				const ok = await postConsoleCommand(line);
				if (!ok) return;

				setConsoleCommand("");
				setConsoleError("");
				await fetchConsole();
			} catch (error) {
				const message = error instanceof Error ? error.message : "Erro ao enviar comando.";
				setConsoleError(message);
			} finally {
				setSendingCommand(false);
			}
		},
		[consoleCommand, fetchConsole, postConsoleCommand],
	);

	const playersOnlineNow = useMemo(() => parsePlayersFromStatus(consoleLines), [consoleLines]);

	return (
		<PageAccessGate level={1} restrictedTitle="Acesso restrito">
			<main className="relative overflow-hidden py-14 md:py-20">
				<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(236,161,73,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(231,106,33,0.14),transparent_28%)]" />

				<section className="container">
					<SectionTitle
						title="Painel do Servidor CS2"
						description="Configurar o servidor"
					/>

					<PremiumCard className="mb-8 border-gold/20 bg-[#08111b]/95">
						<div className="p-5">
							<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">Servidor Querido Camp</p>
									<p className="mt-1 text-sm text-gray-300">1x1 / Treino / Mix / Testar Skin</p>
								</div>
								<a
									href={STEAM_CONNECT_URL}
									className="inline-flex items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-black transition hover:bg-gold/90"
								>
									Conectar via Steam
								</a>
							</div>

							<div className="rounded-xl border border-white/10 bg-black/40 p-3">
								<p className="text-xs uppercase tracking-[0.14em] text-gold/75">Comando no console</p>
								<p className="mt-1 break-all font-mono text-sm text-gray-200">{CONSOLE_CONNECT_COMMAND}</p>
							</div>
						</div>
					</PremiumCard>

					<div className="mb-8 grid gap-4 md:grid-cols-2">
						<PremiumCard>
							<div className="p-5">
								<p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">Server ID</p>
								<p className="mt-2 break-all text-sm font-bold text-white">{SERVER_ID}</p>
							</div>
						</PremiumCard>

						<PremiumCard>
							<div className="flex items-center gap-3 p-5">
								<Server className="h-5 w-5 text-gold" />
								<div>
									<p className="text-xs uppercase tracking-[0.18em] text-gold/75">Players online agora</p>
									<p className="text-xl font-black text-white">{formatNumber(playersOnlineNow)}</p>
								</div>
							</div>
						</PremiumCard>
					</div>

					<div className="grid gap-8">
						<PremiumCard className="border-gold/20 bg-[#08111b]/95">
							<div className="p-6 md:p-7">
								<div className="mb-5 flex items-center gap-2 text-2xl font-black text-white">
									<Swords className="h-6 w-6 text-gold" />
									Modo rapido (nivel 1)
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<button
										type="button"
										onClick={() => {
											void applyModePreset("1v1");
										}}
										disabled={!canUseLevel1Preset || applyingPreset !== null}
										className="inline-flex items-center justify-center rounded-xl bg-gold px-5 py-3 text-sm font-bold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{applyingPreset === "1v1" ? "Aplicando 1v1..." : "1v1"}
									</button>

									<button
										type="button"
										onClick={() => {
											void applyModePreset("mix");
										}}
										disabled={!canUseLevel1Preset || applyingPreset !== null}
										className="inline-flex items-center justify-center rounded-xl border border-gold bg-transparent px-5 py-3 text-sm font-bold text-gold transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{applyingPreset === "mix" ? "Aplicando Mix..." : "Mix"}
									</button>
								</div>
							</div>
						</PremiumCard>

						<PremiumCard className="border-gold/20 bg-[#08111b]/95">
							<div className="p-6 md:p-7">
								<div className="mb-5 flex items-center justify-between gap-3">
									<h2 className="flex items-center gap-2 text-2xl font-black text-white">
										<Cog className="h-6 w-6 text-gold" />
										Configuracao do servidor
									</h2>
									<button
										type="button"
										onClick={() => {
											setLoadingConfig(true);
											void fetchServerSettings();
										}}
										className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold transition hover:bg-gold/20"
										disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
									>
										<RefreshCw className="h-4 w-4" /> Recarregar
									</button>
								</div>

								<form onSubmit={saveServerSettings} className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<label className="text-xs font-bold uppercase tracking-[0.16em] text-gold/80">Game Mode</label>
										<select
											value={configForm.game_mode}
											onChange={(event) => setConfigForm((prev) => ({ ...prev, game_mode: event.target.value as GameMode }))}
											className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none focus:border-gold/50"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
										>
											<option value="competitive">Competitive</option>
											<option value="casual">Casual</option>
											<option value="arms_race">Arms Race</option>
											<option value="ffa_deathmatch">FFA Deathmatch</option>
											<option value="retakes">Retakes</option>
											<option value="wingman">Wingman</option>
											<option value="custom">Custom</option>
										</select>
									</div>

									<div className="space-y-2">
										<label className="text-xs font-bold uppercase tracking-[0.16em] text-gold/80">Maps Source</label>
										<select
											value={configForm.maps_source}
											onChange={(event) => setConfigForm((prev) => ({ ...prev, maps_source: event.target.value as MapsSource }))}
											className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none focus:border-gold/50"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
										>
											<option value="mapgroup">mapgroup</option>
											<option value="workshop_collection">workshop_collection</option>
											<option value="workshop_single_map">workshop_single_map</option>
										</select>
									</div>

									<div className="space-y-2">
										<label className="text-xs font-bold uppercase tracking-[0.16em] text-gold/80">Mapgroup</label>
										<input
											type="text"
											value={configForm.mapgroup}
											onChange={(event) => setConfigForm((prev) => ({ ...prev, mapgroup: event.target.value }))}
											placeholder="Ex: mg_active"
											className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
										/>
									</div>

									<div className="space-y-2">
										<label className="text-xs font-bold uppercase tracking-[0.16em] text-gold/80">Start Map</label>
										<input
											type="text"
											value={configForm.mapgroup_start_map}
											onChange={(event) => setConfigForm((prev) => ({ ...prev, mapgroup_start_map: event.target.value }))}
											placeholder="Ex: de_dust2"
											className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
										/>
									</div>

									<div className="space-y-2 md:col-span-2">
										<label className="text-xs font-bold uppercase tracking-[0.16em] text-gold/80">Workshop Map ID</label>
										<input
											type="text"
											value={configForm.workshop_map_id}
											onChange={(event) => setConfigForm((prev) => ({ ...prev, workshop_map_id: event.target.value }))}
											placeholder={configForm.maps_source === "workshop_single_map" ? "Steam ID do mapa (single map)" : "Steam ID do start map da collection"}
											className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
										/>
									</div>

									<div className="md:col-span-2 flex flex-wrap items-center gap-3">
										<button
											type="submit"
											disabled={!canUseRestrictedAreas || loadingConfig || savingConfig}
											className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{savingConfig ? "Salvando..." : "Salvar configuracao"}
										</button>

										{loadingConfig && <span className="text-sm text-gray-400">Carregando configuracoes...</span>}
										{!!configSuccess && <span className="text-sm text-emerald-300">{configSuccess}</span>}
										{!!configError && <span className="text-sm text-red-300">{configError}</span>}
									</div>
								</form>
							</div>
						</PremiumCard>

						<PremiumCard className="border-gold/20 bg-[#08111b]/95">
							<div className="p-6 md:p-7">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<h2 className="flex items-center gap-2 text-2xl font-black text-white">
										<TerminalSquare className="h-6 w-6 text-gold" />
										Console ao vivo
									</h2>

									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={() => {
												void fetchConsole();
											}}
											className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold transition hover:bg-gold/20"
											disabled={!canUseRestrictedAreas}
										>
											<RefreshCw className="h-4 w-4" /> Atualizar
										</button>
										<button
											type="button"
											onClick={() => {
												if (!canUseRestrictedAreas) return;
												void (async () => {
													const ok = await postConsoleCommand("status");
													if (ok) {
														window.setTimeout(() => {
															void fetchConsole();
														}, 700);
													}
												})();
											}}
											className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold transition hover:bg-gold/20"
											disabled={!canUseRestrictedAreas}
										>
											Status
										</button>
										<button
											type="button"
											onClick={() => setAutoScrollToBottom((prev) => !prev)}
											className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold transition hover:bg-gold/20"
											disabled={!canUseRestrictedAreas}
										>
											Auto-scroll: {autoScrollToBottom ? "ON" : "OFF"}
										</button>
									</div>
								</div>

								<p className="mt-2 text-sm text-gray-400">
									Atualizado em: <span className="font-semibold text-gray-300">{lastConsoleRefresh || "-"}</span>
								</p>
								<p className="mt-1 text-xs text-gray-500">
									Ultimo comando status: <span className="font-semibold text-gray-400">{lastStatusCommandAt || "-"}</span>
								</p>

								<div className="mt-5 rounded-2xl border border-white/10 bg-black/70 p-4">
									{loadingConsole ? (
										<p className="text-sm text-gray-400">Carregando console...</p>
									) : consoleError ? (
										<div className="flex items-start gap-2 text-sm text-red-300">
											<AlertTriangle className="mt-0.5 h-4 w-4" />
											<p>{consoleError}</p>
										</div>
									) : (
										<pre ref={consoleRef} className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-6 text-gray-200">
											{consoleLines.length > 0 ? consoleLines.join("\n") : "Console sem linhas no momento."}
										</pre>
									)}
								</div>

								<form onSubmit={sendConsoleCommand} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
									<input
										type="text"
										value={consoleCommand}
										onChange={(event) => setConsoleCommand(event.target.value)}
										placeholder="Ex: status, changelevel, sv_cheats 0"
										className="w-full rounded-xl border border-white/15 bg-[#0f1823] px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50"
										disabled={!canUseRestrictedAreas}
									/>

									<button
										type="submit"
										disabled={!canUseRestrictedAreas || sendingCommand || !consoleCommand.trim()}
										className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-black transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<Send className="h-4 w-4" />
										{sendingCommand ? "Enviando..." : "Enviar comando"}
									</button>
								</form>
							</div>
						</PremiumCard>
					</div>
				</section>
			</main>
		</PageAccessGate>
	);
}
