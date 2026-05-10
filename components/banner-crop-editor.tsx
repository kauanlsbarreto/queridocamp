"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";

type BannerConfig = {
  time: string;
  zoom: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
  ordem?: string;
};

type BannerCropEditorProps = {
  isOpen: boolean;
  teamName: string;
  imageUrl: string;
  config: BannerConfig;
  savedConfig: BannerConfig;
  imageNaturalSize: { width: number; height: number } | null;
  loadingBannerConfig: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (next: BannerConfig) => void;
  onConfigChange: (next: BannerConfig) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeBannerConfig(config: BannerConfig, imageSize: { width: number; height: number } | null) {
  if (!imageSize || !imageSize.width || !imageSize.height) return config;

  const zoom = Math.max(0.05, config.zoom || 1);
  const scaledWidth = imageSize.width * zoom;
  const scaledHeight = imageSize.height * zoom;
  const xBounds = scaledWidth >= config.largura
    ? { min: config.largura - scaledWidth, max: 0 }
    : { min: 0, max: config.largura - scaledWidth };
  const yBounds = scaledHeight >= config.altura
    ? { min: config.altura - scaledHeight, max: 0 }
    : { min: 0, max: config.altura - scaledHeight };

  return {
    ...config,
    zoom: Number(zoom.toFixed(2)),
    x: Math.trunc(clamp(config.x, xBounds.min, xBounds.max)),
    y: Math.trunc(clamp(config.y, yBounds.min, yBounds.max)),
  } satisfies BannerConfig;
}

export default function BannerCropEditor({
  isOpen,
  teamName,
  imageUrl,
  config,
  savedConfig,
  imageNaturalSize,
  loadingBannerConfig,
  saving,
  onCancel,
  onSave,
  onConfigChange,
}: BannerCropEditorProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [editorHostWidth, setEditorHostWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const host = editorHostRef.current;
    if (!host) return;

    const updateWidth = () => setEditorHostWidth(host.clientWidth);
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(host);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateWindowHeight = () => setWindowHeight(window.innerHeight);
    updateWindowHeight();
    window.addEventListener("resize", updateWindowHeight);
    return () => window.removeEventListener("resize", updateWindowHeight);
  }, []);

  const baseImageWidth = imageNaturalSize?.width || config.largura;
  const baseImageHeight = imageNaturalSize?.height || config.altura;

  const minZoom = useMemo(() => {
    if (!baseImageWidth || !baseImageHeight) return 0.05;
    return Math.max(0.05, config.largura / baseImageWidth, config.altura / baseImageHeight);
  }, [baseImageHeight, baseImageWidth, config.altura, config.largura]);

  const safeConfig = useMemo(
    () => normalizeBannerConfig({ ...config, zoom: Math.max(config.zoom, minZoom) }, imageNaturalSize),
    [config, imageNaturalSize, minZoom]
  );

  useEffect(() => {
    if (safeConfig.zoom !== config.zoom || safeConfig.x !== config.x || safeConfig.y !== config.y) {
      onConfigChange({ ...safeConfig, time: config.time || teamName });
    }
  }, [config.time, config.x, config.y, config.zoom, onConfigChange, safeConfig, teamName]);

  const scaledImageWidth = Math.max(1, baseImageWidth * safeConfig.zoom);
  const scaledImageHeight = Math.max(1, baseImageHeight * safeConfig.zoom);

  const maxEditorPreviewHeight = useMemo(() => {
    if (!windowHeight) return 460;
    return Math.max(220, windowHeight - 430);
  }, [windowHeight]);

  const editorScale = useMemo(() => {
    if (!editorHostWidth || !safeConfig.largura || !safeConfig.altura) return 1;
    const widthScale = editorHostWidth / safeConfig.largura;
    const heightScale = maxEditorPreviewHeight / safeConfig.altura;
    return Math.min(1, widthScale, heightScale);
  }, [editorHostWidth, maxEditorPreviewHeight, safeConfig.altura, safeConfig.largura]);

  const viewportWidth = Math.max(1, Math.round(safeConfig.largura * editorScale));
  const viewportHeight = Math.max(1, Math.round(safeConfig.altura * editorScale));

  const scaledBounds = useMemo(() => {
    const xBounds = scaledImageWidth >= safeConfig.largura
      ? { min: safeConfig.largura - scaledImageWidth, max: 0 }
      : { min: 0, max: safeConfig.largura - scaledImageWidth };
    const yBounds = scaledImageHeight >= safeConfig.altura
      ? { min: safeConfig.altura - scaledImageHeight, max: 0 }
      : { min: 0, max: safeConfig.altura - scaledImageHeight };

    return {
      minX: xBounds.min,
      maxX: xBounds.max,
      minY: yBounds.min,
      maxY: yBounds.max,
    };
  }, [safeConfig.altura, safeConfig.largura, scaledImageHeight, scaledImageWidth]);

  function updateConfig(next: BannerConfig) {
    onConfigChange(normalizeBannerConfig({ ...next, time: next.time || teamName }, imageNaturalSize));
  }

  function applyZoom(nextZoomRaw: number) {
    const nextZoom = Math.max(minZoom, toNumber(nextZoomRaw) || minZoom);

    const centerX = (safeConfig.largura / 2 - safeConfig.x) / safeConfig.zoom;
    const centerY = (safeConfig.altura / 2 - safeConfig.y) / safeConfig.zoom;

    updateConfig({
      ...safeConfig,
      zoom: Number(nextZoom.toFixed(2)),
      x: Math.trunc(safeConfig.largura / 2 - centerX * nextZoom),
      y: Math.trunc(safeConfig.altura / 2 - centerY * nextZoom),
    });
  }

  function handleDragStart() {
    dragStartRef.current = { x: safeConfig.x, y: safeConfig.y };
  }

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const base = dragStartRef.current;
    if (!base) return;

    const scale = editorScale || 1;
    const nextX = base.x + info.offset.x / scale;
    const nextY = base.y + info.offset.y / scale;

    updateConfig({
      ...safeConfig,
      x: Math.trunc(nextX),
      y: Math.trunc(nextY),
    });

    dragStartRef.current = null;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#060d22] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.6)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black uppercase tracking-wide text-cyan-100">Editor de Banner</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/20 px-3 py-1 text-xs font-bold uppercase text-zinc-200 hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="rounded-xl border border-cyan-300/20 bg-[#020816] p-3">
          {loadingBannerConfig ? (
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-cyan-200/90">Carregando configuracao salva...</p>
          ) : null}
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-300">Imagem movel sob mascara fixa</p>
          <p className="mb-3 text-[11px] text-cyan-200/80">Area de corte: {safeConfig.largura}px x {safeConfig.altura}px</p>

          <div ref={editorHostRef} className="w-full">
            <div className="flex justify-center rounded-lg border border-white/15 bg-[#030913] p-3">
              <div
                className="relative overflow-hidden rounded-xl border border-cyan-300/60 bg-[#030913]"
                style={{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }}
              >
                <motion.div
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={{
                    left: scaledBounds.minX * editorScale,
                    right: scaledBounds.maxX * editorScale,
                    top: scaledBounds.minY * editorScale,
                    bottom: scaledBounds.maxY * editorScale,
                  }}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  className="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
                  style={{
                    width: `${Math.max(1, Math.round(scaledImageWidth * editorScale))}px`,
                    height: `${Math.max(1, Math.round(scaledImageHeight * editorScale))}px`,
                    x: safeConfig.x * editorScale,
                    y: safeConfig.y * editorScale,
                    backgroundImage: `url("${imageUrl}")`,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                  }}
                />

                <div
                  className="pointer-events-none absolute inset-2 rounded-xl border-2 border-cyan-300"
                  style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
                >
                  <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-black uppercase tracking-[0.15em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-lg">
                    Arraste para posicionar
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => applyZoom(safeConfig.zoom - 0.05)}
              className="h-8 w-8 rounded-full border border-white/25 text-lg leading-none text-zinc-200 hover:bg-white/10"
            >
              -
            </button>

            <input
              type="range"
              min={minZoom}
              max={8}
              step={0.01}
              value={safeConfig.zoom}
              onChange={(e) => applyZoom(toNumber(e.target.value))}
              className="w-full"
            />

            <button
              type="button"
              onClick={() => applyZoom(safeConfig.zoom + 0.05)}
              className="h-8 w-8 rounded-full border border-white/25 text-lg leading-none text-zinc-200 hover:bg-white/10"
            >
              +
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">Zoom livre</label>
            <input
              type="number"
              min={minZoom}
              step={0.01}
              value={safeConfig.zoom}
              onChange={(e) => applyZoom(toNumber(e.target.value))}
              className="w-28 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-sm text-white outline-none"
            />
          </div>

          <p className="mt-1 text-xs text-zinc-400">Zoom: {safeConfig.zoom.toFixed(2)} | X: {safeConfig.x}px | Y: {safeConfig.y}px</p>
          <p className="mt-1 text-[11px] text-cyan-200/80">Salvo no banco: Zoom {savedConfig.zoom.toFixed(2)} | X {savedConfig.x}px | Y {savedConfig.y}px</p>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave(safeConfig)}
            disabled={saving}
            className="rounded-md border border-amber-300/50 bg-amber-400/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-100 transition hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
