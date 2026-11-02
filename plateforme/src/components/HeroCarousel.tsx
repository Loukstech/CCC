"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cover } from "@/components/Cover";
import { ChevronIcon, PlayIcon } from "@/components/icons";
import { PriceLabel } from "@/components/Money";
import type { CardItem } from "@/lib/catalog";
import { t } from "@/lib/i18n";

const DELAY_MS = 7000;
const SPACE = { BOOK: "/livres", FILM: "/films", DOCUMENTARY: "/documentaires" } as const;

/** Grand carrousel d'accueil : une œuvre à la une, son affiche, ses informations et un bouton d'action. */
export function HeroCarousel({ items }: { items: CardItem[] }) {
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

  const go = (n: number) => setIndex((n + count) % count);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={t(ui, "hero.carousel")}
      className="hero-bg relative overflow-hidden text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="film-strip absolute inset-y-0 right-0 w-1/2 opacity-30" aria-hidden />
      <div
        className="absolute -top-24 -right-24 size-[34rem] rounded-full bg-gradient-to-br from-brand-light/60 to-transparent blur-sm sm:size-[44rem]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl">
        {items.map((w, i) => (
          <article
            key={w.id}
            aria-hidden={i !== index}
            aria-roledescription="diapositive"
            aria-label={t(ui, "hero.slideOf", { i: i + 1, n: count })}
            className={`col-start-1 row-start-1 grid items-center gap-6 px-4 pt-28 pb-24 transition-opacity duration-700 sm:gap-8 sm:px-5 sm:pb-32 md:pt-28 md:grid-cols-[1fr_300px] ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div className="order-2 md:order-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-gold uppercase">
                <span className="size-1.5 rounded-full bg-gold" aria-hidden />
                {t(w.ui, w.isNew ? "hero.new" : "hero.featured")}
              </p>
              <h1 className="font-display mt-4 max-w-2xl text-3xl leading-[1.08] font-semibold text-balance sm:mt-5 sm:text-6xl">
                {w.title}
              </h1>
              <ul className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                {[t(w.ui, `type.${w.type}` as const), w.language, w.meta].filter(Boolean).map((chip) => (
                  <li key={chip} className="rounded-full border border-white/25 px-3 py-1 text-white/90">
                    {chip}
                  </li>
                ))}
                <li className="rounded-full border border-white/25 px-3 py-1 text-white/90">
                  <PriceLabel item={w} lang={w.ui} />
                </li>
              </ul>
              {w.description && (
                <p className="mt-5 line-clamp-3 max-w-xl leading-relaxed text-white/75">{w.description}</p>
              )}
              <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row">
                <Link href={`/oeuvres/${w.slug}`} tabIndex={i === index ? 0 : -1} className="btn btn-primary w-full sm:w-auto">
                  <PlayIcon />
                  {t(w.ui, `cta.${w.type}` as const)}
                </Link>
                <Link href={SPACE[w.type]} tabIndex={i === index ? 0 : -1} className="btn btn-ghost w-full sm:w-auto">
                  {t(w.ui, "hero.allOf", { space: t(w.ui, `space.${w.type}` as const) })}
                </Link>
              </div>
            </div>
            <div className="order-1 mx-auto w-32 rotate-3 sm:w-40 md:order-2 md:w-full md:max-w-[280px]">
              <div className="absolute inset-auto -z-0 hidden size-72 translate-x-6 translate-y-6 rounded-full bg-gold/25 md:block" aria-hidden />
              <Cover
                type={w.type}
                title={w.title}
                author={w.author}
                coverUrl={w.coverUrl}
                className="relative shadow-2xl shadow-black/60 ring-1 ring-white/20"
              />
            </div>
          </article>
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-[4.5rem] z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:bottom-24 sm:px-5">
          <div className="flex items-center gap-2" role="tablist" aria-label={t(ui, "hero.chooseSlide")}>
            {items.map((w, i) => (
              <button
                key={w.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t(ui, "hero.slide", { i: i + 1, title: w.title })}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-gold" : "w-3 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {(["left", "right"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => go(index + (d === "left" ? -1 : 1))}
                aria-label={t(ui, d === "left" ? "hero.prev" : "hero.next")}
                className="hidden size-10 place-items-center rounded-full border border-white/30 bg-black/20 backdrop-blur-sm transition-colors hover:bg-white/20 sm:grid"
              >
                <ChevronIcon dir={d} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
