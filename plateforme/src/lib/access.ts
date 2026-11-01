import "server-only";
import { db } from "@/lib/db";

/**
 * Abonnement en cours. Un abonnement résilié reste valable jusqu'à la fin de la période payée
 * (cahier des charges, 11.2) : on regarde donc la date de fin, pas seulement le statut.
 */
export async function getActiveSubscription(userId: string) {
  return db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "CANCELED"] }, endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    select: { id: true, plan: true, status: true, startsAt: true, endsAt: true },
  });
}

export async function ownsWork(userId: string, workId: string) {
  const order = await db.order.findFirst({
    where: { userId, workId, status: "PAID" },
    select: { id: true },
  });
  return !!order;
}

export type WorkAccess = { ok: true; via: "owned" | "subscription" } | { ok: false };

/**
 * Règle unique d'accès à une œuvre : achetée (ou ajoutée si gratuite), ou comprise dans l'abonnement en cours.
 * Le pays est vérifié à part (voir rights.ts).
 */
export async function getWorkAccess(userId: string, work: { id: string; access: "FREE" | "PURCHASE" | "SUBSCRIPTION" }): Promise<WorkAccess> {
  if (await ownsWork(userId, work.id)) return { ok: true, via: "owned" };
  if (work.access === "SUBSCRIPTION" && (await getActiveSubscription(userId))) return { ok: true, via: "subscription" };
  return { ok: false };
}
