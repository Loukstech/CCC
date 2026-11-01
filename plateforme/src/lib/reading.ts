import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/dal";
import { getCountry, isAvailable } from "@/lib/rights";

export type ReadAccess =
  | { ok: true; work: { id: string; slug: string; title: string; author: string | null; fileKey: string } }
  | { ok: false; reason: "not-found" | "not-owned" | "unavailable" | "no-file" };

/**
 * Règle unique d'accès à la lecture d'un livre : œuvre publiée, dans la bibliothèque de l'utilisateur,
 * disponible dans son pays, avec un fichier. Utilisée par la page du lecteur ET par la route qui sert le fichier.
 */
export async function authorizeRead(
  user: CurrentUser,
  where: { id: string } | { slug: string },
): Promise<ReadAccess> {
  const work = await db.work.findFirst({
    where: { ...where, status: "PUBLISHED", type: "BOOK" },
    select: {
      id: true,
      slug: true,
      title: true,
      author: true,
      fileKey: true,
      licenses: { select: { countries: true, allowWeb: true, startsAt: true, endsAt: true } },
    },
  });
  if (!work) return { ok: false, reason: "not-found" };

  const owned = await db.order.findFirst({
    where: { userId: user.id, workId: work.id, status: "PAID" },
    select: { id: true },
  });
  if (!owned) return { ok: false, reason: "not-owned" };

  const country = await getCountry(user);
  if (!country || !isAvailable(work.licenses, country, new Date())) return { ok: false, reason: "unavailable" };

  if (!work.fileKey) return { ok: false, reason: "no-file" };
  return { ok: true, work: { id: work.id, slug: work.slug, title: work.title, author: work.author, fileKey: work.fileKey } };
}
