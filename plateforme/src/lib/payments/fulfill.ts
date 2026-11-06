import "server-only";
import { db } from "@/lib/db";
import { ensureOrderAccounting, reverseOrderAccounting } from "@/lib/ledger";

function addPeriod(from: Date, plan: "MONTHLY" | "YEARLY") {
  const d = new Date(from);
  if (plan === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/**
 * Valide une commande payée. Peut être appelée plusieurs fois pour la même commande (le prestataire peut
 * confirmer deux fois) : seule la première passe de « en attente » à « payée » compte, donc aucun double effet.
 * Pour un abonnement, la période s'ajoute à la fin de l'abonnement en cours s'il y en a un.
 * `actualFeeAmount` est le frais réellement prélevé par le prestataire : il remplace l'estimation
 * configurée et devient la base du partage (frais déduits avant partage).
 */
export async function markOrderPaid(orderId: string, providerRef?: string, actualFeeAmount?: number): Promise<boolean> {
  const paid = await db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), ...(providerRef ? { providerRef } : {}) },
    });
    if (claimed.count !== 1) return false;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { userId: true, plan: true, provider: true },
    });
    if (order.plan) {
      const now = new Date();
      const current = await tx.subscription.findFirst({
        where: { userId: order.userId, status: { in: ["ACTIVE", "CANCELED"] }, endsAt: { gt: now } },
        orderBy: { endsAt: "desc" },
        select: { id: true, endsAt: true },
      });
      if (current) {
        await tx.subscription.update({
          where: { id: current.id },
          data: { endsAt: addPeriod(current.endsAt, order.plan), status: "ACTIVE", plan: order.plan },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: order.userId,
            plan: order.plan,
            status: "ACTIVE",
            startsAt: now,
            endsAt: addPeriod(now, order.plan),
            provider: order.provider,
          },
        });
      }
    }
    return true;
  });

  // Les commissions (lot 4) sont écrites juste après l'encaissement, de façon idempotente : si cette
  // étape échoue, la réconciliation de l'écran Finances les rattrape sans jamais payer deux fois.
  if (paid) await ensureOrderAccounting(orderId, actualFeeAmount).catch(() => undefined);
  return paid;
}

/**
 * Rembourse une commande payée : le registre reçoit des contre-écritures négatives, rien n'est effacé.
 * La résiliation d'un abonnement éventuel reste une décision humaine, prise depuis le compte client.
 */
export async function markOrderRefunded(orderId: string): Promise<boolean> {
  return reverseOrderAccounting(orderId);
}

export async function markOrderFailed(orderId: string): Promise<boolean> {
  const res = await db.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "FAILED" } });
  return res.count === 1;
}
