import Link from "next/link";
import { PlayIcon, TypeIcon } from "@/components/icons";
import type { CardItem } from "@/lib/catalog";
import { backdropUrl } from "@/lib/images";

/** Carte éditoriale paysage d'un documentaire : image large, durée, titre et résumé. */
export function DocCard({ w }: { w: CardItem }) {
  const img = backdropUrl(w.coverUrl, 800, 450);
  return (
    <Link
      href={`/oeuvres/${w.slug}`}
      className="group block overflow-hidden rounded-md border-t-4 border-gold bg-surface shadow-sm ring-1 ring-line transition-shadow hover:shadow-xl hover:shadow-brand/15"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#0e5a73] to-brand-deep">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <TypeIcon type="DOCUMENTARY" className="size-12 text-gold" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-night/70 to-transparent" aria-hidden />
        <span className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-full bg-gold text-brand-night shadow-lg transition-transform group-hover:scale-110">
          <PlayIcon className="size-4" />
        </span>
        {w.meta && (
          <span className="absolute right-3 bottom-3 rounded bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
            {w.meta}
          </span>
        )}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {w.isNew && (
            <span className="rounded bg-gold px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-night uppercase">
              Nouveau
            </span>
          )}
          {w.free && (
            <span className="rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand uppercase">
              Gratuit
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display line-clamp-2 text-lg leading-snug font-semibold text-ink group-hover:text-brand">
          {w.title}
        </h3>
        {w.author && <p className="mt-0.5 text-xs font-semibold tracking-wide text-muted uppercase">{w.author}</p>}
        {w.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{w.description}</p>}
        {!w.free && <p className="mt-3 text-sm font-semibold text-brand">{w.priceLabel}</p>}
      </div>
    </Link>
  );
}
