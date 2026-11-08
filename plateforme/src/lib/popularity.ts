import "server-only";
import { db } from "@/lib/db";

/**
 * Popularité des œuvres à partir des données DÉJÀ présentes en base.
 *
 * Aucune migration, aucune écriture : `Favorite`, `Bookmark`, `Progress` et `Review` existent
 * depuis les lots précédents mais n'étaient agrégés que sous forme de totaux globaux. Ce module
 * les croise par œuvre pour produire un classement exploitable.
 *
 * Le « score » est un indice d'engagement pondéré, volontairement simple et documenté : ce n'est
 * ni du chiffre d'affaires ni une mesure d'audience unique. Une lecture (= une ligne Progress,
 * donc un lecteur distinct) pèse 2, un favori 3, un signet 2, un avis publié 4. Ces poids
 * privilégient les actions délibérées sur la simple ouverture d'un contenu.
 */

const DAY = 86_400_000;

export const POPULARITY_WEIGHTS = { readers: 2, favorites: 3, bookmarks: 2, reviews: 4 } as const;

export type PopularWork = {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  favorites: number;
  bookmarks: number;
  /** Lecteurs distincts : `Progress` a une contrainte d'unicité (userId, workId). */
  readers: number;
  /** Avis publiés uniquement, cohérent avec les notes affichées sur le site. */
  reviews: number;
  ratingAvg: number;
  score: number;
};

export type PopularityData = {
  totals: {
    favorites: number;
    bookmarks: number;
    readers: number;
    reviews: number;
    ratingAvg: number;
    /** Œuvres ayant au moins un signal d'engagement. */
    engagedWorks: number;
    works: number;
    /** Lecteurs ayant repris une lecture au cours des 30 derniers jours. */
    activeReaders30d: number;
  };
  /** Distribution des notes publiées, de 1 à 5 étoiles (les 5 cases existent toujours). */
  ratings: { stars: number; count: number }[];
  top: PopularWork[];
};

export async function getPopularity(now = new Date(), limit = 10): Promise<PopularityData> {
  const [works, favorites, bookmarks, progress, reviews, ratingRows, activeGroups] = await Promise.all([
    db.work.findMany({
      select: { id: true, title: true, slug: true, type: true, status: true },
      take: 5000,
    }),
    db.favorite.groupBy({ by: ["workId"], _count: { _all: true } }),
    db.bookmark.groupBy({ by: ["workId"], _count: { _all: true } }),
    db.progress.groupBy({ by: ["workId"], _count: { _all: true } }),
    db.review.groupBy({
      by: ["workId"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    db.review.findMany({
      where: { status: "PUBLISHED" },
      select: { rating: true },
      take: 20000,
    }),
    db.progress.groupBy({
      by: ["userId"],
      where: { updatedAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      _count: { _all: true },
    }),
  ]);

  const favByWork = new Map(favorites.map((r) => [r.workId, r._count._all]));
  const markByWork = new Map(bookmarks.map((r) => [r.workId, r._count._all]));
  const readByWork = new Map(progress.map((r) => [r.workId, r._count._all]));
  const reviewByWork = new Map(reviews.map((r) => [r.workId, { count: r._count._all, avg: r._avg.rating ?? 0 }]));

  const w = POPULARITY_WEIGHTS;
  const all: PopularWork[] = works.map((work) => {
    const f = favByWork.get(work.id) ?? 0;
    const b = markByWork.get(work.id) ?? 0;
    const r = readByWork.get(work.id) ?? 0;
    const rev = reviewByWork.get(work.id) ?? { count: 0, avg: 0 };
    return {
      id: work.id,
      title: work.title,
      slug: work.slug,
      type: String(work.type),
      status: String(work.status),
      favorites: f,
      bookmarks: b,
      readers: r,
      reviews: rev.count,
      ratingAvg: rev.avg,
      score: r * w.readers + f * w.favorites + b * w.bookmarks + rev.count * w.reviews,
    };
  });

  const ratings = [1, 2, 3, 4, 5].map((stars) => ({
    stars,
    count: ratingRows.filter((r) => Math.min(5, Math.max(1, r.rating)) === stars).length,
  }));

  return {
    totals: {
      favorites: favorites.reduce((n, r) => n + r._count._all, 0),
      bookmarks: bookmarks.reduce((n, r) => n + r._count._all, 0),
      readers: progress.reduce((n, r) => n + r._count._all, 0),
      reviews: ratingRows.length,
      ratingAvg: ratingRows.length
        ? ratingRows.reduce((n, r) => n + r.rating, 0) / ratingRows.length
        : 0,
      engagedWorks: all.filter((x) => x.score > 0).length,
      works: all.length,
      activeReaders30d: activeGroups.length,
    },
    ratings,
    top: all
      .sort((a, b) => b.score - a.score || b.readers - a.readers || a.title.localeCompare(b.title))
      .slice(0, limit)
      .filter((x) => x.score > 0),
  };
}
