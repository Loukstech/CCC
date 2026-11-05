import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const BODY_MAX = 1500;

/**
 * Recalcule la note moyenne d'une œuvre à partir des seuls avis publiés.
 * Appelé dans la même transaction que la modification de l'avis : les compteurs affichés
 * ne peuvent donc pas diverger des avis réels.
 */
export async function recomputeRating(tx: Prisma.TransactionClient, workId: string) {
  const agg = await tx.review.aggregate({
    where: { workId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.work.update({
    where: { id: workId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
  });
}

/** Même principe pour le nombre de commentaires publiés. */
export async function recomputeComments(tx: Prisma.TransactionClient, workId: string) {
  const count = await tx.comment.count({ where: { workId, status: "PUBLISHED" } });
  await tx.work.update({ where: { id: workId }, data: { commentCount: count } });
}
