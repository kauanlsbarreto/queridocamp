"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ClassificacaoAdGateProps = {
  children: ReactNode;
};

const SKIP_DELAY_SECONDS = 10;

export default function ClassificacaoAdGate({ children }: ClassificacaoAdGateProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SKIP_DELAY_SECONDS);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [needsManualStart, setNeedsManualStart] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousVolumeRef = useRef(0.5);

  function formatTime(totalSeconds: number) {
    const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  useEffect(() => {
    setShowAd(true);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!showAd) {
      setCanSkip(false);
      setSecondsLeft(SKIP_DELAY_SECONDS);
      setIsVideoPlaying(false);
      setNeedsManualStart(false);
      setVideoLoadError(false);
      setRemainingSeconds(0);
      return;
    }

    const tryPlay = async () => {
      if (videoRef.current) {
        videoRef.current.volume = volume;
        videoRef.current.muted = isMuted;
      }

      try {
        await videoRef.current?.play();
        setNeedsManualStart(false);
      } catch {
        setNeedsManualStart(true);
      }
    };

    void tryPlay();
  }, [showAd, volume, isMuted]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!showAd || !isVideoPlaying) {
      return;
    }

    const unlockTimer = window.setTimeout(() => {
      setCanSkip(true);
      setSecondsLeft(0);
    }, SKIP_DELAY_SECONDS * 1000);

    const countdownTimer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearTimeout(unlockTimer);
      window.clearInterval(countdownTimer);
    };
  }, [showAd, isVideoPlaying]);

  const skipLabel = useMemo(() => {
    if (canSkip) return "Pular video";
    return `Pular em ${secondsLeft}s`;
  }, [canSkip, secondsLeft]);

  function handleCompleted() {
    setShowAd(false);
    setRemainingSeconds(0);
  }

  function handleSkip() {
    if (!canSkip) return;

    setShowAd(false);
    videoRef.current?.pause();
  }

  async function handleManualStart() {
    try {
      await videoRef.current?.play();
      setNeedsManualStart(false);
    } catch {
      setNeedsManualStart(true);
    }
  }

  function handleToggleMute() {
    if (isMuted || volume === 0) {
      const restoreVolume = previousVolumeRef.current > 0 ? previousVolumeRef.current : 0.5;
      setVolume(restoreVolume);
      setIsMuted(false);
      return;
    }

    previousVolumeRef.current = volume;
    setIsMuted(true);
  }

  function handleVolumeChange(nextVolume: number) {
    setVolume(nextVolume);

    if (nextVolume <= 0) {
      setIsMuted(true);
      return;
    }

    previousVolumeRef.current = nextVolume;
    setIsMuted(false);
  }

  if (!isHydrated) return null;

  if (showAd) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black px-4 py-6">
        <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#050505] p-4 shadow-2xl">
          <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-white/10 bg-black sm:max-w-[400px]">
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md bg-black/65 px-3 py-1 text-xs font-bold tracking-[0.08em] text-white">
              Tempo restante: {formatTime(remainingSeconds)}
            </div>
            <video
              ref={videoRef}
              src="/contabilize.mp4"
              className="mx-auto h-[70vh] max-h-[620px] w-full object-contain"
              autoPlay
              playsInline
              muted={isMuted}
              controls={false}
              preload="auto"
              disablePictureInPicture
              controlsList="nodownload"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onLoadedData={() => {
                setVideoLoadError(false);
                const duration = videoRef.current?.duration;
                if (duration && Number.isFinite(duration)) {
                  setRemainingSeconds(duration);
                }
              }}
              onTimeUpdate={() => {
                const video = videoRef.current;
                if (!video) return;
                if (!Number.isFinite(video.duration) || video.duration <= 0) return;
                setRemainingSeconds(video.duration - video.currentTime);
              }}
              onError={() => {
                setVideoLoadError(true);
                setIsVideoPlaying(false);
              }}
              onEnded={handleCompleted}
            />

            {needsManualStart && !videoLoadError && (
              <button
                type="button"
                onClick={handleManualStart}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 text-sm font-bold uppercase tracking-[0.12em] text-white"
              >
                Clique para iniciar o video
              </button>
            )}

            {videoLoadError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-center">
                <p className="text-sm font-semibold text-white">Nao foi possivel carregar /contabilize.mp4.</p>
                <a
                  href="/contabilize.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-black"
                >
                  Abrir video diretamente
                </a>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100">
              Aguarde para liberar o conteudo
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="min-w-[48px] text-xs font-bold uppercase tracking-[0.08em] text-white"
                >
                  {isMuted || volume === 0 ? "Mudo" : "Som"}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  className="h-1 w-24 cursor-pointer accent-cyan-300"
                  aria-label="Volume do video"
                />
              </div>

              <button
                type="button"
                onClick={handleSkip}
                disabled={!canSkip}
                className="rounded-md bg-white px-4 py-2 text-sm font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {skipLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
    </>
  );
}
