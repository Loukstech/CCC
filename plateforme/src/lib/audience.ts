import "server-only";
import { db } from "@/lib/db";
import { BUCKETS, DAY, RANGE_DAYS, type RangeKey } from "@/lib/admin-overview";

/**
 * Statistiques d'audience réelles.
 *
 * Deux niveaux de stockage, écrits dans la même transaction :
 * - `Work.viewCount / downloadCount / playCount` : compteurs cumulés, affichables sans agrégation ;
 * - `WorkAudienceStat` : une ligne par (œuvre, jour UTC), pour les courbes de tendance. On
 *   n'enregistre pas chaque visite : l'écriture reste un `upsert` à compteur, donc le volume de
 *   la table est borné à « œuvres × jours » et les requêtes de graphique restent légères.
 *
 * `trackAudience` n'échoue jamais vers l'appelant : un incident de mesure ne doit pas empêcher
 * quelqu'un de lire un livre ou de télécharger un fichier.
 */

export type AudienceKind = "view" | "download" | "play";

const BACKFILL_KEY = "audience_backfill_done";

/** Minuit UTC du jour : clé stable pour le rollup, quelle que soit l'heure de l'événement. */
export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Enregistre un événement d'audience. Appelé depuis la route API (vue, lecture) et depuis la
 * route de téléchargement de fichier. Le compteur cumulé et le rollup sont atomiques.
 */
export async function trackAudience(workId: string, kind: AudienceKind): Promise<void> {
  if (!workId || workId.length > 64) return;
  const day = utcDay(new Date());
  const counter = kind === "view"
    ? { viewCount: { increment: 1 } }
    : kind === "download"
      ? { downloadCount: { increment: 1 } }
      : { playCount: { increment: 1 } };
  const stat = kind === "view"
    ? { views: 1 }
    : kind === "download"
      ? { downloads: 1 }
      : { plays: 1 };
  const bump = kind === "view"
    ? { views: { increment: 1 } }
    : kind === "download"
      ? { downloads: { increment: 1 } }
      : { plays: { increment: 1 } };

  try {
    await db.$transaction([
      db.work.update({ where: { id: workId }, data: counter }),
      db.workAudienceStat.upsert({
        where: { workId_day: { workId, day } },
        create: { workId, day, ...stat },
        update: bump,
      }),
    ]);
  } catch (error) {
    // Une œuvre supprimée entre-temps (P2025) ou une base momentanément indisponible ne doit
    // jamais transformer une lecture en erreur 500.
    console.error("[audience] événement non enregistré", kind, workId, error);
  }
}

export type AudiencePoint = {
  key: string;
  label: string;
  views: number;
  downloads: number;
  plays: number;
};

export type AnalyticsWork = {
  id: string;
  title: string;
  slug: string;
  type: string;
  views: number;
  downloads: number;
  plays: number;
};

export type AudienceAnalytics = {
  range: RangeKey;
  rangeStart: Date;
  /** Compteurs cumulés depuis l'origine, toutes périodes confondues. */
  totals: { views: number; downloads: number; plays: number };
  period: { views: number; downloads: number; plays: number; points: AudiencePoint[] };
  top: AnalyticsWork[];
  trackedWorks: number;
  /** Nombre de lignes de rollup présentes sur la période. */
  statRows: number;
  firstDay: Date | null;
};

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Séries et classements de la section « Analytique » de la console. */
export async function getAudienceAnalytics(
  range: RangeKey = "12m",
  lang: "fr" | "en" = "fr",
  now = new Date(),
  limit = 10,
): Promise<AudienceAnalytics> {
  const rangeStart = new Date(now.getTime() - RANGE_DAYS[range] * DAY);
  const fromDay = utcDay(rangeStart);
  const n = BUCKETS[range];
  const span = now.getTime() - rangeStart.getTime();
  const step = span / n;

  const points: AudiencePoint[] = Array.from({ length: n }, (_, i) => {
    const from = new Date(rangeStart.getTime() + i * step);
    const key = range === "12m" ? monthKey(from) : `${monthKey(from)}-${i}`;
    const label = range === "12m"
      ? from.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
      : from.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return { key, label, views: 0, downloads: 0, plays: 0 };
  });
  const bucketOf = (ts: number): number => {
    const i = Math.floor(((ts - rangeStart.getTime()) / span) * n);
    return Math.min(n - 1, Math.max(0, i));
  };

  const trackedWhere = {
    OR: [{ viewCount: { gt: 0 } }, { downloadCount: { gt: 0 } }, { playCount: { gt: 0 } }],
  };

  const [rows, sums, topRaw, tracked, first] = await Promise.all([
    db.workAudienceStat.findMany({
      where: { day: { gte: fromDay } },
      select: { day: true, views: true, downloads: true, plays: true },
      take: 50000,
    }),
    db.work.aggregate({ _sum: { viewCount: true, downloadCount: true, playCount: true } }),
    db.work.findMany({
      where: trackedWhere,
      orderBy: [{ viewCount: "desc" }, { playCount: "desc" }],
      take: limit,
      select: { id: true, title: true, slug: true, type: true, viewCount: true, downloadCount: true, playCount: true },
    }),
    db.work.count({ where: trackedWhere }),
    db.workAudienceStat.aggregate({ _min: { day: true } }),
  ]);

  const period = { views: 0, downloads: 0, plays: 0 };
  for (const r of rows) {
    const at = new Date(r.day).getTime();
    if (at < rangeStart.getTime()) continue;
    const p = points[bucketOf(at)];
    p.views += r.views;
    p.downloads += r.downloads;
    p.plays += r.plays;
    period.views += r.views;
    period.downloads += r.downloads;
    period.plays += r.plays;
  }

  return {
    range,
    rangeStart,
    totals: {
      views: sums._sum.viewCount ?? 0,
      downloads: sums._sum.downloadCount ?? 0,
      plays: sums._sum.playCount ?? 0,
    },
    period: { ...period, points },
    top: topRaw.map((w) => ({
      id: w.id, title: w.title, slug: w.slug, type: String(w.type),
      views: w.viewCount, downloads: w.downloadCount, plays: w.playCount,
    })),
    trackedWorks: tracked,
    statRows: rows.length,
    firstDay: first._min.day ?? null,
  };
}

export type WriterAudiencePoint = {
  key: string;
  label: string;
  views: number;
  downloads: number;
  plays: number;
};

export type WriterAudienceData = {
  totals: { views: number; downloads: number; plays: number };
  trend: WriterAudiencePoint[];
  top: AnalyticsWork[];
  trackedWorks: number;
  firstDay: Date | null;
};

/**
 * Même mesure, mais strictement limitée aux œuvres d'un auteur. L'espace écrivain garde ainsi
 * ses propres courbes et son propre classement, sans jamais exposer les autres catalogues.
 */
export async function getWriterAudience(
  userId: string,
  lang: "fr" | "en" = "fr",
  now = new Date(),
  months = 6,
  limit = 5,
): Promise<WriterAudienceData> {
  const monthCount = Number.isFinite(months) ? Math.min(24, Math.max(1, Math.trunc(months))) : 6;
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthCount - 1), 1));
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const points: WriterAudiencePoint[] = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + i, 1));
    return {
      key: monthKey(d),
      label: d.toLocaleDateString(locale, { month: "short", year: "2-digit", timeZone: "UTC" }),
      views: 0,
      downloads: 0,
      plays: 0,
    };
  });
  const index = new Map(points.map((p, i) => [p.key, i]));
  const trackedWhere = {
    OR: [{ viewCount: { gt: 0 } }, { downloadCount: { gt: 0 } }, { playCount: { gt: 0 } }],
  };

  const [sums, rows, topRaw, tracked, first] = await Promise.all([
    db.work.aggregate({
      where: { authorId: userId },
      _sum: { viewCount: true, downloadCount: true, playCount: true },
    }),
    db.workAudienceStat.findMany({
      where: { work: { authorId: userId }, day: { gte: firstMonth } },
      select: { day: true, views: true, downloads: true, plays: true },
      take: 50000,
    }),
    db.work.findMany({
      where: { authorId: userId, ...trackedWhere },
      orderBy: [{ viewCount: "desc" }, { playCount: "desc" }, { downloadCount: "desc" }],
      take: limit,
      select: { id: true, title: true, slug: true, type: true, viewCount: true, downloadCount: true, playCount: true },
    }),
    db.work.count({ where: { authorId: userId, ...trackedWhere } }),
    db.workAudienceStat.aggregate({ where: { work: { authorId: userId } }, _min: { day: true } }),
  ]);

  for (const r of rows) {
    const p = points[index.get(monthKey(new Date(r.day))) ?? -1];
    if (!p) continue;
    p.views += r.views;
    p.downloads += r.downloads;
    p.plays += r.plays;
  }

  return {
    totals: {
      views: sums._sum.viewCount ?? 0,
      downloads: sums._sum.downloadCount ?? 0,
      plays: sums._sum.playCount ?? 0,
    },
    trend: points,
    top: topRaw.map((w) => ({
      id: w.id, title: w.title, slug: w.slug, type: String(w.type),
      views: w.viewCount, downloads: w.downloadCount, plays: w.playCount,
    })),
    trackedWorks: tracked,
    firstDay: first._min.day ?? null,
  };
}

/**
 * Reconstruit un historique de lectures à partir des `Progress` déjà enregistrés AVANT la mise
 * en place du suivi. `Progress` ne garde que `updatedAt` (dernière activité), donc la répartition
 * par jour est approximative — mais elle provient de lectures réelles, pas de données inventées.
 *
 * Un marqueur `AppSetting` rend l'opération idempotente : un second lancement ne double pas
 * les compteurs. Les événements suivants sont comptés par `trackAudience`.
 */
export async function backfillAudience(now = new Date()) {
  const marker = await db.appSetting.findUnique({ where: { key: BACKFILL_KEY } });
  if (marker) return { works: 0, days: 0, plays: 0, skipped: true };

  const rows = await db.progress.findMany({
    select: { workId: true, updatedAt: true },
    take: 50000,
  });
  const groups = new Map<string, { workId: string; day: Date; plays: number }>();
  for (const r of rows) {
    const day = utcDay(r.updatedAt);
    const key = `${r.workId}|${day.toISOString().slice(0, 10)}`;
    const g = groups.get(key) ?? { workId: r.workId, day, plays: 0 };
    g.plays += 1;
    groups.set(key, g);
  }

  const list = [...groups.values()];
  await db.$transaction(async (tx) => {
    for (const g of list) {
      await tx.workAudienceStat.upsert({
        where: { workId_day: { workId: g.workId, day: g.day } },
        create: { workId: g.workId, day: g.day, plays: g.plays },
        update: { plays: { increment: g.plays } },
      });
      await tx.work.update({
        where: { id: g.workId },
        data: { playCount: { increment: g.plays } },
      });
    }
    await tx.appSetting.upsert({
      where: { key: BACKFILL_KEY },
      create: { key: BACKFILL_KEY, value: now.toISOString() },
      update: { value: now.toISOString() },
    });
  });

  return {
    works: new Set(list.map((g) => g.workId)).size,
    days: new Set(list.map((g) => g.day.toISOString().slice(0, 10))).size,
    plays: list.reduce((n, g) => n + g.plays, 0),
    skipped: false,
  };
}

/** Remet le marqueur à zéro (outil d'administration, après un rejeu complet des données démo). */
export async function resetAudienceBackfillMarker(): Promise<boolean> {
  const res = await db.appSetting.deleteMany({ where: { key: BACKFILL_KEY } });
  return res.count > 0;
}
