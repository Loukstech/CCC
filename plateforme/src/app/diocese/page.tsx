import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireDioceseScope } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { balanceOf, statement } from "@/lib/ledger";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const metadata = { title: "Espace diocèse — CCC" };

export default function DiocesePage({
  searchParams,
}: {
  searchParams: Promise<{ diocese?: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
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
  const lang = await getLang();
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
  const dateLocale = lang === "fr" ? "fr-FR" : "en-GB";

  // Revenus du diocèse (lot 4 et 5) : solde à recevoir, acquis du mois, versements de l'année.
  const [revenueBalance, revenue] = await Promise.all([
    balanceOf("DIOCESE", { dioceseId }, "XOF"),
    statement("DIOCESE", { dioceseId }, "XOF", 6),
  ]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const earnedThisMonth = revenue.months.find((m) => m.month === thisMonth)?.earned ?? 0;
  const paidThisYear = revenue.payouts
    .filter((p) => p.paidAt && p.paidAt.getUTCFullYear() === new Date().getUTCFullYear())
    .reduce((n, p) => n + p.amount, 0);
  const roleLabel =
    role === "SUPER_ADMIN"
      ? t(lang, "dioPage.roleSuper")
      : role === "ADMIN"
        ? t(lang, "dioPage.roleAdmin")
        : t(lang, "dioPage.roleViewer");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-brand">
          {t(lang, "dioPage.home")}
        </Link>
        <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "dioPage.title")}</h1>
        <p className="max-w-2xl text-sm text-muted">{t(lang, "dioPage.intro")}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t(lang, "dioPage.diocese")}</p>
          <p className="font-semibold text-ink text-xl">{diocese.name}</p>
          <p className="text-xs text-muted">{diocese.country}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t(lang, "dioPage.activeParishes")}</p>
          <p className="font-semibold text-ink text-xl">{parishes.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">{t(lang, "dioPage.faithful")}</p>
          <p className="font-semibold text-ink text-3xl">{total}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "dioPage.revenue")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-paper/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t(lang, "dioPage.revenueBalance")}</p>
            <p className="font-display mt-1 text-xl font-semibold text-ink">{formatMoney(revenueBalance, "XOF", lang)}</p>
          </div>
          <div className="rounded-xl bg-paper/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t(lang, "dioPage.revenueMonth")}</p>
            <p className="font-display mt-1 text-xl font-semibold text-ink">{formatMoney(earnedThisMonth, "XOF", lang)}</p>
          </div>
          <div className="rounded-xl bg-paper/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{t(lang, "dioPage.revenuePaid")}</p>
            <p className="font-display mt-1 text-xl font-semibold text-ink">{formatMoney(paidThisYear, "XOF", lang)}</p>
          </div>
        </div>
        {revenue.months.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1">{t(lang, "ecr.month")}</th>
                <th className="py-1 text-right">{t(lang, "ecr.earned")}</th>
                <th className="py-1 text-right">{t(lang, "ecr.paid")}</th>
              </tr>
            </thead>
            <tbody>
              {revenue.months.map((month) => (
                <tr key={month.month} className="border-t border-line">
                  <td className="py-1.5">{month.month}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(month.earned + month.refunded, "XOF", lang)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(month.paid, "XOF", lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {revenue.months.length === 0 && <p className="mt-3 text-sm text-muted">{t(lang, "dioPage.revenueEmpty")}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "dioPage.byParish")}</h2>
        {parishes.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "dioPage.noParish")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {parishes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{p.city ?? t(lang, "dioPage.cityMissing")}</p>
                </div>
                <p className="text-sm font-semibold text-ink">
                  {t(lang, "dioPage.registered", { n: p._count.users })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <h2 className="font-display text-xl font-semibold text-brand">
            {shown < total
              ? t(lang, "dioPage.listTitleLimited", { total, shown })
              : t(lang, "dioPage.listTitle", { total })}
          </h2>
          {canExport && (
            <form action="/api/diocese/export" method="POST">
              <input type="hidden" name="dioceseId" value={dioceseId} />
              <button
                type="submit"
                className="h-10 rounded-lg border border-line px-3 text-sm font-medium hover:bg-brand/5"
              >
                {t(lang, "dioPage.export")}
              </button>
            </form>
          )}
        </div>

        {faithful.length === 0 ? (
          <p className="p-6 text-center text-muted">{t(lang, "dioPage.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink">{t(lang, "dioPage.colName")}</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">{t(lang, "dioPage.colEmail")}</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">{t(lang, "dioPage.colParish")}</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">{t(lang, "dioPage.colCountry")}</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink">{t(lang, "dioPage.colDate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {faithful.map((u) => (
                  <tr key={u.id} className="hover:bg-brand/5">
                    <td className="px-4 py-3 text-ink">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{u.parish?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{u.country ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString(dateLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shown < total && <p className="border-t border-line p-3 text-xs text-muted">{t(lang, "dioPage.limit")}</p>}
      </section>

      <p className="text-xs text-muted">
        {t(lang, "dioPage.connectedAs", {
          name: user.name ?? user.email ?? "—",
          role: roleLabel,
        })}
      </p>
    </div>
  );
}
