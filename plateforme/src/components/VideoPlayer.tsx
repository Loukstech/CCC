"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { t, type Lang } from "@/lib/i18n";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SAVE_EVERY_MS = 10_000;

/** Une piste de sous-titres WebVTT, telle qu'elle est stockée en base pour une œuvre. */
export type SubtitleTrack = {
  /** Code langue court (« fr », « en ») : le navigateur s'en sert pour apparier la piste. */
  lang: string;
  /** Libellé lisible (« Français »). */
  label: string;
  /** Adresse du fichier .vtt. */
  src: string;
  isDefault: boolean;
};

type Props = {
  workId: string;
  title: string;
  src: string;
  /** `mp4` : fichier lu directement ; `hls` : flux adaptatif (la qualité s'ajuste à la connexion). */
  kind: "mp4" | "hls";
  initialPosition: number;
  /** Texte discret affiché sur l'image (filigrane : dissuade le partage d'écran, cahier des charges 13). */
  watermark: string;
  /** Pistes de sous-titres disponibles. Vide : aucun bouton ST n'est affiché. */
  tracks?: SubtitleTrack[];
  lang: Lang;
};

/**
 * Lecteur vidéo : reprise là où l'on s'est arrêté, sauts de 10 secondes, vitesse, qualité (flux adaptatif),
 * sous-titres, plein écran. La position est enregistrée côté serveur (toutes les 10 s, à la pause, à la fin,
 * en quittant la page).
 *
 * Les sous-titres sont des pistes WebVTT déclarées par `<track>` : le navigateur les charge lui-même, ce qui
 * fonctionne aussi bien sur un MP4 que sur un flux HLS (hls.js expose les pistes du manifeste). Les pistes
 * démarrent désactivées ; le bouton ST fait défiler « aucun → piste 1 → piste 2 → aucun ».
 */
export function VideoPlayer({
  workId,
  title,
  src,
  kind,
  initialPosition,
  watermark,
  tracks = [],
  lang,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const lastSave = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);
  const [heights, setHeights] = useState<number[]>([]);
  const [level, setLevel] = useState(-1); // -1 : automatique
  const [trackIndex, setTrackIndex] = useState(-1); // -1 : sous-titres désactivés

  // Le mode des pistes ne se règle qu'en JavaScript : on aligne l'état du lecteur sur `trackIndex`.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const list = v.textTracks;
    for (let i = 0; i < list.length; i += 1) {
      list[i].mode = i === trackIndex ? "showing" : "disabled";
    }
  }, [trackIndex, tracks.length, kind, src]);

  const save = useCallback(
    (keepalive = false) => {
      const v = video.current;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
      lastSave.current = Date.now();
      fetch(`/api/videos/${workId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: v.currentTime, duration: v.duration }),
        keepalive,
      }).catch(() => {
        /* hors connexion : la position sera renvoyée à la prochaine sauvegarde */
      });
    },
    [workId],
  );

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      save(true);
    };
  }, [save]);

  // Flux adaptatif : Safari et iPhone le lisent nativement, les autres navigateurs passent par hls.js.
  useEffect(() => {
    if (kind !== "hls") return;
    const v = video.current;
    if (!v) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      return;
    }
    let cancelled = false;
    (async () => {
      const { default: HlsJs } = await import("hls.js");
      if (cancelled) return;
      if (!HlsJs.isSupported()) {
        setError(true);
        return;
      }
      const player = new HlsJs({ capLevelToPlayerSize: true });
      hls.current = player;
      player.on(HlsJs.Events.MANIFEST_PARSED, (_, data) => setHeights(data.levels.map((l) => l.height)));
      player.on(HlsJs.Events.ERROR, (_, data) => data.fatal && setError(true));
      player.loadSource(src);
      player.attachMedia(v);
    })();
    return () => {
      cancelled = true;
      hls.current?.destroy();
      hls.current = null;
    };
  }, [kind, src]);

  const skip = (s: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + s));
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (video.current) video.current.playbackRate = next;
  };
  // Sous-titres : aucun → piste 1 → piste 2 → … → aucun.
  const cycleTrack = () => {
    if (tracks.length === 0) return;
    setTrackIndex((i) => (i + 1 >= tracks.length ? -1 : i + 1));
  };
  const activeTrack = trackIndex >= 0 ? tracks[trackIndex] : null;
  // Qualité : automatique, puis chaque niveau disponible (utile pour économiser les données mobiles).
  const cycleQuality = () => {
    const next = level + 1 >= heights.length ? -1 : level + 1;
    setLevel(next);
    if (hls.current) hls.current.currentLevel = next;
  };
  const fullscreen = () => {
    const el = box.current;
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.(); // iPhone : plein écran de la vidéo seule
  };

  const btn =
    "grid h-11 min-w-11 place-items-center rounded-lg px-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 active:bg-white/20";

  return (
    <div>
      <div ref={box} className="relative aspect-video w-full bg-black sm:overflow-hidden sm:rounded-xl">
        <video
          ref={video}
          src={kind === "mp4" ? src : undefined}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (initialPosition > 0 && initialPosition < v.duration) v.currentTime = initialPosition;
          }}
          onTimeUpdate={() => Date.now() - lastSave.current > SAVE_EVERY_MS && save()}
          onPause={() => save()}
          onEnded={() => save()}
          onError={() => kind === "mp4" && setError(true)}
          className="size-full"
          aria-label={title}
        >
          {tracks.map((track) => (
            <track key={track.lang} kind="subtitles" src={track.src} srcLang={track.lang} label={track.label} />
          ))}
        </video>
        <span
          aria-hidden
          className="pointer-events-none absolute top-3 right-3 rounded bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white/50 select-none"
        >
          {watermark}
        </span>
        {error && (
          <p role="alert" className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm">
            {t(lang, "video.error")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 px-2 pt-2 sm:px-0">
        <div className="flex items-center gap-1">
          <button type="button" className={btn} onClick={() => skip(-10)} aria-label={t(lang, "video.back10")}>
            −10 s
          </button>
          <button type="button" className={btn} onClick={() => skip(10)} aria-label={t(lang, "video.fwd10")}>
            +10 s
          </button>
        </div>
        <div className="flex items-center gap-1">
          {tracks.length > 0 && (
            <button
              type="button"
              className={`${btn} min-w-12 ${activeTrack ? "bg-white/15 text-white" : ""}`}
              onClick={cycleTrack}
              aria-pressed={activeTrack !== null}
              aria-label={
                activeTrack
                  ? t(lang, "video.subtitlesOn", { lang: activeTrack.label })
                  : t(lang, "video.subtitlesOff")
              }
              title={t(lang, "video.subtitles")}
            >
              ST{activeTrack ? ` · ${activeTrack.lang.toUpperCase()}` : ""}
            </button>
          )}
          {heights.length > 1 && (
            <button
              type="button"
              className={`${btn} min-w-16`}
              onClick={cycleQuality}
              aria-label={t(lang, "video.quality", {
                q: level === -1 ? t(lang, "video.qualityAuto") : t(lang, "video.qualityPixels", { n: heights[level] }),
              })}
            >
              {level === -1 ? t(lang, "video.auto") : `${heights[level]}p`}
            </button>
          )}
          <button type="button" className={`${btn} min-w-16`} onClick={cycleSpeed} aria-label={t(lang, "video.speed", { speed })}>
            ×{speed}
          </button>
          <button type="button" className={btn} onClick={fullscreen}>
            {t(lang, "video.fullscreen")}
          </button>
        </div>
      </div>
    </div>
  );
}
