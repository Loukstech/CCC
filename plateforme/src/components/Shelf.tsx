"use client";

import { useRef } from "react";
import { ChevronIcon } from "@/components/icons";
import { WorkCard } from "@/components/WorkCard";
import type { CardItem } from "@/lib/catalog";
import { t, type Lang } from "@/lib/i18n";

/** Rangée horizontale d'œuvres, avec flèches et défilement par cartes (comme les rangées d'une vidéothèque). */
export function Shelf({
  id,
  title,
  subtitle,
  items,
  board = false,
  lang,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  items: CardItem[];
  board?: boolean;
  lang: Lang;
}) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) =>
    track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-6 sm:px-5 sm:py-8">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-brand sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-gold" />
        </div>
        <div className="hidden gap-2 sm:flex">
          {(["left", "right"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => scroll(d === "left" ? -1 : 1)}
              aria-label={t(lang, d === "left" ? "shelf.prev" : "shelf.next", { title })}
              className="grid size-10 place-items-center rounded-full border border-line bg-surface text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white"
            >
              <ChevronIcon dir={d} />
            </button>
          ))}
        </div>
      </div>

      <ul
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:-mx-5 sm:scroll-px-5 sm:gap-5 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((w) => (
          <li key={w.id} className="w-40 shrink-0 snap-start sm:w-44 lg:w-48">
            <WorkCard w={w} />
          </li>
        ))}
      </ul>
      {board && <div aria-hidden className="shelf-board" />}
    </section>
  );
}
