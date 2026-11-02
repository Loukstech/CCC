import { Suspense } from "react";
import { BookHero } from "@/components/BookHero";
import { CinemaHero } from "@/components/CinemaHero";
import { DocHero } from "@/components/DocHero";
import { PageFallback } from "@/components/PageFallback";
import { Shelf } from "@/components/Shelf";
import { SpaceGrid } from "@/components/SpaceGrid";
import { getPublishedWorks, toCard, type CardItem } from "@/lib/catalog";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

async function load(type: CardItem["type"], lang: Lang) {
  const works = await getPublishedWorks();
  return works.map((w, i) => toCard(w, i < 3, lang)).filter((i) => i.type === type);
}

const Empty = ({ text }: { text: string }) => (
  <p className="mx-auto my-12 w-full max-w-6xl rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-muted">
    {text}
  </p>
);

const Heading = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-6">
    <h2 className="font-display text-2xl font-semibold text-brand sm:text-3xl">{children}</h2>
    <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-gold" />
  </div>
);

/** La langue vient d'un cookie : chaque espace s'affiche derrière un cadre d'attente, le reste de la page est immédiat. */
const Streamed = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageFallback />}>{children}</Suspense>
);

/** Univers « Livres » : bibliothèque claire, rangées posées sur des étagères. */
export function BookSpace() {
  return (
    <Streamed>
      <BookSpaceContent />
    </Streamed>
  );
}

async function BookSpaceContent() {
  const lang = await getLang();
  const items = await load("BOOK", lang);
  const free = items.filter((i) => i.free);
  return (
    <main data-universe="livre" className="flex-1">
      <BookHero featured={items[0]} count={items.length} lang={lang} />
      {items.length === 0 ? (
        <Empty text={t(lang, "books.empty")} />
      ) : (
        <>
          <div className="pt-4">
            <Shelf board lang={lang} title={t(lang, "books.news")} subtitle={t(lang, "books.newsSub")} items={items.slice(0, 8)} />
            {free.length > 0 && free.length < items.length && (
              <Shelf board lang={lang} title={t(lang, "books.freeShelf")} subtitle={t(lang, "books.freeSub")} items={free} />
            )}
          </div>
          <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
            <Heading>{t(lang, "books.all")}</Heading>
            <SpaceGrid items={items} lang={lang} />
          </section>
        </>
      )}
    </main>
  );
}

/** Univers « Films » : salle de cinéma, fond nuit, rangées par type d'accès. */
export function CinemaSpace() {
  return (
    <Streamed>
      <CinemaSpaceContent />
    </Streamed>
  );
}

async function CinemaSpaceContent() {
  const lang = await getLang();
  const items = await load("FILM", lang);
  const free = items.filter((i) => i.free);
  const sub = items.filter((i) => i.access === "SUBSCRIPTION");
  const paid = items.filter((i) => i.access === "PURCHASE");
  return (
    <main data-universe="film" className="flex-1">
      {items.length === 0 ? (
        <>
          <div className="px-4 py-24 text-center sm:px-5">
            <h1 className="text-4xl font-extrabold tracking-tight">{t(lang, "films.title")}</h1>
          </div>
          <Empty text={t(lang, "films.empty")} />
        </>
      ) : (
        <>
          <CinemaHero items={items.slice(0, 4)} />
          <div className="pb-8">
            {free.length > 0 && <Shelf lang={lang} title={t(lang, "films.free")} subtitle={t(lang, "films.freeSub")} items={free} />}
            {sub.length > 0 && <Shelf lang={lang} title={t(lang, "films.sub")} subtitle={t(lang, "films.subSub")} items={sub} />}
            {paid.length > 0 && <Shelf lang={lang} title={t(lang, "films.paid")} subtitle={t(lang, "films.paidSub")} items={paid} />}
          </div>
        </>
      )}
    </main>
  );
}

/** Univers « Documentaires » : magazine de reportages, cartes éditoriales en paysage. */
export function DocSpace() {
  return (
    <Streamed>
      <DocSpaceContent />
    </Streamed>
  );
}

async function DocSpaceContent() {
  const lang = await getLang();
  const items = await load("DOCUMENTARY", lang);
  return (
    <main data-universe="doc" className="flex-1">
      <DocHero featured={items[0]} lang={lang} />
      {items.length === 0 ? (
        <Empty text={t(lang, "docs.empty")} />
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
          <Heading>{t(lang, "docs.all")}</Heading>
          <SpaceGrid items={items} lang={lang} variant="landscape" />
        </section>
      )}
    </main>
  );
}
