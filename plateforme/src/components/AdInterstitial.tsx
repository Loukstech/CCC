"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdItem } from "@/components/AdBanner";
import { t, type Lang } from "@/lib/i18n";

/** Secondes pendant lesquelles l'annonce reste à l'écran avant que le bouton « Continuer » s'active. */
const COUNTDOWN = 8;

type Props = {
  ads: AdItem[];
  lang: Lang;
  /** Identifiant de l'œuvre : la publicité ne revient pas si le visiteur relance la même séance. */
  workId: string;
  /**
   * `video` : la publicité part après un temps de lecture réel (le film est mis en pause).
   * `reading` : elle part après un temps de présence sur la page, sans interrompre le lecteur de livre.
   */
  mode: "video" | "reading";
  /** Délai avant l'apparition, en millisecondes. */
  delayMs: number;
};

/**
 * Publicité qui s'intercale pendant un contenu gratuit : voile plein écran, compte à rebours, puis
 * retour au contenu. Une seule fois par œuvre et par séance (`sessionStorage`), pour ne pas transformer
 * la lecture en calvaire — et parce qu'un annonceur ne paie pas deux fois le même visiteur.
 *
 * Le film est mis en pause par un événement (`ccc:ad-open`) que le lecteur vidéo écoute : les deux
 * composants restent indépendants.
 */
export function AdInterstitial({ ads, lang, workId, mode, delayMs }: Props) {
  const [ad, setAd] = useState<AdItem | null>(null);
  const [left, setLeft] = useState(COUNTDOWN);
  const [videoDuration, setVideoDuration] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(false);
  const continueBtn = useRef<HTMLButtonElement>(null);

  // Durée réelle du film, transmise par le lecteur : sur un extrait de trente secondes, la coupure
  // doit arriver plus tôt que sur un film de quatre-vingt-dix minutes.
  useEffect(() => {
    if (mode !== "video") return;
    const onMeta = (event: Event) => {
      const d = Number((event as CustomEvent<{ duration?: number }>).detail?.duration ?? 0);
      if (Number.isFinite(d) && d > 0) setVideoDuration(d);
    };
    window.addEventListener("ccc:video-meta", onMeta);
    return () => window.removeEventListener("ccc:video-meta", onMeta);
  }, [mode]);

  const effectiveDelay = videoDuration > 0 ? Math.min(delayMs, Math.round(videoDuration * 0.35 * 1000)) : delayMs;

  const open = useCallback(() => {
    if (done.current || ads.length === 0) return;
    done.current = true;
    const picked = ads[Math.floor(Math.random() * ads.length)];
    setLeft(COUNTDOWN);
    setAd(picked);
    window.dispatchEvent(new Event("ccc:ad-open"));
    // L'affichage est compté ici : le bandeau a son propre compteur, avec sa propre règle de séance.
    void fetch(`/api/ads/${picked.id}/impression`, { method: "POST", keepalive: true }).catch(() => null);
  }, [ads]);

  const close = useCallback(() => {
    setAd(null);
    window.dispatchEvent(new Event("ccc:ad-close"));
  }, []);

  // Déclenchement : après un temps de lecture pour une vidéo, après un temps de présence pour un livre.
  useEffect(() => {
    if (ads.length === 0) return;
    try {
      if (sessionStorage.getItem(`ccc-ad-break-${workId}`)) {
        done.current = true;
        return;
      }
    } catch {
      /* sans stockage : la publicité peut revenir, ce n'est pas grave */
    }

    const arm = () => {
      if (timer.current || done.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        try {
          sessionStorage.setItem(`ccc-ad-break-${workId}`, "1");
        } catch {
          /* sans stockage : tant pis */
        }
        open();
      }, effectiveDelay);
    };
    const disarm = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
    };

    if (mode === "reading") {
      arm();
      return disarm;
    }

    // Vidéo : le compte à rebours ne court que pendant la lecture effective.
    window.addEventListener("ccc:video-playing", arm);
    window.addEventListener("ccc:video-paused", disarm);
    return () => {
      window.removeEventListener("ccc:video-playing", arm);
      window.removeEventListener("ccc:video-paused", disarm);
      disarm();
    };
  }, [ads.length, effectiveDelay, mode, open, workId]);

  // Compte à rebours de l'annonce elle-même.
  useEffect(() => {
    if (!ad) return;
    if (left <= 0) {
      continueBtn.current?.focus();
      return;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [ad, left]);

  // Échap ne ferme pas avant la fin du compte à rebours : c'est la contrepartie du contenu gratuit.
  useEffect(() => {
    if (!ad) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && left <= 0) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ad, left, close]);

  if (!ad) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, "ad.label")}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold tracking-wider text-white/80 uppercase">
            {t(lang, "ad.label")}
          </span>
          <button
            ref={continueBtn}
            type="button"
            onClick={close}
            disabled={left > 0}
            className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {left > 0 ? t(lang, "ad.skipIn", { n: left }) : t(lang, "ad.skip")}
          </button>
        </div>

        <a
          href={`/api/ads/${ad.id}/click`}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="group overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition-colors hover:border-white/40"
        >
          {ad.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt="" className="h-56 w-full object-cover sm:h-72" />
          )}
          <div className="p-5">
            <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">
              {t(lang, "ad.from", { name: ad.advertiser })}
            </p>
            <p className="mt-1 font-display text-xl font-semibold text-white sm:text-2xl">{ad.title}</p>
            {ad.text && <p className="mt-2 text-sm leading-relaxed text-white/80">{ad.text}</p>}
            <span className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black group-hover:bg-white/90">
              {t(lang, "ad.discover")}
            </span>
          </div>
        </a>

        <p className="text-center text-xs text-white/60">{t(lang, "ad.interstitialLead")}</p>
      </div>
    </div>
  );
}
