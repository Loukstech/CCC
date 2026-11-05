import { connection } from "next/server";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { Stars } from "@/components/Stars";

/**
 * Note moyenne d'une œuvre, lue à chaque requête.
 *
 * Le reste de la fiche (titre, prix, licences) est mis en cache par `getPublishedWork`. La note,
 * elle, change à chaque avis publié ou masqué : la servir depuis le cache de page la rendrait
 * périmée, parfois jusqu'à l'expiration. `connection()` force le rendu dynamique de ce fragment.
 */
export async function WorkRating({ workId, lang }: { workId: string; lang: Lang }) {
  await connection();
  const work = await db.work.findUnique({
    where: { id: workId },
    select: { ratingAvg: true, ratingCount: true },
  });
  if (!work || work.ratingCount === 0) return null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
      <Stars value={work.ratingAvg} className="text-base" />
      {t(lang, "rev.summary", { avg: work.ratingAvg.toFixed(1), n: work.ratingCount })}
    </p>
  );
}
