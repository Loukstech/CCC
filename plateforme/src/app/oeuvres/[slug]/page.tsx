import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdSlot } from "@/components/AdSlot";
import { Cover } from "@/components/Cover";
import { PageFallback } from "@/components/PageFallback";
import { Shelf } from "@/components/Shelf";
import { WorkRating } from "@/components/WorkRating";
import { WorkReviews } from "@/components/WorkReviews";
import { Availability, WorkAction } from "@/components/WorkAction";
import { countryName } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getActiveSubscription } from "@/lib/access";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCountry, isAvailable } from "@/lib/rights";
import { Money } from "@/components/Money";
import { getEditions, getPublishedWork, getPublishedWorks, priceFor, toCard } from "@/lib/catalog";
import { languageName } from "@/lib/languages";

const UNIVERSE = { BOOK: "livre", FILM: "film", DOCUMENTARY: "doc" } as const;

export default function WorkPage({ params }: PageProps<"/oeuvres/[slug]">) {
  return (
    <main className="flex-1">
      <Suspense fallback={<PageFallback />}>
        <Work params={params} />
      </Suspense>
    </main>
  );
}

async function Work({ params }: { params: PageProps<"/oeuvres/[slug]">["params"] }) {
  const { slug } = await params;
  const lang = await getLang();
  const work = await getPublishedWork(slug);
  if (!work) notFound();

  const space = {
    BOOK: ["/livres", t(lang, "space.BOOK")],
    FILM: ["/films", t(lang, "space.FILM")],
    DOCUMENTARY: ["/documentaires", t(lang, "space.DOCUMENTARY")],
  }[work.type];
  const related = (await getPublishedWorks())
    .filter((w) => w.type === work.type && w.id !== work.id)
    .map((w) => toCard(w, false, lang))
    .slice(0, 10);
  const user = await getCurrentUser();
  const country = await getCountry(user);
  const available = country ? isAvailable(work.licenses, country, new Date()) : false;
  const owned = user
    ? !!(await db.order.findFirst({ where: { userId: user.id, workId: work.id, status: "PAID" }, select: { id: true } }))
    : false;
  const subscribed = user ? !!(await getActiveSubscription(user.id)) : false;
  const price = priceFor(work.prices, country);
  // Autres éditions du même titre : la même œuvre dans d'autres langues, si elles ont été reliées.
  const otherEditions = work.translationGroupId
    ? (await getEditions(work.translationGroupId)).filter((e) => e.id !== work.id)
    : [];
  const countries = [...new Set(work.licenses.flatMap((l) => l.countries))];
  const offline = work.licenses.some((l) => l.allowOffline);
  const priceNode =
    work.access === "PURCHASE" && price ? <Money amount={price.amount} currency={price.currency} lang={lang} /> : t(lang, `access.${work.access}` as const);

  const facts = [
    { label: t(lang, "work.access"), value: priceNode },
    { label: t(lang, "work.language"), value: work.language.toUpperCase() },
    { label: t(lang, "work.offline"), value: t(lang, offline ? "work.offlineYes" : "work.offlineNo") },
    { label: t(lang, "work.availableIn"), value: countries.length ? countries.map((c) => countryName(c, lang)).join(", ") : "—" },
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
              {t(lang, "work.back", { space: space[1] })}
            </Link>
            <p className="mt-5 text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              {t(lang, `type.${work.type}` as const)}
            </p>
            <h1 className="font-display mt-2 text-3xl leading-tight font-semibold text-balance sm:text-5xl">
              {work.title}
            </h1>
            {work.author && <p className="mt-2 text-lg text-white/70">{work.author}</p>}
            {otherEditions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-white/60">{t(lang, "work.editions")}</span>
                {otherEditions.map((edition) => (
                  <Link
                    key={edition.id}
                    href={`/oeuvres/${edition.slug}`}
                    className="rounded-full border border-white/30 px-3 py-1 text-sm font-medium text-white/90 transition-colors hover:border-white/60 hover:bg-white/10"
                  >
                    {languageName(edition.language)}
                  </Link>
                ))}
              </div>
            )}
            <WorkRating workId={work.id} lang={lang} />
            {work.description && (
              <p className="mt-5 max-w-2xl leading-8 text-white/85">{work.description}</p>
            )}
            <p className="font-display mt-6 text-2xl font-semibold text-gold">{priceNode}</p>
            <div className="mt-3">
              <WorkAction
                lang={lang}
                workId={work.id}
                type={work.type}
                access={work.access}
                signedIn={!!user}
                country={country}
                available={available}
                owned={owned}
                subscribed={subscribed}
                price={work.access === "PURCHASE" && price ? { amount: price.amount, currency: price.currency } : null}
                readHref={
                  work.type === "BOOK" && work.fileKey && available && (owned || (subscribed && work.access === "SUBSCRIPTION"))
                    ? `/lire/${work.slug}`
                    : undefined
                }
                watchHref={
                  work.type !== "BOOK" && work.fileKey && available && (owned || (subscribed && work.access === "SUBSCRIPTION"))
                    ? `/regarder/${work.slug}`
                    : undefined
                }
              />
            </div>
            <Availability country={country} available={available} lang={lang} />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
        <h2 className="font-display mb-5 text-2xl font-semibold text-brand">{t(lang, "work.info")}</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="rounded-2xl border border-line bg-surface p-5">
              <dt className="text-xs font-semibold tracking-widest text-muted uppercase">{f.label}</dt>
              <dd className="mt-1.5 text-lg font-semibold text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <AdSlot placement="WORK" lang={lang} />

      <WorkReviews workId={work.id} slug={work.slug} lang={lang} userId={user?.id ?? null} />

      {related.length > 0 && (
        <Shelf lang={lang} title={t(lang, "work.alsoTitle")} subtitle={t(lang, "work.alsoSub", { space: space[1] })} items={related} />
      )}
    </div>
  );
}
