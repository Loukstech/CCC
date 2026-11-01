import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Cover } from "@/components/Cover";
import { PlayIcon } from "@/components/icons";
import { WorkCard } from "@/components/WorkCard";
import { getActiveSubscription } from "@/lib/access";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { publicSelect, toCard, type CardItem } from "@/lib/catalog";

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

/** Lien d'ouverture d'une œuvre : lecteur de livres ou lecteur vidéo (null si elle n'a pas de fichier). */
const openHref = (w: CardItem) => (w.readable ? `/lire/${w.slug}` : w.watchable ? `/regarder/${w.slug}` : null);

/**
 * Avancement en pourcentage : pour un livre, la position est déjà un pourcentage ; pour une vidéo,
 * c'est un nombre de secondes et la durée est enregistrée avec (champ `locator`).
 */
function percentOf(w: CardItem, p: { position: number; locator: string | null }) {
  if (w.type === "BOOK") return Math.round(p.position);
  const duration = Number(p.locator ?? 0);
  return duration > 0 ? Math.min(100, Math.round((p.position / duration) * 100)) : 0;
}

async function Items() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const orders = await db.order.findMany({
    where: { userId: user.id, status: "PAID", work: { status: "PUBLISHED" } },
    orderBy: { paidAt: "desc" },
    select: { work: { select: publicSelect } },
  });
  const items = orders.flatMap((o) => (o.work ? [toCard(o.work)] : []));

  // « Reprendre » : les œuvres en cours, achetées ou comprises dans l'abonnement actuel.
  const sub = await getActiveSubscription(user.id);
  const recent = await db.progress.findMany({
    where: { userId: user.id, work: { status: "PUBLISHED" } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: { position: true, locator: true, work: { select: publicSelect } },
  });
  const ownedIds = new Set(items.map((i) => i.id));
  const resumable = recent
    .map((r) => ({ w: toCard(r.work), access: r.work.access, p: r }))
    .filter(({ w, access }) => openHref(w) && (ownedIds.has(w.id) || (access === "SUBSCRIPTION" && !!sub)))
    .map(({ w, p }) => ({ w, pct: percentOf(w, p) }))
    .filter(({ pct }) => pct < 100);
  const resume = resumable[0];
  const percentById = new Map(recent.map((r) => [r.work.id, percentOf(toCard(r.work), r)]));

  if (items.length === 0 && !resume) {
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

  return (
    <>
      {resume && (
        <section aria-label="Reprendre" className="mb-10">
          <h2 className="font-display mb-3 text-xl font-semibold text-ink">
            {resume.w.type === "BOOK" ? "Continuer la lecture" : "Reprendre le visionnage"}
          </h2>
          <Link
            href={openHref(resume.w)!}
            className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line transition-shadow hover:shadow-lg hover:shadow-brand/15"
          >
            <div className="w-20 shrink-0 sm:w-24">
              <Cover type={resume.w.type} title={resume.w.title} author={resume.w.author} coverUrl={resume.w.coverUrl} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display line-clamp-2 text-lg leading-snug font-semibold text-ink">{resume.w.title}</p>
              {resume.w.author && <p className="truncate text-sm text-muted">{resume.w.author}</p>}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <Bar percent={resume.pct} />
                </div>
                <span className="text-sm font-semibold text-brand tabular-nums">{resume.pct} %</span>
              </div>
              <span className="btn btn-primary mt-4 h-10 w-full sm:w-auto">
                <PlayIcon />
                Reprendre
              </span>
            </div>
          </Link>
        </section>
      )}

      {items.length > 0 && (
        <>
          <h2 className="font-display mb-4 text-xl font-semibold text-ink">Tous mes titres</h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5">
            {items.map((w) => {
              const pct = percentById.get(w.id) ?? 0;
              const href = openHref(w);
              const verb = w.type === "BOOK" ? "Lire" : "Regarder";
              return (
                <li key={w.id}>
                  <WorkCard w={w} />
                  {href && (
                    <div className="mt-3">
                      {pct > 0 && <Bar percent={pct} />}
                      <Link href={href} className="btn btn-primary mt-2 h-10 w-full px-3 text-sm">
                        {pct > 0 && pct < 100 ? `Reprendre · ${pct} %` : pct >= 100 ? (w.type === "BOOK" ? "Relire" : "Revoir") : verb}
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
