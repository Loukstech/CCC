import { Suspense } from "react";
import { WorkCard } from "@/components/WorkCard";
import { searchPublishedWorks, toCard } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const metadata = { title: "Recherche — CCC" };

export default function SearchPage({ searchParams }: PageProps<"/recherche">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
      <Suspense fallback={<p className="text-muted" aria-busy="true">…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/recherche">["searchParams"] }) {
  const lang = await getLang();
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";

  if (!query) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "search.title")}</h1>
        <p className="mt-3 text-muted">{t(lang, "search.prompt")}</p>
        <form action="/recherche" role="search" className="mt-6 flex max-w-lg gap-2">
          <input
            type="search"
            name="q"
            required
            placeholder={t(lang, "search.fieldPlaceholder")}
            className="h-11 w-full rounded-xl border border-line bg-surface px-5 text-sm outline-none focus:border-brand-light focus:ring-4 focus:ring-brand-light/15"
          />
          <button type="submit" className="btn btn-brand">
            {t(lang, "search.submit")}
          </button>
        </form>
      </>
    );
  }

  const items = (await searchPublishedWorks(query)).map((w) => toCard(w, false, lang));

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "search.resultsFor", { q: query })}</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        {items.length === 0 ? t(lang, "search.none") : t(lang, "search.count", { n: items.length })}
      </p>
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((w) => (
            <li key={w.id}>
              <WorkCard w={w} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
