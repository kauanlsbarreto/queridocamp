"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PremiumCard from "@/components/premium-card";
import PageAccessGate from "@/components/page-access-gate";
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
moedas: number;
preco: number;
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

type WallpaperSuccessModalState = {
open: boolean;
itemName: string;
};

type PaymentMethodId = "PIX" | "CREDIT_CARD";

type PaymentMethodOption = {
id: PaymentMethodId;
label: string;
image: string;
opensExternalPage: boolean;
};

type PaymentMethodModalState = {
open: boolean;
item: StoreItem | null;
error: string;
submittingMethod: PaymentMethodId | null;
};

type BillingProfile = {
billing_full_name: string;
billing_company_name: string;
billing_cpf_cnpj: string;
billing_street: string;
billing_number: string;
billing_complement: string;
billing_neighborhood: string;
billing_city: string;
billing_state: string;
billing_postal_code: string;
billing_country: string;
billing_phone: string;
};

type TopPlayer = {
id: number;
nickname: string;
avatar: string;
points: number;
};

type BillingModalMode = "summary" | "edit";

type BillingModalState = {
open: boolean;
item: StoreItem | null;
profile: BillingProfile;
mode: BillingModalMode;
loading: boolean;
saving: boolean;
error: string;
};

type PixModalState = {
open: boolean;
itemName: string;
paymentId: number | null;
qrCodeImageUrl: string;
qrCodeText: string;
expiresAt: string;
};

type PaymentFeedbackModalState = {
open: boolean;
title: string;
message: string;
isError: boolean;
};

const PAYMENT_METHODS: PaymentMethodOption[] = [
{ id: "PIX", label: "PIX", image: "/images/payments/pix.svg", opensExternalPage: false },
{ id: "CREDIT_CARD", label: "Credito", image: "/images/payments/credit-card.svg", opensExternalPage: true },
];

const EMPTY_BILLING_PROFILE: BillingProfile = {
billing_full_name: "",
billing_company_name: "",
billing_cpf_cnpj: "",
billing_street: "",
billing_number: "",
billing_complement: "",
billing_neighborhood: "",
billing_city: "",
billing_state: "",
billing_postal_code: "",
billing_country: "Brasil",
billing_phone: "",
};

const LOCALHOST_BILLING_PROFILE: BillingProfile = {
billing_full_name: "Teste Local Querido Camp",
billing_company_name: "",
billing_cpf_cnpj: "12345678909",
billing_street: "Rua de Teste",
billing_number: "123",
billing_complement: "Apto 4",
billing_neighborhood: "Centro",
billing_city: "Sao Paulo",
billing_state: "SP",
billing_postal_code: "01001-000",
billing_country: "Brasil",
billing_phone: "11999999999",
};

const defaultForm: AddItemForm = {
nome: "",
descricao: "",
imagem_url: "",
categoria: "",
tipo_item: "",
estoque: 0,
moedas: 0,
preco: 0,
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

function isWallpaperItem(item: Pick<StoreItem, "categoria"> | null | undefined) {
return String(item?.categoria || "").trim().toLowerCase() === "wallpaper";
}

function normalizeBillingProfile(source: Partial<BillingProfile> | null | undefined): BillingProfile {
return {
billing_full_name: String(source?.billing_full_name || "").trim(),
billing_company_name: String(source?.billing_company_name || "").trim(),
billing_cpf_cnpj: String(source?.billing_cpf_cnpj || "").trim(),
billing_street: String(source?.billing_street || "").trim(),
billing_number: String(source?.billing_number || "").trim(),
billing_complement: String(source?.billing_complement || "").trim(),
billing_neighborhood: String(source?.billing_neighborhood || "").trim(),
billing_city: String(source?.billing_city || "").trim(),
billing_state: String(source?.billing_state || "").trim(),
billing_postal_code: String(source?.billing_postal_code || "").trim(),
billing_country: String(source?.billing_country || "Brasil").trim() || "Brasil",
billing_phone: String(source?.billing_phone || "").trim(),
};
}

function isBillingProfileComplete(profile: BillingProfile) {
return Boolean(
profile.billing_full_name &&
profile.billing_cpf_cnpj &&
profile.billing_street &&
profile.billing_number &&
profile.billing_neighborhood &&
profile.billing_city &&
profile.billing_state &&
profile.billing_postal_code &&
profile.billing_country &&
profile.billing_phone,
);
}

function formatBillingAddress(profile: BillingProfile) {
return [
[profile.billing_street, profile.billing_number].filter(Boolean).join(", "),
[profile.billing_complement, profile.billing_neighborhood].filter(Boolean).join(", "),
[profile.billing_city, profile.billing_state].filter(Boolean).join(" - "),
[
profile.billing_postal_code ? `CEP ${profile.billing_postal_code}` : "",
profile.billing_country,
].filter(Boolean).join(" | "),
]
.filter(Boolean)
.join("\n");
}

function normalizeCep(value: string) {
return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function formatCep(value: string) {
const digits = normalizeCep(value);
if (digits.length <= 5) return digits;
return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function resolveAvatarSrc(avatar: string | null | undefined) {
const value = String(avatar || "").trim();
if (!value) return "/images/cs2-player.png";
if (/^https?:\/\//i.test(value)) return value;
if (value.startsWith("/")) return value;
return `/${value}`;
}

export default function LojaPage() {
	// Data de lançamento da loja (igual backend)
	const LOJA_RELEASE_AT_ISO = "2026-04-25T00:00:00.000Z"; // ajuste conforme backend
	const LOJA_RELEASE_DATE = new Date(LOJA_RELEASE_AT_ISO);
	const now = new Date();

	const paymentPopupRef = useRef<Window | null>(null);
	const paymentPollRef = useRef<number | null>(null);
	const billingCepLookupTimerRef = useRef<number | null>(null);
	const billingCepLastLookupRef = useRef("");

	const [user, setUser] = useState<FaceitUser | null>(null);
	const [items, setItems] = useState<StoreItem[]>([]);
	const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
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
	const [wallpaperSuccessModal, setWallpaperSuccessModal] = useState<WallpaperSuccessModalState>({
		open: false,
		itemName: "",
	});
	const [paymentMethodModal, setPaymentMethodModal] = useState<PaymentMethodModalState>({
		open: false,
		item: null,
		error: "",
		submittingMethod: null,
	});
	const [billingModal, setBillingModal] = useState<BillingModalState>({
		open: false,
		item: null,
		profile: EMPTY_BILLING_PROFILE,
		mode: "edit",
		loading: false,
		saving: false,
		error: "",
	});
	const [pixModal, setPixModal] = useState<PixModalState>({
		open: false,
		itemName: "",
		paymentId: null,
		qrCodeImageUrl: "",
		qrCodeText: "",
		expiresAt: "",
	});
	const [pixCopied, setPixCopied] = useState(false);
	const [pixRemainingSeconds, setPixRemainingSeconds] = useState<number | null>(null);
	const [paymentFeedbackModal, setPaymentFeedbackModal] = useState<PaymentFeedbackModalState>({
		open: false,
		title: "",
		message: "",
		isError: false,
	});
	const [billingCepLoading, setBillingCepLoading] = useState(false);

	//

const adminLevel = useMemo(() => {
if (!user) return null;
const level = user.Admin ?? user.admin;
const parsed = Number(level);
return Number.isFinite(parsed) ? parsed : null;
}, [user]);

const isAdmin12 = adminLevel === 1 || adminLevel === 2;

const formatCurrencyBRL = useCallback((value: number) => {
const amount = Number(value || 0);
return amount.toLocaleString("pt-BR", {
style: "currency",
currency: "BRL",
});
}, []);

const clearPaymentPolling = useCallback(() => {
if (paymentPollRef.current) {
window.clearInterval(paymentPollRef.current);
paymentPollRef.current = null;
}
}, []);

const hasRealPricePayment = useCallback((item: StoreItem | null | undefined) => {
return Number(item?.preco || 0) > 0;
}, []);

const loadItems = useCallback(async (guid: string, options?: { silent?: boolean }) => {
if (!options?.silent) {
setLoading(true);
}
setError("");

		try {
			const res = await fetch("/api/loja", {
				headers: guid ? { "x-faceit-guid": guid } : {},
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setItems([]);
				setTopPlayers([]);
				setError(data?.message || "Nao foi possivel carregar a loja.");
				return;
			}

			setItems(Array.isArray(data.items) ? data.items : []);
			setTopPlayers(
				Array.isArray(data.topPlayers)
					? data.topPlayers
							.map((player: unknown) => {
								const candidate = player as Partial<TopPlayer>;
								return {
									id: Number(candidate.id || 0),
									nickname: String(candidate.nickname || "Jogador"),
									avatar: String(candidate.avatar || ""),
									points: Math.max(0, Number(candidate.points || 0)),
								};
							})
							.filter((player: TopPlayer) => player.id > 0)
					: [],
			);
		} catch {
			setItems([]);
			setTopPlayers([]);
			setError("Erro ao carregar itens da loja.");
		} finally {
			if (!options?.silent) {
				setLoading(false);
			}
		}
	}, []);

const startPaymentStatusPolling = useCallback(
(paymentId: number, itemName: string, faceitGuid: string) => {
clearPaymentPolling();

let popupClosedAt: number | null = null;

paymentPollRef.current = window.setInterval(async () => {
try {
const popupWasClosed =
paymentPopupRef.current !== null && paymentPopupRef.current.closed;

if (popupWasClosed && popupClosedAt === null) {
popupClosedAt = Date.now();
}

if (!popupWasClosed) {
popupClosedAt = null;
}

const statusRes = await fetch(`/api/loja/pagamento/status?paymentId=${paymentId}`);
const statusData = await statusRes.json().catch(() => ({}));
if (!statusRes.ok) return;

const status = String(statusData?.status || "").toUpperCase();
const isFinal = Boolean(statusData?.isFinal);

const closedForMs = popupClosedAt ? Date.now() - popupClosedAt : 0;
const shouldFinalizeByClosedPopup = popupWasClosed && closedForMs >= 60000;

if (!isFinal && !shouldFinalizeByClosedPopup) return;

clearPaymentPolling();

if (paymentPopupRef.current && !paymentPopupRef.current.closed) {
paymentPopupRef.current.close();
}
paymentPopupRef.current = null;
closePixModal();

if (status === "PAID") {
await loadItems(faceitGuid, { silent: true });
setPaymentFeedbackModal({
open: true,
title: "Pagamento confirmado",
message: `Pagamento de ${itemName} confirmado.`,
isError: false,
});
return;
}

if (status === "EXPIRED") {
setPaymentFeedbackModal({
open: true,
title: "Tempo expirado",
message: "O tempo de pagamento expirou. Tente novamente.",
isError: true,
});
return;
}

if (!isFinal && shouldFinalizeByClosedPopup) {
setPaymentFeedbackModal({
open: true,
title: "Pagamento em processamento",
message:
							"A janela foi fechada antes da confirmacao final. O pagamento pode levar alguns segundos para atualizar.",
isError: false,
});
return;
}

setPaymentFeedbackModal({
open: true,
title: "Pagamento nao concluido",
message: "O PagBank informou que o pagamento nao foi concluido.",
isError: true,
});
} catch {
}
}, 5000);
},
	[clearPaymentPolling, loadItems],
);

useEffect(() => {
		if (typeof window === "undefined") return;

		const stored = localStorage.getItem("faceit_user");
		let isAdmin = false;
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as FaceitUser;
				setUser(parsed);
				const adminLevel = parsed.Admin ?? parsed.admin;
				isAdmin = adminLevel === 1 || adminLevel === 2;
			} catch {}
		}

		// Permite visualizar se for admin OU se já passou da data de lançamento
		const podeVer = isAdmin || now >= LOJA_RELEASE_DATE;
		setCanViewStore(podeVer);

		if (podeVer) {
			if (stored) {
				try {
					const parsed = JSON.parse(stored) as FaceitUser;
					const guid = String(parsed.faceit_guid || "");
					loadItems(guid);
				} catch {
					loadItems("");
				}
			} else {
				loadItems("");
			}
		} else {
			setLoading(false);
		}
	}, [loadItems]);

useEffect(() => {
return () => {
clearPaymentPolling();
if (paymentPopupRef.current && !paymentPopupRef.current.closed) {
paymentPopupRef.current.close();
}
};
}, [clearPaymentPolling]);

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
moedas: Number(item.moedas || 0),
preco: Number(item.preco || 0),
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

const handleBuyItem = (item: StoreItem) => {
if (isWallpaperItem(item) && Number(item.moedas || 0) > 0) {
setPurchaseModal((prev) => ({ ...prev, open: false }));
void handleWallpaperPurchase(item);
return;
}

if (Number(item.moedas || 0) <= 0) {
setError("Este item esta indisponivel para compra no momento.");
return;
}

openPurchaseModal(item);
};

const closePaymentMethodModal = () => {
setPaymentMethodModal({
open: false,
item: null,
error: "",
submittingMethod: null,
});
};

function closePixModal() {
setPixModal({
open: false,
itemName: "",
paymentId: null,
qrCodeImageUrl: "",
qrCodeText: "",
expiresAt: "",
});
setPixCopied(false);
setPixRemainingSeconds(null);
}

const handleCopyPixCode = useCallback(async () => {
if (!pixModal.qrCodeText) return;
try {
await navigator.clipboard.writeText(pixModal.qrCodeText);
setPixCopied(true);
window.setTimeout(() => setPixCopied(false), 2000);
} catch {
setPixCopied(false);
}
}, [pixModal.qrCodeText]);

useEffect(() => {
if (!pixModal.open || !pixModal.expiresAt) {
setPixRemainingSeconds(null);
return;
}

const updateRemaining = () => {
const expiresAtMs = new Date(pixModal.expiresAt).getTime();
if (!Number.isFinite(expiresAtMs)) {
setPixRemainingSeconds(null);
return;
}

const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
setPixRemainingSeconds(remaining);
};

updateRemaining();
const timer = window.setInterval(updateRemaining, 1000);
return () => window.clearInterval(timer);
}, [pixModal.open, pixModal.expiresAt]);

useEffect(() => {
if (!billingModal.open || billingModal.mode !== "edit") return;
if (typeof window === "undefined") return;

const hostname = window.location.hostname.toLowerCase();
if (hostname !== "localhost" && hostname !== "127.0.0.1") return;

const handleKeyDown = (event: KeyboardEvent) => {
if (event.key !== "Insert") return;
event.preventDefault();
setBillingModal((prev) => ({
...prev,
profile: LOCALHOST_BILLING_PROFILE,
error: "",
}));
};

window.addEventListener("keydown", handleKeyDown);
return () => window.removeEventListener("keydown", handleKeyDown);
}, [billingModal.open, billingModal.mode]);

const closePaymentFeedbackModal = () => {
setPaymentFeedbackModal({
open: false,
title: "",
message: "",
isError: false,
});
};

const closeBillingModal = () => {
setBillingModal({
open: false,
item: null,
profile: EMPTY_BILLING_PROFILE,
mode: "edit",
loading: false,
saving: false,
error: "",
});
};

const openBillingSummary = (item: StoreItem, profile: BillingProfile, isComplete: boolean) => {
setBillingModal({
open: true,
item,
profile,
mode: isComplete ? "summary" : "edit",
loading: false,
saving: false,
error: "",
});
};

const openMethodSelectionForItem = (item: StoreItem) => {
setPaymentMethodModal({
open: true,
item,
error: "",
submittingMethod: null,
});
};

const loadBillingForItem = async (item: StoreItem) => {
const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setError("Voce precisa estar logado com Faceit para pagar.");
return;
}

setBillingModal({
open: true,
item,
profile: EMPTY_BILLING_PROFILE,
mode: "edit",
loading: true,
saving: false,
error: "",
});

try {
const res = await fetch(`/api/loja/pagamento/billing?faceit_guid=${encodeURIComponent(faceitGuid)}`);
const data = await res.json().catch(() => ({}));

if (!res.ok) {
setBillingModal((prev) => ({
...prev,
loading: false,
error: data?.message || "Nao foi possivel carregar seus dados de cobranca.",
}));
return;
}

const profile = normalizeBillingProfile(data?.profile);
openBillingSummary(item, profile, Boolean(data?.isComplete) || isBillingProfileComplete(profile));
} catch {
setBillingModal((prev) => ({
...prev,
loading: false,
error: "Erro inesperado ao carregar seus dados de cobranca.",
}));
}
};

const lookupBillingCep = useCallback(async (cepRaw: string) => {
	const cep = normalizeCep(cepRaw);
	if (cep.length !== 8) return;
	if (billingCepLastLookupRef.current === cep) return;
	setBillingCepLoading(true);

	try {
		const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
		const data = await response.json().catch(() => null);

		if (!response.ok || !data || data?.erro) {
			return;
		}

		billingCepLastLookupRef.current = cep;

		setBillingModal((prev) => {
			if (!prev.open || prev.mode !== "edit") return prev;

			return {
				...prev,
				profile: {
					...prev.profile,
					billing_postal_code: formatCep(cep),
					billing_street: String(data.logradouro || prev.profile.billing_street || "").trim(),
					billing_neighborhood: String(data.bairro || prev.profile.billing_neighborhood || "").trim(),
					billing_city: String(data.localidade || prev.profile.billing_city || "").trim(),
					billing_state: String(data.uf || prev.profile.billing_state || "").trim(),
				},
			};
		});
	} catch {
	} finally {
		setBillingCepLoading(false);
	}
}, []);

const updateBillingField = (field: keyof BillingProfile, value: string) => {
const normalizedValue = field === "billing_postal_code" ? formatCep(value) : value;
setBillingModal((prev) => ({
...prev,
profile: {
...prev.profile,
[field]: normalizedValue,
},
error: "",
}));
};

useEffect(() => {
	if (!billingModal.open || billingModal.mode !== "edit") return;

	const cep = normalizeCep(billingModal.profile.billing_postal_code);
	if (cep.length !== 8) return;

	if (billingCepLookupTimerRef.current) {
		window.clearTimeout(billingCepLookupTimerRef.current);
	}

	billingCepLookupTimerRef.current = window.setTimeout(() => {
		void lookupBillingCep(cep);
	}, 350);

	return () => {
		if (billingCepLookupTimerRef.current) {
			window.clearTimeout(billingCepLookupTimerRef.current);
			billingCepLookupTimerRef.current = null;
		}
	};
}, [billingModal.open, billingModal.mode, billingModal.profile.billing_postal_code, lookupBillingCep]);

const handleContinueToPaymentMethods = () => {
if (!billingModal.item) return;
const item = billingModal.item;
closeBillingModal();
openMethodSelectionForItem(item);
};

const handleSaveBillingProfile = async () => {
const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setBillingModal((prev) => ({ ...prev, error: "Voce precisa estar logado com Faceit." }));
return;
}

const profile = normalizeBillingProfile(billingModal.profile);
if (!isBillingProfileComplete(profile)) {
setBillingModal((prev) => ({
...prev,
error: "Preencha nome, documento, telefone e endereco completo.",
}));
return;
}

setBillingModal((prev) => ({ ...prev, saving: true, error: "" }));

try {
const res = await fetch("/api/loja/pagamento/billing", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
faceit_guid: faceitGuid,
...profile,
}),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
setBillingModal((prev) => ({
...prev,
saving: false,
error: data?.message || "Nao foi possivel salvar seus dados de cobranca.",
}));
return;
}

const savedProfile = normalizeBillingProfile(data?.profile || profile);
setBillingModal((prev) => ({
...prev,
profile: savedProfile,
saving: false,
mode: "summary",
error: "",
}));

if (billingModal.item) {
const item = billingModal.item;
closeBillingModal();
openMethodSelectionForItem(item);
}
} catch {
setBillingModal((prev) => ({
...prev,
saving: false,
error: "Erro inesperado ao salvar seus dados de cobranca.",
}));
}
};

const openPaymentMethodsModal = async (item: StoreItem) => {
const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setError("Voce precisa estar logado com Faceit para pagar.");
return;
}

if (hasRealPricePayment(item)) {
await loadBillingForItem(item);
return;
}

handleBuyItem(item);
};

const handleSelectPaymentMethod = async (method: PaymentMethodId) => {
if (!paymentMethodModal.item) return;

const item = paymentMethodModal.item;
const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setPaymentMethodModal((prev) => ({ ...prev, error: "Voce precisa estar logado com Faceit." }));
return;
}

setPaymentMethodModal((prev) => ({ ...prev, submittingMethod: method, error: "" }));

try {
const res = await fetch("/api/loja/pagamento/criar", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
item_id: item.id,
faceit_guid: faceitGuid,
payment_method: method,
}),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
if (data?.code === "BILLING_INCOMPLETE") {
closePaymentMethodModal();
setBillingModal({
open: true,
item,
profile: normalizeBillingProfile(data?.billingProfile),
mode: "edit",
loading: false,
saving: false,
error: data?.message || "Preencha seus dados de cobranca antes de pagar.",
});
return;
}

if (res.status === 409 && Number(data?.existingPaymentId || 0) > 0) {
const existingPaymentId = Number(data.existingPaymentId);

		if (method === "PIX") {
			setPixModal({
				open: true,
				itemName: item.nome,
				paymentId: existingPaymentId,
				qrCodeImageUrl: String(data?.pix?.qrCodeImageUrl || ""),
				qrCodeText: String(data?.pix?.qrCodeText || ""),
				expiresAt: String(data?.expiresAt || ""),
			});
			closePaymentMethodModal();
			startPaymentStatusPolling(existingPaymentId, item.nome, faceitGuid);
			return;
		}

		const existingCheckoutUrl = String(data?.checkoutUrl || "");
		if (existingCheckoutUrl) {
			closePaymentMethodModal();
			window.location.assign(existingCheckoutUrl);
			return;
		}

closePaymentMethodModal();
startPaymentStatusPolling(existingPaymentId, item.nome, faceitGuid);
setPaymentFeedbackModal({
open: true,
title: "Pagamento pendente encontrado",
message:
data?.message ||
"Ja existe um pagamento pendente para este item. Continuamos acompanhando ate confirmar ou expirar.",
isError: true,
});
return;
}

setPaymentMethodModal((prev) => ({
...prev,
submittingMethod: null,
error: data?.message || "Nao foi possivel iniciar o pagamento.",
}));
return;
}

const paymentId = Number(data?.paymentId || 0);
if (!paymentId) {
setPaymentMethodModal((prev) => ({
...prev,
submittingMethod: null,
error: "Pagamento iniciado sem identificador valido.",
}));
return;
}

if (method === "PIX") {
setPixModal({
open: true,
itemName: item.nome,
paymentId,
qrCodeImageUrl: String(data?.pix?.qrCodeImageUrl || ""),
qrCodeText: String(data?.pix?.qrCodeText || ""),
expiresAt: String(data?.expiresAt || ""),
});
closePaymentMethodModal();
startPaymentStatusPolling(paymentId, item.nome, faceitGuid);
return;
}

const checkoutUrl = String(data?.checkoutUrl || "");
if (!checkoutUrl) {
setPaymentMethodModal((prev) => ({
...prev,
submittingMethod: null,
error: "Checkout nao retornou URL de pagamento.",
}));
return;
}

closePaymentMethodModal();
window.location.assign(checkoutUrl);
} catch {
setPaymentMethodModal((prev) => ({
...prev,
submittingMethod: null,
error: "Erro inesperado ao iniciar pagamento.",
}));
}
};

const handleWallpaperPurchase = async (item: StoreItem) => {
const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setError("Voce precisa estar logado com Faceit para comprar.");
return;
}

setError("");

try {
const res = await fetch("/api/loja/compra", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
item_id: item.id,
faceit_guid: faceitGuid,
}),
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
setError(data?.message || "Erro ao comprar wallpaper.");
return;
}

if (typeof window !== "undefined") {
const raw = localStorage.getItem("faceit_user");
if (raw) {
try {
const parsed = JSON.parse(raw);
parsed.points = data?.points;
if (data?.fundoperfil) parsed.fundoperfil = data.fundoperfil;
localStorage.setItem("faceit_user", JSON.stringify(parsed));
} catch {
}
}
}

await loadItems(faceitGuid, { silent: true });
setWallpaperSuccessModal({
open: true,
itemName: item.nome,
});
} catch {
setError("Erro inesperado ao comprar wallpaper.");
}
};

const closeWallpaperSuccessModal = () => {
setWallpaperSuccessModal({
open: false,
itemName: "",
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

if (isWallpaperItem(purchaseModal.item)) {
setPurchaseModal((prev) => ({
...prev,
error: "Wallpaper nao precisa de upload. Use o botao Comprar.",
}));
return;
}

const faceitGuid = String(user?.faceit_guid || "");
if (!faceitGuid) {
setPurchaseModal((prev) => ({
...prev,
error: "Voce precisa estar logado com Faceit para comprar.",
}));
return;
}

if (purchaseModal.item.id !== 1) {
setPurchaseModal((prev) => ({
...prev,
error: "No momento, compra disponivel apenas para o item ID 1.",
}));
return;
}

if (!purchaseModal.label.trim()) {
setPurchaseModal((prev) => ({
...prev,
error: "A label e obrigatoria.",
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
error: "Formato invalido. Use PNG, JPG ou JPEG.",
}));
return;
}

if (purchaseModal.file.size > 25 * 1024 * 1024) {
setPurchaseModal((prev) => ({
...prev,
error: "A imagem deve ter no maximo 25MB.",
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
setError("Nao foi possivel validar seu usuario admin.");
return;
}

const hasMoedas = Number.isFinite(form.moedas) && form.moedas > 0;
const hasPreco = Number.isFinite(form.preco) && form.preco > 0;

if (!hasMoedas && !hasPreco) {
setError("Preencha pelo menos Moedas do site OU Preco em BRL. Item precisa ter um tipo de pagamento.");
return;
}

if (hasMoedas && !Number.isInteger(form.moedas)) {
setError("Moedas deve ser um numero inteiro sem decimais.");
return;
}

if (!Number.isFinite(form.estoque) || form.estoque < 0) {
setError("Estoque deve ser um numero inteiro valido.");
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
<PageAccessGate level={2}>
  <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
    <div className="container mx-auto px-4">
      <div className="mx-auto max-w-6xl space-y-6">
<PremiumCard>
<div className="p-6 md:p-8">
<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
<div>
<p className="text-xs uppercase tracking-[0.2em] text-gold/80">Querido Camp</p>
<h1 className="mt-1 text-3xl font-black uppercase text-white md:text-4xl">Loja</h1>
<p className="mt-2 text-sm text-zinc-400">
Itens exclusivos para compra com moeda do site.
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

<div className="md:col-span-2">
<label className="block text-xs uppercase tracking-[0.1em] text-zinc-400 mb-2">Estoque (quantidade disponivel)</label>
<input
type="number"
min={0}
step="1"
className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
placeholder="Ex: 50 unidades"
value={form.estoque}
onChange={(e) => setForm((prev) => ({ ...prev, estoque: Number(e.target.value) }))}
required
/>
</div>

<div className="md:col-span-2">
<label className="block text-xs uppercase tracking-[0.1em] text-zinc-400 mb-2">Moedas do site (moeda interna - gratis) *opcional</label>
<input
type="number"
min={0}
step="1"
className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
placeholder="Ex: 100 (deixe vazio para item so de pagamento em BRL)"
value={form.moedas || ""}
onChange={(e) => setForm((prev) => ({ ...prev, moedas: e.target.value ? Math.max(0, Math.floor(Number(e.target.value))) : 0 }))}
/>
<p className="mt-1 text-xs text-zinc-500">Numero inteiro sem decimais. Deixe vazio se o item for somente pagamento em BRL (preco em reais).</p>
</div>

<div className="md:col-span-2">
<label className="block text-xs uppercase tracking-[0.1em] text-zinc-400 mb-2">Preco em BRL (opcional - para pagamento real)</label>
<input
type="number"
min={0}
step="0.01"
className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-gold"
placeholder="Ex: 19.90 (deixe vazio se for so moedas internas)"
value={form.preco || ""}
onChange={(e) => setForm((prev) => ({ ...prev, preco: e.target.value ? Number(e.target.value) : 0 }))}
/>
<p className="mt-1 text-xs text-zinc-500">Preenchido = item disponivel com pagamento real. Vazio + moedas preenchidas = item so com moedas internas.</p>
</div>

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
{submitting ? "Salvando..." : formMode === "edit" ? "Salvar alteracoes" : "Salvar item"}
</button>
</form>
</PremiumCard>
)}

{error && (
<PremiumCard>
<div className="p-6 text-sm font-semibold text-red-400">{error}</div>
</PremiumCard>
)}

<div>
<div>
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

<div className="mt-4 flex flex-wrap items-center gap-2">
{Number(item.moedas || 0) > 0 && (
<div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-black text-gold">
<Image src="/moeda.png" alt="Moeda" width={18} height={18} />
{item.moedas} moedas
</div>
)}
{Number(item.preco || 0) > 0 && (
<div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-300">
{formatCurrencyBRL(item.preco)}
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
onClick={() => (hasRealPricePayment(item) ? openPaymentMethodsModal(item) : handleBuyItem(item))}
className="flex-1 rounded-lg border border-gold bg-gold px-3 py-2 text-xs font-black uppercase text-black transition hover:opacity-90"
>
{hasRealPricePayment(item) ? "Pagar" : "Comprar"}
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
</div>

<aside className="mt-6 xl:hidden">
<PremiumCard className="h-fit">
<div className="p-5">
<p className="text-xs uppercase tracking-[0.18em] text-gold/80">Ranking</p>
<h3 className="mt-1 text-lg font-black uppercase text-white">Top 5 moedas</h3>
<p className="mt-1 text-xs text-zinc-400">Jogadores com maior saldo de moedas no site.</p>

<div className="mt-4 space-y-2">
{topPlayers.length > 0 ? (
topPlayers.map((player, index) => (
<div key={player.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
<span className="w-5 text-center text-xs font-black text-gold">#{index + 1}</span>
<div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-black/40">
<Image
src={resolveAvatarSrc(player.avatar)}
alt={player.nickname}
fill
className="object-cover"
unoptimized
/>
</div>
<div className="min-w-0 flex-1">
<p className="truncate text-sm font-bold text-white">{player.nickname}</p>
</div>
<div className="flex items-center gap-1 rounded-md border border-gold/25 bg-gold/10 px-2 py-1">
<Image src="/moeda.png" alt="Moeda" width={14} height={14} />
<span className="text-xs font-black text-gold">{player.points}</span>
</div>
</div>
))
) : (
<div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs text-zinc-400">
Nenhum jogador com moedas encontrado.
</div>
)}
</div>
</div>
</PremiumCard>
</aside>
</div>

{billingModal.open && billingModal.item && (
<div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/85 px-4 py-6">
<PremiumCard className="w-full max-w-2xl">
<div className="p-6 md:p-8">
<h2 className="text-xl font-black uppercase text-white">Dados de cobranca</h2>
<p className="mt-2 text-sm text-zinc-300">
Item: <span className="font-bold text-gold">{billingModal.item.nome}</span>
</p>

{billingModal.loading ? (
<div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-zinc-300">
Carregando seus dados salvos...
</div>
) : billingModal.mode === "summary" ? (
<div className="mt-5 space-y-4">
<div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
<p><span className="font-bold text-white">Nome:</span> {billingModal.profile.billing_full_name || "Nao informado"}</p>
<p><span className="font-bold text-white">Documento:</span> {billingModal.profile.billing_cpf_cnpj || "Nao informado"}</p>
<p><span className="font-bold text-white">Telefone:</span> {billingModal.profile.billing_phone || "Nao informado"}</p>
<p className="whitespace-pre-line"><span className="font-bold text-white">Endereco:</span> {"\n"}{formatBillingAddress(billingModal.profile) || "Nao informado"}</p>
</div>

<div className="grid gap-3 md:grid-cols-3">
<button
type="button"
onClick={() => setBillingModal((prev) => ({ ...prev, mode: "edit", error: "" }))}
className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold uppercase text-zinc-200"
>
Editar
</button>
<button
type="button"
onClick={handleContinueToPaymentMethods}
className="rounded-lg border border-gold bg-gold px-4 py-3 text-sm font-black uppercase text-black md:col-span-2"
>
Continuar para pagamento
</button>
</div>
</div>
) : (
<div className="mt-5 space-y-4">
<div className="grid gap-3 md:grid-cols-2">
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Nome completo *</span>
<input required value={billingModal.profile.billing_full_name} onChange={(event) => updateBillingField("billing_full_name", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">CPF ou CNPJ *</span>
<input required value={billingModal.profile.billing_cpf_cnpj} onChange={(event) => updateBillingField("billing_cpf_cnpj", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300 md:col-span-2">
<span className="mb-1 block font-bold uppercase text-zinc-200">Rua *</span>
<input required value={billingModal.profile.billing_street} onChange={(event) => updateBillingField("billing_street", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Numero *</span>
<input required value={billingModal.profile.billing_number} onChange={(event) => updateBillingField("billing_number", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Bairro *</span>
<input required value={billingModal.profile.billing_neighborhood} onChange={(event) => updateBillingField("billing_neighborhood", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Telefone *</span>
<input required value={billingModal.profile.billing_phone} onChange={(event) => updateBillingField("billing_phone", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Cidade *</span>
<input required value={billingModal.profile.billing_city} onChange={(event) => updateBillingField("billing_city", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Estado *</span>
<input required value={billingModal.profile.billing_state} onChange={(event) => updateBillingField("billing_state", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">CEP *</span>
<input required value={billingModal.profile.billing_postal_code} onChange={(event) => updateBillingField("billing_postal_code", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
{billingCepLoading && <span className="mt-1 block text-xs text-zinc-400">Buscando CEP...</span>}
</label>
<label className="text-sm text-zinc-300">
<span className="mb-1 block font-bold uppercase text-zinc-200">Pais *</span>
<input required value={billingModal.profile.billing_country} onChange={(event) => updateBillingField("billing_country", event.target.value)} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none" />
</label>
</div>

<div className="grid gap-3 md:grid-cols-2">
<button
type="button"
onClick={handleSaveBillingProfile}
disabled={billingModal.saving}
className="rounded-lg border border-gold bg-gold px-4 py-3 text-sm font-black uppercase text-black disabled:opacity-60"
>
{billingModal.saving ? "Salvando..." : "Salvar e continuar"}
</button>
<button
type="button"
onClick={() => {
if (isBillingProfileComplete(billingModal.profile)) {
setBillingModal((prev) => ({ ...prev, mode: "summary", error: "" }));
return;
}
closeBillingModal();
}}
className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold uppercase text-zinc-200"
>
{isBillingProfileComplete(billingModal.profile) ? "Voltar para resumo" : "Cancelar"}
</button>
</div>
</div>
)}

{billingModal.error && (
<p className="mt-4 text-sm font-semibold text-red-400">{billingModal.error}</p>
)}

{!billingModal.loading && (
<div className="mt-6">
<button
type="button"
onClick={closeBillingModal}
className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
>
Fechar
</button>
</div>
)}
</div>
</PremiumCard>
</div>
)}

{paymentMethodModal.open && paymentMethodModal.item && (
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
<PremiumCard className="w-full max-w-sm">
<div className="p-6">
<h2 className="text-xl font-black uppercase text-white">Escolha a forma de pagamento</h2>
<p className="mt-2 text-sm text-zinc-300">
Item: <span className="font-bold text-gold">{paymentMethodModal.item.nome}</span>
</p>
<div className="mt-5 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
{PAYMENT_METHODS.map((method) => (
<button
key={method.id}
type="button"
onClick={() => handleSelectPaymentMethod(method.id)}
disabled={paymentMethodModal.submittingMethod !== null}
className="min-w-[150px] snap-start rounded-xl border border-white/20 bg-white/5 p-4 text-center transition hover:border-gold/60 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50 md:min-w-0"
>
<div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-md border border-white/10 bg-black/30 p-1 md:h-14 md:w-14">
<Image src={method.image} alt={method.label} width={64} height={64} className="h-full w-full object-contain" />
</div>
<p className="text-sm font-black uppercase text-white md:text-xs">{method.label}</p>
<p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
{method.opensExternalPage ? "Abre janela externa" : "Pagamento no site"}
</p>
</button>
))}
</div>

<p className="mt-2 text-xs text-zinc-500 md:hidden">Deslize para ver todos os metodos.</p>

{paymentMethodModal.error && (
<p className="mt-3 text-sm font-semibold text-red-400">{paymentMethodModal.error}</p>
)}

<div className="mt-6">
<button
type="button"
onClick={closePaymentMethodModal}
className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
>
Cancelar
</button>
</div>
</div>
</PremiumCard>
</div>
)}

{pixModal.open && (
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
<PremiumCard className="w-full max-w-md">
<div className="p-6 md:p-8 text-center">
<h2 className="text-xl font-black uppercase text-white">Pagar com PIX</h2>
<p className="mt-2 text-sm text-zinc-300">
Escaneie o QR Code para pagar <span className="font-bold text-gold">{pixModal.itemName}</span>.
</p>

{pixModal.qrCodeImageUrl ? (
<div className="mx-auto mt-4 h-56 w-56 overflow-hidden rounded-lg border border-white/15 bg-white p-3">
<Image
src={pixModal.qrCodeImageUrl}
alt="QR Code PIX"
width={220}
height={220}
className="h-full w-full object-contain"
unoptimized
/>
</div>
) : (
<p className="mt-4 text-xs text-zinc-400">QR Code em processamento...</p>
)}

{pixModal.qrCodeText && (
<div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3 text-left">
<p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Copia e Cola</p>
<p className="mt-2 break-all text-xs text-zinc-300">{pixModal.qrCodeText}</p>
<button
type="button"
onClick={handleCopyPixCode}
className="mt-3 w-full rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-xs font-black uppercase text-gold"
>
{pixCopied ? "Codigo copiado" : "Copiar codigo PIX"}
</button>
</div>
)}

{pixRemainingSeconds !== null && (
<p className="mt-3 text-xs font-semibold text-zinc-300">
Tempo restante: {String(Math.floor(pixRemainingSeconds / 60)).padStart(2, "0")}:
{String(pixRemainingSeconds % 60).padStart(2, "0")}
</p>
)}

<p className="mt-3 text-xs text-zinc-400">
Aguardando confirmacao do PagBank. Esta janela fecha automaticamente quando confirmar ou expirar.
</p>

<div className="mt-5">
<button
type="button"
onClick={closePixModal}
className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold uppercase text-zinc-200"
>
Fechar
</button>
</div>
</div>
</PremiumCard>
</div>
)}

{paymentFeedbackModal.open && (
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
<PremiumCard className="w-full max-w-md">
<div className="p-6 md:p-8 text-center">
<h2 className={`text-xl font-black uppercase ${paymentFeedbackModal.isError ? "text-red-300" : "text-white"}`}>
{paymentFeedbackModal.title}
</h2>
<p className="mt-3 text-sm text-zinc-300">{paymentFeedbackModal.message}</p>
<div className="mt-6">
<button
type="button"
onClick={closePaymentFeedbackModal}
className="w-full rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black"
>
Fechar
</button>
</div>
</div>
</PremiumCard>
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
onChange={(e) => setPurchaseModal((prev) => ({ ...prev, label: e.target.value }))}
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
<p className="text-xs text-zinc-400">Arquivo ate 25MB. Formatos: PNG, JPG, JPEG.</p>
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

{wallpaperSuccessModal.open && (
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4">
<PremiumCard className="w-full max-w-md">
<div className="p-6 md:p-8 text-center">
<h2 className="text-xl font-black uppercase text-white">Compra Finalizada</h2>
<p className="mt-3 text-sm text-zinc-300">
O wallpaper <span className="font-bold text-gold">{wallpaperSuccessModal.itemName}</span> foi comprado com sucesso e aplicado no seu perfil.
</p>
<div className="mt-6">
<button
type="button"
onClick={closeWallpaperSuccessModal}
className="w-full rounded-lg border border-gold bg-gold px-4 py-2 text-sm font-black uppercase text-black"
>
Fechar
</button>
</div>
</div>
</PremiumCard>
</div>
)}
			</div>

			<aside className="fixed top-36 z-[40] hidden w-[300px] xl:right-[8vw] xl:block 2xl:right-[10vw]">
				<PremiumCard className="h-fit">
					<div className="p-5">
						<p className="text-xs uppercase tracking-[0.18em] text-gold/80">Ranking</p>
						<h3 className="mt-1 text-lg font-black uppercase text-white">Top 5</h3>
						<p className="mt-1 text-xs text-zinc-400">Jogadores com maior saldo de moedas no site.</p>

						<div className="mt-4 space-y-2">
							{topPlayers.length > 0 ? (
								topPlayers.map((player, index) => (
									<div key={player.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
										<span className="w-5 text-center text-xs font-black text-gold">#{index + 1}</span>
										<div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/15 bg-black/40">
											<Image
												src={resolveAvatarSrc(player.avatar)}
												alt={player.nickname}
												fill
												className="object-cover"
												unoptimized
											/>
										</div>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-bold text-white">{player.nickname}</p>
										</div>
										<div className="flex items-center gap-1 rounded-md border border-gold/25 bg-gold/10 px-2 py-1">
											<Image src="/moeda.png" alt="Moeda" width={14} height={14} />
											<span className="text-xs font-black text-gold">{player.points}</span>
										</div>
									</div>
								))
							) : (
								<div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs text-zinc-400">
									Nenhum jogador com moedas encontrado.
								</div>
							)}
						</div>
					</div>
				</PremiumCard>
			</aside>
		</div>
	</section>
</PageAccessGate>
);
}
