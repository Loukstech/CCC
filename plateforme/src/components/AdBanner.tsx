"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

export type AdItem = {
  id: string;
  title: string;
  advertiser: string;
  text: string | null;
  imageUrl: string | null;
};

const DISMISS_KEY = "ccc-ad-dismissed";

/**
 * Bandeau publicitaire. Il est toujours étiqueté « Publicité » et le lien passe par /api/ads/[id]/click
 * (comptage des clics). S'il y a plusieurs publicités, l'une d'elles est tirée au hasard à l'affichage.
 * La variante « sticky » est fixée en bas de l'écran et se ferme (le choix dure le temps de la visite).
 */
export function AdBanner({ ads, lang, variant = "banner" }: { ads: AdItem[]; lang: Lang; variant?: "banner" | "sticky" }) {
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(variant === "sticky");

  useEffect(() => {
    if (ads.length > 1) setIndex(Math.floor(Math.random() * ads.length));
    if (variant !== "sticky") return;
    try {
      setClosed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setClosed(false);
    }
  }, [ads.length, variant]);

  const ad = ads[index] ?? ads[0];
  if (!ad || closed) return null;

  const body = (
    <a
      href={`/api/ads/${ad.id}/click`}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
    >
      {ad.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.imageUrl} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-lg object-cover sm:h-16 sm:w-28" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink sm:text-base">{ad.title}</span>
        <span className="block truncate text-xs text-muted sm:text-sm">{ad.text ?? ad.advertiser}</span>
      </span>
    </a>
  );

  const label = (
    <span className="shrink-0 rounded bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-muted uppercase">
      {t(lang, "ad.label")}
    </span>
  );

  if (variant === "sticky") {
    return (
      <aside
        aria-label={t(lang, "ad.label")}
        className="fixed inset-x-0 bottom-16 z-30 mx-auto flex w-[calc(100%-1.5rem)] max-w-3xl items-center gap-3 rounded-2xl border border-line bg-surface/95 p-2.5 pr-2 shadow-xl shadow-brand/20 backdrop-blur md:bottom-4"
      >
        {label}
        {body}
        <button
          type="button"
          aria-label={t(lang, "ad.close")}
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* sans stockage : le bandeau se ferme seulement pour cette page */
            }
            setClosed(true);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-brand/10 hover:text-brand"
        >
          <span aria-hidden>×</span>
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label={t(lang, "ad.label")} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      {label}
      {body}
    </aside>
  );
}
