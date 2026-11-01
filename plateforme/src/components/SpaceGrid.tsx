"use client";

import { useState } from "react";
import { DocCard } from "@/components/DocCard";
import { WorkCard } from "@/components/WorkCard";
import type { CardItem } from "@/lib/catalog";

const FILTERS = [
  { value: "ALL", label: "Tout" },
  { value: "FREE", label: "Gratuit" },
  { value: "PAID", label: "Payant" },
] as const;

/** Grille d'un espace (livres, documentaires ou films) avec un filtre gratuit / payant. */
export function SpaceGrid({ items, variant = "poster" }: { items: CardItem[]; variant?: "poster" | "landscape" }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");
  const shown = items.filter((i) => (filter === "ALL" ? true : filter === "FREE" ? i.free : !i.free));

  return (
    <>
      <div
        role="group"
        aria-label="Filtrer"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`h-11 shrink-0 rounded-full px-6 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white shadow-md shadow-brand/30"
                  : "border border-line bg-surface text-ink/70 active:bg-brand/5"
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <p className="ml-auto self-center pl-2 text-sm whitespace-nowrap text-muted">{shown.length} titre(s)</p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
          Rien ici pour le moment.
        </p>
      ) : (
        <ul
          className={
            variant === "landscape"
              ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5"
          }
        >
          {shown.map((w, i) => (
            <li key={w.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              {variant === "landscape" ? <DocCard w={w} /> : <WorkCard w={w} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
