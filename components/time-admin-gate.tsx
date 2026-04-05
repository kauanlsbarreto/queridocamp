"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

type StoredFaceitUser = {
	Admin?: number | string;
	admin?: number | string;
};

type TimeAdminGateProps = {
	unlockAt: string;
	releaseLabel?: string;
	title?: string;
	description?: string;
	storageKey?: string;
	adminLevels?: number[];
	onAccessChange?: (canAccess: boolean) => void;
	children: ReactNode;
};

function readAdminLevel(storageKey: string) {
	if (typeof window === "undefined") return null;

	const raw = localStorage.getItem(storageKey);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as StoredFaceitUser;
		const rawLevel = parsed.Admin ?? parsed.admin;
		const level = Number(rawLevel);
		if (!Number.isFinite(level)) return null;
		return level;
	} catch {
		return null;
	}
}

function splitCountdown(ms: number) {
	if (ms <= 0) {
		return { days: 0, hours: 0, minutes: 0, seconds: 0 };
	}

	const totalSeconds = Math.floor(ms / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return { days, hours, minutes, seconds };
}

function formatNumber(value: number) {
	return String(value).padStart(2, "0");
}

export default function TimeAdminGate({
	unlockAt,
	releaseLabel,
	title = "Disponivel em breve",
	description = "Essa pagina ainda esta bloqueada para usuarios comuns.",
	storageKey = "faceit_user",
	adminLevels = [1, 2],
	onAccessChange,
	children,
}: TimeAdminGateProps) {
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [adminLevel, setAdminLevel] = useState<number | null>(null);

	const unlockMs = useMemo(() => {
		const parsed = new Date(unlockAt).getTime();
		return Number.isFinite(parsed) ? parsed : 0;
	}, [unlockAt]);

	useEffect(() => {
		setAdminLevel(readAdminLevel(storageKey));
	}, [storageKey]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1000);

		const handleStorage = (event: StorageEvent) => {
			if (!event.key || event.key === storageKey) {
				setAdminLevel(readAdminLevel(storageKey));
			}
		};

		window.addEventListener("storage", handleStorage);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("storage", handleStorage);
		};
	}, [storageKey]);

	const isAdminAllowed = adminLevel !== null && adminLevels.includes(adminLevel);
	const isBeforeUnlock = unlockMs > 0 && nowMs < unlockMs;
	const isBlocked = isBeforeUnlock && !isAdminAllowed;

	useEffect(() => {
		onAccessChange?.(!isBlocked);
	}, [isBlocked, onAccessChange]);

	if (!isBlocked) {
		return <>{children}</>;
	}

	const countdown = splitCountdown(unlockMs - nowMs);
	const releaseText =
		releaseLabel ||
		new Intl.DateTimeFormat("pt-BR", {
			timeZone: "America/Sao_Paulo",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(new Date(unlockMs));

	return (
		<div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-1 shadow-[0_0_40px_rgba(250,204,21,0.15)]">
			<div className="relative rounded-2xl border border-white/10 bg-black/70 p-6 md:p-10">
				<div className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
				<div className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-amber-500/15 blur-3xl" />

				<div className="relative z-10 text-center">
					<p className="text-xs font-black uppercase tracking-[0.24em] text-gold/80">Acesso antecipado</p>
					<h2 className="mt-2 text-3xl font-black uppercase text-white md:text-4xl">{title}</h2>
					<p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">{description}</p>
					<p className="mt-3 text-sm font-semibold text-gold">Liberacao geral: {releaseText} (Brasilia)</p>

					<div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
						<div className="rounded-xl border border-gold/20 bg-white/5 p-4">
							<p className="text-3xl font-black text-gold">{formatNumber(countdown.days)}</p>
							<p className="mt-1 text-xs uppercase tracking-wider text-zinc-300">Dias</p>
						</div>
						<div className="rounded-xl border border-gold/20 bg-white/5 p-4">
							<p className="text-3xl font-black text-gold">{formatNumber(countdown.hours)}</p>
							<p className="mt-1 text-xs uppercase tracking-wider text-zinc-300">Horas</p>
						</div>
						<div className="rounded-xl border border-gold/20 bg-white/5 p-4">
							<p className="text-3xl font-black text-gold">{formatNumber(countdown.minutes)}</p>
							<p className="mt-1 text-xs uppercase tracking-wider text-zinc-300">Min</p>
						</div>
						<div className="rounded-xl border border-gold/20 bg-white/5 p-4">
							<p className="text-3xl font-black text-gold">{formatNumber(countdown.seconds)}</p>
							<p className="mt-1 text-xs uppercase tracking-wider text-zinc-300">Seg</p>
						</div>
					</div>

					<p className="mt-6 text-xs text-zinc-400">Admin 1 e 2 continuam com acesso antes da liberacao.</p>
				</div>
			</div>
		</div>
	);
}
