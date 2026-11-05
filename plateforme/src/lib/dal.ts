import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import type { StaffRole, DioceseAdminRole } from "@/generated/prisma/enums";

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
  /** Diocèse administré par ce compte, ou null. Vient de DioceseAdmin, jamais de l'URL. */
  dioceseId: string | null;
  dioceseRole: DioceseAdminRole | null;
};

/** Utilisateur connecté, ou null. Un compte désactivé est traité comme déconnecté. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const id = session.userId;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      staffRole: true,
      country: true,
      disabledAt: true,
      // Lu dans la même requête : aucun aller-retour supplémentaire pour connaître le périmètre diocèse.
      dioceseAdmins: { select: { dioceseId: true, role: true }, take: 1 },
    },
  });
  if (!user || user.disabledAt) return null;
  const dioceseAdmin = user.dioceseAdmins[0] ?? null;
  // Le personnel et les administrateurs de diocèse ne sont pas soumis à la limite d'appareils ;
  // un lecteur doit avoir un appareil autorisé non retiré.
  const exemptFromDeviceLimit = !!user.staffRole || !!dioceseAdmin;
  const deviceOk =
    exemptFromDeviceLimit ||
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
    dioceseId: dioceseAdmin?.dioceseId ?? null,
    dioceseRole: dioceseAdmin?.role ?? null,
  };
}

/** Réservé au personnel ayant l'un des rôles donnés. À appeler dans chaque page et action d'administration. */
export async function requireStaff(roles: StaffRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.staffRole || !roles.includes(user.staffRole)) redirect("/");
  return user;
}

export type DioceseScope = {
  user: CurrentUser;
  dioceseId: string;
  /** Rôle dans le diocèse ; un super-administrateur agit sur le diocèse qu'il a ouvert. */
  role: DioceseAdminRole | "SUPER_ADMIN";
};

/**
 * Périmètre d'un diocèse : administrateur diocésain (son diocèse, imposé par la base) ou
 * super-administrateur (le diocèse demandé, explicitement).
 *
 * Un administrateur diocésain ne peut jamais viser un autre diocèse : le moindre écart redirige.
 */
export async function requireDioceseScope(dioceseId?: string): Promise<DioceseScope> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  if (user.staffRole === "SUPER_ADMIN") {
    if (!dioceseId) redirect("/admin/dioceses"); // pas de diocèse par défaut : on passe par le référentiel
    const diocese = await db.diocese.findUnique({ where: { id: dioceseId }, select: { id: true } });
    if (!diocese) redirect("/admin/dioceses");
    return { user, dioceseId: diocese.id, role: "SUPER_ADMIN" };
  }

  if (!user.dioceseId) redirect("/");
  // Le diocèse vient de la base : une URL qui désigne un autre diocèse ne change rien, elle redirige.
  if (dioceseId && dioceseId !== user.dioceseId) redirect("/diocese");
  return { user, dioceseId: user.dioceseId, role: user.dioceseRole ?? "VIEWER" };
}

export const CATALOG_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR", "RIGHTS_MANAGER"];
/** Envoi du fichier d'une œuvre : l'éditeur du catalogue. */
export const FILE_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];
/** Licences et territoires : le gestionnaire des droits (section 4.3 du cahier des charges). */
export const RIGHTS_ROLES: StaffRole[] = ["SUPER_ADMIN", "RIGHTS_MANAGER"];
/** Prix par pays. */
export const PRICE_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];

/** Publicités : gérées par l'éditeur du catalogue. */
export const AD_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];

/**
 * Référentiel des diocèses et paroisses (et, à venir, le taux de reversement) : super-administrateur
 * uniquement. Un administrateur de diocèse n'accède qu'à son propre diocèse, via DioceseAdmin.
 */
export const REFERENTIAL_ROLES: StaffRole[] = ["SUPER_ADMIN"];

/** Modération des avis et commentaires (publication immédiate, contrôle a posteriori). */
export const MODERATION_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR", "SUPPORT"];

/** Commissions, versements et remboursements (lots 4 et 5). */
export const FINANCE_ROLES: StaffRole[] = ["SUPER_ADMIN", "FINANCE"];

/** Dépôt de manuscrits : comité éditorial (lot 7). */
export const EDITORIAL_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR"];
