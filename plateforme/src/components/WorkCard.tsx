import Link from "next/link";
import { Cover } from "@/components/Cover";
import { PlayIcon } from "@/components/icons";
import { PriceLabel } from "@/components/Money";
import type { CardItem } from "@/lib/catalog";
import { t } from "@/lib/i18n";

/** Carte d'œuvre : affiche, pastilles (statut, langue), prix et durée. */
export function WorkCard({ w }: { w: CardItem }) {
  return (
    <Link href={`/oeuvres/${w.slug}`} className="group block">
      <div className="relative rounded-xl transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl group-hover:shadow-brand/30">
        <Cover type={w.type} title={w.title} author={w.author} coverUrl={w.coverUrl} />

        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {w.isNew && (
            <span className="rounded-md bg-gold px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-night uppercase">
              {t(w.ui, "card.new")}
            </span>
          )}
          {w.free && (
            <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
              {t(w.ui, "price.free")}
            </span>
          )}
        </div>
        <span className="absolute top-2.5 right-2.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {w.language}
        </span>

        <div className="absolute inset-0 flex items-end justify-center rounded-xl bg-gradient-to-t from-brand-night/90 via-brand-night/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-brand-night">
            <PlayIcon className="size-3.5" />
            {t(w.ui, w.type === "BOOK" ? "card.discover" : "card.seeSheet")}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold tracking-widest text-[#8f6a00] uppercase">{t(w.ui, `type.${w.type}` as const)}</p>
      <h3 className="font-display mt-0.5 line-clamp-2 text-base leading-snug font-semibold text-ink transition-colors group-hover:text-brand">
        {w.title}
      </h3>
      {w.author && <p className="mt-0.5 truncate text-sm text-muted">{w.author}</p>}
      <p className="mt-1.5 flex items-center gap-2 text-sm">
        <span className="font-semibold text-brand">
          <PriceLabel item={w} lang={w.ui} />
        </span>
        {w.meta && (
          <>
            <span aria-hidden className="size-1 rounded-full bg-line" />
            <span className="text-muted">{w.meta}</span>
          </>
        )}
      </p>
    </Link>
  );
}
