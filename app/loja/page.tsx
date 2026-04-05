"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import PremiumCard from "@/components/premium-card";
import TimeAdminGate from "@/components/time-admin-gate";
import { LOJA_RELEASE_AT_ISO, LOJA_RELEASE_LABEL } from "@/lib/release-gates";

type StoreItem = {
	id: number;
	nome: string;
	descricao: string | null;
	preco: number;
	moedas: number;
	estoque: number;
	imagem_url: string | null;
	categoria: string | null;
	tipo_item: string | null;
	ativo: number;
};

type FaceitUser = {
	faceit_guid?: string;
	Admin?: number;
	admin?: number;
};

type AddItemForm = {
	nome: string;
	descricao: string;
	imagem_url: string;
	categoria: string;
	tipo_item: string;
	estoque: number;
	modo_pagamento: "preco" | "moedas";
	preco: number;
	moedas: number;
	ativo: boolean;
};

type StoreActionMode = "create" | "edit";

type PurchaseModalState = {
	open: boolean;
	item: StoreItem | null;
	label: string;
	file: File | null;
	error: string;
	submitting: boolean;
};

const defaultForm: AddItemForm = {
	nome: "",
	descricao: "",
	imagem_url: "",
	categoria: "",
	tipo_item: "",
	estoque: 0,
	modo_pagamento: "preco",
	preco: 0,
	moedas: 0,
	ativo: true,
};

function resolveStoreImageSrc(imageUrl: string | null) {
	const value = String(imageUrl || "").trim().replace(/\\/g, "/");
	if (!value) return "/images/cs2-player.png";

	if (/^https?:\/\//i.test(value)) {
		return value;
	}

	let localPath = value;
	if (localPath.toLowerCase().startsWith("public/")) {
		localPath = localPath.slice("public".length);
	}

	if (!localPath.startsWith("/")) {
		localPath = `/${localPath}`;
	}

	return localPath;
}

export default function LojaPage() {
	const [user, setUser] = useState<FaceitUser | null>(null);
	const [items, setItems] = useState<StoreItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");
	const [showForm, setShowForm] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [canViewStore, setCanViewStore] = useState(false);
	const [form, setForm] = useState<AddItemForm>(defaultForm);
	const [formMode, setFormMode] = useState<StoreActionMode>("create");
	const [editingItemId, setEditingItemId] = useState<number | null>(null);
	const [purchaseModal, setPurchaseModal] = useState<PurchaseModalState>({
		open: false,
		item: null,
		label: "",
		file: null,
		error: "",
		submitting: false,
	});

	const adminLevel = useMemo(() => {
		if (!user) return null;
		const level = user.Admin ?? user.admin;
		const parsed = Number(level);
		return Number.isFinite(parsed) ? parsed : null;
	}, [user]);

	const isAdmin12 = adminLevel === 1 || adminLevel === 2;

	const loadItems = useCallback(async (guid: string) => {
		setLoading(true);
		setError("");

		try {
			const res = await fetch("/api/loja", {
				headers: guid ? { "x-faceit-guid": guid } : {},
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setItems([]);
				setError(data?.message || "Não foi possível carregar a loja.");
				return;
			}

			setItems(Array.isArray(data.items) ? data.items : []);
		} catch {
			setItems([]);
			setError("Erro ao carregar itens da loja.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const stored = localStorage.getItem("faceit_user");
		if (!stored) {
			setUser(null);
			if (canViewStore) {
				loadItems("");
			} else {
				setLoading(false);
			}
			return;
		}

		try {
			const parsed = JSON.parse(stored) as FaceitUser;
			setUser(parsed);

			if (canViewStore) {
				loadItems(String(parsed.faceit_guid || ""));
			} else {
				setLoading(false);
			}
		} catch {
			setUser(null);
			if (canViewStore) {
				loadItems("");
			} else {
				setLoading(false);
			}
		}
	}, [canViewStore, loadItems]);

	const handleEditItem = (item: StoreItem) => {
		setFormMode("edit");
		setEditingItemId(item.id);
		setForm({
			nome: item.nome,
			descricao: item.descricao || "",
			imagem_url: item.imagem_url || "",
			categoria: item.categoria || "",
			tipo_item: item.tipo_item || "",
			estoque: item.estoque,
			modo_pagamento: item.moedas > 0 ? "moedas" : "preco",
			preco: Number(item.preco || 0),
			moedas: Number(item.moedas || 0),
			ativo: item.ativo === 1,
		});
		setShowForm(true);
	};

	const handleCreateMode = () => {
		setFormMode("create");
		setEditingItemId(null);
		setForm(defaultForm);
		setShowForm((prev) => !prev);
	};

	const openPurchaseModal = (item: StoreItem) => {
		setPurchaseModal({
			open: true,
			item,
			label: "",
			file: null,
			error: "",
			submitting: false,
		});
	};

	const closePurchaseModal = () => {
		setPurchaseModal({
			open: false,
			item: null,
			label: "",
			file: null,
			error: "",
			submitting: false,
		});
	};

	const handleConfirmPurchase = async () => {
		if (!purchaseModal.item) return;

		const faceitGuid = String(user?.faceit_guid || "");
		if (!faceitGuid) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "Você precisa estar logado com Faceit para comprar.",
			}));
			return;
		}

		if (purchaseModal.item.id !== 1) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "No momento, compra disponível apenas para o item ID 1.",
			}));
			return;
		}

		if (!purchaseModal.label.trim()) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "A label é obrigatória.",
			}));
			return;
		}

		if (!purchaseModal.file) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "Selecione uma imagem PNG/JPG/JPEG.",
			}));
			return;
		}

		const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
		if (!allowedTypes.includes(purchaseModal.file.type.toLowerCase())) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "Formato inválido. Use PNG, JPG ou JPEG.",
			}));
			return;
		}

		if (purchaseModal.file.size > 25 * 1024 * 1024) {
			setPurchaseModal((prev) => ({
				...prev,
				error: "A imagem deve ter no máximo 25MB.",
			}));
			return;
		}

		setPurchaseModal((prev) => ({ ...prev, submitting: true, error: "" }));

		try {
			const formData = new FormData();
			formData.append("item_id", String(purchaseModal.item.id));
			formData.append("faceit_guid", faceitGuid);
			formData.append("label", purchaseModal.label.trim());
			formData.append("image", purchaseModal.file);

			const res = await fetch("/api/loja/compra", {
				method: "POST",
				body: formData,
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setPurchaseModal((prev) => ({
					...prev,
					submitting: false,
					error: data?.message || "Erro ao processar compra.",
				}));
				return;
			}

			if (typeof window !== "undefined") {
				const raw = localStorage.getItem("faceit_user");
				if (raw) {
					try {
						const parsed = JSON.parse(raw);
						parsed.points = data?.points;
						localStorage.setItem("faceit_user", JSON.stringify(parsed));
					} catch {
						// no-op
					}
				}
			}

			await loadItems(faceitGuid);
			closePurchaseModal();
		} catch {
			setPurchaseModal((prev) => ({
				...prev,
				submitting: false,
				error: "Erro inesperado ao comprar item.",
			}));
		}
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isAdmin12) return;

		const faceitGuid = String(user?.faceit_guid || "");
		if (!faceitGuid) {
			setError("Não foi possível validar seu usuário admin.");
			return;
		}

		setSubmitting(true);
		setError("");

		try {
			const payload: Record<string, unknown> = {
				faceit_guid: faceitGuid,
				...form,
			};

			if (formMode === "edit" && editingItemId) {
				payload.id = editingItemId;
			}

			const res = await fetch("/api/loja", {
				method: formMode === "edit" ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setError(data?.message || "Erro ao adicionar item.");
				return;
			}

			setForm(defaultForm);
			setShowForm(false);
			setFormMode("create");
			setEditingItemId(null);
			await loadItems(faceitGuid);
		} catch {
			setError("Erro inesperado ao adicionar item.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
			<div className="container mx-auto px-4">
				<TimeAdminGate
					unlockAt={LOJA_RELEASE_AT_ISO}
					releaseLabel={LOJA_RELEASE_LABEL}
					title="Loja abre ao meio-dia"
					description="A loja sera liberada para todos no horario oficial. Enquanto isso, apenas Admin 1 e 2 possuem acesso antecipado."
					onAccessChange={setCanViewStore}
				>
					<div className="mx-auto max-w-6xl space-y-6">
					<PremiumCard>
						<div className="p-6 md:p-8">
							<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
								<div>
									<p className="text-xs uppercase tracking-[0.2em] text-gold/80">Querido Camp</p>
									<h1 className="mt-1 text-3xl font-black uppercase text-white md:text-4xl">Loja</h1>
									<p className="mt-2 text-sm text-zinc-400">
										Itens exclusivos para compra com moeda do site ou preco em reais.
									</p>
								</div>

								{isAdmin12 && (
									<button
										type="button"
										onClick={handleCreateMode}
										className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black transition hover:opacity-90"
									>
										{showForm && formMode === "create" ? "Fechar" : "Adicionar Item"}
									</button>
								)}
							</div>
						</div>
					</PremiumCard>

					{showForm && isAdmin12 && (
						<PremiumCard>
							<form onSubmit={handleSubmit} className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
								<input
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
									placeholder="Nome do item"
									value={form.nome}
									onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
									required
								/>

								<input
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
									placeholder="URL ou public/loja/item.png"
									value={form.imagem_url}
									onChange={(e) => setForm((prev) => ({ ...prev, imagem_url: e.target.value }))}
								/>

								<input
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
									placeholder="Categoria"
									value={form.categoria}
									onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
								/>

								<input
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
									placeholder="Tipo do item"
									value={form.tipo_item}
									onChange={(e) => setForm((prev) => ({ ...prev, tipo_item: e.target.value }))}
								/>

								<input
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold md:col-span-2"
									placeholder="Descricao"
									value={form.descricao}
									onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
								/>

								<input
									type="number"
									min={0}
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
									placeholder="Estoque"
									value={form.estoque}
									onChange={(e) => setForm((prev) => ({ ...prev, estoque: Number(e.target.value) }))}
								/>

								<select
									value={form.modo_pagamento}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											modo_pagamento: e.target.value as "preco" | "moedas",
										}))
									}
									className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
								>
									<option value="preco">Compra por preco (R$)</option>
									<option value="moedas">Compra por moedas</option>
								</select>

								{form.modo_pagamento === "preco" ? (
									<input
										type="number"
										min={0}
										step="0.01"
										className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
										placeholder="Preco em R$"
										value={form.preco}
										onChange={(e) => setForm((prev) => ({ ...prev, preco: Number(e.target.value) }))}
										required
									/>
								) : (
									<input
										type="number"
										min={0}
										className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
										placeholder="Valor em moedas"
										value={form.moedas}
										onChange={(e) => setForm((prev) => ({ ...prev, moedas: Number(e.target.value) }))}
										required
									/>
								)}

								<label className="flex items-center gap-2 text-sm text-zinc-300">
									<input
										type="checkbox"
										checked={form.ativo}
										onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
									/>
									Item ativo
								</label>

								<button
									type="submit"
									disabled={submitting}
									className="rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{submitting ? "Salvando..." : formMode === "edit" ? "Salvar alterações" : "Salvar item"}
								</button>
							</form>
						</PremiumCard>
					)}

					{error && (
						<PremiumCard>
							<div className="p-6 text-sm font-semibold text-red-400">{error}</div>
						</PremiumCard>
					)}

					{loading && (
						<PremiumCard>
							<div className="p-6 text-sm text-zinc-300">Carregando itens da loja...</div>
						</PremiumCard>
					)}

					{!loading && (
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{items.map((item) => (
								<PremiumCard key={item.id}>
									<div className="p-5">
										<div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
											<Image
												src={resolveStoreImageSrc(item.imagem_url)}
												alt={item.nome}
												fill
												className="object-contain"
												unoptimized
											/>
										</div>

										<h2 className="text-lg font-black uppercase text-white">{item.nome}</h2>
										<p className="mt-1 text-sm text-zinc-400">{item.descricao || "Sem descricao"}</p>

										<div className="mt-4 flex flex-wrap gap-2 text-xs">
											{item.categoria && (
												<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
													{item.categoria}
												</span>
											)}
											{item.tipo_item && (
												<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
													{item.tipo_item}
												</span>
											)}
											<span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-gold">
												Estoque: {item.estoque}
											</span>
										</div>

										<div className="mt-4 flex items-center justify-between gap-2">
											{item.moedas > 0 ? (
												<div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-black text-gold">
													<Image src="/moeda.png" alt="Moeda" width={18} height={18} />
													{item.moedas} moedas
												</div>
											) : (
												<div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-black text-green-400">
													R$ {Number(item.preco || 0).toFixed(2)}
												</div>
											)}
										</div>

										<div className="mt-3 flex gap-2">
											{isAdmin12 && (
												<button
													type="button"
													onClick={() => handleEditItem(item)}
													className="flex-1 rounded-lg border border-blue-400/50 bg-blue-500/10 px-3 py-2 text-xs font-bold uppercase text-blue-300 hover:bg-blue-500/20"
												>
													Editar
												</button>
											)}
											<button
												type="button"
												onClick={() => openPurchaseModal(item)}
												className="flex-1 rounded-lg border border-gold bg-gold px-3 py-2 text-xs font-black uppercase text-black transition hover:opacity-90"
											>
												Comprar
											</button>
										</div>
									</div>
								</PremiumCard>
							))}

							{!items.length && (
								<PremiumCard>
									<div className="p-6 text-sm text-zinc-300">Nenhum item ativo na loja no momento.</div>
								</PremiumCard>
							)}
						</div>
					)}

					{purchaseModal.open && purchaseModal.item && (
						<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
							<PremiumCard className="w-full max-w-lg">
								<div className="p-6 md:p-8">
									<h2 className="text-xl font-black uppercase text-white">Confirmar Compra</h2>
									<p className="mt-2 text-sm text-zinc-300">
										Item: <span className="font-bold text-gold">{purchaseModal.item.nome}</span>
									</p>

									<div className="mt-4 space-y-3">
										<input
											type="text"
											placeholder="Label"
											value={purchaseModal.label}
											onChange={(e) =>
												setPurchaseModal((prev) => ({ ...prev, label: e.target.value }))
											}
											className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold"
										/>

										<input
											type="file"
											accept=".png,.jpg,.jpeg,image/png,image/jpeg"
											onChange={(e) => {
												const file = e.target.files?.[0] || null;
												setPurchaseModal((prev) => ({ ...prev, file }));
											}}
											className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1 file:text-xs file:font-black file:text-black"
										/>
										<p className="text-xs text-zinc-400">Arquivo até 25MB. Formatos: PNG, JPG, JPEG.</p>
									</div>

									{purchaseModal.error && (
										<p className="mt-3 text-sm font-semibold text-red-400">{purchaseModal.error}</p>
									)}

									<div className="mt-6 flex gap-2">
										<button
											type="button"
											onClick={closePurchaseModal}
											className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
										>
											Cancelar
										</button>
										<button
											type="button"
											onClick={handleConfirmPurchase}
											disabled={purchaseModal.submitting}
											className="flex-1 rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black disabled:cursor-not-allowed disabled:opacity-50"
										>
											{purchaseModal.submitting ? "Processando..." : "Confirmar"}
										</button>
									</div>
								</div>
							</PremiumCard>
						</div>
					)}
					</div>
				</TimeAdminGate>
			</div>
		</section>
	);
}
