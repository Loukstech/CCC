import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";
import { Cover } from "@/components/Cover";
import { SearchIcon } from "@/components/icons";
import type { CardItem } from "@/lib/catalog";

/** Univers « Livres » : une bibliothèque lumineuse, un champ de recherche, puis le livre à la une posé en vedette. */
export function BookHero({ featured, count }: { featured?: CardItem; count: number }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-night text-white">
        <Backdrop src="/univers/livres.jpg" className="opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-night/90 via-brand-night/60 to-brand-night/20" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-28 pb-20 sm:px-5 sm:pb-28 md:pt-32">
          <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">La bibliothèque</p>
          <h1 className="font-display mt-2 text-5xl font-semibold sm:text-7xl">Livres</h1>
          <p className="mt-3 max-w-md text-white/80">
            {count} titre(s) à lire en ligne ou hors connexion, et à garder pour toujours dans votre bibliothèque.
          </p>
          <form action="/recherche" role="search" className="mt-6 max-w-md">
            <label className="relative block">
              <span className="sr-only">Rechercher un livre</span>
              <SearchIcon className="pointer-events-none absolute z-10 top-1/2 left-4 size-5 -translate-y-1/2 text-white/85" />
              <input
                type="search"
                name="q"
                required
                placeholder="Titre, auteur, thème…"
                className="h-12 w-full rounded-xl border border-white/35 bg-white/15 pr-4 pl-12 text-base text-white backdrop-blur-md outline-none placeholder:text-white/75 focus:border-gold focus:ring-4 focus:ring-gold/30"
              />
            </label>
          </form>
        </div>
      </section>

      {featured && (
        <section aria-label="Livre à la une" className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:px-5">
          <Link
            href={`/oeuvres/${featured.slug}`}
            className="flex gap-4 rounded-2xl bg-surface p-4 shadow-xl shadow-brand/15 ring-1 ring-line transition-shadow hover:shadow-2xl sm:gap-6 sm:p-5"
          >
            <div className="w-24 shrink-0 sm:w-32">
              <Cover type="BOOK" title={featured.title} author={featured.author} coverUrl={featured.coverUrl} />
            </div>
            <div className="flex min-w-0 flex-col py-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8f6a00] uppercase">Livre à la une</p>
              <h2 className="font-display mt-1 line-clamp-2 text-xl leading-snug font-semibold text-ink sm:text-2xl">
                {featured.title}
              </h2>
              {featured.author && <p className="mt-0.5 truncate text-sm text-muted">{featured.author}</p>}
              {featured.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted sm:line-clamp-3">{featured.description}</p>
              )}
              <p className="mt-auto flex items-center gap-3 pt-3 text-sm">
                <span className="font-semibold text-brand">{featured.free ? "Gratuit" : featured.priceLabel}</span>
                {featured.meta && <span className="text-muted">{featured.meta}</span>}
                <span className="ml-auto font-semibold text-brand">Découvrir →</span>
              </p>
            </div>
          </Link>
        </section>
      )}
    </>
  );
}
