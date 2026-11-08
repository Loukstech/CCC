import "server-only";
import { db } from "@/lib/db";
import { convertMinor } from "@/lib/currency";

/**
 * Agrégats des tableaux de bord (lot « console d'administration », section 15 du cahier des charges).
 *
 * Règles tenues ici :
 * - aucune écriture : tout est calculé en lecture seule, à partir des données déjà présentes ;
 * - les montants sont ramenés en F CFA (plus petite unité) avec les taux indicatifs de `currency.ts`,
 *   car une commande peut être libellée dans plusieurs devises ;
 * - les séries mensuelles couvrent 6 mois glissants en UTC, mois courant inclus, y compris les mois vides ;
 * - les signaux d'engagement historiques viennent de Progress, Favorite, Bookmark et Review ;
 *   les vues, téléchargements et sessions réellement comptés vivent dans `lib/audience.ts`.
 */

export const TREND_MONTHS = 6;

export type MonthPoint = {
  /** Clé UTC « AAAA-MM ». */
  key: string;
  sales: number;
  revenueXof: number;
  signups: number;
  reads: number;
};

export type BreakdownItem = { key: string; count: number };

export type TopWork = {
  id: string;
  title: string;
  slug: string;
  type: "BOOK" | "FILM" | "DOCUMENTARY";
  sales: number;
  reads: number;
  ratingAvg: number;
  ratingCount: number;
};

export type RecentOrder = {
  id: string;
  title: string;
  amountXof: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  date: Date;
};

export type AlertItem = {
  key: string;
  count: number;
  href: string;
};

export type AdminDashboardData = {
  totals: {
    users: number;
    users30d: number;
    works: number;
    published: number;
    sales: number;
    revenueXof: number;
    activeSubscriptions: number;
    reads: number;
    favorites: number;
    reviews: number;
    ratingAvg: number;
    adImpressions: number;
    adClicks: number;
  };
  trend: MonthPoint[];
  byType: BreakdownItem[];
  byStatus: BreakdownItem[];
  byAccess: BreakdownItem[];
  topWorks: TopWork[];
  recentOrders: RecentOrder[];
  alerts: AlertItem[];
  /** Commandes de démonstration : montant nul, donc non comptées comme du chiffre d'affaires réel. */
  demoOrders: number;
  generatedAt: Date;
};

/** Convertit un montant (plus petite unité) d'une devise quelconque en F CFA. */
function toXof(amount: number, currency: string): number {
  return convertMinor(amount, currency, "XOF") ?? 0;
}

/** Six clés « AAAA-MM » consécutives en UTC, la dernière étant le mois courant. */
function monthKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

function startOfWindow(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1), 1));
}

function emptyTrend(keys: string[]): MonthPoint[] {
  return keys.map((key) => ({ key, sales: 0, revenueXof: 0, signups: 0, reads: 0 }));
}

/**
 * Tableau de bord de la console d'administration. Accessible à tous les rôles du personnel
 * (le rôle « Analyste » du CDC doit pouvoir consulter sans rien modifier).
 */
export async function getAdminDashboard(now = new Date()): Promise<AdminDashboardData> {
  const keys = monthKeys(now);
  const windowStart = startOfWindow(now);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const index = new Map(keys.map((k, i) => [k, i]));

  const [
    allUsers,
    windowUsers,
    allWorks,
    windowOrders,
    allPaidOrders,
    recentRaw,
    progressRaw,
    subscriptions,
    favorites,
    reviews,
    adAgg,
    pendingManuscripts,
    openReports,
    pendingReviews,
    expiringCodes,
    missingRights,
    missingFiles,
  ] = await Promise.all([
    db.user.count(),
    db.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    db.work.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        access: true,
        ratingAvg: true,
        ratingCount: true,
        publishedAt: true,
      },
    }),
    db.order.findMany({
      where: { status: "PAID", paidAt: { gte: windowStart } },
      select: { amount: true, currency: true, paidAt: true, workId: true },
    }),
    db.order.findMany({
      where: { status: "PAID" },
      select: { amount: true, currency: true, workId: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        plan: true,
        work: { select: { title: true } },
      },
    }),
    db.progress.findMany({
      where: { updatedAt: { gte: windowStart } },
      select: { updatedAt: true, workId: true },
    }),
    db.subscription.count({ where: { status: "ACTIVE", endsAt: { gte: now } } }),
    db.favorite.count(),
    db.review.findMany({ where: { status: "PUBLISHED" }, select: { rating: true } }),
    db.ad.aggregate({ _sum: { impressions: true, clicks: true } }),
    db.manuscript.count({ where: { status: { in: ["SUBMITTED", "REVIEWING"] } } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.review.count({ where: { status: { in: ["PENDING", "HIDDEN"] } } }),
    db.partnerCode.count({
      where: { usedAt: null, revokedAt: null, expiresAt: { gte: now, lte: in30Days } },
    }),
    db.work.count({
      where: { status: "PUBLISHED", licenses: { none: {} } },
    }),
    db.work.count({ where: { type: "BOOK", fileKey: null } }),
  ]);

  const trend = emptyTrend(keys);
  for (const u of windowUsers) {
    const i = index.get(monthKey(u.createdAt));
    if (i !== undefined) trend[i].signups += 1;
  }
  for (const o of windowOrders) {
    const d = o.paidAt ?? windowStart;
    const i = index.get(monthKey(d));
    if (i !== undefined) {
      trend[i].sales += 1;
      trend[i].revenueXof += toXof(o.amount, o.currency);
    }
  }
  for (const p of progressRaw) {
    const i = index.get(monthKey(p.updatedAt));
    if (i !== undefined) trend[i].reads += 1;
  }

  // Répartition du catalogue et classement des œuvres.
  const countBy = (values: string[]): BreakdownItem[] => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };
  const byType = countBy(allWorks.map((w) => w.type));
  const byStatus = countBy(allWorks.map((w) => w.status));
  const byAccess = countBy(allWorks.map((w) => w.access));

  const salesByWork = new Map<string, number>();
  for (const o of allPaidOrders) {
    if (o.workId) salesByWork.set(o.workId, (salesByWork.get(o.workId) ?? 0) + 1);
  }
  const readCounts = await db.progress.groupBy({
    by: ["workId"],
    _count: { _all: true },
  });
  const readsByWork = new Map(readCounts.map((r) => [r.workId, r._count._all]));

  const topWorks: TopWork[] = allWorks
    .map((w) => ({
      id: w.id,
      title: w.title,
      slug: w.slug,
      type: w.type,
      sales: salesByWork.get(w.id) ?? 0,
      reads: readsByWork.get(w.id) ?? 0,
      ratingAvg: w.ratingAvg,
      ratingCount: w.ratingCount,
    }))
    .sort((a, b) => b.sales - a.sales || b.reads - a.reads || b.ratingCount - a.ratingCount)
    .slice(0, 5);

  const recentOrders: RecentOrder[] = recentRaw.map((o) => ({
    id: o.id,
    title: o.work?.title ?? (o.plan ? `Abonnement ${o.plan}` : "—"),
    amountXof: toXof(o.amount, o.currency),
    currency: o.currency,
    status: o.status,
    date: o.createdAt,
  }));

  const alerts: AlertItem[] = [
    { key: "manuscripts", count: pendingManuscripts, href: "/admin/manuscrits" },
    { key: "reports", count: openReports, href: "/admin/moderation" },
    { key: "reviews", count: pendingReviews, href: "/admin/moderation" },
    { key: "rights", count: missingRights, href: "/admin" },
    { key: "files", count: missingFiles, href: "/admin" },
    { key: "codes", count: expiringCodes, href: "/admin/partenariats" },
  ].filter((a) => a.count > 0);

  const revenueXof = allPaidOrders.reduce((n, o) => n + toXof(o.amount, o.currency), 0);
  const ratingAvg = reviews.length
    ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length
    : 0;

  return {
    totals: {
      users: allUsers,
      users30d: windowUsers.filter((u) => u.createdAt >= thirtyDaysAgo).length,
      works: allWorks.length,
      published: allWorks.filter((w) => w.status === "PUBLISHED").length,
      sales: allPaidOrders.length,
      revenueXof,
      activeSubscriptions: subscriptions,
      reads: readsByWork.size ? [...readsByWork.values()].reduce((a, b) => a + b, 0) : 0,
      favorites,
      reviews: reviews.length,
      ratingAvg,
      adImpressions: adAgg._sum.impressions ?? 0,
      adClicks: adAgg._sum.clicks ?? 0,
    },
    trend,
    byType,
    byStatus,
    byAccess,
    topWorks,
    recentOrders,
    alerts,
    demoOrders: allPaidOrders.filter((o) => o.amount === 0).length,
    generatedAt: now,
  };
}

export type WriterDashboardData = {
  totals: {
    works: number;
    sales: number;
    revenueXof: number;
    reads: number;
    favorites: number;
    bookmarks: number;
    reviews: number;
    ratingAvg: number;
    ratingCount: number;
  };
  trend: MonthPoint[];
  topWorks: TopWork[];
  /** Vrai si aucune donnée d'audience n'existe encore : le tableau de bord l'explique au lieu d'afficher des zéros nus. */
  emptyAudience: boolean;
};

/** Statistiques d'audience et de vente d'un auteur, pour son propre espace. */
export async function getWriterDashboard(userId: string, now = new Date()): Promise<WriterDashboardData> {
  const keys = monthKeys(now);
  const windowStart = startOfWindow(now);
  const index = new Map(keys.map((k, i) => [k, i]));

  const [works, paidOrders, windowOrders, reads, favorites, bookmarks, reviews, windowReads] =
    await Promise.all([
      db.work.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          ratingAvg: true,
          ratingCount: true,
        },
      }),
      db.order.findMany({
        where: { status: "PAID", work: { authorId: userId } },
        select: { amount: true, currency: true, workId: true },
      }),
      db.order.findMany({
        where: { status: "PAID", work: { authorId: userId }, paidAt: { gte: windowStart } },
        select: { amount: true, currency: true, paidAt: true },
      }),
      db.progress.groupBy({
        by: ["workId"],
        where: { work: { authorId: userId } },
        _count: { _all: true },
      }),
      db.favorite.count({ where: { work: { authorId: userId } } }),
      db.bookmark.count({ where: { work: { authorId: userId } } }),
      db.review.findMany({
        where: { work: { authorId: userId }, status: "PUBLISHED" },
        select: { rating: true, workId: true },
      }),
      db.progress.findMany({
        where: { work: { authorId: userId }, updatedAt: { gte: windowStart } },
        select: { updatedAt: true },
      }),
    ]);

  const trend = emptyTrend(keys);
  for (const o of windowOrders) {
    const i = index.get(monthKey(o.paidAt ?? windowStart));
    if (i !== undefined) {
      trend[i].sales += 1;
      trend[i].revenueXof += toXof(o.amount, o.currency);
    }
  }
  for (const r of windowReads) {
    const i = index.get(monthKey(r.updatedAt));
    if (i !== undefined) trend[i].reads += 1;
  }

  const salesByWork = new Map<string, number>();
  for (const o of paidOrders) {
    if (o.workId) salesByWork.set(o.workId, (salesByWork.get(o.workId) ?? 0) + 1);
  }
  const readsByWork = new Map(reads.map((r) => [r.workId, r._count._all]));
  const ratingsByWork = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const cur = ratingsByWork.get(r.workId) ?? { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    ratingsByWork.set(r.workId, cur);
  }

  const topWorks: TopWork[] = works
    .map((w) => {
      const rating = ratingsByWork.get(w.id);
      return {
        id: w.id,
        title: w.title,
        slug: w.slug,
        type: w.type,
        sales: salesByWork.get(w.id) ?? 0,
        reads: readsByWork.get(w.id) ?? 0,
        ratingAvg: rating?.count ? rating.sum / rating.count : w.ratingAvg,
        ratingCount: rating?.count ?? w.ratingCount,
      };
    })
    .sort((a, b) => b.reads - a.reads || b.sales - a.sales || b.ratingCount - a.ratingCount);

  const totalReads = [...readsByWork.values()].reduce((a, b) => a + b, 0);

  return {
    totals: {
      works: works.length,
      sales: paidOrders.length,
      revenueXof: paidOrders.reduce((n, o) => n + toXof(o.amount, o.currency), 0),
      reads: totalReads,
      favorites,
      bookmarks,
      reviews: reviews.length,
      ratingAvg: reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0,
      ratingCount: reviews.length,
    },
    trend,
    topWorks,
    emptyAudience: totalReads === 0 && favorites === 0 && bookmarks === 0 && reviews.length === 0,
  };
}
