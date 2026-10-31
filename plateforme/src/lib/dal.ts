import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";
import type { StaffRole } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  staffRole: StaffRole | null;
};

/** Utilisateur connecté, ou null. Un compte désactivé est traité comme déconnecté. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = await readSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, staffRole: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return null;
  return { id: user.id, name: user.name, email: user.email, staffRole: user.staffRole };
}

/** Réservé au personnel ayant l'un des rôles donnés. À appeler dans chaque page et action d'administration. */
export async function requireStaff(roles: StaffRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.staffRole || !roles.includes(user.staffRole)) redirect("/");
  return user;
}

export const CATALOG_ROLES: StaffRole[] = ["SUPER_ADMIN", "EDITOR", "RIGHTS_MANAGER"];
