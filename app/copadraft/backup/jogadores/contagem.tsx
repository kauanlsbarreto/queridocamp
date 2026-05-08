"use client";

import { useEffect, useMemo, useState } from "react";

export const COPADRAFT_POTES_RELEASE_AT_ISO = "2026-05-06T20:30:00-03:00";
export const COPADRAFT_POTES_RELEASE_LABEL = "06/05/2026 20:30";

type CountdownParts = {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
};

function splitCountdown(ms: number): CountdownParts {
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

export function formatCountdownUnit(value: number) {
	return String(value).padStart(2, "0");
}

export function usePotesReleaseCountdown(unlockAt = COPADRAFT_POTES_RELEASE_AT_ISO) {
	const [nowMs, setNowMs] = useState(() => Date.now());

	const unlockMs = useMemo(() => {
		const parsed = new Date(unlockAt).getTime();
		return Number.isFinite(parsed) ? parsed : 0;
	}, [unlockAt]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1000);

		return () => {
			window.clearInterval(timer);
		};
	}, []);

	const isReleased = unlockMs > 0 ? nowMs >= unlockMs : true;
	const countdown = splitCountdown(unlockMs - nowMs);
	const releaseText =
		COPADRAFT_POTES_RELEASE_LABEL ||
		new Intl.DateTimeFormat("pt-BR", {
			timeZone: "America/Sao_Paulo",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(new Date(unlockMs));

	return {
		nowMs,
		unlockMs,
		isReleased,
		countdown,
		releaseText,
	};
}

