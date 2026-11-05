import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireDioceseScope } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "Espace diocèse — CCC" };

export default function DiocesePage({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/" className="text-sm text-muted hover:text-brand">
        ← Accueil
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">Espace diocèse</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Tableau de bord des fidèles rattachés à votre diocèse. Vous ne voyez que les inscriptions des
        paroisses qui en dépendent.
      </p>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        {/* searchParams est lu dans la frontière dynamique : le squelette de la page reste prérendu. */}
        <DioceseContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DioceseContent({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string }>;
}) {
  // Un super-administrateur peut ouvrir l'espace d'un diocèse précis ; un administrateur diocésain est
  // toujours ramené au sien par le guard.
  const { diocese: requestedDioceseId } = await searchParams;
  // Le périmètre vient de la base : un administrateur diocésain ne peut pas viser un autre diocèse.
  const { user, dioceseId, role } = await requireDioceseScope(requestedDioceseId);

  // Données vivantes : une inscription doit apparaître immédiatement, sans cache de page.
  await connection();

  const diocese = await db.diocese.findUniqueOrThrow({
    where: { id: dioceseId },
    select: { name: true, country: true, active: true },
  });

  const [parishes, total, faithful] = await Promise.all([
    db.parish.findMany({
      where: { dioceseId, active: true, mergedIntoId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true, _count: { select: { users: true } } },
    }),
    db.user.count({ where: { parish: { dioceseId } } }),
    db.user.findMany({
      where: { parish: { dioceseId } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        country: true,
        createdAt: true,
        parish: { select: { name: true } },
      },
    }),
  ]);

  const shown = faithful.length;
  const canExport = role !== "VIEWER";

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Diocèse</p>
          <p className="font-semibold text-ink text-xl">{diocese.name}</p>
          <p className="text-xs text-muted">{diocese.country}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Paroisses actives</p>
          <p className="font-semibold text-ink text-xl">{parishes.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Fidèles inscrits</p>
          <p className="font-semibold text-ink text-3xl">{total}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">Répartition par paroisse</h2>
        {parishes.length === 0 ? (
          <p className="text-sm text-muted">Aucune paroisse active dans ce diocèse.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {parishes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.city ?? "ville à compléter"}</p>
                </div>
                <p className="text-sm font-semibold text-ink">{p._count.users} inscrit(s)</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="font-display text-xl font-semibold text-brand">
            Fidèles ({total}
            {shown < total ? ` · ${shown} affichés` : ""})
          </h2>
          {canExport && (
            <form action="/api/diocese/export" method="POST">
              <input type="hidden" name="dioceseId" value={dioceseId} />
              <button
                type="submit"
                className="h-10 rounded-lg border border-line px-3 text-sm font-medium hover:bg-brand/5"
              >
                Exporter en CSV
              </button>
            </form>
          )}
        </div>

        {faithful.length === 0 ? (
          <p className="p-6 text-center text-muted">Aucun fidèle rattaché à ce diocèse pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink">Nom</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">Paroisse</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">Pays</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">Inscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {faithful.map((u) => (
                  <tr key={u.id} className="hover:bg-brand/5">
                    <td className="px-4 py-3 text-ink">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{u.parish?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.country ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shown < total && (
          <p className="border-t border-line p-3 text-xs text-muted">
            Les {200} inscriptions les plus récentes sont affichées. L’export CSV contient la liste
            complète.
          </p>
        )}
      </section>

      <p className="text-xs text-muted">
        Connecté en tant que {user.name ?? user.email ?? "administrateur"} · rôle{" "}
        {role === "SUPER_ADMIN" ? "super-administrateur" : role === "ADMIN" ? "administrateur" : "observateur"}.
      </p>
    </div>
  );
}
