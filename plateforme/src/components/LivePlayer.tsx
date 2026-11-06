"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { t, type Lang } from "@/lib/i18n";

/**
 * Lecteur d'un événement en direct (lot 8). Deux sources :
 *  - `embed` : iframe d'une plateforme externe (YouTube Live, Facebook Live…), URL validée côté serveur ;
 *  - `hls`   : flux Mux Live, lu par Safari en natif ou par hls.js ailleurs.
 *
 * Contrairement à VideoPlayer, aucune progression n'est enregistrée : un direct n'a pas de position
 * de reprise et n'est pas rattaché à une œuvre du catalogue.
 */
export function LivePlayer({
  src,
  kind,
  title,
  lang,
}: {
  src: string;
  kind: "embed" | "hls";
  title: string;
  lang: Lang;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const hls = useRef<Hls | null>(null);
  const [error, setError] = useState(false);

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
      const player = new HlsJs({ lowLatencyMode: true, liveSyncDurationCount: 3 });
      hls.current = player;
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

  if (kind === "embed") {
    return (
      <div className="aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
        <iframe
          src={src}
          title={title}
          className="size-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
      <video
        ref={video}
        controls
        autoPlay
        muted
        playsInline
        controlsList="nodownload"
        disablePictureInPicture
        className="size-full"
        aria-label={title}
      />
      {error && (
        <p role="alert" className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">
          {t(lang, "video.error")}
        </p>
      )}
    </div>
  );
}
