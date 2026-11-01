import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { Shelf } from "@/components/Shelf";
import { Availability, WorkAction } from "@/components/WorkAction";
import { COUNTRY_NAME } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCountry, isAvailable } from "@/lib/rights";
import { ACCESS_LABEL, TYPE_LABEL, formatPrice, getPublishedWork, getPublishedWorks, priceFor, toCard } from "@/lib/catalog";

const UNIVERSE = { BOOK: "livre", FILM: "film", DOCUMENTARY: "doc" } as const;

export default function WorkPage({ params }: PageProps<"/oeuvres/[slug]">) {
  return (
    <main className="flex-1">
      <Suspense fallback={<p className="mx-auto w-full max-w-6xl px-4 py-16 text-muted sm:px-5">Chargement…</p>}>
        <Work params={params} />
      </Suspense>
    </main>
  );
}

async function Work({ params }: { params: PageProps<"/oeuvres/[slug]">["params"] }) {
  const { slug } = await params;
  const work = await getPublishedWork(slug);
  if (!work) notFound();

  const space = { BOOK: ["/livres", "livres"], FILM: ["/films", "films"], DOCUMENTARY: ["/documentaires", "documentaires"] }[work.type];
  const related = (await getPublishedWorks())
    .filter((w) => w.type === work.type && w.id !== work.id)
    .map((w) => toCard(w))
    .slice(0, 10);
  const user = await getCurrentUser();
  const country = await getCountry(user);
  const available = country ? isAvailable(work.licenses, country, new Date()) : false;
  const owned = user
    ? !!(await db.order.findFirst({ where: { userId: user.id, workId: work.id, status: "PAID" }, select: { id: true } }))
    : false;
  const price = priceFor(work.prices, country);
  const countries = [...new Set(work.licenses.flatMap((l) => l.countries))];
  const offline = work.licenses.some((l) => l.allowOffline);
  const priceLabel = work.access === "PURCHASE" && price ? formatPrice(price) : ACCESS_LABEL[work.access];

  const facts = [
    { label: "Accès", value: priceLabel },
    { label: "Langue", value: work.language.toUpperCase() },
    { label: "Lecture hors ligne", value: offline ? "Autorisée" : "Non disponible" },
    { label: "Disponible dans", value: countries.length ? countries.map((c) => COUNTRY_NAME[c] ?? c).join(", ") : "—" },
  ];

  return (
    <div data-universe={UNIVERSE[work.type]} className="flex-1">
      <section className="hero-bg relative overflow-hidden text-white">
        <div className="film-strip absolute inset-y-0 right-0 w-1/2 opacity-30" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl gap-6 px-4 pt-28 pb-8 sm:gap-10 sm:px-5 sm:pb-16 md:grid-cols-[260px_1fr] md:items-center">
          <div className="rise mx-auto w-40 sm:w-52 md:w-full">
            <Cover
              type={work.type}
              title={work.title}
              author={work.author}
              coverUrl={work.coverUrl}
              className="shadow-2xl shadow-black/50 ring-1 ring-white/15"
            />
          </div>
          <div className="rise" style={{ animationDelay: "100ms" }}>
            <Link href={space[0]} className="inline-block py-2 text-sm text-white/70 transition-colors hover:text-white">
              ← Tous les {space[1]}
            </Link>
            <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              {TYPE_LABEL[work.type]}
            </p>
            <h1 className="font-display mt-2 text-3xl leading-tight font-semibold text-balance sm:text-5xl">
              {work.title}
            </h1>
            {work.author && <p className="mt-2 text-lg text-white/70">{work.author}</p>}
            {work.description && (
              <p className="mt-5 max-w-2xl leading-8 text-white/85">{work.description}</p>
            )}
            <p className="font-display mt-6 text-2xl font-semibold text-gold">{priceLabel}</p>
            <div className="mt-3">
              <WorkAction
                workId={work.id}
                access={work.access}
                signedIn={!!user}
                country={country}
                available={available}
                owned={owned}
                readHref={work.type === "BOOK" && work.fileKey && available ? `/lire/${work.slug}` : undefined}
              />
            </div>
            <Availability country={country} available={available} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
        <h2 className="font-display mb-5 text-2xl font-semibold text-brand">Informations</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-semibold tracking-widest text-muted uppercase">{f.label}</dt>
              <dd className="mt-1.5 text-lg font-semibold text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <Shelf title="À découvrir aussi" subtitle={`D’autres ${space[1]}`} items={related} />
      )}
    </div>
  );
}
