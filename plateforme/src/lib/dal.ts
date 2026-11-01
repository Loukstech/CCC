import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import type { StaffRole } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  staffRole: StaffRole | null;
  country: string | null;
  /** Appareil autorisé auquel la session est liée. */
  deviceId: string | null;
  /** Faux si cet appareil n'est pas (ou plus) autorisé : lecture refusée tant qu'il n'est pas enregistré. */
  deviceOk: boolean;
};

/** Utilisateur connecté, ou null. Un compte désactivé est traité comme déconnecté. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const id = session.userId;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, staffRole: true, country: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;
  // Le personnel n'est pas soumis à la limite d'appareils ; un lecteur doit avoir un appareil autorisé non retiré.
  const deviceOk =
    !!user.staffRole ||
    (!!session.deviceId &&
      !!(await db.device.findFirst({
        where: { id: session.deviceId, userId: user.id, revokedAt: null },
        select: { id: true },
      })));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    staffRole: user.staffRole,
    country: user.country,
    deviceId: session.deviceId,
    deviceOk,
  };
}

/** Réservé au personnel ayant l'un des rôles donnés. À appeler dans chaque page et action d'administration. */
export async function requireStaff(roles: StaffRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.staffRole || !roles.includes(user.staffRole)) redirect("/");
  return user;
}

export const CATALOG_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR", "RIGHTS_MANAGER"];
/** Envoi du fichier d'une œuvre : l'éditeur du catalogue. */
export const FILE_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];
/** Licences et territoires : le gestionnaire des droits (section 4.3 du cahier des charges). */
export const RIGHTS_ROLES: StaffRole[] = ["SUPER_ADMIN", "RIGHTS_MANAGER"];
/** Prix par pays. */
export const PRICE_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];
