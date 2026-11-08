import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, CheckField, Field, SelectField } from "@/components/ActionForm";
import { BreakdownBars, TrendChart, type ChartSeries } from "@/components/dashboard";
import { ConsoleCard, ConsoleTable, Kpi, Metric, Pill, type TableRow } from "@/components/admin/ConsoleUI";
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
import { getAdminOverview, isRangeKey, RANGES, type NamedCount, type RangeKey } from "@/lib/admin-overview";
import { convertMinor, formatMoney, isDisplayCurrency } from "@/lib/currency";
import { cl, ct, type CKey } from "@/lib/console-i18n";
import { t, type Key, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/settings";
import { getAudienceAnalytics } from "@/lib/audience";
import { getPopularity } from "@/lib/popularity";
import { createWork, setWorkStatus } from "@/app/actions/works";
import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Vue d'ensemble de la console : format « grand écran », sans limite de largeur autre que 1920 px.
 * Toutes les données viennent de `getAdminOverview` (une requête d'inventaire + agrégats groupés) ;
 * les préférences de densité, de période et de devise viennent des paramètres applicatifs.
 */
export const instant = false;

export async function generateMetadata() {
  return { title: `${ct(await getLang(), "title")} — CCC` };
}

const TYPE_KEY = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;
const STATUS_KEY = { DRAFT: "adm.status.DRAFT", PUBLISHED: "adm.status.PUBLISHED", ARCHIVED: "adm.status.ARCHIVED" } as const;
const ACCESS_KEY = { FREE: "access.FREE", PURCHASE: "access.PURCHASE", SUBSCRIPTION: "access.SUBSCRIPTION" } as const;

const ALERT_KEY: Record<string, Key> = {
  manuscripts: "dash.alert.manuscripts",
  reports: "dash.alert.reports",
  reviews: "dash.alert.reviews",
  rights: "dash.alert.rights",
  files: "dash.alert.files",
  codes: "dash.alert.codes",
};

type ModuleDef = { href: string; title: Key; hint: Key; roles: StaffRole[] };
const MODULES: ModuleDef[] = [
  { href: "/admin/moderation", title: "dash.mod.moderation", hint: "dash.mod.moderationHint", roles: MODERATION_ROLES },
  { href: "/admin/finances", title: "dash.mod.finances", hint: "dash.mod.financesHint", roles: FINANCE_ROLES },
  { href: "/admin/manuscrits", title: "dash.mod.manuscripts", hint: "dash.mod.manuscriptsHint", roles: EDITORIAL_ROLES },
  { href: "/admin/partenariats", title: "dash.mod.partners", hint: "dash.mod.partnersHint", roles: PARTNER_ROLES },
  { href: "/admin/dioceses", title: "dash.mod.dioceses", hint: "dash.mod.diocesesHint", roles: REFERENTIAL_ROLES },
  { href: "/admin/publicites", title: "dash.mod.ads", hint: "dash.mod.adsHint", roles: AD_ROLES },
  { href: "/admin/lives", title: "dash.mod.lives", hint: "dash.mod.livesHint", roles: LIVE_ROLES },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const lang = await getLang();
  // `searchParams` est lu à l'intérieur de la frontière Suspense : la coque peut être servie
  // immédiatement, seule la zone de données attend la fenêtre statistique choisie.
  return (
    <Suspense fallback={<p className="text-sm text-muted">{t(lang, "adm.loading")}</p>}>
      <Overview query={searchParams} />
    </Suspense>
  );
}

function fmtNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB").format(n);
}

function fmtDate(d: Date, lang: Lang, withTime = false): string {
  return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  });
}

/** Panneau de répartition : libellés de données traduits, repli sur la clé brute. */
function BreakdownCard({ title, items, lang }: { title: string; items: NamedCount[]; lang: Lang }) {
  return (
    <ConsoleCard title={title}>
      <BreakdownBars
        items={items.slice(0, 8).map((i) => ({ label: cl(lang, i.key), count: i.count }))}
      />
    </ConsoleCard>
  );
}

async function Overview({ query }: { query: Promise<{ range?: string }> }) {
  const [user, lang, settings, q] = await Promise.all([
    requireStaff(DASHBOARD_ROLES),
    getLang(),
    getSettings(),
    query,
  ]);
  const range: RangeKey = isRangeKey(q.range)
    ? q.range
    : isRangeKey(settings.console_range) ? settings.console_range : "12m";
  const currency = isDisplayCurrency(settings.default_currency) ? settings.default_currency : "XOF";
  const role = user.staffRole as StaffRole;
  const canEditCatalog = CATALOG_ROLES.includes(role);
  const showCharts = settings.console_show_charts !== "false";
  const showAudit = settings.console_show_audit !== "false";
  const rowLimit = Math.min(200, Math.max(5, Number(settings.console_rows) || 25));

  // Une seule horloge pour toutes les fenêtres statistiques affichées sur la page.
  const now = new Date();
  const [data, works, popularity, analytics] = await Promise.all([
    getAdminOverview(range, currency, lang, now),
    canEditCatalog
      ? db.work.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true, title: true, type: true, status: true, fileKey: true,
            licenses: { select: { countries: true, contractRef: true } },
          },
        })
      : Promise.resolve([]),
    getPopularity(now, Math.min(rowLimit, 12)),
    getAudienceAnalytics(range, lang, now, Math.min(rowLimit, 10)),
  ]);

  const money = (n: number) => formatMoney(n, currency, lang);
  const num = (n: number) => fmtNumber(n, lang);
  const inv = new Map(data.inventory.map((r) => [r.key, r.count]));
  const totalRows = data.inventory.reduce((n, r) => n + r.count, 0);
  const staffCount = data.breakdowns.userRoles
    .filter((r) => r.key !== "READER")
    .reduce((n, r) => n + r.count, 0);
  const alertsByKey = new Map(data.alerts.map((a) => [a.key, a.count]));
  const modules = MODULES.filter((m) => m.roles.includes(role));

  // Le tableau de bord de base convertit tout en XOF ; la console affiche la devise choisie.
  const totalRevenue = convertMinor(data.totals.revenueXof, "XOF", currency) ?? 0;

  const months = data.period.points.map((p) => p.key);
  const labels = data.period.points.map((p) => p.label);
  const countSeries: ChartSeries[] = [
    { label: ct(lang, "trend.sales"), values: data.period.points.map((p) => p.sales), color: "var(--brand)", format: (n) => num(n) },
    { label: ct(lang, "trend.signups"), values: data.period.points.map((p) => p.signups), color: "var(--gold)", format: (n) => num(n) },
    { label: ct(lang, "trend.reads"), values: data.period.points.map((p) => p.reads), color: "var(--brand-light)", format: (n) => num(n) },
  ];
  const revenueSeries: ChartSeries[] = [
    { label: ct(lang, "trend.revenue"), values: data.period.points.map((p) => p.revenueXof), color: "var(--gold)", format: money },
  ];

  const inventoryRows: TableRow[] = data.inventory.map((r) => ({
    key: r.key,
    cells: [
      <span key="n" className="text-ink">{cl(lang, `table.${r.key}`)}</span>,
      <span key="k" className="font-mono text-[11px] text-muted">{r.key}</span>,
      <span key="v" className="font-semibold tabular-nums">{num(r.count)}</span>,
    ],
  }));

  const workRows: TableRow[] = data.workRows.slice(0, rowLimit).map((w) => ({
    key: w.id,
    cells: [
      <Link key="t" href={`/oeuvres/${w.slug}`} className="block max-w-[22rem] truncate font-medium text-ink hover:text-brand hover:underline" title={w.title}>
        {w.title}
      </Link>,
      <Pill key="ty">{cl(lang, w.type)}</Pill>,
      <Pill key="st" tone={w.status === "PUBLISHED" ? "brand" : "neutral"}>{cl(lang, w.status)}</Pill>,
      <span key="ac" className="text-muted">{cl(lang, w.access)}</span>,
      <span key="lg" className="uppercase text-muted">{w.language}</span>,
      <span key="sa" className="font-semibold tabular-nums">{num(w.sales)}</span>,
      <span key="re" className="tabular-nums">{num(w.reads)}</span>,
      <span key="ra" className="tabular-nums">{w.ratingCount ? `${w.ratingAvg.toFixed(1)} / 5` : "—"}</span>,
      <span key="rc" className="text-muted tabular-nums">{num(w.ratingCount)}</span>,
    ],
  }));

  // Popularité : classement par signaux d'engagement déjà stockés (aucune migration).
  const popularityRows: TableRow[] = popularity.top.map((w) => ({
    key: w.id,
    cells: [
      <Link key="t" href={`/oeuvres/${w.slug}`} className="block max-w-[18rem] truncate font-medium text-ink hover:text-brand hover:underline" title={w.title}>
        {w.title}
      </Link>,
      <Pill key="ty">{cl(lang, w.type)}</Pill>,
      <span key="f" className="tabular-nums">{num(w.favorites)}</span>,
      <span key="b" className="tabular-nums">{num(w.bookmarks)}</span>,
      <span key="r" className="tabular-nums">{num(w.readers)}</span>,
      <span key="v" className="tabular-nums">{num(w.reviews)}</span>,
      <span key="a" className="tabular-nums">{w.reviews ? `${w.ratingAvg.toFixed(1)} / 5` : "—"}</span>,
      <span key="s" className="font-semibold tabular-nums text-brand">{num(w.score)}</span>,
    ],
  }));
  const ratingItems = [...popularity.ratings]
    .reverse()
    .map((r) => ({ label: ct(lang, "pop.stars", { n: r.stars }), count: r.count }));

  // Analytique : compteurs réels, courbe sur la même fenêtre que le reste de la console.
  const analyticsMonths = analytics.period.points.map((p) => p.key);
  const analyticsLabels = analytics.period.points.map((p) => p.label);
  const analyticsSeries: ChartSeries[] = [
    { label: ct(lang, "ana.views"), values: analytics.period.points.map((p) => p.views), color: "var(--brand)", format: num },
    { label: ct(lang, "ana.downloads"), values: analytics.period.points.map((p) => p.downloads), color: "var(--gold)", format: num },
    { label: ct(lang, "ana.plays"), values: analytics.period.points.map((p) => p.plays), color: "var(--brand-light)", format: num },
  ];
  const analyticsRows: TableRow[] = analytics.top.map((w) => ({
    key: w.id,
    cells: [
      <Link key="t" href={`/oeuvres/${w.slug}`} className="block max-w-[16rem] truncate font-medium text-ink hover:text-brand hover:underline" title={w.title}>
        {w.title}
      </Link>,
      <Pill key="ty">{cl(lang, w.type)}</Pill>,
      <span key="v" className="tabular-nums">{num(w.views)}</span>,
      <span key="d" className="tabular-nums">{num(w.downloads)}</span>,
      <span key="p" className="tabular-nums">{num(w.plays)}</span>,
      <span key="s" className="font-semibold tabular-nums text-brand">{num(w.views + w.downloads + w.plays)}</span>,
    ],
  }));
  const analyticsEvents = analytics.period.views + analytics.period.downloads + analytics.period.plays;

  const userRows: TableRow[] = data.recentUsers.map((u) => ({
    key: u.id,
    cells: [
      <span key="n" className="block max-w-[10rem] truncate font-medium">{u.name ?? "—"}</span>,
      <span key="e" className="block max-w-[13rem] truncate text-muted">{u.email ?? "—"}</span>,
      <span key="c">{u.country ?? "—"}</span>,
      <Pill key="r" tone={u.staffRole ? "gold" : "neutral"}>{cl(lang, u.staffRole ?? "READER")}</Pill>,
      <span key="d" className="whitespace-nowrap text-muted">{fmtDate(u.createdAt, lang)}</span>,
    ],
  }));

  const activityRows: TableRow[] = data.recentActivity.map((a) => ({
    key: a.id,
    cells: [
      <span key="w" className="whitespace-nowrap text-muted">{fmtDate(a.createdAt, lang, true)}</span>,
      <span key="a" className="block max-w-[10rem] truncate text-muted">{a.actor ?? "—"}</span>,
      <span key="ac" className="font-mono text-[11px] text-brand">{a.action}</span>,
      <span key="t" className="block max-w-[9rem] truncate font-mono text-[11px] text-muted">{a.target ?? "—"}</span>,
    ],
  }));

  const liveRows: TableRow[] = data.upcomingLives.map((l) => ({
    key: l.id,
    cells: [
      <span key="t" className="block max-w-[14rem] truncate font-medium">{l.title}</span>,
      <Pill key="s" tone={l.status === "LIVE" ? "red" : "brand"}>{cl(lang, l.status)}</Pill>,
      <span key="d" className="whitespace-nowrap text-muted">{fmtDate(l.startsAt, lang, true)}</span>,
    ],
  }));

  const codeRows: TableRow[] = data.expiringCodes.map((c) => ({
    key: c.id,
    cells: [
      <span key="l" className="block max-w-[14rem] truncate font-medium">{c.label}</span>,
      <Pill key="k">{cl(lang, c.kind)}</Pill>,
      <span key="d" className="whitespace-nowrap text-muted">{fmtDate(c.expiresAt, lang)}</span>,
    ],
  }));

  const adRows: TableRow[] = data.ads.map((a) => ({
    key: a.key,
    cells: [
      <span key="p" className="font-medium">{cl(lang, a.key)}</span>,
      <span key="n" className="tabular-nums">{num(a.ads)}</span>,
      <span key="i" className="tabular-nums">{num(a.impressions)}</span>,
      <span key="c" className="tabular-nums">{num(a.clicks)}</span>,
      <span key="r" className="font-semibold tabular-nums">{a.impressions ? `${((a.clicks / a.impressions) * 100).toFixed(2)} %` : "—"}</span>,
    ],
  }));

  const orderRows: TableRow[] = data.recentOrders.map((o) => ({
    key: o.id,
    cells: [
      <span key="t" className="block max-w-[18rem] truncate font-medium">{o.title}</span>,
      <span key="a" className="whitespace-nowrap font-semibold tabular-nums">{money(convertMinor(o.amountXof, "XOF", currency) ?? 0)}</span>,
      <Pill key="s" tone={o.status === "PAID" ? "brand" : o.status === "REFUNDED" ? "red" : "neutral"}>{cl(lang, o.status)}</Pill>,
      <span key="d" className="whitespace-nowrap text-muted">{fmtDate(o.date, lang)}</span>,
      <span key="i" className="font-mono text-[11px] text-muted">{o.id.slice(-8).toUpperCase()}</span>,
    ],
  }));

  const b = data.breakdowns;
  const breakdownCards: { key: CKey; items: NamedCount[] }[] = [
    { key: "breakdowns.orderStatus", items: b.orderStatus },
    { key: "breakdowns.subscriptionStatus", items: b.subscriptionStatus },
    { key: "breakdowns.subscriptionPlan", items: b.subscriptionPlan },
    { key: "breakdowns.userRoles", items: b.userRoles },
    { key: "breakdowns.userCountries", items: b.userCountries },
    { key: "breakdowns.workStatus", items: b.workStatus },
    { key: "breakdowns.workLanguages", items: b.workLanguages },
    { key: "breakdowns.manuscriptStatus", items: b.manuscriptStatus },
    { key: "breakdowns.partnerCodeState", items: b.partnerCodeState },
    { key: "breakdowns.auditActions", items: b.auditActions },
    { key: "breakdowns.byType", items: data.byType },
    { key: "breakdowns.byAccess", items: data.byAccess },
  ];

  const healthIssues = [
    { key: "health.disabledUsers", n: data.health.disabledUsers },
    { key: "health.worksWithoutRights", n: data.health.worksWithoutRights },
    { key: "health.booksWithoutFile", n: data.health.booksWithoutFile },
    { key: "health.expiredActiveAds", n: data.health.expiredActiveAds },
    { key: "health.orphanOrders", n: data.health.orphanOrders },
  ].filter((i) => i.n > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête et sélecteur de période */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{ct(lang, "eyebrow")}</p>
          <h1 className="font-display text-2xl font-semibold text-brand xl:text-3xl">{ct(lang, "title")}</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted">{ct(lang, "lead")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={ct(lang, "period")} className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?range=${r}`}
                aria-current={r === range ? "true" : undefined}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  r === range ? "bg-brand text-white" : "text-muted hover:bg-brand/5 hover:text-brand"
                }`}
              >
                {ct(lang, `period.${r}` as CKey)}
              </Link>
            ))}
          </nav>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
            {ct(lang, "asOf", { date: fmtDate(data.generatedAt, lang, true) })}
          </span>
          <span className="rounded-full bg-brand/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand">
            {cl(lang, role)}
          </span>
        </div>
      </header>

      {data.demoOrders > 0 && (
        <p className="rounded-lg border border-gold/40 bg-gold-soft/25 px-3 py-2 text-[11px] text-ink">
          {ct(lang, "demoNote", { n: data.demoOrders })}
        </p>
      )}

      {/* 12 indicateurs clés : 6 colonnes sur un écran large */}
      <section aria-label={ct(lang, "sec.kpi")} className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        <Kpi lang={lang} label={ct(lang, "kpi.users")} value={num(data.totals.users)} hint={ct(lang, "kpi.usersHint", { n: data.totals.users30d })} delta={data.deltas.users} />
        <Kpi lang={lang} label={ct(lang, "kpi.works")} value={num(data.totals.works)} hint={ct(lang, "kpi.published", { n: data.totals.published })} accent="gold" />
        <Kpi lang={lang} label={ct(lang, "kpi.orders")} value={num(data.totals.sales)} hint={ct(lang, "kpi.ordersHint", { n: data.period.sales })} delta={data.deltas.orders} />
        <Kpi lang={lang} label={ct(lang, "kpi.revenue")} value={money(totalRevenue)} hint={ct(lang, "kpi.revenueHint")} delta={data.deltas.revenue} accent="gold" />
        <Kpi lang={lang} label={ct(lang, "kpi.subscriptions")} value={num(data.totals.activeSubscriptions)} hint={ct(lang, "kpi.subscriptionsHint")} />
        <Kpi lang={lang} label={ct(lang, "kpi.reads")} value={num(data.totals.reads)} hint={ct(lang, "kpi.readsHint", { n: data.period.reads })} delta={data.deltas.reads} />
        <Kpi lang={lang} label={ct(lang, "kpi.rating")} value={data.totals.ratingAvg ? `${data.totals.ratingAvg.toFixed(1)} / 5` : "—"} hint={ct(lang, "kpi.ratingHint", { n: data.totals.reviews })} accent="gold" />
        <Kpi lang={lang} label={ct(lang, "kpi.ads")} value={num(data.totals.adImpressions)} hint={ct(lang, "kpi.adsHint", { n: num(data.totals.adClicks) })} />
        <Kpi lang={lang} label={ct(lang, "kpi.staff")} value={num(staffCount)} hint={ct(lang, "kpi.staffHint", { n: data.health.disabledUsers })} />
        <Kpi lang={lang} label={ct(lang, "kpi.dioceses")} value={num(inv.get("dioceses") ?? 0)} hint={ct(lang, "kpi.diocesesHint", { n: inv.get("parishes") ?? 0 })} accent="gold" />
        <Kpi lang={lang} label={ct(lang, "sec.inventory")} value={num(totalRows)} hint={ct(lang, "inventory.total", { n: num(totalRows) })} />
        <Kpi lang={lang} label={ct(lang, "sec.health")} value={`${data.health.dbLatencyMs} ms`} hint={ct(lang, "health.latency")} />
      </section>

      {/* Courbes */}
      {showCharts && (
        <ConsoleCard
          title={ct(lang, "sec.trend")}
          lead={ct(lang, "trend.lead")}
          aside={<Pill tone="gold">{ct(lang, `period.${range}` as CKey)}</Pill>}
          bodyClass="grid gap-4 xl:grid-cols-[1.5fr_1fr]"
        >
          <div className="min-w-0">
            <TrendChart months={months} labels={labels} series={countSeries} lang={lang} ariaLabel={ct(lang, "sec.trend")} />
          </div>
          <div className="min-w-0 border-t border-line pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
            <TrendChart months={months} labels={labels} series={revenueSeries} lang={lang} ariaLabel={ct(lang, "trend.revenue")} />
            <p className="mt-2 text-center text-[11px] text-muted">
              {ct(lang, "trend.total")} : <strong className="text-brand">{money(data.period.revenueXof)}</strong>
            </p>
          </div>
        </ConsoleCard>
      )}

      {/* Popularité : favoris, signets, lectures et avis, croisés par œuvre */}
      <ConsoleCard
        title={ct(lang, "sec.popularity")}
        lead={ct(lang, "pop.lead")}
        aside={
          <Pill tone="gold">
            {ct(lang, "pop.engagedHint", { n: popularity.totals.engagedWorks, total: popularity.totals.works })}
          </Pill>
        }
        bodyClass="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]"
      >
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label={ct(lang, "pop.favorites")} value={num(popularity.totals.favorites)} />
            <Metric label={ct(lang, "pop.bookmarks")} value={num(popularity.totals.bookmarks)} />
            <Metric label={ct(lang, "pop.readers")} value={num(popularity.totals.readers)} tone="gold" />
            <Metric label={ct(lang, "pop.reviews")} value={num(popularity.totals.reviews)} />
            <Metric label={ct(lang, "pop.rating")} value={popularity.totals.ratingAvg ? `${popularity.totals.ratingAvg.toFixed(1)} / 5` : "—"} />
            <Metric label={ct(lang, "pop.active30")} value={num(popularity.totals.activeReaders30d)} />
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">{ct(lang, "pop.ratings")}</p>
            <BreakdownBars items={ratingItems} />
            <p className="mt-3 text-[10px] leading-snug text-muted">{ct(lang, "pop.scoreHint")}</p>
            {popularity.totals.favorites + popularity.totals.bookmarks + popularity.totals.reviews === 0 && (
              <p className="mt-1.5 text-[10px] leading-snug text-muted">{ct(lang, "pop.noSignals")}</p>
            )}
          </div>
        </div>
        <div className="min-w-0 border-t border-line pt-3 2xl:border-l 2xl:border-t-0 2xl:pl-4 2xl:pt-0">
          <p className="mb-1.5 text-[11px] font-semibold text-ink">{ct(lang, "pop.top")}</p>
          <ConsoleTable
            head={[
              ct(lang, "col.title"), ct(lang, "col.type"), ct(lang, "pop.favorites"),
              ct(lang, "pop.bookmarks"), ct(lang, "pop.readers"), ct(lang, "pop.reviews"),
              ct(lang, "col.rating"), ct(lang, "pop.score"),
            ]}
            rows={popularityRows}
            empty={ct(lang, "pop.empty")}
            align={["left", "left", "right", "right", "right", "right", "right", "right"]}
          />
        </div>
      </ConsoleCard>

      {/* Analytique : compteurs d'audience réels et évolution dans le temps */}
      <ConsoleCard
        title={ct(lang, "sec.analytics")}
        lead={ct(lang, "ana.lead")}
        aside={<Pill tone="brand">{ct(lang, "ana.tracked", { n: analytics.trackedWorks })}</Pill>}
        bodyClass="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
      >
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
            <Metric label={ct(lang, "ana.totalViews")} value={num(analytics.totals.views)} />
            <Metric label={ct(lang, "ana.totalDownloads")} value={num(analytics.totals.downloads)} tone="gold" />
            <Metric label={ct(lang, "ana.totalPlays")} value={num(analytics.totals.plays)} />
            <Metric label={ct(lang, "ana.rangeViews")} value={num(analytics.period.views)} />
            <Metric label={ct(lang, "ana.rangeDownloads")} value={num(analytics.period.downloads)} tone="gold" />
            <Metric label={ct(lang, "ana.rangePlays")} value={num(analytics.period.plays)} />
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold text-ink">{ct(lang, "ana.trend")}</p>
              <p className="text-[10px] text-muted">
                {ct(lang, "ana.trendLead", {
                  n: analytics.period.points.length,
                  range: ct(lang, `period.${range}` as CKey),
                })}
              </p>
            </div>
            {showCharts ? (
              <TrendChart
                months={analyticsMonths}
                labels={analyticsLabels}
                series={analyticsSeries}
                lang={lang}
                ariaLabel={ct(lang, "ana.trend")}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-[11px] text-muted">
                {ct(lang, "ana.chartsOff")}
              </p>
            )}
            {analyticsEvents === 0 && (
              <p className="mt-1.5 text-[10px] leading-snug text-muted">{ct(lang, "ana.empty")}</p>
            )}
            <p className="mt-2 text-[10px] leading-snug text-muted">{ct(lang, "ana.backfillNote")}</p>
          </div>
        </div>
        <div className="min-w-0 border-t border-line pt-3 2xl:border-l 2xl:border-t-0 2xl:pl-4 2xl:pt-0">
          <p className="text-[11px] font-semibold text-ink">{ct(lang, "ana.top")}</p>
          <p className="mb-1.5 text-[10px] text-muted">{ct(lang, "ana.topLead")}</p>
          <ConsoleTable
            head={[
              ct(lang, "col.title"), ct(lang, "col.type"), ct(lang, "ana.views"),
              ct(lang, "ana.downloads"), ct(lang, "ana.plays"), ct(lang, "ana.total"),
            ]}
            rows={analyticsRows}
            empty={ct(lang, "ana.empty")}
            align={["left", "left", "right", "right", "right", "right"]}
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label={ct(lang, "ana.dailyRows")} value={num(analytics.statRows)} />
            <Metric
              label={ct(lang, "ana.since")}
              value={analytics.firstDay ? fmtDate(analytics.firstDay, lang) : ct(lang, "ana.noFirst")}
            />
          </div>
        </div>
      </ConsoleCard>

      {/* À traiter, modération, santé */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        <ConsoleCard title={ct(lang, "sec.alerts")} lead={ct(lang, "alerts.empty")} bodyClass="p-2">
          {data.alerts.length === 0 ? (
            <p className="px-2 py-5 text-center text-xs text-muted">{ct(lang, "alerts.empty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.alerts.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center justify-between gap-2 px-2 py-2 text-xs hover:bg-brand/5">
                    <span>{t(lang, ALERT_KEY[a.key] ?? "dash.alerts.title", { n: a.count })}</span>
                    <Pill tone="gold">{a.count}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ConsoleCard>

        <ConsoleCard title={ct(lang, "sec.moderation")} lead={ct(lang, "moderation.lead")}>
          <div className="grid grid-cols-2 gap-2">
            <Metric label={ct(lang, "moderation.pendingReviews")} value={num(data.moderation.pendingReviews)} tone={data.moderation.pendingReviews ? "gold" : "brand"} />
            <Metric label={ct(lang, "moderation.hiddenReviews")} value={num(data.moderation.hiddenReviews)} />
            <Metric label={ct(lang, "moderation.openReports")} value={num(data.moderation.openReports)} tone={data.moderation.openReports ? "gold" : "brand"} />
            <Metric label={ct(lang, "moderation.pendingComments")} value={num(data.moderation.pendingComments)} />
          </div>
        </ConsoleCard>

        <ConsoleCard title={ct(lang, "sec.health")} lead={ct(lang, "health.lead")}>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Metric label={ct(lang, "health.latency")} value={`${data.health.dbLatencyMs} ms`} />
            <Metric label={ct(lang, "health.issues")} value={num(healthIssues.length)} tone={healthIssues.length ? "gold" : "brand"} />
          </div>
          {healthIssues.length === 0 ? (
            <p className="text-xs text-muted">{ct(lang, "health.allOk")}</p>
          ) : (
            <ul className="space-y-1">
              {healthIssues.map((i) => (
                <li key={i.key} className="text-[11px] text-ink">• {ct(lang, i.key as CKey, { n: i.n })}</li>
              ))}
            </ul>
          )}
        </ConsoleCard>
      </div>

      {/* Finances et publicité */}
      <div className="grid gap-3 xl:grid-cols-2">
        <ConsoleCard title={ct(lang, "sec.finance")} lead={ct(lang, "finance.lead")}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Metric label={ct(lang, "finance.revenue")} value={money(data.finance.revenueRangeXof)} />
            <Metric label={ct(lang, "finance.fees")} value={money(data.finance.feesRangeXof)} />
            <Metric label={ct(lang, "finance.net")} value={money(data.finance.netRangeXof)} tone="gold" />
            <Metric label={ct(lang, "finance.commissions")} value={num(data.finance.commissionTotalXof)} />
            <Metric label={ct(lang, "finance.payouts")} value={num(data.finance.payoutTotalXof)} />
            <Metric label={ct(lang, "finance.payoutPaid")} value={num(data.finance.payoutPaidXof)} />
            <Metric label={ct(lang, "finance.refunds")} value={num(data.finance.refundedCount)} tone="gold" />
          </div>
        </ConsoleCard>

        <ConsoleCard title={ct(lang, "sec.ads")} lead={ct(lang, "ads.lead")}>
          <ConsoleTable
            head={[
              ct(lang, "col.placement"), ct(lang, "col.count"), ct(lang, "col.impressions"),
              ct(lang, "col.clicks"), ct(lang, "col.ctr"),
            ]}
            rows={adRows}
            empty={ct(lang, "common.empty")}
            align={["left", "right", "right", "right", "right"]}
          />
        </ConsoleCard>
      </div>

      {/* Inventaire complet + répartitions */}
      <div className="grid gap-3 2xl:grid-cols-[1fr_2fr]">
        <ConsoleCard
          title={ct(lang, "sec.inventory")}
          lead={ct(lang, "inventory.lead", { n: data.inventory.length })}
          aside={<Pill tone="brand">{ct(lang, "inventory.total", { n: num(totalRows) })}</Pill>}
        >
          <ConsoleTable
            head={[ct(lang, "col.table"), ct(lang, "col.key"), ct(lang, "col.rows")]}
            rows={inventoryRows}
            empty={ct(lang, "common.empty")}
            align={["left", "left", "right"]}
          />
        </ConsoleCard>

        <section aria-label={ct(lang, "sec.breakdowns")} className="min-w-0">
          <p className="mb-2 text-[11px] text-muted">{ct(lang, "breakdowns.lead")}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {breakdownCards.map((c) => (
              <BreakdownCard key={c.key} title={ct(lang, c.key)} items={c.items} lang={lang} />
            ))}
          </div>
        </section>
      </div>

      {/* Table du catalogue, dense et triable visuellement */}
      <ConsoleCard
        title={ct(lang, "sec.works")}
        lead={ct(lang, "works.lead", { n: data.workRows.length })}
        aside={<span className="text-[11px] text-muted">{ct(lang, "common.showing", { n: Math.min(rowLimit, data.workRows.length) })}</span>}
      >
        <ConsoleTable
          head={[
            ct(lang, "col.title"), ct(lang, "col.type"), ct(lang, "col.status"), ct(lang, "col.access"),
            ct(lang, "col.language"), ct(lang, "col.sales"), ct(lang, "col.reads"),
            ct(lang, "col.rating"), ct(lang, "col.count"),
          ]}
          rows={workRows}
          empty={ct(lang, "common.empty")}
          align={["left", "left", "left", "left", "left", "right", "right", "right", "right"]}
        />
      </ConsoleCard>

      {/* Quatre flux de données */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <ConsoleCard title={ct(lang, "sec.users")} lead={ct(lang, "users.lead", { n: data.recentUsers.length })}>
          <ConsoleTable
            head={[ct(lang, "col.name"), ct(lang, "col.email"), ct(lang, "col.country"), ct(lang, "col.role"), ct(lang, "col.date")]}
            rows={userRows}
            empty={ct(lang, "common.empty")}
          />
        </ConsoleCard>

        {showAudit && (
          <ConsoleCard
            title={ct(lang, "sec.activity")}
            lead={ct(lang, "activity.lead")}
            aside={<Link href="/admin/audit" className="text-[11px] font-semibold text-brand hover:underline">{ct(lang, "common.viewAll")}</Link>}
          >
            <ConsoleTable
              head={[ct(lang, "col.time"), ct(lang, "col.actor"), ct(lang, "col.action"), ct(lang, "col.target")]}
              rows={activityRows}
              empty={ct(lang, "activity.empty")}
            />
          </ConsoleCard>
        )}

        <ConsoleCard title={ct(lang, "sec.lives")} lead={ct(lang, "lives.lead")}>
          <ConsoleTable
            head={[ct(lang, "col.title"), ct(lang, "col.status"), ct(lang, "col.date")]}
            rows={liveRows}
            empty={ct(lang, "lives.empty")}
          />
        </ConsoleCard>

        <ConsoleCard title={ct(lang, "sec.codes")} lead={ct(lang, "codes.lead")}>
          <ConsoleTable
            head={[ct(lang, "col.name"), ct(lang, "col.type"), ct(lang, "col.date")]}
            rows={codeRows}
            empty={ct(lang, "codes.empty")}
          />
        </ConsoleCard>
      </div>

      {/* Dernières commandes + accès rapides */}
      <div className="grid gap-3 2xl:grid-cols-[2fr_1fr]">
        <ConsoleCard title={ct(lang, "sec.orders")} lead={ct(lang, "sec.ordersLead", { n: data.recentOrders.length })}>
          <ConsoleTable
            head={[ct(lang, "col.title"), ct(lang, "col.value"), ct(lang, "col.status"), ct(lang, "col.date"), "ID"]}
            rows={orderRows}
            empty={ct(lang, "common.empty")}
          />
        </ConsoleCard>

        <ConsoleCard title={ct(lang, "sec.quick")} lead={t(lang, "dash.modules.lead")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {modules.map((m) => {
              const count = m.href.includes("moderation") ? (alertsByKey.get("reports") ?? 0)
                : m.href.includes("manuscrits") ? (alertsByKey.get("manuscripts") ?? 0)
                : m.href.includes("partenariats") ? (alertsByKey.get("codes") ?? 0) : 0;
              return (
                <li key={m.href}>
                  <Link href={m.href} className="flex items-start justify-between gap-2 rounded-lg border border-line px-2.5 py-2 transition-colors hover:border-brand hover:bg-brand/5">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-ink">{t(lang, m.title)}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted">{t(lang, m.hint)}</span>
                    </span>
                    {count > 0 && <Pill tone="gold">{count}</Pill>}
                  </Link>
                </li>
              );
            })}
          </ul>
          {!canEditCatalog && <p className="mt-3 text-[11px] text-muted">{ct(lang, "readOnly")}</p>}
        </ConsoleCard>
      </div>

      {/* Gestion du catalogue : conservée, repliée pour ne pas noyer les statistiques. */}
      {canEditCatalog && (
        <details className="rounded-xl border border-line bg-surface shadow-sm">
          <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-semibold text-brand">
            {t(lang, "adm.works", { n: works.length })} — {t(lang, "adm.addWork")}
          </summary>
          <div className="grid gap-6 border-t border-line p-3.5 xl:grid-cols-[1fr_380px]">
            <section>
              {works.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">{t(lang, "adm.worksEmpty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {works.map((w) => {
                    const documented = w.licenses.some((l) => l.countries.length > 0 && l.contractRef);
                    return (
                      <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{w.title}</p>
                          <p className="text-[11px] text-muted">
                            {t(lang, TYPE_KEY[w.type])} · {t(lang, STATUS_KEY[w.status])} ·{" "}
                            {documented ? t(lang, "adm.rightsOk") : t(lang, "adm.rightsMissing")}
                            {w.type === "BOOK" && (w.fileKey ? ` · ${t(lang, "adm.fileOk")}` : ` · ${t(lang, "adm.fileMissing")}`)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/oeuvres/${w.id}`} className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                            {t(lang, "adm.manage")}
                          </Link>
                          <form action={setWorkStatus}>
                            <input type="hidden" name="id" value={w.id} />
                            <input type="hidden" name="status" value={w.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                            <button type="submit" disabled={w.status !== "PUBLISHED" && !documented}
                              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50">
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
            <section className="h-fit rounded-lg border border-line p-4">
              <h2 className="mb-3 font-display text-base font-semibold text-brand">{t(lang, "adm.addWork")}</h2>
              <ActionForm action={createWork} submitLabel={t(lang, "adm.save")} lang={lang}>
                <Field label={t(lang, "adm.field.title")} name="title" />
                <SelectField label={t(lang, "adm.field.type")} name="type"
                  options={(["BOOK", "DOCUMENTARY", "FILM"] as const).map((v) => ({ value: v, label: t(lang, TYPE_KEY[v]) }))} />
                <Field label={t(lang, "adm.field.author")} name="author" required={false} />
                <Field label={t(lang, "adm.field.description")} name="description" required={false} />
                <Field label={t(lang, "adm.field.language")} name="language" defaultValue="fr" />
                <SelectField label={t(lang, "adm.field.access")} name="access"
                  options={(["FREE", "PURCHASE", "SUBSCRIPTION"] as const).map((v) => ({ value: v, label: t(lang, ACCESS_KEY[v]) }))} />
                <Field label={t(lang, "adm.field.priceXof")} name="price" type="number" required={false} hint={t(lang, "adm.hint.priceXof")} />
                <fieldset className="flex flex-col gap-3 rounded-xl bg-gold-soft/50 p-3">
                  <legend className="px-1 text-sm font-semibold text-brand">{t(lang, "adm.rights")}</legend>
                  <Field label={t(lang, "adm.field.countries")} name="countries" required={false} hint={t(lang, "adm.hint.countries")} />
                  <Field label={t(lang, "adm.field.contract")} name="contractRef" required={false} />
                  <CheckField label={t(lang, "adm.field.offline")} name="allowOffline" />
                </fieldset>
                <CheckField label={t(lang, "adm.publishNow")} name="publish" />
              </ActionForm>
            </section>
          </div>
        </details>
      )}
    </div>
  );
}
