import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ACCESS_LABEL, TYPE_LABEL, formatPrice, getPublishedWork } from "@/lib/catalog";

export default function WorkPage({ params }: PageProps<"/oeuvres/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <Work params={params} />
      </Suspense>
    </main>
  );
}

async function Work({ params }: { params: PageProps<"/oeuvres/[slug]">["params"] }) {
  const { slug } = await params;
  const work = await getPublishedWork(slug);
  if (!work) notFound();

  const price = work.prices[0];
  const countries = [...new Set(work.licenses.flatMap((l) => l.countries))];
  const offline = work.licenses.some((l) => l.allowOffline);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#B8860B]">
        {TYPE_LABEL[work.type]}
      </p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#14213D]">{work.title}</h1>
      {work.author && <p className="mt-1 text-zinc-600">{work.author}</p>}

      {work.description && <p className="mt-5 leading-7 text-zinc-800">{work.description}</p>}

      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-zinc-500">Accès</dt>
          <dd>
            {work.access === "PURCHASE" && price ? formatPrice(price) : ACCESS_LABEL[work.access]}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Langue</dt>
          <dd className="uppercase">{work.language}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Lecture hors ligne</dt>
          <dd>{offline ? "Autorisée" : "Non disponible"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Pays où l’œuvre est disponible</dt>
          <dd>{countries.length ? countries.join(", ") : "—"}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled
        className="mt-8 h-11 w-full rounded-md bg-zinc-200 px-5 text-sm font-semibold text-zinc-500 sm:w-auto"
      >
        Achat et lecture : bientôt disponibles
      </button>
    </article>
  );
}
