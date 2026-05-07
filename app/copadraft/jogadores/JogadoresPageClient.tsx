"use client";
import Image from 'next/image';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

function normalizeText(value: unknown) {
	return String(value || '').trim();
}

function getLevelImagePath(level: number | null) {
	if (typeof level === 'number' && level >= 1 && level <= 10) {
		return `/faceitlevel/${level}.png`;
	}
	return '/faceitlevel/-1.png';
}

function isAdmin(user: any) {
	return user?.Admin === 1 || user?.Admin === 2 || user?.admin === 1 || user?.admin === 2;
}

function groupByPote(jogadores: any[]) {
	const potes: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
	jogadores.forEach((j: any) => {
		if (j.pote && potes[j.pote]) potes[j.pote].push(j);
	});
	return potes;
}

function groupByTime(jogadores: any[]) {
	const times: Record<number, any[]> = {};
	jogadores.forEach((j: any) => {
		if (j.timeid) {
			if (!times[j.timeid]) times[j.timeid] = [];
			times[j.timeid].push(j);
		}
	});
	return times;
}

function readStoredUser() {
	if (typeof window === 'undefined') return null;
	try {
		const stored = localStorage.getItem('faceit_user');
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

export default function JogadoresPageClient({ jogadores }: { jogadores: any[] }) {
	const [user, setUser] = useState<any>(() => readStoredUser());
	const [viewAs, setViewAs] = useState<'admin' | 'player'>(() => {
		const u = readStoredUser();
		return isAdmin(u) ? 'admin' : 'player';
	});
	const [tab, setTab] = useState<'escolher'|'times'|'potes'>(() => {
		const u = readStoredUser();
		return isAdmin(u) ? 'times' : 'potes';
	});
	const [jogadoresState, setJogadoresState] = useState<any[]>(() => {
		if (Array.isArray(jogadores) && jogadores.length > 0) return jogadores;
		return [];
	});
	const [savingPoteById, setSavingPoteById] = useState<Record<number, boolean>>({});
	const [removingPoteById, setRemovingPoteById] = useState<Record<number, boolean>>({});
	const [pickModal, setPickModal] = useState<{ open: boolean; capitao: any | null; jogador: any | null; pote: number | null }>({
		open: false,
		capitao: null,
		jogador: null,
		pote: null,
	});
	const [gastoInput, setGastoInput] = useState('0');
	const [savingPick, setSavingPick] = useState(false);
	const [restoringTimeByCapitao, setRestoringTimeByCapitao] = useState<Record<number, boolean>>({});
	const [playerSelectorModal, setPlayerSelectorModal] = useState<{ open: boolean; capitao: any | null; pote: number | null }>({
		open: false,
		capitao: null,
		pote: null,
	});
	const [playerSearchText, setPlayerSearchText] = useState('');
	const [escolherPoteSearchText, setEscolherPoteSearchText] = useState('');
	const [removingFromTimeById, setRemovingFromTimeById] = useState<Record<number, boolean>>({});
	const [rafflePoteModal, setRafflePoteModal] = useState<{ open: boolean; selectedPote: number | null }>({
		open: false,
		selectedPote: null,
	});
	const [raffleLoading, setRaffleLoading] = useState(false);
	const [resettingAllData, setResettingAllData] = useState(false);
	const [top90Modal, setTop90Modal] = useState<{ open: boolean; jogador: any | null }>({
		open: false,
		jogador: null,
	});

	const isAdminUser = isAdmin(user);
	const isAdminView = isAdminUser && viewAs === 'admin';
	const canSeeEscolherTab = isAdminView;
	const canSeeTimesTab = true;
	const canSeePotesTab = true;

	useEffect(() => {
		const updated = readStoredUser();
		if (updated) setUser(updated);
	}, []);

	useEffect(() => {
		if (!isAdminUser && viewAs !== 'player') {
			setViewAs('player');
		}
	}, [isAdminUser, viewAs]);

	useEffect(() => {
		if (Array.isArray(jogadores) && jogadores.length > 0) {
			setJogadoresState(jogadores);
		}
	}, [jogadores]);

	useEffect(() => {
		if (!canSeeEscolherTab && tab === 'escolher') {
			setTab('potes');
		}
	}, [tab, canSeeEscolherTab]);

	useEffect(() => {
		if (isAdminView) return;
		setPickModal({ open: false, capitao: null, jogador: null, pote: null });
		setPlayerSelectorModal({ open: false, capitao: null, pote: null });
		setRafflePoteModal({ open: false, selectedPote: null });
		setTop90Modal({ open: false, jogador: null });
	}, [isAdminView]);

	async function handleSetPote(jogadorId: number, pote: number) {
		if (!isAdminView) return;
		setSavingPoteById((prev) => ({ ...prev, [jogadorId]: true }));

		try {
			const res = await fetch('/copadraft/jogadores/api/pote', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jogadorId, pote }),
			});

			if (!res.ok) {
				throw new Error('Falha ao atualizar pote');
			}

			setJogadoresState((prev) => prev.map((j: any) => (Number(j.id) === Number(jogadorId) ? { ...j, pote } : j)));
		} catch {
			// Sem toast por enquanto para manter UX atual simples
		} finally {
			setSavingPoteById((prev) => ({ ...prev, [jogadorId]: false }));
		}
	}

	async function handleRemoveFromPote(jogadorId: number) {
		if (!isAdminView) return;
		setRemovingPoteById((prev) => ({ ...prev, [jogadorId]: true }));

		try {
			const res = await fetch('/copadraft/jogadores/api/remove-pote', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jogadorId }),
			});

			if (!res.ok) {
				throw new Error('Falha ao remover pote');
			}

			setJogadoresState((prev) => prev.map((j: any) => (Number(j.id) === Number(jogadorId) ? { ...j, pote: null } : j)));
		} catch {
			// Sem toast por enquanto para manter UX atual simples
		} finally {
			setRemovingPoteById((prev) => ({ ...prev, [jogadorId]: false }));
		}
	}

	async function handleRemoveFromTime(jogadorId: number) {
		if (!isAdminView) return;
		setRemovingFromTimeById((prev) => ({ ...prev, [jogadorId]: true }));

		try {
			const res = await fetch('/copadraft/jogadores/api/remove-from-time', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jogadorId }),
			});

			if (!res.ok) {
				throw new Error('Falha ao remover do time');
			}

			const data = await res.json();
			const timeidRemovido = Number(data.timeid);

			// Remove timeid de todos os jogadores desse time
			setJogadoresState((prev) => prev.map((j: any) => 
				Number(j.timeid) === timeidRemovido ? { ...j, timeid: null } : j
			));
		} catch {
			// Sem toast por enquanto para manter UX atual simples
		} finally {
			setRemovingFromTimeById((prev) => ({ ...prev, [jogadorId]: false }));
		}
	}

	function getAvailableByPote(pote: number) {
		return jogadoresState.filter((j: any) => Number(j.pote) === pote && !j.timeid);
	}

	function openPlayerSelector(capitao: any, pote: number) {
		setPlayerSelectorModal({ open: true, capitao, pote });
		setPlayerSearchText('');
	}

	function selectPlayerFromModal(jogador: any) {
		if (!playerSelectorModal.capitao || !playerSelectorModal.pote) return;
		openPickModal(playerSelectorModal.capitao, jogador, playerSelectorModal.pote);
		setPlayerSelectorModal({ open: false, capitao: null, pote: null });
		setPlayerSearchText('');
	}

	function openPickModal(capitao: any, jogador: any, pote: number) {
		setPickModal({ open: true, capitao, jogador, pote });
		setGastoInput('0');
	}

	function addGasto(value: number) {
		const current = Number(gastoInput || 0);
		const next = Number.isFinite(current) ? current + value : value;
		setGastoInput(String(next));
	}

	async function confirmPick() {
		if (!pickModal.capitao || !pickModal.jogador || !pickModal.pote || !isAdminView) return;

		const gasto = Number(gastoInput);
		if (!Number.isInteger(gasto) || gasto < 0) return;

		setSavingPick(true);
		try {
			const res = await fetch('/copadraft/jogadores/api/pick', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					capitaoId: Number(pickModal.capitao.id),
					jogadorId: Number(pickModal.jogador.id),
					gasto,
				}),
			});

			if (!res.ok) {
				throw new Error('Falha ao realizar pick');
			}

			const data = await res.json();
			setJogadoresState((prev) => prev.map((j: any) => {
				if (Number(j.id) === Number(data.jogadorId)) {
					return { ...j, timeid: Number(data.capitaoId) };
				}
				if (Number(j.id) === Number(data.capitaoId)) {
					return { ...j, dinheiro: Number(data.novoDinheiro) };
				}
				return j;
			}));

			setPickModal({ open: false, capitao: null, jogador: null, pote: null });
			setGastoInput('0');
		} catch {
			// Mantem UX simples sem toast por enquanto
		} finally {
			setSavingPick(false);
		}
	}

	async function handleRestoreTime(capitaoId: number) {
		if (!isAdminView) return;
		setRestoringTimeByCapitao((prev) => ({ ...prev, [capitaoId]: true }));

		try {
			const res = await fetch('/copadraft/jogadores/api/restore-time', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ capitaoId }),
			});

			if (!res.ok) {
				throw new Error('Falha ao restaurar time');
			}

			const data = await res.json();
			setJogadoresState((prev) => prev.map((j: any) => {
				if (Number(j.id) === Number(capitaoId)) {
					return { ...j, dinheiro: Number(data.novoDinheiro ?? 500000) };
				}
				if (Number(j.timeid) === Number(capitaoId) && Number(j.id) !== Number(capitaoId)) {
					return { ...j, timeid: null };
				}
				return j;
			}));
		} catch {
			// Mantem UX simples sem toast por enquanto
		} finally {
			setRestoringTimeByCapitao((prev) => ({ ...prev, [capitaoId]: false }));
		}
	}

	async function performRaffle(poteAlSortear: number) {
		if (!isAdminView || !poteAlSortear) return;
		setRaffleLoading(true);

		try {
			const res = await fetch('/copadraft/jogadores/api/raffle', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ poteAlSortear }),
			});

			if (!res.ok) {
				throw new Error('Falha ao realizar sorteio');
			}

			const data = await res.json();
			// Atualizar estado com os novos timeid e dinheiro dos capitões
			setJogadoresState((prev) => prev.map((j: any) => {
				const updates = data.updates.find((u: any) => Number(u.jogadorId) === Number(j.id));
				if (updates) {
					return { ...j, timeid: updates.timeid, pote: j.pote };
				}
				const capitaoUpdate = data.updates.find((u: any) => Number(u.capitaoId) === Number(j.id));
				if (capitaoUpdate) {
					return { ...j, dinheiro: capitaoUpdate.novoDinheiro };
				}
				return j;
			}));

			setRafflePoteModal({ open: false, selectedPote: null });
		} catch {
			// Mantem UX simples sem toast por enquanto
		} finally {
			setRaffleLoading(false);
		}
	}

	async function handleResetAllData() {
		if (!isAdminView || !window.confirm('Tem certeza? Isso vai limpar pote, timeid e dinheiro de TODOS os jogadores!')) return;
		setResettingAllData(true);

		try {
			const res = await fetch('/copadraft/jogadores/api/reset-all', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
			});

			if (!res.ok) {
				throw new Error('Falha ao resetar dados');
			}

			// Atualizar estado local: limpar pote, timeid e dinheiro para todos
			setJogadoresState((prev) => prev.map((j: any) => ({
				...j,
				pote: null,
				timeid: null,
				dinheiro: 0,
			})));
		} catch {
			// Mantem UX simples
		} finally {
			setResettingAllData(false);
		}
	}

	const potes = groupByPote(jogadoresState);
	const times = groupByTime(jogadoresState);
	const jogadoresSemPote = jogadoresState.filter((j: any) => !j.pote);
	const tabOptions: Array<{ key: 'escolher' | 'times' | 'potes'; label: string }> = [
		...(canSeeEscolherTab ? [{ key: 'escolher' as const, label: 'Escolher Pote' }] : []),
		...(canSeeTimesTab ? [{ key: 'times' as const, label: 'Times' }] : []),
		{ key: 'potes' as const, label: 'Potes' },
	];

	function JogadorCard({ jogador, podeEscolherPote = false, podeRemoverDoTime = false }: { jogador: any, podeEscolherPote?: boolean, podeRemoverDoTime?: boolean }) {
		const jogadorId = Number(jogador.id);
		const dbLevelRaw = Number(jogador?.level || 0);
		const faceitLevel = Number.isInteger(dbLevelRaw) && dbLevelRaw >= 1 && dbLevelRaw <= 10 ? dbLevelRaw : null;
		const levelImg = getLevelImagePath(faceitLevel);
		const currentPote = jogador.pote ? Number(jogador.pote) : null;
		const savingPote = Boolean(savingPoteById[jogadorId]);
		const removingPote = Boolean(removingPoteById[jogadorId]);
		const removingFromTime = Boolean(removingFromTimeById[jogadorId]);
		const hasTop90Stats = Boolean(jogador?.top90Stats);
		const showTop90Visuals = isAdminView && hasTop90Stats;
		const canOpenStatsModal = showTop90Visuals;
		const avatarUrl = String(jogador?.faceit_image || jogador?.avatar || '').trim();

		const borderColor = showTop90Visuals ? 'border-zinc-700' : 'border-gray-400';
		const bgColor = showTop90Visuals ? 'bg-[#060c14]' : 'bg-white/10';

		// Cor de fundo e borda fixa, tamanho da foto padronizado
		return (
			<div
				className={`relative ${bgColor} border-2 ${borderColor} rounded-xl shadow-xl p-4 flex flex-col items-center gap-3 transition-shadow duration-200 hover:shadow-2xl`}
			>
				{podeRemoverDoTime && isAdminView && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleRemoveFromTime(jogadorId);
						}}
						disabled={removingFromTime}
						className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center text-sm font-bold transition disabled:opacity-60"
					>
						{removingFromTime ? '...' : '✕'}
					</button>
				)}
				{showTop90Visuals && (
					<div className="absolute top-2 left-2 rounded-md border border-zinc-500/60 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-200">
                        Ja participou
					</div>
				)}
				{avatarUrl ? (
					<div className="relative mb-2 w-20 h-20 rounded-full border-2 border-white shadow overflow-hidden">
						<Image src={avatarUrl} fill alt={jogador.nick} className="object-cover" />
					</div>
				) : null}
				<div className="font-extrabold text-lg text-white drop-shadow-lg text-center">{jogador.nick}</div>
			{!podeEscolherPote && (
				<div className="text-xs text-zinc-300">
					{currentPote ? `Pote atual: ${currentPote}` : 'Sem pote'}
				</div>
			)}
				{currentPote === 1 && (
					<div className="text-xs text-gold font-semibold">
						R$ {Number(jogador.dinheiro || 0).toLocaleString('pt-BR')}
					</div>
				)}
				<div className="flex items-center gap-2 min-h-[42px]">
					<Image src={levelImg} width={42} height={42} alt={`Faceit Level ${faceitLevel ?? '-'} `} onError={(e) => {
						const target = e.currentTarget as HTMLImageElement;
						target.src = '/faceitlevel/-1.png';
					}} />
				</div>
				   <div className="flex gap-2 mt-1">
					   {jogador.linkgc && (
						   <Link onClick={(e) => e.stopPropagation()} href={jogador.linkgc} className="px-2 py-1 bg-gradient-to-r from-blue-700 to-blue-400 rounded-full shadow hover:from-blue-800 hover:to-blue-500 transition flex items-center" target="_blank">
							   <Image src="/gc.png" alt="GC" width={28} height={28} className="inline-block" />
						   </Link>
					   )}
					   {jogador.faceit_guid && (
						   <>
							   <Link onClick={(e) => e.stopPropagation()} href={`https://www.faceit.com/en/players/${encodeURIComponent(String(jogador.nick || ''))}`} className="px-2 py-1 bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full shadow hover:from-orange-600 hover:to-yellow-500 transition flex items-center" target="_blank">
								   <Image src="/images/faceit.png" alt="Faceit" width={28} height={28} className="inline-block" />
							   </Link>
							   {isAdminView && (
								   <button
									   type="button"
									   className="px-2 py-1 bg-gradient-to-r from-zinc-700 to-zinc-500 rounded-full shadow text-xs text-white hover:from-zinc-800 hover:to-zinc-600 transition flex items-center gap-1"
									   style={{ minWidth: 0 }}
									   onClick={(e) => {
										   e.stopPropagation();
										   if (navigator?.clipboard) {
											   navigator.clipboard.writeText(jogador.faceit_guid);
										   }
									   }}
									   title="Copiar Faceit GUID"
								   >
									   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path fill="currentColor" d="M8 2a2 2 0 0 0-2 2v2H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1h1a3 3 0 0 0 3-3v-2a1 1 0 1 0-2 0v2a1 1 0 0 1-1 1h-1v-4a3 3 0 0 0-3-3H8V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2a1 1 0 1 0 2 0V4a3 3 0 0 0-3-3H8Zm6 8v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3Z"/></svg>
								   </button>
							   )}
						   </>
					   )}
				   </div>
				{canOpenStatsModal && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setTop90Modal({ open: true, jogador });
						}}
						className="mt-1 rounded-md border border-zinc-500/70 bg-zinc-900/80 px-3 py-1 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 transition"
					>
						Ver stats
					</button>
				)}
				{podeEscolherPote && isAdminView && (
					<div className="w-full mt-2 flex flex-col gap-2">
						<select
							className="w-full rounded-lg border border-gold/30 bg-[#101826] text-white text-sm px-3 py-2 outline-none focus:border-gold"
							value={currentPote || ''}
							disabled={savingPote || removingPote}
							onClick={(e) => {
								e.stopPropagation();
							}}
							onChange={(e) => {
								e.stopPropagation();
								const nextPote = Number(e.target.value);
								if (!nextPote || nextPote === currentPote) return;
								handleSetPote(jogadorId, nextPote);
							}}
						>
							<option value="" disabled>Escolher pote</option>
							{[1, 2, 3, 4, 5].map((pote) => (
								<option key={pote} value={pote}>Pote {pote}</option>
							))}
						</select>
						{currentPote && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handleRemoveFromPote(jogadorId);
								}}
								disabled={removingPote || savingPote}
								className="w-full rounded-lg border border-red-400/60 bg-red-500/20 text-red-200 text-sm font-semibold px-3 py-2 hover:bg-red-500/30 transition disabled:opacity-60"
							>
								{removingPote ? 'Removendo...' : 'Remover de Pote'}
							</button>
						)}
						{savingPote && <div className="text-[11px] text-gold mt-1">Salvando...</div>}
					</div>
				)}
			</div>
		);
	}

	function TimesSection() {
		const capitoes = potes[1] || [];
		if (capitoes.length === 0) return <div className="text-zinc-400">Nenhum time criado ainda.</div>;
		return (
			<div className="flex flex-col gap-6">
				{isAdminView && (
					<div className="flex justify-end">
						<button
							type="button"
							onClick={() => setRafflePoteModal({ open: true, selectedPote: null })}
							className="rounded-md border border-blue-400/60 bg-blue-500/20 text-blue-200 text-xs font-semibold px-3 py-2 hover:bg-blue-500/30 transition"
						>
							Sortear Pote
						</button>
					</div>
				)}
				{capitoes.map((capitao: any) => {
					const isRestoring = Boolean(restoringTimeByCapitao[Number(capitao.id)]);
					const time = jogadoresState.filter((j: any) => j.timeid === capitao.id || j.id === capitao.id);
					const dinheiroCapitao = Number(capitao.dinheiro || 0);
					return (
						<div key={capitao.id} className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#0B141F] to-[#111B28] p-4 md:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
							<div className="flex items-center justify-between mb-4">
								<div>
									<div className="font-black tracking-tight text-lg text-white">Time de {capitao.nick}</div>
									<div className="text-xs text-gold mt-1">Dinheiro: R$ {dinheiroCapitao.toLocaleString('pt-BR')}</div>
								</div>
								<div className="flex items-center gap-2">
									{isAdminView && (
										<>
											<button
												type="button"
												onClick={() => handleRestoreTime(Number(capitao.id))}
												disabled={isRestoring}
												className="rounded-md border border-red-400/60 bg-red-500/20 text-red-200 text-xs font-semibold px-2 py-1 hover:bg-red-500/30 transition disabled:opacity-60"
											>
												{isRestoring ? 'Restaurando...' : 'Restaurar time'}
											</button>
										</>
									)}
									<span className="text-[11px] uppercase tracking-[0.2em] text-gold/80">Draft</span>
								</div>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
								{[1,2,3,4,5].map(pote => {
									const membro = time.find((j: any) => j.pote === pote);
									const disponiveisDoPote = getAvailableByPote(pote);
									const minValues: Record<number, number> = { 2: 150000, 3: 100000, 4: 75000, 5: 50000 };
									return (
										<div key={pote} className="min-h-[120px]">
											{membro ? <JogadorCard jogador={membro} podeEscolherPote={false} podeRemoverDoTime={pote !== 1} /> : (
												isAdminView && pote !== 1
													? <div className="h-full rounded-xl border border-dashed border-gold/40 bg-gold/5 p-3 flex flex-col items-center justify-center text-center text-xs text-gold gap-2">
														<div className="font-semibold">Escolher do Pote {pote}</div>
														{minValues[pote] && <div className="text-red-400 font-bold text-xs">Mín: R$ {minValues[pote].toLocaleString('pt-BR')}</div>}
														<button
															onClick={() => openPlayerSelector(capitao, pote)}
															className="w-full rounded-lg border border-gold/60 bg-gold/20 hover:bg-gold/30 text-gold font-semibold px-3 py-2 text-xs transition"
														>
															Buscar Jogador
														</button>
													</div>
													: <div className="h-full rounded-xl border border-dashed border-white/20 bg-white/5 p-3 flex items-center justify-center text-center text-xs text-zinc-300">Vago</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	function PotesSection() {
		return (
			<div className="flex flex-col gap-5">
				{[1,2,3,4,5].map(pote => (
					<div key={pote} className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0C1521] to-[#121C2A] p-4">
						<div className="flex items-center justify-between mb-3">
							<div className="font-extrabold text-white">Pote {pote}</div>
							<span className="text-xs text-zinc-400">{potes[pote]?.length || 0} jogadores</span>
						</div>
						<div className="flex gap-2 flex-wrap justify-center">
							{potes[pote]?.length ? potes[pote].map((j: any) => {
								const canEdit = isAdminView;
								if (!canEdit) return <JogadorCard key={j.id} jogador={j} />;
								
								return (
									<div key={j.id} className="relative">
										<JogadorCard jogador={j} />
										<div className="pointer-events-none absolute top-0 left-0 right-0 flex flex-col gap-2 p-2">
											<select
												className="pointer-events-auto flex-1 rounded-md border border-gold/30 bg-[#101826] text-white text-xs px-2 py-1 outline-none focus:border-gold"
												value={pote}
												disabled={savingPoteById[Number(j.id)] || removingPoteById[Number(j.id)]}
												onChange={(e) => {
													const nextPote = Number(e.target.value);
													if (nextPote === pote) return;
													handleSetPote(Number(j.id), nextPote);
												}}
											>
												{[1, 2, 3, 4, 5].map((p) => (
													<option key={p} value={p}>Pote {p}</option>
												))}
											</select>
											<button
												type="button"
												onClick={() => handleRemoveFromPote(Number(j.id))}
												disabled={savingPoteById[Number(j.id)] || removingPoteById[Number(j.id)]}
												className="pointer-events-auto rounded-md border border-red-400/60 bg-red-500/20 text-red-200 text-[11px] font-semibold px-2 py-1 hover:bg-red-500/30 transition disabled:opacity-60"
											>
												{removingPoteById[Number(j.id)] ? 'Removendo...' : 'Sem pote'}
											</button>
										</div>
									</div>
								);
							}) : <span className="text-zinc-400">Nenhum jogador</span>}
						</div>
					</div>
				))}
				{isAdminView && (
					<button
						onClick={handleResetAllData}
						disabled={resettingAllData}
						className="w-full rounded-lg bg-red-600/30 border border-red-500/50 text-red-300 px-4 py-3 font-semibold hover:bg-red-600/40 transition disabled:opacity-50"
					>
						{resettingAllData ? 'Limpando...' : 'Limpar Tudo'}
					</button>
				)}
			</div>
		);
	}

	function EscolherPoteSection() {
		if (!isAdminView) return <div className="text-zinc-400">Apenas admins podem escolher potes.</div>;
		const filteredPlayers = jogadoresSemPote
			.filter((j: any) =>
				normalizeText(j.nick).toLowerCase().includes(normalizeText(escolherPoteSearchText).toLowerCase())
			)
			.sort((a: any, b: any) => {
				const levelA = Number(a?.level || 0);
				const levelB = Number(b?.level || 0);
				return levelB - levelA;
			});
		return (
			<div className="flex flex-col gap-4">
				<div>
					<input
						type="text"
						placeholder="Buscar jogador por nick..."
						className="w-full rounded-lg border border-gold/40 bg-[#131F2F] text-white px-4 py-3 outline-none focus:border-gold text-sm"
						value={escolherPoteSearchText}
						onChange={(e) => setEscolherPoteSearchText(e.target.value)}
										autoFocus
					/>
				</div>
				<div className="flex flex-wrap gap-4 justify-center">
					{filteredPlayers.length ? filteredPlayers.map((j: any) => <JogadorCard key={j.id} jogador={j} podeEscolherPote={true} />) : <span className="text-zinc-400">Nenhum jogador encontrado.</span>}
				</div>
			</div>
		);
	}

	function PlayerSelectorModal() {
		if (!playerSelectorModal.open || !playerSelectorModal.capitao || !playerSelectorModal.pote) return null;

		const availablePlayers = getAvailableByPote(playerSelectorModal.pote);
		const filteredPlayers = availablePlayers.filter((j: any) =>
			normalizeText(j.nick).toLowerCase().includes(normalizeText(playerSearchText).toLowerCase())
		);

		return (
			<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
				<div className="w-full max-w-2xl rounded-2xl border border-gold/30 bg-[#0F1724] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] max-h-[80vh] overflow-y-auto">
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="text-lg font-black text-white">Selecionar Jogador</div>
							<div className="text-xs text-zinc-300 mt-1">
								{playerSelectorModal.capitao?.nick} - Pote {playerSelectorModal.pote}
							</div>
						</div>
						<button
							onClick={() => setPlayerSelectorModal({ open: false, capitao: null, pote: null })}
							className="text-zinc-400 hover:text-white text-xl"
						>
							✕
						</button>
					</div>

					<div className="mb-4">
						<input
							type="text"
							placeholder="Buscar por nick..."
							className="w-full rounded-lg border border-gold/40 bg-[#131F2F] text-white px-4 py-3 outline-none focus:border-gold text-sm"
							value={playerSearchText}
							onChange={(e) => setPlayerSearchText(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
						{filteredPlayers.length > 0 ? (
							filteredPlayers.map((jogador: any) => {
								const dbLevelRaw = Number(jogador?.level || 0);
								const faceitLevel = Number.isInteger(dbLevelRaw) && dbLevelRaw >= 1 && dbLevelRaw <= 10 ? dbLevelRaw : null;
								const levelImg = getLevelImagePath(faceitLevel);
								return (
									<button
										key={jogador.id}
										onClick={() => selectPlayerFromModal(jogador)}
										className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gold/20 bg-white/5 hover:bg-gold/10 hover:border-gold/40 transition"
									>
										<div className="relative w-16 h-16 rounded-full border-2 border-gold/40 overflow-hidden">
											{String(jogador.faceit_image || jogador.avatar || '').trim() ? (
												<Image
													src={String(jogador.faceit_image || jogador.avatar || '').trim()}
													fill
													alt={jogador.nick}
													className="object-cover"
												/>
											) : (
												<div className="w-full h-full bg-[#1D2A3C] flex items-center justify-center text-[10px] text-zinc-200 px-2 text-center">
													{jogador.nick}
												</div>
											)}
										</div>
										<div className="text-xs font-semibold text-white text-center truncate w-full px-1">
											{jogador.nick}
										</div>
										<Image
											src={levelImg}
											width={28}
											height={28}
											alt={`Level ${faceitLevel ?? '-'}`}
											onError={(e) => {
												const target = e.currentTarget as HTMLImageElement;
												target.src = '/faceitlevel/-1.png';
											}}
										/>
									</button>
								);
							})
						) : (
							<div className="col-span-2 md:col-span-3 text-center text-zinc-400 text-sm py-8">
								Nenhum jogador disponível
							</div>
						)}
					</div>

					<button
						onClick={() => setPlayerSelectorModal({ open: false, capitao: null, pote: null })}
						className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition"
					>
						Cancelar
					</button>
				</div>
			</div>
		);
	}

	function RafflePoteModal() {
		if (!rafflePoteModal.open) return null;

		return (
			<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
				<div className="w-full max-w-md rounded-2xl border border-blue-400/30 bg-[#0F1724] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
					<div className="text-lg font-black text-white">Sortear Pote</div>
					<div className="text-sm text-zinc-300 mt-1">
						Escolha qual pote deseja sortear nos times que não têm
					</div>

					<div className="mt-4 grid grid-cols-2 gap-2">
						{[2, 3, 4, 5].map((pote) => (
							<button
								key={pote}
								onClick={() => {
									setRafflePoteModal({ open: true, selectedPote: pote });
								}}
								className="rounded-lg border border-blue-400/60 bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 font-semibold px-3 py-2 transition text-sm"
							>
								Pote {pote}
							</button>
						))}
					</div>

					<div className="mt-4 flex gap-2 justify-end">
						<button
							type="button"
							onClick={() => setRafflePoteModal({ open: false, selectedPote: null })}
							className="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition"
							disabled={raffleLoading}
						>
							Cancelar
						</button>
						{rafflePoteModal.selectedPote && (
							<button
								type="button"
								onClick={() => performRaffle(rafflePoteModal.selectedPote!)}
								className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 text-sm font-bold text-white hover:brightness-110 transition"
								disabled={raffleLoading}
							>
								{raffleLoading ? 'Sorteando...' : `Sortear Pote ${rafflePoteModal.selectedPote}`}
							</button>
						)}
					</div>
				</div>
			</div>
		);
	}

	function Top90StatsModal() {
		if (!isAdminView || !top90Modal.open || !top90Modal.jogador?.top90Stats) return null;

		const stats = top90Modal.jogador.top90Stats;
		const items = [
			{ label: 'K/D', value: Number(stats.kd || 0).toFixed(2) },
			{ label: 'K/R', value: Number(stats.kr || 0).toFixed(2) },
			{ label: 'Kills', value: String(Math.trunc(Number(stats.k || 0))) },
			{ label: 'Mortes', value: String(Math.trunc(Number(stats.d || 0))) },
		];

		return (
			<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTop90Modal({ open: false, jogador: null })}>
				<div className="w-full max-w-md rounded-2xl border border-zinc-500/40 bg-[#0A0F17] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]" onClick={(e) => e.stopPropagation()}>
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="text-lg font-black text-white">Estatisticas</div>
							<div className="text-xs text-zinc-300 mt-1">{top90Modal.jogador.nick}</div>
						</div>
						<button onClick={() => setTop90Modal({ open: false, jogador: null })} className="text-zinc-400 hover:text-white text-xl">✕</button>
					</div>

					<div className="grid grid-cols-2 gap-3">
						{items.map((item) => (
							<div key={item.label} className="rounded-xl border border-zinc-700/80 bg-zinc-900/70 p-3">
								<div className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">{item.label}</div>
								<div className="mt-1 text-xl font-black text-white">{item.value}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
			<div className="mb-6 md:mb-8">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Copa Draft - {jogadoresState.length} Jogadores</h1>
					{isAdminUser && (
						<div className="inline-flex rounded-xl border border-gold/35 bg-[#0E1724] p-1">
							<button
								type="button"
								onClick={() => setViewAs('admin')}
								className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
									viewAs === 'admin'
										? 'bg-gold text-black shadow-[0_6px_16px_rgba(236,161,73,0.35)]'
										: 'text-zinc-200 hover:bg-white/10'
								}`}
							>
								Ver como Admin
							</button>
							<button
								type="button"
								onClick={() => setViewAs('player')}
								className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
									viewAs === 'player'
										? 'bg-zinc-200 text-black shadow-[0_6px_16px_rgba(255,255,255,0.18)]'
										: 'text-zinc-200 hover:bg-white/10'
								}`}
							>
								Ver como Player
							</button>
						</div>
					)}
				</div>
				{jogadoresState.length === 0 && <p className="mt-2 text-xs text-zinc-400">Nenhum jogador encontrado no banco de dados.</p>}
			</div>



			{tabOptions.length > 0 && (
				<>

					<div className="rounded-2xl border border-white/10 bg-[#08111B]/80 backdrop-blur-sm p-2 mb-6 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
							{tabOptions.map((option) => {
								const active = tab === option.key;
								return (
									<button
										key={option.key}
										onClick={() => setTab(option.key)}
										className={`rounded-xl px-4 py-3 text-left transition-all duration-200 border ${
											active
												? 'bg-gradient-to-r from-gold to-gold-dark text-black border-transparent shadow-[0_8px_20px_rgba(236,161,73,0.45)]'
												: 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-gold/30'
										}`}
									>
										<div className="font-bold text-sm md:text-base">{option.label}</div>
									</button>
								);
							})}
						</div>
					</div>

					<div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0A111A] to-[#0E1825] p-4 md:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
						{tab === 'escolher' && canSeeEscolherTab && <EscolherPoteSection />}
						{tab === 'times' && canSeeTimesTab && <TimesSection />}
						{tab === 'potes' && canSeePotesTab && <PotesSection />}
					</div>
				</>
			)}

			{pickModal.open && (
				<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="w-full max-w-md rounded-2xl border border-gold/30 bg-[#0F1724] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
						<div className="text-lg font-black text-white">Definir gasto da escolha</div>
						<div className="text-sm text-zinc-300 mt-1">
							{pickModal.capitao?.nick} escolheu {pickModal.jogador?.nick} (Pote {pickModal.pote})
						</div>
						<div className="text-xs text-gold mt-1">
							Saldo atual: R$ {Number(pickModal.capitao?.dinheiro || 0).toLocaleString('pt-BR')}
						</div>

						<div className="mt-4">
							<label className="text-xs text-zinc-400">Valor gasto</label>
							<input
								type="number"
								min={0}
								className="mt-1 w-full rounded-lg border border-white/20 bg-[#131F2F] text-white px-3 py-2 outline-none focus:border-gold"
								value={gastoInput}
								onChange={(e) => setGastoInput(e.target.value)}
							/>
						</div>

						<div className="mt-3 grid grid-cols-3 gap-2">
							{[100000, 50000, 10000, 5000, 1000].map((value) => (
								<button
									key={value}
									type="button"
									onClick={() => addGasto(value)}
									className="rounded-md bg-gold/20 border border-gold/40 text-gold text-xs font-semibold px-2 py-1 hover:bg-gold/30 transition"
								>
									+{value.toLocaleString('pt-BR')}
								</button>
							))}
						</div>

						<div className="mt-5 flex gap-2 justify-end">
							<button
								type="button"
								onClick={() => setPickModal({ open: false, capitao: null, jogador: null, pote: null })}
								className="rounded-lg border border-white/20 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 transition"
								disabled={savingPick}
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={confirmPick}
								className="rounded-lg bg-gradient-to-r from-gold to-gold-dark px-3 py-2 text-sm font-bold text-black hover:brightness-110 transition"
								disabled={savingPick}
							>
								{savingPick ? 'Salvando...' : 'Confirmar escolha'}
							</button>
						</div>
					</div>
				</div>
			)}

			<Top90StatsModal />

			<PlayerSelectorModal />
			<RafflePoteModal />
		</div>
	);
}
