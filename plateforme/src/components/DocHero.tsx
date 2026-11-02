import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";
import { PlayIcon } from "@/components/icons";
import type { CardItem } from "@/lib/catalog";
import { t, type Lang } from "@/lib/i18n";
import { backdropUrl } from "@/lib/images";

/** Univers « Documentaires » : une couverture de magazine pour le reportage à la une, puis un ruban éditorial. */
export function DocHero({ featured, lang }: { featured?: CardItem; lang: Lang }) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-night text-white">
        <div className="relative h-[28rem] sm:h-[32rem]">
          <Backdrop src={backdropUrl(featured?.coverUrl, 1600, 900) ?? "/univers/documentaires.jpg"} />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-night via-brand-night/55 to-brand-night/10" aria-hidden />
          <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col justify-end px-4 pb-8 sm:px-5 sm:pb-12">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
              <span aria-hidden className="h-px w-8 bg-gold" />
              {featured ? t(lang, "docs.featuredKicker") : t(lang, "docs.title")}
            </p>
            <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl">
              {featured?.title ?? t(lang, "docs.title")}
            </h1>
            {featured && (
              <>
                <p className="mt-3 text-sm text-white/75">
                  {[featured.author, featured.meta, featured.language].filter(Boolean).join(" · ")}
                </p>
                {featured.description && (
                  <p className="mt-2 line-clamp-2 max-w-xl text-sm text-white/80 sm:text-base">{featured.description}</p>
                )}
                <Link href={`/oeuvres/${featured.slug}`} className="btn btn-primary mt-5 w-full sm:w-auto sm:self-start">
                  <PlayIcon />
                  {t(lang, "docs.watch")}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="bg-gold py-2 text-center text-[11px] font-bold tracking-[0.3em] text-brand-night uppercase" aria-hidden>
        {t(lang, "docs.ribbon")}
      </div>
    </>
  );
}
