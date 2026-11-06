import "server-only";
import { getWorkAccess } from "@/lib/access";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/dal";
import { getCountry, isAvailable } from "@/lib/rights";

type WorkType = "BOOK" | "FILM" | "DOCUMENTARY";
type AccessModeKey = "FREE" | "PURCHASE" | "SUBSCRIPTION";

export type ReadAccess =
  | {
      ok: true;
      work: {
        id: string;
        slug: string;
        title: string;
        author: string | null;
        type: WorkType;
        fileKey: string;
        language: string;
        /** Gratuit ou payant : c'est ce qui décide si une publicité peut s'intercaler. */
        access: AccessModeKey;
      };
    }
  | { ok: false; reason: "not-found" | "not-owned" | "unavailable" | "no-file" | "device" };

/**
 * Règle unique d'accès au contenu d'une œuvre (lecture d'un livre ou visionnage d'une vidéo) : appareil autorisé,
 * œuvre publiée, achetée ou comprise dans l'abonnement, disponible dans le pays de l'utilisateur, avec un fichier.
 * Utilisée par les pages ET par les routes qui servent les fichiers.
 */
async function authorizeMedia(
  user: CurrentUser,
  where: { id: string } | { slug: string },
  types: WorkType[],
): Promise<ReadAccess> {
  if (!user.deviceOk) return { ok: false, reason: "device" };

  const work = await db.work.findFirst({
    where: { ...where, status: "PUBLISHED", type: { in: types } },
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      type: true,
      access: true,
      fileKey: true,
      language: true,
      licenses: { select: { countries: true, allowWeb: true, startsAt: true, endsAt: true } },
    },
  });
  if (!work) return { ok: false, reason: "not-found" };

  const access = await getWorkAccess(user.id, work);
  if (!access.ok) return { ok: false, reason: "not-owned" };

  const country = await getCountry(user);
  if (!country || !isAvailable(work.licenses, country, new Date())) return { ok: false, reason: "unavailable" };

  if (!work.fileKey) return { ok: false, reason: "no-file" };
  return {
    ok: true,
    work: {
      id: work.id,
      slug: work.slug,
      title: work.title,
      author: work.author,
      type: work.type,
      fileKey: work.fileKey,
      language: work.language,
      access: work.access,
    },
  };
}

export const authorizeRead = (user: CurrentUser, where: { id: string } | { slug: string }) =>
  authorizeMedia(user, where, ["BOOK"]);

export const authorizeWatch = (user: CurrentUser, where: { id: string } | { slug: string }) =>
  authorizeMedia(user, where, ["FILM", "DOCUMENTARY"]);
