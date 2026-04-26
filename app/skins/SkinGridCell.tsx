import type React from "react";
import type { GridCellProps } from "./types";

export function SkinGridCell(
	props: {
		columnIndex: number;
		rowIndex: number;
		style: React.CSSProperties;
	} & GridCellProps,
) {
	const {
		columnIndex,
		rowIndex,
		style,
		filtered,
		setConfigSkin,
		setShowConfig,
		onQuickSave,
		isSelected,
		tab,
	} = props;

	const index = rowIndex * 4 + columnIndex;
	if (index >= filtered.length) return null;
	const item = filtered[index];
	const selected = isSelected(item);

	return (
		<div
			className={`border rounded-xl flex h-full flex-col items-center justify-center bg-zinc-950 shadow transition-all ${
				selected
					? "border-orange-500 ring-1 ring-orange-500/40"
					: "border-zinc-800 hover:border-orange-400"
			}`}
			onClick={() => {
				if (tab === "skins") {
					setConfigSkin(item);
					setShowConfig(true);
				} else {
					onQuickSave(item);
				}
			}}
			onKeyDown={(e) => {
				if (tab === "skins" && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					setConfigSkin(item);
					setShowConfig(true);
				} else if (tab !== "skins" && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onQuickSave(item);
				}
			}}
			role={tab === "skins" ? "button" : undefined}
			tabIndex={tab === "skins" ? 0 : -1}
			aria-label={
				tab === "skins"
					? `Abrir configuracoes de ${item.paint_name || item.agent_name || item.name || "skin"}`
					: undefined
			}
			style={{ ...style, padding: 12, cursor: tab === "skins" ? "pointer" : "default" }}
		>
			<img
				src={item.image}
				alt={item.paint_name || item.agent_name || item.name || ""}
				className="w-32 h-32 object-contain mb-2 rounded-lg bg-zinc-900 mx-auto"
				loading="lazy"
			/>
			<div className="w-full font-semibold text-center mb-2 text-orange-200">
				{item.paint_name || item.agent_name || item.name}
			</div>
		</div>
	);
}
