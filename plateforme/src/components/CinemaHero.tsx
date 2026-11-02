"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Backdrop } from "@/components/Backdrop";
import { PlayIcon } from "@/components/icons";
import { PriceLabel } from "@/components/Money";
import type { CardItem } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { backdropUrl } from "@/lib/images";

const DELAY_MS = 6500;

/** Univers « Films » : grand visuel plein écran, titre en surimpression, puis les films à la une en petites cartes. */
export function CinemaHero({ items }: { items: CardItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const ui = items[0]?.ui ?? "fr";

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), DELAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, count]);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={t(ui, "cinema.carousel")}
      className="relative isolate overflow-hidden bg-brand-night"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative h-[32rem] sm:h-[38rem]">
        {items.map((w, i) => (
          <article
            key={w.id}
            aria-hidden={i !== index}
            aria-roledescription="diapositive"
            aria-label={t(ui, "hero.slideOf", { i: i + 1, n: count })}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <Backdrop src={backdropUrl(w.coverUrl, 1600, 900) ?? "/univers/films.jpg"} />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-night via-brand-night/50 to-brand-night/10" aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-night/75 via-brand-night/15 to-transparent" aria-hidden />

            <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col justify-end px-4 pb-28 text-white sm:px-5 sm:pb-32">
              <ul className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <li className="rounded bg-gold px-2 py-0.5 tracking-wide text-brand-night uppercase">{t(w.ui, "type.FILM")}</li>
                {[w.language, w.meta].filter(Boolean).map((chip) => (
                  <li key={chip} className="rounded border border-white/30 px-2 py-0.5 text-white/90">
                    {chip}
                  </li>
                ))}
                <li className="rounded border border-white/30 px-2 py-0.5 text-white/90">
                  <PriceLabel item={w} lang={w.ui} />
                </li>
              </ul>
              <h1 className="mt-3 max-w-2xl text-4xl leading-[1.02] font-extrabold tracking-tight text-balance drop-shadow-lg sm:text-6xl">
                {w.title}
              </h1>
              {w.description && (
                <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/80 sm:text-base">{w.description}</p>
              )}
              <div className="mt-5">
                <Link
                  href={`/oeuvres/${w.slug}`}
                  tabIndex={i === index ? 0 : -1}
                  className="btn btn-primary w-full sm:w-auto"
                >
                  <PlayIcon />
                  {t(w.ui, "cinema.watch")}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-10 sm:bottom-6">
          <div
            role="tablist"
            aria-label={t(ui, "cinema.choose")}
            className="mx-auto flex w-full max-w-6xl gap-3 overflow-x-auto px-4 pb-1 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((w, i) => {
              const thumb = backdropUrl(w.coverUrl, 160, 240);
              const active = i === index;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={t(ui, "cinema.item", { i: i + 1, title: w.title })}
                  onClick={() => setIndex(i)}
                  className={`flex w-60 shrink-0 items-center gap-3 rounded-xl border p-2 pr-3 text-left text-white backdrop-blur-md transition-colors sm:w-64 ${
                    active ? "border-white/50 bg-black/55" : "border-white/15 bg-black/35 hover:bg-black/50"
                  }`}
                >
                  <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-md bg-brand-deep">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{w.title}</span>
                    <span className="block truncate text-xs text-white/70">
                      {[w.language, w.meta].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#2f7be8] to-[#0a3d91] text-white transition-opacity ${
                      active ? "opacity-100" : "opacity-60"
                    }`}
                  >
                    <PlayIcon className="size-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
