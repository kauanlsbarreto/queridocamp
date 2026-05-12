"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import BannerCropEditor from "@/components/banner-crop-editor";

type BannerConfig = {
  time: string;
  zoom: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
  ordem: string;
};

type TeamPlayerView = {
  faceitGuid: string;
  nickname: string;
  avatar: string;
  stats: {
    kills: number;
    deaths: number;
    kd: number;
    kr: number;
    adr: number;
    hltvRating: number;
  } | null;
};

type LocalPhotoOption = {
  id: string;
  name: string;
  mimeType: string;
  previewUrl: string;
};

type AvatarFilterMode = "none" | "remove-white" | "white-bg";

type Props = {
  teamName: string;
  bannerImageUrl: string | null;
  teamAudioUrl: string | null;
  initialBannerConfig: BannerConfig | null;
  players: TeamPlayerView[];
};

type FaceBox = {
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const DEFAULT_AVATAR = "/images/cs2-player.png";
const DEFAULT_CONFIG: BannerConfig = {
  time: "",
  zoom: 1,
  x: 0,
  y: 0,
  largura: 1100,
  altura: 280,
  ordem: "",
};

function decodeOrder(ordem: string, players: TeamPlayerView[]) {
  const normalized = String(ordem || "").trim().toLowerCase();
  if (!normalized) return players;

  const picked = new Set<number>();
  const ordered: TeamPlayerView[] = [];

  for (const token of normalized) {
    const idx = parseInt(token, 36);
    if (!Number.isInteger(idx)) continue;
    if (idx < 0 || idx >= players.length) continue;
    if (picked.has(idx)) continue;
    picked.add(idx);
    ordered.push(players[idx]);
  }

  for (let i = 0; i < players.length; i += 1) {
    if (!picked.has(i)) ordered.push(players[i]);
  }

  return ordered;
}

function encodeOrder(ordered: TeamPlayerView[], original: TeamPlayerView[]) {
  const byGuid = new Map<string, number>();
  for (let i = 0; i < original.length; i += 1) {
    byGuid.set(String(original[i]?.faceitGuid || "").trim().toLowerCase(), i);
  }

  const used = new Set<number>();
  const tokens: string[] = [];

  for (const player of ordered) {
    const key = String(player?.faceitGuid || "").trim().toLowerCase();
    const idx = byGuid.get(key);
    if (idx === undefined || used.has(idx)) continue;
    used.add(idx);
    tokens.push(idx.toString(36));
  }

  return tokens.join("").slice(0, 10);
}

function movePlayer(list: TeamPlayerView[], from: number, to: number) {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  if (to < 0 || to >= list.length) return list;

  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadImageDimensions(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar banner."));
    image.src = src;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuid(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isCustomTeamAvatarPath(value: unknown) {
  const url = String(value || "").trim().toLowerCase();
  return url.startsWith("/fotostime/") || url.startsWith("/api/fotostime?") || url.startsWith("https://i.ibb.co/");
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.readAsDataURL(blob);
  });
}

async function applyAvatarFilter(blob: Blob, mode: AvatarFilterMode) {
  if (mode === "none" || mode === "remove-white") return blob;

  const sourceUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Falha ao processar imagem."));
      img.src = sourceUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponivel.");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);

    if (mode === "white-bg") {
      const whiteCanvas = document.createElement("canvas");
      whiteCanvas.width = image.naturalWidth;
      whiteCanvas.height = image.naturalHeight;
      const whiteCtx = whiteCanvas.getContext("2d");
      if (!whiteCtx) throw new Error("Canvas indisponivel.");
      whiteCtx.fillStyle = "#ffffff";
      whiteCtx.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height);
      whiteCtx.drawImage(canvas, 0, 0);

      return await new Promise<Blob>((resolve, reject) => {
        whiteCanvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Falha ao renderizar imagem."));
            return;
          }
          resolve(result);
        }, "image/jpeg", 0.95);
      });
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Falha ao renderizar imagem."));
          return;
        }
        resolve(result);
      }, "image/png", 0.98);
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
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

async function detectFacesBannerConfig(imageUrl: string, baseConfig: BannerConfig) {
  if (typeof window === "undefined") return null;

  const FaceDetectorCtor = (window as Window & {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (input: HTMLImageElement) => Promise<FaceBox[]>;
    };
  }).FaceDetector;

  if (!FaceDetectorCtor) return null;

  try {
    const image = await loadImageDimensions(imageUrl);
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 10 });
    const faces = await detector.detect(image);

    if (!Array.isArray(faces) || faces.length === 0) return null;

    const validBoxes = faces
      .map((face) => face?.boundingBox)
      .filter(Boolean)
      .map((box) => ({
        x: toNumber(box?.x),
        y: toNumber(box?.y),
        width: Math.max(1, toNumber(box?.width)),
        height: Math.max(1, toNumber(box?.height)),
      }));

    if (validBoxes.length === 0) return null;

    const minX = Math.min(...validBoxes.map((box) => box.x));
    const minY = Math.min(...validBoxes.map((box) => box.y));
    const maxX = Math.max(...validBoxes.map((box) => box.x + box.width));
    const maxY = Math.max(...validBoxes.map((box) => box.y + box.height));
    const avgWidth = validBoxes.reduce((sum, box) => sum + box.width, 0) / validBoxes.length;
    const avgHeight = validBoxes.reduce((sum, box) => sum + box.height, 0) / validBoxes.length;

    const paddedX = clamp(minX - avgWidth * 0.5, 0, image.naturalWidth);
    const paddedY = clamp(minY - avgHeight * 0.7, 0, image.naturalHeight);
    const paddedMaxX = clamp(maxX + avgWidth * 0.5, 0, image.naturalWidth);
    const paddedMaxY = clamp(maxY + avgHeight * 1.6, 0, image.naturalHeight);
    const focusWidth = Math.max(1, paddedMaxX - paddedX);
    const focusHeight = Math.max(1, paddedMaxY - paddedY);

    const zoom = Number(
      Math.max(baseConfig.largura / focusWidth, baseConfig.altura / focusHeight).toFixed(2)
    );

    const centerX = paddedX + focusWidth / 2;
    const centerY = paddedY + focusHeight / 2;
    const x = Math.trunc(baseConfig.largura / 2 - centerX * zoom);
    const y = Math.trunc(baseConfig.altura / 2 - centerY * zoom);

    return {
      ...baseConfig,
      zoom,
      x,
      y,
    } satisfies BannerConfig;
  } catch {
    return null;
  }
}

export default function TeamDetailClient({ teamName, bannerImageUrl, teamAudioUrl, initialBannerConfig, players }: Props) {
  const teamAudioRef = useRef<HTMLAudioElement | null>(null);
  const bannerHostRef = useRef<HTMLDivElement | null>(null);
  const [faceitGuid, setFaceitGuid] = useState("");
  const [faceitNickname, setFaceitNickname] = useState("");
  const [steamId64, setSteamId64] = useState("");
  const [adminLevel, setAdminLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [loadingBannerConfig, setLoadingBannerConfig] = useState(false);
  const [bannerHostWidth, setBannerHostWidth] = useState(0);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBannerViewerOpen, setIsBannerViewerOpen] = useState(false);
  const [orderedPlayers, setOrderedPlayers] = useState<TeamPlayerView[]>(players);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");
  const [isOrderEditMode, setIsOrderEditMode] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarPhotos, setAvatarPhotos] = useState<LocalPhotoOption[]>([]);
  const [loadingAvatarPhotos, setLoadingAvatarPhotos] = useState(false);
  const [selectedAvatarPhotoId, setSelectedAvatarPhotoId] = useState("");
  const [selectedAvatarTargetGuid, setSelectedAvatarTargetGuid] = useState("");
  const [selectedAvatarTargetName, setSelectedAvatarTargetName] = useState("");
  const [avatarFilterMode, setAvatarFilterMode] = useState<AvatarFilterMode>("remove-white");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [config, setConfig] = useState<BannerConfig>({
    ...(initialBannerConfig || DEFAULT_CONFIG),
    time: teamName,
  });
  const [draftConfig, setDraftConfig] = useState<BannerConfig>({
    ...(initialBannerConfig || DEFAULT_CONFIG),
    time: teamName,
  });
  const hasSavedBannerConfig = Boolean(initialBannerConfig);

  const isAdmin1 = adminLevel === 1;
  const isTeamMember = useMemo(
    () => players.some((player) => String(player.faceitGuid || "").trim().toLowerCase() === faceitGuid.toLowerCase()),
    [faceitGuid, players]
  );
  const canManagePlayerOrder = isAdmin1;
  const ownGuid = normalizeGuid(faceitGuid);
  const canNonAdminPickOwnAvatar = isTeamMember && !isAdmin1;

  useEffect(() => {
    const localStorageKey = "site_volume";

    const getStoredVolume = () => {
      const raw = localStorage.getItem(localStorageKey);
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 1;
      return Math.min(1, Math.max(0, parsed));
    };

    const currentAudio = teamAudioRef.current;
    if (currentAudio) {
      currentAudio.pause();
      teamAudioRef.current = null;
    }

    if (!teamAudioUrl) return;

    const audio = new Audio(teamAudioUrl);
    audio.loop = false;
    audio.preload = "auto";
    audio.volume = getStoredVolume();
    teamAudioRef.current = audio;

    const tryPlay = () => {
      if (!teamAudioRef.current) return;
      if (teamAudioRef.current.volume <= 0) return;
      void teamAudioRef.current.play().catch(() => {});
    };

    const handleVolumeChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ volume?: number }>;
      const nextVolume = Number(customEvent?.detail?.volume);
      const safeVolume = Number.isFinite(nextVolume)
        ? Math.min(1, Math.max(0, nextVolume))
        : getStoredVolume();

      if (!teamAudioRef.current) return;
      teamAudioRef.current.volume = safeVolume;

      if (safeVolume <= 0) {
        teamAudioRef.current.pause();
        return;
      }

      tryPlay();
    };

    tryPlay();
    window.addEventListener("click", tryPlay, { once: true });
    window.addEventListener("keydown", tryPlay, { once: true });
    window.addEventListener("touchstart", tryPlay, { once: true });
    window.addEventListener("siteVolumeChanged", handleVolumeChanged as EventListener);

    return () => {
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("keydown", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
      window.removeEventListener("siteVolumeChanged", handleVolumeChanged as EventListener);
      audio.pause();
      if (teamAudioRef.current === audio) {
        teamAudioRef.current = null;
      }
    };
  }, [teamAudioUrl]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("faceit_user");
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        faceit_guid?: string;
        nickname?: string;
        steam_id_64?: string;
        steam?: string;
        Admin?: number | string;
        admin?: number | string;
      };

      setFaceitGuid(String(parsed?.faceit_guid || "").trim());
      setFaceitNickname(String(parsed?.nickname || "").trim());
      setSteamId64(String(parsed?.steam_id_64 || parsed?.steam || "").trim());
      const level = Number(parsed?.Admin ?? parsed?.admin ?? 0);
      setAdminLevel(Number.isFinite(level) ? level : 0);
    } catch {
      setFaceitGuid("");
      setFaceitNickname("");
      setSteamId64("");
      setAdminLevel(0);
    }
  }, []);

  useEffect(() => {
    setConfig({
      ...(initialBannerConfig || DEFAULT_CONFIG),
      time: teamName,
    });
    setDraftConfig({
      ...(initialBannerConfig || DEFAULT_CONFIG),
      time: teamName,
    });
  }, [teamName, initialBannerConfig]);

  useEffect(() => {
    setOrderedPlayers(decodeOrder(String(initialBannerConfig?.ordem || ""), players));
  }, [players, initialBannerConfig?.ordem]);

  useEffect(() => {
    let cancelled = false;

    async function resolveNaturalSize() {
      if (!bannerImageUrl) {
        setImageNaturalSize(null);
        return;
      }

      try {
        const image = await loadImageDimensions(bannerImageUrl);
        if (cancelled) return;
        setImageNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      } catch {
        if (cancelled) return;
        setImageNaturalSize(null);
      }
    }

    void resolveNaturalSize();

    return () => {
      cancelled = true;
    };
  }, [bannerImageUrl]);

  useEffect(() => {
    let cancelled = false;

    async function applyAutoFaceFocus() {
      if (!bannerImageUrl || hasSavedBannerConfig) return;

      const baseConfig = {
        ...(initialBannerConfig || DEFAULT_CONFIG),
        time: teamName,
      };

      const detectedConfig = await detectFacesBannerConfig(bannerImageUrl, baseConfig);
      if (!detectedConfig || cancelled) return;

      setConfig(normalizeBannerConfig(detectedConfig, imageNaturalSize));
      setDraftConfig(normalizeBannerConfig(detectedConfig, imageNaturalSize));
    }

    void applyAutoFaceFocus();

    return () => {
      cancelled = true;
    };
  }, [bannerImageUrl, hasSavedBannerConfig, imageNaturalSize, initialBannerConfig, teamName]);

  useEffect(() => {
    const host = bannerHostRef.current;
    if (!host) return;

    const updateWidth = () => setBannerHostWidth(host.clientWidth);
    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(host);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (!isBannerViewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBannerViewerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBannerViewerOpen]);

  useEffect(() => {
    if (!imageNaturalSize) return;

    setConfig((prev) => normalizeBannerConfig(prev, imageNaturalSize));
    setDraftConfig((prev) => normalizeBannerConfig(prev, imageNaturalSize));
  }, [imageNaturalSize]);

  const bannerLayerStyle = useMemo(() => {
    const baseWidth = imageNaturalSize?.width || config.largura;
    const baseHeight = imageNaturalSize?.height || config.altura;
    const width = Math.max(1, baseWidth * config.zoom);
    const height = Math.max(1, baseHeight * config.zoom);

    return {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${config.x}px, ${config.y}px)`,
      backgroundImage: bannerImageUrl ? `url("${bannerImageUrl}")` : undefined,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
    } as const;
  }, [bannerImageUrl, config, imageNaturalSize]);

  const pageBannerScale = useMemo(() => {
    if (!config.largura || !bannerHostWidth) return 1;
    return bannerHostWidth / config.largura;
  }, [config.largura, bannerHostWidth]);

  const pageBannerHeight = Math.max(120, Math.round(config.altura * pageBannerScale));

  async function handleSaveBanner(nextConfig: BannerConfig) {
    if (!isAdmin1) {
      window.alert("Apenas Admin 1 pode salvar o recorte do banner.");
      return;
    }

    if (!faceitGuid) {
      window.alert("Faça login para salvar o banner.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const response = await fetch("/api/copadraft/times/banner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          faceit_guid: faceitGuid,
          time: teamName,
          zoom: Number(nextConfig.zoom.toFixed(2)),
          x: Math.trunc(nextConfig.x),
          y: Math.trunc(nextConfig.y),
          largura: Math.trunc(nextConfig.largura),
          altura: Math.trunc(nextConfig.altura),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSaveMessage(String(data?.message || "Erro ao salvar banner."));
        return;
      }

      const normalizedConfig = normalizeBannerConfig(nextConfig, imageNaturalSize);
      setConfig(normalizedConfig);
      setDraftConfig(normalizedConfig);
      setOrderedPlayers(decodeOrder(String(normalizedConfig.ordem || ""), players));
      setSaveMessage("Banner salvo com sucesso.");
      setIsEditorOpen(false);
    } catch {
      setSaveMessage("Erro inesperado ao salvar banner.");
    } finally {
      setSaving(false);
    }
  }

  async function fetchLatestBannerConfig() {
    try {
      const response = await fetch(`/api/copadraft/times/banner?time=${encodeURIComponent(teamName)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      const dbConfig = data?.config as Partial<BannerConfig> | null;
      if (!dbConfig) return null;

      return {
        time: String(dbConfig.time || teamName),
        zoom: toNumber(dbConfig.zoom) || 1,
        x: Math.trunc(toNumber(dbConfig.x)),
        y: Math.trunc(toNumber(dbConfig.y)),
        largura: Math.max(320, Math.trunc(toNumber(dbConfig.largura) || 1100)),
        altura: Math.max(120, Math.trunc(toNumber(dbConfig.altura) || 280)),
        ordem: String(dbConfig.ordem || "").trim().slice(0, 10),
      } as BannerConfig;
    } catch {
      return null;
    }
  }

  async function openEditor() {
    setDraftConfig({ ...config });
    setIsEditorOpen(true);

    setLoadingBannerConfig(true);
    const latest = await fetchLatestBannerConfig();
    if (latest) {
      const normalizedLatest = normalizeBannerConfig(latest, imageNaturalSize);
      setConfig(normalizedLatest);
      setDraftConfig(normalizedLatest);
      setOrderedPlayers(decodeOrder(String(normalizedLatest.ordem || ""), players));
    }
    setLoadingBannerConfig(false);
  }

  function closeEditor() {
    setIsEditorOpen(false);
  }

  function openBannerViewer() {
    if (!bannerImageUrl) return;
    setIsBannerViewerOpen(true);
  }

  function closeBannerViewer() {
    setIsBannerViewerOpen(false);
  }

  async function openAvatarModal(targetPlayer: TeamPlayerView) {
    const targetGuid = normalizeGuid(targetPlayer.faceitGuid);
    const canAdminOpen = canManagePlayerOrder && isOrderEditMode;
    const canNonAdminOpen = canNonAdminPickOwnAvatar && targetGuid === ownGuid;

    if (!canAdminOpen && !canNonAdminOpen) return;
    if (!ownGuid) return;

    if (!targetGuid) {
      setAvatarMessage("Jogador invalido para trocar foto.");
      return;
    }

    setIsAvatarModalOpen(true);
    setAvatarMessage("");
    setSelectedAvatarTargetGuid(targetGuid);
    setSelectedAvatarTargetName(String(targetPlayer.nickname || "Jogador"));
    setAvatarPhotos([]);
    setSelectedAvatarPhotoId("");
    setLoadingAvatarPhotos(true);

    try {
      const response = await fetch(
        `/api/copadraft/times/avatar-options?time=${encodeURIComponent(teamName)}&faceit_guid=${encodeURIComponent(faceitGuid)}&_t=${Date.now()}`,
        { method: "GET", cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAvatarMessage(String(data?.message || "Erro ao listar fotos da pasta."));
        setAvatarPhotos([]);
        setSelectedAvatarPhotoId("");
        return;
      }

      const photos = Array.isArray(data?.photos) ? (data.photos as LocalPhotoOption[]) : [];
      setAvatarPhotos(photos);
      setSelectedAvatarPhotoId(photos[0]?.id || "");
      if (photos.length === 0) {
        setAvatarMessage("Nenhuma foto encontrada na pasta do time.");
      }
    } catch {
      setAvatarPhotos([]);
      setSelectedAvatarPhotoId("");
      setAvatarMessage("Erro inesperado ao buscar fotos da pasta.");
    } finally {
      setLoadingAvatarPhotos(false);
    }
  }

  function closeAvatarModal() {
    setIsAvatarModalOpen(false);
    setAvatarMessage("");
    setSelectedAvatarTargetGuid("");
    setSelectedAvatarTargetName("");
  }

  async function saveSelectedAvatar() {
    const canAdminSave = canManagePlayerOrder && isOrderEditMode;
    const canNonAdminSave = canNonAdminPickOwnAvatar && selectedAvatarTargetGuid === ownGuid;
    if (!canAdminSave && !canNonAdminSave) return;
    if (!selectedAvatarPhotoId) {
      setAvatarMessage("Selecione uma foto antes de salvar.");
      return;
    }

    if (!selectedAvatarTargetGuid) {
      setAvatarMessage("Selecione um jogador para aplicar a foto.");
      return;
    }

    const selected = avatarPhotos.find((photo) => photo.id === selectedAvatarPhotoId);
    if (!selected) {
      setAvatarMessage("Foto selecionada invalida.");
      return;
    }

    setSavingAvatar(true);
    setAvatarMessage("");

    try {
      const response = await fetch("/api/copadraft/times/avatar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          faceit_guid: faceitGuid,
          nickname: faceitNickname,
          steam_id_64: steamId64,
          player_faceit_guid: selectedAvatarTargetGuid,
          player_nickname: selectedAvatarTargetName,
          time: teamName,
          filter_mode: avatarFilterMode,
          filename: selected.name,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAvatarMessage(String(data?.message || "Erro ao salvar avatar."));
        return;
      }

      const savedPath = String(data?.avatarPathVersioned || data?.avatarPath || "").trim();
      if (savedPath) {
        setOrderedPlayers((prev) =>
          prev.map((player) => {
            if (normalizeGuid(player.faceitGuid) !== selectedAvatarTargetGuid) return player;
            return { ...player, avatar: savedPath };
          })
        );
      }

      setAvatarMessage("Foto de perfil salva com sucesso.");
      setOrderMessage(`Foto de perfil de ${selectedAvatarTargetName || "jogador"} atualizada com sucesso.`);
      window.location.reload();
    } catch {
      setAvatarMessage("Erro inesperado ao salvar avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function savePlayerOrder() {
    if (!canManagePlayerOrder) {
      setOrderMessage("Somente Admin 1 pode alterar a ordem.");
      return;
    }

    if (!faceitGuid) {
      setOrderMessage("Faça login para alterar a ordem.");
      return;
    }

    const ordem = encodeOrder(orderedPlayers, players);
    setSavingOrder(true);
    setOrderMessage("");

    try {
      const response = await fetch("/api/copadraft/times/banner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          faceit_guid: faceitGuid,
          time: teamName,
          zoom: Number(config.zoom.toFixed(2)),
          x: Math.trunc(config.x),
          y: Math.trunc(config.y),
          largura: Math.trunc(config.largura),
          altura: Math.trunc(config.altura),
          ordem,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setOrderMessage(String(data?.message || "Erro ao salvar ordem."));
        return;
      }

      const nextConfig = {
        ...config,
        ordem,
      } satisfies BannerConfig;
      setConfig(nextConfig);
      setDraftConfig((prev) => ({ ...prev, ordem }));
      setOrderedPlayers(decodeOrder(ordem, players));
      setOrderMessage("Ordem dos jogadores salva com sucesso.");
    } catch {
      setOrderMessage("Erro inesperado ao salvar ordem.");
    } finally {
      setSavingOrder(false);
    }
  }

  function handlePlayerDragEnd(result: DropResult) {
    if (!canManagePlayerOrder || !isOrderEditMode) return;
    if (!result.destination) return;

    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    setOrderedPlayers((prev) => movePlayer(prev, from, to));
  }

  const displayedPlayers = orderedPlayers;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      <div className="relative mx-auto max-w-6xl space-y-6">
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">Copa Draft</p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#071331]/85 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          {bannerImageUrl ? (
            <div>
              <div ref={bannerHostRef} className="w-full">
                <div
                  className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-white/15 bg-[#04102b]"
                  style={{ width: "100%", height: `${pageBannerHeight}px` }}
                  onClick={openBannerViewer}
                >
                  <div
                    className="absolute left-0 top-0"
                    style={{
                      width: `${config.largura}px`,
                      height: `${config.altura}px`,
                      transform: `scale(${pageBannerScale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <div className="select-none" style={bannerLayerStyle} />
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-2xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] md:text-3xl">
                    {teamName}
                  </p>

                  {isAdmin1 ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openEditor();
                      }}
                      className="absolute right-3 top-3 rounded-md border border-white/25 bg-black/65 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white opacity-0 transition hover:bg-black/85 group-hover:opacity-100"
                    >
                      Editar banner
                    </button>
                  ) : null}
                </div>
              </div>

              {saveMessage ? <p className="px-3 py-2 text-xs text-zinc-200">{saveMessage}</p> : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 px-4 py-10 text-center text-sm text-zinc-300">
              Sem foto
            </div>
          )}
        </section>

        {isEditorOpen && isAdmin1 && bannerImageUrl ? (
          <BannerCropEditor
            isOpen={isEditorOpen}
            teamName={teamName}
            imageUrl={bannerImageUrl}
            config={draftConfig}
            savedConfig={config}
            imageNaturalSize={imageNaturalSize}
            loadingBannerConfig={loadingBannerConfig}
            saving={saving}
            onCancel={closeEditor}
            onSave={(next) =>
              void handleSaveBanner({
                ...draftConfig,
                ...next,
                ordem: String(next.ordem ?? draftConfig.ordem ?? ""),
              })
            }
            onConfigChange={(next) =>
              setDraftConfig((prev) =>
                normalizeBannerConfig(
                  {
                    ...prev,
                    ...next,
                    time: teamName,
                  },
                  imageNaturalSize
                )
              )
            }
          />
        ) : null}

        {isBannerViewerOpen && bannerImageUrl ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={closeBannerViewer}>
            <div className="relative w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={closeBannerViewer}
                className="absolute right-2 top-2 z-10 rounded-md border border-white/25 bg-black/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-black/90"
              >
                Fechar
              </button>
              <img
                src={bannerImageUrl}
                alt={`Banner completo do time ${teamName}`}
                className="max-h-[88vh] w-full rounded-xl border border-white/20 object-contain"
              />
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-cyan-300/25 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black uppercase tracking-[0.08em] text-cyan-200">Jogadores</h2>
            {canManagePlayerOrder ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderEditMode((prev) => !prev);
                    setOrderMessage("");
                  }}
                  aria-label="Editar ordem"
                  title="Editar ordem"
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                    isOrderEditMode
                      ? "border-cyan-200/60 bg-cyan-300/20 text-cyan-100 hover:bg-cyan-300/30"
                      : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </button>

                {isOrderEditMode ? (
                  <button
                    type="button"
                    onClick={() => void savePlayerOrder()}
                    disabled={savingOrder}
                    className="rounded-md border border-amber-200/50 bg-amber-300/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-100 transition hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingOrder ? "Salvando ordem..." : "Salvar ordem"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {orderMessage ? <p className="mb-3 text-xs text-zinc-300">{orderMessage}</p> : null}

          {displayedPlayers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-zinc-300">
              Nenhum jogador encontrado para este time.
            </div>
          ) : (
            <DragDropContext onDragEnd={handlePlayerDragEnd}>
              <Droppable
                droppableId="team-players"
                direction="horizontal"
                isDropDisabled={!canManagePlayerOrder || !isOrderEditMode}
              >
                {(dropProvided) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className="flex gap-6 overflow-x-auto pb-2 md:overflow-visible"
                  >
                    {displayedPlayers.map((player, index) => (
                      <Draggable
                        key={`${player.faceitGuid}-${player.nickname}`}
                        draggableId={`player-${player.faceitGuid || index}`}
                        index={index}
                          isDragDisabled={!canManagePlayerOrder || !isOrderEditMode}
                      >
                        {(dragProvided, snapshot) => (
                          (() => {
                            const draggableStyle = {
                              ...(dragProvided.draggableProps.style || {}),
                              zIndex: snapshot.isDragging ? 9999 : "auto",
                            };
                            const hasCustomAvatar = isCustomTeamAvatarPath(player.avatar);

                            const card = (
                              <article
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={draggableStyle}
                                className={`min-w-[170px] shrink-0 text-center transition ${
                                  canManagePlayerOrder && isOrderEditMode ? "cursor-grab active:cursor-grabbing" : ""
                                } ${snapshot.isDragging ? "scale-[1.02] rounded-xl bg-[#0a1634]" : ""} md:min-w-0 md:flex-1`}
                              >
                                {canManagePlayerOrder && isOrderEditMode ? (
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">Arraste para mover</p>
                                ) : null}

                                <div className="mb-3 flex justify-center">
                                  {hasCustomAvatar ? (
                                    <div className="relative h-[14.3rem] w-[14.3rem] overflow-hidden">
                                      <img
                                        src={player.avatar || DEFAULT_AVATAR}
                                        alt={player.nickname}
                                        className="h-full w-full object-contain"
                                        onError={(e) => {
                                          e.currentTarget.src = DEFAULT_AVATAR;
                                        }}
                                      />
                                      <p className="absolute inset-x-0 bottom-1 px-1 text-center text-xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                                        {player.nickname}
                                      </p>
                                    </div>
                                  ) : (
                                    <img
                                      src={player.avatar || DEFAULT_AVATAR}
                                      alt={player.nickname}
                                      className="h-20 w-20 rounded-full border-2 border-cyan-300/35 object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = DEFAULT_AVATAR;
                                      }}
                                    />
                                  )}
                                </div>

                                {!hasCustomAvatar ? (
                                  <p className="mb-2 truncate text-sm font-black uppercase tracking-wide text-white">{player.nickname}</p>
                                ) : null}

                                {(canManagePlayerOrder && isOrderEditMode) || (canNonAdminPickOwnAvatar && normalizeGuid(player.faceitGuid) === ownGuid) ? (
                                  <button
                                    type="button"
                                    onClick={() => void openAvatarModal(player)}
                                    className="mb-2 rounded-md border border-cyan-200/45 bg-cyan-300/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-300/35"
                                  >
                                    Escolher foto
                                  </button>
                                ) : null}

                                {player.stats ? (
                                  <div className="space-y-1 text-xs text-zinc-200">
                                    <p><span className="text-zinc-400">Kills:</span> <span className="font-bold text-white">{player.stats.kills}</span></p>
                                    <p><span className="text-zinc-400">Mortes:</span> <span className="font-bold text-white">{player.stats.deaths}</span></p>
                                    <p><span className="text-zinc-400">K/D:</span> <span className="font-bold text-white">{player.stats.kd.toFixed(2)}</span></p>
                                    <p><span className="text-zinc-400">ADR:</span> <span className="font-bold text-white">{player.stats.adr.toFixed(1)}</span></p>
                                    <p><span className="text-zinc-400">HLTV 2.0:</span> <span className="font-bold text-white">{player.stats.hltvRating.toFixed(2)}</span></p>
                                  </div>
                                ) : null}
                              </article>
                            );

                            if (snapshot.isDragging && typeof document !== "undefined") {
                              return createPortal(card, document.body);
                            }

                            return card;
                          })()
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </section>
      </div>

      {isAvatarModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={closeAvatarModal}>
          <div
            className="w-full max-w-5xl rounded-2xl border border-cyan-300/30 bg-[#071331] p-4 shadow-[0_24px_55px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.08em] text-cyan-100">Escolher foto de perfil {selectedAvatarTargetName ? `- ${selectedAvatarTargetName}` : ""}</h3>
              <button
                type="button"
                onClick={closeAvatarModal}
                className="rounded-md border border-white/25 bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-100 hover:bg-black/65"
              >
                Fechar
              </button>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setAvatarFilterMode("none")}
                className={`rounded-md border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                  avatarFilterMode === "none"
                    ? "border-cyan-200/60 bg-cyan-300/20 text-cyan-100"
                    : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                Sem filtro
              </button>
              <button
                type="button"
                onClick={() => setAvatarFilterMode("remove-white")}
                className={`rounded-md border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                  avatarFilterMode === "remove-white"
                    ? "border-cyan-200/60 bg-cyan-300/20 text-cyan-100"
                    : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                Remover fundo 
              </button>
              <button
                type="button"
                onClick={() => setAvatarFilterMode("white-bg")}
                className={`rounded-md border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                  avatarFilterMode === "white-bg"
                    ? "border-cyan-200/60 bg-cyan-300/20 text-cyan-100"
                    : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                }`}
              >
                Fundo branco
              </button>
            </div>

            {loadingAvatarPhotos ? (
              <div className="rounded-xl border border-white/15 bg-[#081739] px-4 py-8 text-center text-sm text-zinc-200">
                Carregando fotos da pasta...
              </div>
            ) : avatarPhotos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-zinc-300">
                Nenhuma foto disponivel para esse time.
              </div>
            ) : (
              <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                {avatarPhotos.map((photo) => {
                  const selected = selectedAvatarPhotoId === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedAvatarPhotoId(photo.id)}
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        selected
                          ? "border-cyan-200/70 bg-cyan-300/10"
                          : "border-white/15 bg-black/20 hover:border-cyan-200/35"
                      }`}
                    >
                      <img src={photo.previewUrl} alt={photo.name} className="h-36 w-full object-contain" loading="lazy" />
                    </button>
                  );
                })}
              </div>
            )}

            {avatarMessage ? <p className="mt-3 text-xs text-zinc-200">{avatarMessage}</p> : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void saveSelectedAvatar()}
                disabled={savingAvatar || loadingAvatarPhotos || avatarPhotos.length === 0}
                className="rounded-md border border-amber-200/50 bg-amber-300/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-100 transition hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {savingAvatar ? "Salvando foto..." : "Salvar foto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
