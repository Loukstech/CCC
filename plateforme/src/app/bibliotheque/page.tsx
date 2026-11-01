import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { PlayIcon } from "@/components/icons";
import { WorkCard } from "@/components/WorkCard";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { publicSelect, toCard } from "@/lib/catalog";

export const metadata = { title: "Ma bibliothèque — CCC" };

export default function LibraryPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-brand sm:text-4xl">Ma bibliothèque</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Vos livres, documentaires et films, sur tous vos appareils.</p>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <Items />
      </Suspense>
    </main>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
    </div>
  );
}

async function Items() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const orders = await db.order.findMany({
    where: { userId: user.id, status: "PAID", work: { status: "PUBLISHED" } },
    orderBy: { paidAt: "desc" },
    select: { work: { select: publicSelect } },
  });
  const items = orders.map((o) => toCard(o.work));

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-muted">Votre bibliothèque est vide pour le moment.</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/livres" className="btn btn-primary">
            Parcourir les livres
          </Link>
          <Link href="/documentaires" className="btn btn-primary">
            Documentaires
          </Link>
          <Link href="/films" className="btn btn-primary">
            Films
          </Link>
        </div>
      </div>
    );
  }

  const progress = await db.progress.findMany({
    where: { userId: user.id, workId: { in: items.map((i) => i.id) } },
    orderBy: { updatedAt: "desc" },
    select: { workId: true, position: true },
  });
  const percentOf = new Map(progress.map((p) => [p.workId, Math.round(p.position)]));
  const resume = progress.map((p) => items.find((i) => i.id === p.workId)).find((i) => i?.readable && (percentOf.get(i.id) ?? 0) < 100);

  return (
    <>
      {resume && (
        <section aria-label="Continuer la lecture" className="mb-10">
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">Continuer la lecture</h2>
          <Link
            href={`/lire/${resume.slug}`}
            className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line transition-shadow hover:shadow-lg hover:shadow-brand/15"
          >
            <div className="w-20 shrink-0 sm:w-24">
              <Cover type="BOOK" title={resume.title} author={resume.author} coverUrl={resume.coverUrl} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display line-clamp-2 text-lg leading-snug font-semibold text-ink">{resume.title}</p>
              {resume.author && <p className="truncate text-sm text-muted">{resume.author}</p>}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <Bar percent={percentOf.get(resume.id) ?? 0} />
                </div>
                <span className="text-sm font-semibold text-brand tabular-nums">{percentOf.get(resume.id) ?? 0} %</span>
              </div>
              <span className="btn btn-primary mt-4 h-10 w-full sm:w-auto">
                <PlayIcon />
                Reprendre
              </span>
            </div>
          </Link>
        </section>
      )}

      <h2 className="font-display mb-4 text-xl font-semibold text-ink">Tous mes titres</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
        {items.map((w) => {
          const pct = percentOf.get(w.id) ?? 0;
          return (
            <li key={w.id}>
              <WorkCard w={w} />
              {w.readable && (
                <div className="mt-3">
                  {pct > 0 && <Bar percent={pct} />}
                  <Link href={`/lire/${w.slug}`} className="btn btn-primary mt-2 h-10 w-full px-3 text-sm">
                    {pct > 0 && pct < 100 ? `Continuer · ${pct} %` : pct >= 100 ? "Relire" : "Lire"}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
