import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, CheckField, Field, SelectField } from "@/components/ActionForm";
import {
  BreakdownBars,
  CountBadge,
  DashboardCard,
  StatCard,
  TrendChart,
  compact,
  type ChartSeries,
} from "@/components/dashboard";
import {
  AD_ROLES,
  CATALOG_ROLES,
  DASHBOARD_ROLES,
  EDITORIAL_ROLES,
  FINANCE_ROLES,
  LIVE_ROLES,
  MODERATION_ROLES,
  PARTNER_ROLES,
  REFERENTIAL_ROLES,
  requireStaff,
} from "@/lib/dal";
import { db } from "@/lib/db";
import { getAdminDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/currency";
import { t, type Key, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createWork, setWorkStatus } from "@/app/actions/works";
import type { StaffRole } from "@/generated/prisma/enums";

// Écran authentifié : il lit les cookies (langue, session), donc il ne peut pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "dash.title")} — CCC` };
}

const TYPE_KEY = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;
const STATUS_KEY = { DRAFT: "adm.status.DRAFT", PUBLISHED: "adm.status.PUBLISHED", ARCHIVED: "adm.status.ARCHIVED" } as const;
const ACCESS_KEY = { FREE: "access.FREE", PURCHASE: "access.PURCHASE", SUBSCRIPTION: "access.SUBSCRIPTION" } as const;

type ModuleDef = {
  href: string;
  title: Key;
  hint: Key;
  roles: StaffRole[];
  alert?: string;
};

const MODULES: ModuleDef[] = [
  { href: "/admin/moderation", title: "dash.mod.moderation", hint: "dash.mod.moderationHint", roles: MODERATION_ROLES, alert: "reports" },
  { href: "/admin/finances", title: "dash.mod.finances", hint: "dash.mod.financesHint", roles: FINANCE_ROLES },
  { href: "/admin/manuscrits", title: "dash.mod.manuscripts", hint: "dash.mod.manuscriptsHint", roles: EDITORIAL_ROLES, alert: "manuscripts" },
  { href: "/admin/partenariats", title: "dash.mod.partners", hint: "dash.mod.partnersHint", roles: PARTNER_ROLES, alert: "codes" },
  { href: "/admin/dioceses", title: "dash.mod.dioceses", hint: "dash.mod.diocesesHint", roles: REFERENTIAL_ROLES },
  { href: "/admin/publicites", title: "dash.mod.ads", hint: "dash.mod.adsHint", roles: AD_ROLES },
  { href: "/admin/lives", title: "dash.mod.lives", hint: "dash.mod.livesHint", roles: LIVE_ROLES },
];

const ALERT_KEY: Record<string, Key> = {
  manuscripts: "dash.alert.manuscripts",
  reports: "dash.alert.reports",
  reviews: "dash.alert.reviews",
  rights: "dash.alert.rights",
  files: "dash.alert.files",
  codes: "dash.alert.codes",
};

const dateOf = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function AdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-5 sm:py-10">
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <AdminDashboard />
      </Suspense>
    </main>
  );
}

async function AdminDashboard() {
  // Lecture ouverte à tous les rôles du personnel (dont l'Analyste du CDC) ; chaque module
  // d'écriture garde son propre contrôle, et l'interface ne montre que les accès autorisés.
  const user = await requireStaff(DASHBOARD_ROLES);
  const lang = await getLang();
  const role = user.staffRole as StaffRole;
  const canEditCatalog = CATALOG_ROLES.includes(role);

  const [data, works] = await Promise.all([
    getAdminDashboard(),
    db.work.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        fileKey: true,
        licenses: { select: { countries: true, contractRef: true } },
      },
    }),
  ]);

  const months = data.trend.map((m) => m.key);
  const series: ChartSeries[] = [
    {
      label: t(lang, "dash.trend.sales"),
      values: data.trend.map((m) => m.sales),
      color: "var(--brand)",
      format: (n) => String(n),
    },
    {
      label: t(lang, "dash.trend.signups"),
      values: data.trend.map((m) => m.signups),
      color: "var(--gold)",
      format: (n) => String(n),
    },
  ];

  const alertsByKey = new Map(data.alerts.map((a) => [a.key, a.count]));
  const modules = MODULES.filter((m) => m.roles.includes(role));
  const kpi = data.totals;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">{t(lang, "dash.eyebrow")}</p>
          <h1 className="font-display text-3xl font-semibold text-brand sm:text-4xl">{t(lang, "dash.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t(lang, "dash.lead")}</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>{t(lang, "dash.asOf", { date: dateOf(data.generatedAt, lang) })}</p>
          <p className="mt-1 rounded-full bg-brand/10 px-3 py-1 font-semibold text-brand">
            {t(lang, `dash.role.${role}`)}
          </p>
        </div>
      </header>

      {data.demoOrders > 0 && (
        <p className="rounded-xl border border-gold/40 bg-gold-soft/30 px-4 py-3 text-xs text-ink">
          {t(lang, "dash.demoNote", { n: data.demoOrders })}
        </p>
      )}

      {/* Indicateurs clés */}
      <section aria-label={t(lang, "dash.kpi.title")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t(lang, "dash.kpi.users")} value={compact(kpi.users, lang)} hint={t(lang, "dash.kpi.usersHint", { n: kpi.users30d })} />
        <StatCard label={t(lang, "dash.kpi.works")} value={compact(kpi.works, lang)} hint={t(lang, "dash.kpi.worksHint", { n: kpi.published })} accent="gold" />
        <StatCard label={t(lang, "dash.kpi.sales")} value={compact(kpi.sales, lang)} hint={t(lang, "dash.kpi.salesHint")} />
        <StatCard label={t(lang, "dash.kpi.revenue")} value={formatMoney(kpi.revenueXof, "XOF", lang)} hint={t(lang, "dash.kpi.revenueHint")} accent="gold" />
        <StatCard label={t(lang, "dash.kpi.subscriptions")} value={compact(kpi.activeSubscriptions, lang)} hint={t(lang, "dash.kpi.subscriptionsHint")} />
        <StatCard label={t(lang, "dash.kpi.reads")} value={compact(kpi.reads, lang)} hint={t(lang, "dash.kpi.readsHint")} />
        <StatCard label={t(lang, "dash.kpi.favorites")} value={compact(kpi.favorites, lang)} hint={t(lang, "dash.kpi.reviewsHint", { n: kpi.reviews })} />
        <StatCard label={t(lang, "dash.kpi.rating")} value={kpi.ratingAvg ? `${kpi.ratingAvg.toFixed(1)} / 5` : "—"} hint={t(lang, "dash.kpi.adsHint", { n: compact(kpi.adImpressions, lang) })} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <DashboardCard title={t(lang, "dash.trend.title")} lead={t(lang, "dash.trend.lead")}>
          <TrendChart months={months} series={series} lang={lang} ariaLabel={t(lang, "dash.trend.title")} />
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">{t(lang, "dash.trend.sales")}</dt>
              <dd className="font-display text-lg font-semibold text-brand tabular-nums">{data.trend.reduce((n, m) => n + m.sales, 0)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">{t(lang, "dash.trend.revenue")}</dt>
              <dd className="font-display text-lg font-semibold text-brand tabular-nums">
                {formatMoney(data.trend.reduce((n, m) => n + m.revenueXof, 0), "XOF", lang)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">{t(lang, "dash.trend.signups")}</dt>
              <dd className="font-display text-lg font-semibold text-brand tabular-nums">{data.trend.reduce((n, m) => n + m.signups, 0)}</dd>
            </div>
          </dl>
        </DashboardCard>

        <DashboardCard title={t(lang, "dash.alerts.title")} lead={t(lang, "dash.alerts.lead")}>
          {data.alerts.length === 0 ? (
            <p className="rounded-xl bg-brand/5 px-4 py-6 text-center text-sm text-muted">{t(lang, "dash.alerts.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.alerts.map((a) => (
                <li key={a.key}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:border-brand hover:bg-brand/5"
                  >
                    <span className="text-ink">{t(lang, ALERT_KEY[a.key] ?? "dash.alerts.title", { n: a.count })}</span>
                    <CountBadge count={a.count} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title={t(lang, "dash.catalog.title")} lead={t(lang, "dash.catalog.lead")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "dash.catalog.byType")}</p>
              <BreakdownBars
                items={data.byType.map((i) => ({
                  label: t(lang, TYPE_KEY[i.key as keyof typeof TYPE_KEY] ?? "dash.other"),
                  count: i.count,
                  color: "var(--brand)",
                }))}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t(lang, "dash.catalog.byAccess")}</p>
              <BreakdownBars
                items={data.byAccess.map((i) => ({
                  label: t(lang, ACCESS_KEY[i.key as keyof typeof ACCESS_KEY] ?? "dash.other"),
                  count: i.count,
                  color: "var(--gold)",
                }))}
              />
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title={t(lang, "dash.top.title")} lead={t(lang, "dash.top.lead")}>
          {data.topWorks.length === 0 ? (
            <p className="text-sm text-muted">{t(lang, "dash.top.empty")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line">
              {data.topWorks.map((w, i) => (
                <li key={w.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="font-display w-5 shrink-0 text-base font-semibold text-gold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/oeuvres/${w.slug}`} className="block truncate font-medium text-ink hover:text-brand hover:underline">
                      {w.title}
                    </Link>
                    <span className="text-xs text-muted">{t(lang, TYPE_KEY[w.type])}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="block font-semibold text-ink tabular-nums">{t(lang, "dash.top.sales", { n: w.sales })}</span>
                    {t(lang, "dash.top.reads", { n: w.reads })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </DashboardCard>
      </div>

      <DashboardCard title={t(lang, "dash.modules.title")} lead={t(lang, "dash.modules.lead")}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const count = m.alert ? (alertsByKey.get(m.alert) ?? 0) : 0;
            return (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="flex h-full items-start justify-between gap-2 rounded-xl border border-line p-4 transition-colors hover:border-brand hover:bg-brand/5"
                >
                  <span>
                    <span className="block font-semibold text-ink">{t(lang, m.title)}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t(lang, m.hint)}</span>
                  </span>
                  <CountBadge count={count} />
                </Link>
              </li>
            );
          })}
        </ul>
        {!canEditCatalog && (
          <p className="mt-4 rounded-xl bg-brand/5 px-4 py-3 text-xs text-muted">{t(lang, "dash.readOnly")}</p>
        )}
      </DashboardCard>

      <DashboardCard title={t(lang, "dash.recent.title")} lead={t(lang, "dash.recent.lead")}>
        {data.recentOrders.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "dash.recent.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{o.title}</span>
                  <span className="text-xs text-muted">{dateOf(o.date, lang)} · {o.id.slice(-8).toUpperCase()}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold text-ink tabular-nums">{formatMoney(o.amountXof, "XOF", lang)}</span>
                  <span className="text-xs text-muted">{t(lang, `pay.status.${o.status}`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      {/* Gestion du catalogue : conservée, réservée aux rôles d'édition. */}
      {canEditCatalog && (
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "adm.works", { n: works.length })}</h2>
            {works.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "adm.worksEmpty")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {works.map((w) => {
                  const documented = w.licenses.some((l) => l.countries.length > 0 && l.contractRef);
                  return (
                    <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                      <div>
                        <p className="font-semibold text-ink">{w.title}</p>
                        <p className="text-xs text-muted">
                          {t(lang, TYPE_KEY[w.type])} · {t(lang, STATUS_KEY[w.status])} ·{" "}
                          {documented ? t(lang, "adm.rightsOk") : t(lang, "adm.rightsMissing")}
                          {w.type === "BOOK" && (w.fileKey ? ` · ${t(lang, "adm.fileOk")}` : ` · ${t(lang, "adm.fileMissing")}`)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/oeuvres/${w.id}`}
                          className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
                        >
                          {t(lang, "adm.manage")}
                        </Link>
                        <form action={setWorkStatus}>
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="status" value={w.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                          <button
                            type="submit"
                            disabled={w.status !== "PUBLISHED" && !documented}
                            className="rounded-full border border-line px-4 py-1.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {w.status === "PUBLISHED" ? t(lang, "adm.unpublish") : t(lang, "adm.publish")}
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "adm.addWork")}</h2>
            <ActionForm action={createWork} submitLabel={t(lang, "adm.save")} lang={lang}>
              <Field label={t(lang, "adm.field.title")} name="title" />
              <SelectField
                label={t(lang, "adm.field.type")}
                name="type"
                options={(["BOOK", "DOCUMENTARY", "FILM"] as const).map((v) => ({ value: v, label: t(lang, TYPE_KEY[v]) }))}
              />
              <Field label={t(lang, "adm.field.author")} name="author" required={false} />
              <Field label={t(lang, "adm.field.description")} name="description" required={false} />
              <Field label={t(lang, "adm.field.language")} name="language" defaultValue="fr" />
              <SelectField
                label={t(lang, "adm.field.access")}
                name="access"
                options={(["FREE", "PURCHASE", "SUBSCRIPTION"] as const).map((v) => ({ value: v, label: t(lang, ACCESS_KEY[v]) }))}
              />
              <Field
                label={t(lang, "adm.field.priceXof")}
                name="price"
                type="number"
                required={false}
                hint={t(lang, "adm.hint.priceXof")}
              />
              <fieldset className="flex flex-col gap-3 rounded-2xl bg-gold-soft/50 p-3">
                <legend className="px-1 text-sm font-semibold text-brand">{t(lang, "adm.rights")}</legend>
                <Field label={t(lang, "adm.field.countries")} name="countries" required={false} hint={t(lang, "adm.hint.countries")} />
                <Field label={t(lang, "adm.field.contract")} name="contractRef" required={false} />
                <CheckField label={t(lang, "adm.field.offline")} name="allowOffline" />
              </fieldset>
              <CheckField label={t(lang, "adm.publishNow")} name="publish" />
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  );
}
