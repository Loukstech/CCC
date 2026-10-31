import Link from "next/link";
import { ACCESS_LABEL, TYPE_LABEL, formatPrice, getPublishedWorks } from "@/lib/catalog";

export default async function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <section className="mb-10 rounded-2xl bg-[#14213D] px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#E3B341]">
          Lire · Regarder · Transmettre
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
          Le savoir prend vie
        </h1>
        <p className="mt-3 max-w-xl text-zinc-200">
          Livres numériques, documentaires et films, à lire et à regarder où que vous soyez,
          même sans connexion.
        </p>
      </section>

      <h2 className="mb-4 text-xl font-semibold text-[#14213D]">Catalogue</h2>
      <Catalog />
    </main>
  );
}

async function Catalog() {
  const works = await getPublishedWorks();

  if (works.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
        Le catalogue est en préparation. Les premières œuvres arrivent bientôt.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {works.map((w) => {
        const price = w.prices[0];
        return (
          <li key={w.id}>
            <Link
              href={`/oeuvres/${w.slug}`}
              className="flex h-full flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-[#B8860B]">
                {TYPE_LABEL[w.type]}
              </span>
              <span className="text-lg font-semibold leading-snug text-[#14213D]">{w.title}</span>
              {w.author && <span className="text-sm text-zinc-600">{w.author}</span>}
              <span className="mt-auto pt-3 text-sm font-medium text-zinc-800">
                {w.access === "PURCHASE" && price ? formatPrice(price) : ACCESS_LABEL[w.access]}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
