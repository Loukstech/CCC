import { BookHero } from "@/components/BookHero";
import { CinemaHero } from "@/components/CinemaHero";
import { DocHero } from "@/components/DocHero";
import { Shelf } from "@/components/Shelf";
import { SpaceGrid } from "@/components/SpaceGrid";
import { getPublishedWorks, toCard, type CardItem } from "@/lib/catalog";

async function load(type: CardItem["type"]) {
  const works = await getPublishedWorks();
  return works.map((w, i) => toCard(w, i < 3)).filter((i) => i.type === type);
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

/** Univers « Livres » : bibliothèque claire, rangées posées sur des étagères. */
export async function BookSpace() {
  const items = await load("BOOK");
  const free = items.filter((i) => i.free);
  return (
    <main data-universe="livre" className="flex-1">
      <BookHero featured={items[0]} count={items.length} />
      {items.length === 0 ? (
        <Empty text="Les premiers livres arrivent bientôt." />
      ) : (
        <>
          <div className="pt-4">
            <Shelf board title="Nouveautés" subtitle="Les derniers livres ajoutés" items={items.slice(0, 8)} />
            {free.length > 0 && free.length < items.length && (
              <Shelf board title="À lire gratuitement" subtitle="Pour commencer" items={free} />
            )}
          </div>
          <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
            <Heading>Toute la bibliothèque</Heading>
            <SpaceGrid items={items} />
          </section>
        </>
      )}
    </main>
  );
}

/** Univers « Films » : salle de cinéma, fond nuit, rangées par type d'accès. */
export async function CinemaSpace() {
  const items = await load("FILM");
  const free = items.filter((i) => i.free);
  const sub = items.filter((i) => i.priceLabel === "Abonnement");
  const paid = items.filter((i) => !i.free && i.priceLabel !== "Abonnement");
  return (
    <main data-universe="film" className="flex-1">
      {items.length === 0 ? (
        <>
          <div className="px-4 py-24 text-center sm:px-5">
            <h1 className="text-4xl font-extrabold tracking-tight">Films</h1>
          </div>
          <Empty text="Les premiers films arrivent bientôt." />
        </>
      ) : (
        <>
          <CinemaHero items={items.slice(0, 4)} />
          <div className="pb-8">
            {free.length > 0 && <Shelf title="Gratuits" subtitle="À voir sans abonnement" items={free} />}
            {sub.length > 0 && <Shelf title="Avec l’abonnement" subtitle="Inclus dans votre formule" items={sub} />}
            {paid.length > 0 && <Shelf title="À l’unité" subtitle="Achetez, regardez, gardez" items={paid} />}
          </div>
        </>
      )}
    </main>
  );
}

/** Univers « Documentaires » : magazine de reportages, cartes éditoriales en paysage. */
export async function DocSpace() {
  const items = await load("DOCUMENTARY");
  return (
    <main data-universe="doc" className="flex-1">
      <DocHero featured={items[0]} />
      {items.length === 0 ? (
        <Empty text="Les premiers documentaires arrivent bientôt." />
      ) : (
        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
          <Heading>Tous les reportages</Heading>
          <SpaceGrid items={items} variant="landscape" />
        </section>
      )}
    </main>
  );
}
