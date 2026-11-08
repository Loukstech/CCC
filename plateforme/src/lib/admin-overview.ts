import "server-only";
import { db } from "@/lib/db";
import { convertMinor } from "@/lib/currency";
import { getAdminDashboard, type AdminDashboardData } from "@/lib/dashboard";

/**
 * Vue d'ensemble exhaustive de la console d'administration.
 *
 * Principes :
 * - une seule requête SQL pour l'inventaire de toutes les tables (30 `UNION ALL`), au lieu de
 *   trente allers-retours vers Neon : la page reste rapide même sur une connexion froide ;
 * - les séries temporelles sont calculées à partir des tables existantes, sans aucun compteur
 *   de vues/téléchargements (ces champs n'existent pas encore dans le schéma) ;
 * - les montants sont convertis en plus petite unité de la devise de la console ;
 * - `getAdminDashboard` fournit la base (KPI, alertes, top œuvres), ce module ajoute tout le
 *   reste. Aucune écriture : la console est sûre pour le rôle ANALYST en lecture seule.
 */

export type RangeKey = "7d" | "30d" | "90d" | "12m";
export const RANGES: RangeKey[] = ["7d", "30d", "90d", "12m"];
export const isRangeKey = (v: string | undefined): v is RangeKey =>
  !!v && (RANGES as string[]).includes(v);

/** Partagés avec `lib/audience.ts` pour que les deux séries utilisent les mêmes fenêtres. */
export const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };
export const BUCKETS: Record<RangeKey, number> = { "7d": 7, "30d": 10, "90d": 12, "12m": 12 };
export const DAY = 86_400_000;

export type NamedCount = { key: string; count: number };
export type PeriodPoint = {
  /** Clé unique du bucket (sert de clé React et d'identifiant de série). */
  key: string;
  /** Libellé court déjà localisé, prêt à afficher en abscisse. */
  label: string;
  sales: number;
  revenueXof: number;
  signups: number;
  reads: number;
};
export type TableRow = { key: string; count: number };
export type ActivityRow = {
  id: string;
  action: string;
  target: string | null;
  createdAt: Date;
  actor: string | null;
};
export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  staffRole: string | null;
  createdAt: Date;
};
export type WorkRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  access: string;
  language: string;
  ratingAvg: number;
  ratingCount: number;
  sales: number;
  reads: number;
  slug: string;
};

export type AdminOverview = AdminDashboardData & {
  range: RangeKey;
  rangeStart: Date;
  previousStart: Date;
  currency: string;
  /** Comparaison avec la période précédente de même durée, en pourcentage (null si base à 0). */
  deltas: { users: number | null; orders: number | null; revenue: number | null; reads: number | null };
  period: { signups: number; sales: number; revenueXof: number; reads: number; points: PeriodPoint[] };
  inventory: TableRow[];
  breakdowns: {
    orderStatus: NamedCount[];
    subscriptionStatus: NamedCount[];
    subscriptionPlan: NamedCount[];
    userRoles: NamedCount[];
    userCountries: NamedCount[];
    userLocales: NamedCount[];
    workStatus: NamedCount[];
    workLanguages: NamedCount[];
    manuscriptStatus: NamedCount[];
    reportStatus: NamedCount[];
    liveStatus: NamedCount[];
    payoutStatus: NamedCount[];
    partnerCodeState: NamedCount[];
    auditActions: NamedCount[];
  };
  ads: { key: string; ads: number; impressions: number; clicks: number }[];
  finance: {
    revenueRangeXof: number;
    feesRangeXof: number;
    netRangeXof: number;
    refundedCount: number;
    commissionTotalXof: number;
    payoutTotalXof: number;
    payoutPaidXof: number;
  };
  recentUsers: UserRow[];
  workRows: WorkRow[];
  recentActivity: ActivityRow[];
  upcomingLives: { id: string; title: string; status: string; startsAt: Date }[];
  expiringCodes: { id: string; label: string; kind: string; expiresAt: Date }[];
  moderation: { pendingReviews: number; hiddenReviews: number; openReports: number; pendingComments: number };
  health: {
    dbLatencyMs: number;
    disabledUsers: number;
    worksWithoutRights: number;
    booksWithoutFile: number;
    expiredActiveAds: number;
    orphanOrders: number;
  };
};

const toXof = (amount: number, currency: string, target = "XOF") =>
  convertMinor(amount, currency, target) ?? 0;

const countBy = (values: string[]): NamedCount[] => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v ?? "") ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Bornes de la période courante et de la période précédente, en UTC. */
function bounds(range: RangeKey, now: Date) {
  const days = RANGE_DAYS[range];
  const rangeStart = new Date(now.getTime() - days * DAY);
  const previousStart = new Date(now.getTime() - 2 * days * DAY);
  return { rangeStart, previousStart };
}

/** Découpe la période en N buckets égaux, avec libellé court localisé. */
function makePoints(range: RangeKey, start: Date, now: Date, lang: "fr" | "en"): PeriodPoint[] {
  const n = BUCKETS[range];
  const span = now.getTime() - start.getTime();
  const step = span / n;
  return Array.from({ length: n }, (_, i) => {
    const from = new Date(start.getTime() + i * step);
    const key = range === "12m" ? monthKey(from) : `${monthKey(from)}-${i}`;
    const label = range === "12m"
      ? from.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
      : from.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return { key, label, _at: from.getTime(), sales: 0, revenueXof: 0, signups: 0, reads: 0 } as PeriodPoint & { _at: number };
  });
}

const pct = (cur: number, prev: number): number | null =>
  prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

/** Inventaire de toutes les tables en une seule requête. Aucune interpolation : SQL statique. */
async function tableInventory(): Promise<TableRow[]> {
  const rows = await db.$queryRaw<{ key: string; n: number }[]>`
    SELECT 'users' AS key, COUNT(*)::int AS n FROM "User"
    UNION ALL SELECT 'devices', COUNT(*)::int FROM "Device"
    UNION ALL SELECT 'dioceses', COUNT(*)::int FROM "Diocese"
    UNION ALL SELECT 'parishes', COUNT(*)::int FROM "Parish"
    UNION ALL SELECT 'dioceseAdmins', COUNT(*)::int FROM "DioceseAdmin"
    UNION ALL SELECT 'works', COUNT(*)::int FROM "Work"
    UNION ALL SELECT 'prices', COUNT(*)::int FROM "Price"
    UNION ALL SELECT 'planPrices', COUNT(*)::int FROM "PlanPrice"
    UNION ALL SELECT 'licenses', COUNT(*)::int FROM "License"
    UNION ALL SELECT 'subtitles', COUNT(*)::int FROM "Subtitle"
    UNION ALL SELECT 'orders', COUNT(*)::int FROM "Order"
    UNION ALL SELECT 'commissionEntries', COUNT(*)::int FROM "CommissionEntry"
    UNION ALL SELECT 'payoutBatches', COUNT(*)::int FROM "PayoutBatch"
    UNION ALL SELECT 'payoutItems', COUNT(*)::int FROM "PayoutItem"
    UNION ALL SELECT 'subscriptions', COUNT(*)::int FROM "Subscription"
    UNION ALL SELECT 'progress', COUNT(*)::int FROM "Progress"
    UNION ALL SELECT 'favorites', COUNT(*)::int FROM "Favorite"
    UNION ALL SELECT 'bookmarks', COUNT(*)::int FROM "Bookmark"
    UNION ALL SELECT 'reviews', COUNT(*)::int FROM "Review"
    UNION ALL SELECT 'comments', COUNT(*)::int FROM "Comment"
    UNION ALL SELECT 'reports', COUNT(*)::int FROM "Report"
    UNION ALL SELECT 'manuscripts', COUNT(*)::int FROM "Manuscript"
    UNION ALL SELECT 'writerProfiles', COUNT(*)::int FROM "WriterProfile"
    UNION ALL SELECT 'ads', COUNT(*)::int FROM "Ad"
    UNION ALL SELECT 'adDailyStats', COUNT(*)::int FROM "AdDailyStat"
    UNION ALL SELECT 'partnerCodes', COUNT(*)::int FROM "PartnerCode"
    UNION ALL SELECT 'liveEvents', COUNT(*)::int FROM "LiveEvent"
    UNION ALL SELECT 'liveBroadcasters', COUNT(*)::int FROM "LiveBroadcaster"
    UNION ALL SELECT 'auditLogs', COUNT(*)::int FROM "AuditLog"
    UNION ALL SELECT 'appSettings', COUNT(*)::int FROM "AppSetting"
    UNION ALL SELECT 'workAudienceStats', COUNT(*)::int FROM "WorkAudienceStat"
  `;
  return rows.map((r) => ({ key: r.key, count: Number(r.n) }));
}

export async function getAdminOverview(
  range: RangeKey = "12m",
  currency = "XOF",
  lang: "fr" | "en" = "fr",
  now = new Date(),
): Promise<AdminOverview> {
  const { rangeStart, previousStart } = bounds(range, now);
  const t0 = Date.now();

  const [base, inventory, rawOrders, rawUsers, rawProgress,
    orderStatus, subscriptionStatus, subscriptionPlan, userRoles, userCountries, userLocales,
    workStatus, workLanguages, manuscriptStatus, reportStatus, liveStatus, payoutStatus,
    adGroups, auditActions, commissionAgg, payoutAgg, recentUsersRaw, recentAuditRaw,
    upcomingLives, expiringCodesRaw, moderationCounts, healthCounts, liveDbCheck,
  ] = await Promise.all([
    getAdminDashboard(now),
    tableInventory(),
    db.order.findMany({
      where: { paidAt: { gte: previousStart } },
      select: { amount: true, currency: true, feeAmount: true, netAmount: true, paidAt: true, status: true, workId: true },
      take: 50000,
    }),
    db.user.findMany({
      where: { createdAt: { gte: previousStart } },
      select: { createdAt: true },
      take: 50000,
    }),
    db.progress.findMany({
      where: { updatedAt: { gte: previousStart } },
      select: { updatedAt: true },
      take: 50000,
    }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    db.subscription.groupBy({ by: ["plan"], _count: { _all: true } }),
    db.user.groupBy({ by: ["staffRole"], _count: { _all: true } }),
    db.user.groupBy({ by: ["country"], _count: { _all: true } }),
    db.user.groupBy({ by: ["locale"], _count: { _all: true } }),
    db.work.groupBy({ by: ["status"], _count: { _all: true } }),
    db.work.groupBy({ by: ["language"], _count: { _all: true } }),
    db.manuscript.groupBy({ by: ["status"], _count: { _all: true } }),
    db.report.groupBy({ by: ["status"], _count: { _all: true } }),
    db.liveEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payoutBatch.groupBy({ by: ["status"], _sum: { total: true }, _count: { _all: true } }),
    db.ad.groupBy({ by: ["placement"], _sum: { impressions: true, clicks: true }, _count: { _all: true } }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { _count: { action: "desc" } }, take: 12 }),
    db.commissionEntry.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    db.payoutBatch.aggregate({ _sum: { total: true }, _count: { _all: true } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" }, take: 12,
      select: { id: true, name: true, email: true, country: true, staffRole: true, createdAt: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" }, take: 12,
      select: { id: true, action: true, target: true, createdAt: true, actorId: true },
    }),
    db.liveEvent.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } }, orderBy: { startsAt: "asc" }, take: 6,
      select: { id: true, title: true, status: true, startsAt: true },
    }),
    db.partnerCode.findMany({
      where: { usedAt: null, revokedAt: null, expiresAt: { gte: now } },
      orderBy: { expiresAt: "asc" }, take: 6,
      select: { id: true, label: true, kind: true, expiresAt: true },
    }),
    Promise.all([
      db.review.count({ where: { status: "PENDING" } }),
      db.review.count({ where: { status: "HIDDEN" } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.comment.count({ where: { status: "PENDING" } }),
    ]),
    Promise.all([
      db.user.count({ where: { disabledAt: { not: null } } }),
      db.work.count({ where: { status: "PUBLISHED", licenses: { none: {} } } }),
      db.work.count({ where: { type: "BOOK", fileKey: null } }),
      db.ad.count({ where: { active: true, endsAt: { lt: now } } }),
      db.order.count({ where: { workId: null, plan: null } }),
    ]),
    db.$queryRaw`SELECT 1`,
  ]);

  const dbLatencyMs = Date.now() - t0;
  void liveDbCheck;

  // AuditLog ne porte que actorId (pas de relation) : résolution groupée des noms affichés.
  const actorIds = [...new Set(recentAuditRaw.map((a) => a.actorId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorName = new Map(actors.map((u) => [u.id, u.name ?? u.email ?? u.id.slice(-8)]));

  // — Séries de la période —
  const points = makePoints(range, rangeStart, now, lang);
  const bucketOf = (ts: number): number => {
    const span = now.getTime() - rangeStart.getTime();
    const i = Math.floor(((ts - rangeStart.getTime()) / span) * points.length);
    return Math.min(points.length - 1, Math.max(0, i));
  };
  type MutablePoint = PeriodPoint & { _at: number };
  const mutable = points as MutablePoint[];
  let curSignups = 0, prevSignups = 0;
  for (const u of rawUsers) {
    if (u.createdAt >= rangeStart) { mutable[bucketOf(u.createdAt.getTime())].signups += 1; curSignups += 1; }
    else prevSignups += 1;
  }
  let curSales = 0, prevSales = 0, curRevenue = 0, prevRevenue = 0, curReads = 0, prevReads = 0;
  let feesRangeXof = 0, netRangeXof = 0;
  for (const o of rawOrders) {
    const at = o.paidAt ?? rangeStart;
    const amount = toXof(o.amount, o.currency, currency);
    if (at >= rangeStart) {
      const i = bucketOf(at.getTime());
      mutable[i].sales += 1;
      mutable[i].revenueXof += amount;
      curSales += 1; curRevenue += amount;
      feesRangeXof += toXof(o.feeAmount ?? 0, o.currency, currency);
      netRangeXof += toXof(o.netAmount ?? 0, o.currency, currency);
    } else { prevSales += 1; prevRevenue += amount; }
  }
  for (const p of rawProgress) {
    if (p.updatedAt >= rangeStart) { mutable[bucketOf(p.updatedAt.getTime())].reads += 1; curReads += 1; }
    else prevReads += 1;
  }
  const periodPoints: PeriodPoint[] = mutable.map(({ key, label, sales, revenueXof, signups, reads }) => ({ key, label, sales, revenueXof, signups, reads }));

  // — États des codes partenaires (champs calculés, pas de colonne `status`) —
  const codeStates = await db.partnerCode.findMany({
    select: { usedAt: true, revokedAt: true, expiresAt: true },
    take: 10000,
  });
  const partnerCodeState = countBy(codeStates.map((c) =>
    c.revokedAt ? "REVOKED" : c.usedAt ? "USED" : c.expiresAt <= now ? "EXPIRED" : "AVAILABLE"));

  // — Classement des œuvres, enrichi —
  const allWorks = await db.work.findMany({
    select: {
      id: true, title: true, slug: true, type: true, status: true, access: true,
      language: true, ratingAvg: true, ratingCount: true,
    },
    take: 5000,
  });
  const paidWorkOrders = await db.order.findMany({
    where: { status: "PAID", workId: { not: null } }, select: { workId: true }, take: 50000,
  });
  const readsGroups = await db.progress.groupBy({ by: ["workId"], _count: { _all: true } });
  const salesByWork = new Map<string, number>();
  for (const o of paidWorkOrders) if (o.workId) salesByWork.set(o.workId, (salesByWork.get(o.workId) ?? 0) + 1);
  const readsByWork = new Map(readsGroups.map((r) => [r.workId, r._count._all]));
  const workRows: WorkRow[] = allWorks.map((w) => ({
    id: w.id, title: w.title, slug: w.slug, type: w.type, status: w.status,
    access: w.access, language: w.language, ratingAvg: w.ratingAvg, ratingCount: w.ratingCount,
    sales: salesByWork.get(w.id) ?? 0, reads: readsByWork.get(w.id) ?? 0,
  })).sort((a, b) => b.sales - a.sales || b.reads - a.reads || b.ratingCount - a.ratingCount);

  const [pendingReviews, hiddenReviews, openReports, pendingComments] = moderationCounts;
  const [disabledUsers, worksWithoutRights, booksWithoutFile, expiredActiveAds, orphanOrders] = healthCounts;

  return {
    ...base,
    range, rangeStart, previousStart, currency,
    deltas: {
      users: pct(curSignups, prevSignups),
      orders: pct(curSales, prevSales),
      revenue: pct(curRevenue, prevRevenue),
      reads: pct(curReads, prevReads),
    },
    period: { signups: curSignups, sales: curSales, revenueXof: curRevenue, reads: curReads, points: periodPoints },
    inventory,
    breakdowns: {
      orderStatus: orderStatus.map((r) => ({ key: r.status, count: r._count._all })).sort((a, b) => b.count - a.count),
      subscriptionStatus: subscriptionStatus.map((r) => ({ key: r.status, count: r._count._all })),
      subscriptionPlan: subscriptionPlan.map((r) => ({ key: r.plan, count: r._count._all })),
      userRoles: userRoles.map((r) => ({ key: r.staffRole ?? "READER", count: r._count._all })).sort((a, b) => b.count - a.count),
      userCountries: userCountries.map((r) => ({ key: r.country ?? "—", count: r._count._all })).sort((a, b) => b.count - a.count).slice(0, 10),
      userLocales: userLocales.map((r) => ({ key: r.locale, count: r._count._all })),
      workStatus: workStatus.map((r) => ({ key: r.status, count: r._count._all })),
      workLanguages: workLanguages.map((r) => ({ key: r.language, count: r._count._all })),
      manuscriptStatus: manuscriptStatus.map((r) => ({ key: r.status, count: r._count._all })),
      reportStatus: reportStatus.map((r) => ({ key: r.status, count: r._count._all })),
      liveStatus: liveStatus.map((r) => ({ key: r.status, count: r._count._all })),
      payoutStatus: payoutStatus.map((r) => ({ key: r.status, count: r._count._all })),
      partnerCodeState,
      auditActions: auditActions.map((r) => ({ key: r.action, count: r._count._all })),
    },
    ads: adGroups.map((a) => ({
      key: a.placement, ads: a._count._all,
      impressions: a._sum.impressions ?? 0, clicks: a._sum.clicks ?? 0,
    })).sort((a, b) => b.impressions - a.impressions),
    finance: {
      revenueRangeXof: curRevenue,
      feesRangeXof,
      netRangeXof,
      refundedCount: rawOrders.filter((o) => o.status === "REFUNDED").length,
      commissionTotalXof: commissionAgg._sum.amount ?? 0,
      payoutTotalXof: payoutAgg._sum.total ?? 0,
      payoutPaidXof: payoutStatus.filter((p) => p.status === "PAID").reduce((n, p) => n + (p._sum.total ?? 0), 0),
    },
    recentUsers: recentUsersRaw.map((u) => ({ ...u, staffRole: u.staffRole ?? null })),
    recentActivity: recentAuditRaw.map((a) => ({
      id: a.id, action: a.action, target: a.target, createdAt: a.createdAt,
      actor: a.actorId ? (actorName.get(a.actorId) ?? a.actorId.slice(-8)) : null,
    })),
    upcomingLives,
    expiringCodes: expiringCodesRaw.map((c) => ({ ...c, kind: String(c.kind) })),
    moderation: { pendingReviews, hiddenReviews, openReports, pendingComments },
    health: { dbLatencyMs, disabledUsers, worksWithoutRights, booksWithoutFile, expiredActiveAds, orphanOrders },
    topWorks: base.topWorks,
    workRows,
  };
}
