import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { partnerCodesRequired } from "@/lib/partner-codes";

/**
 * Accès à l'espace écrivain. Quand le contrôle par code est actif, seul un profil d'auteur
 * APPROUVÉ (créé par un code de partenariat ou validé depuis /admin/partenariats) peut entrer.
 * Sans ce garde, un simple compte fidèle pourrait contourner le code en ouvrant /ecrivain.
 */
export async function requireWriterAccess(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!partnerCodesRequired()) return user;
  const profile = await db.writerProfile.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  if (profile?.status !== "APPROVED") redirect("/ecrivain/inscription?acces=refuse");
  return user;
}
