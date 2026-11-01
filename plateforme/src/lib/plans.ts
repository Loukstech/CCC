import "server-only";
import { db } from "@/lib/db";

export const PLANS = ["MONTHLY", "YEARLY"] as const;
export type PlanId = (typeof PLANS)[number];

export const PLAN_LABEL: Record<PlanId, string> = { MONTHLY: "Mensuel", YEARLY: "Annuel" };
export const PLAN_PERIOD: Record<PlanId, string> = { MONTHLY: "mois", YEARLY: "an" };

export const isPlan = (v: unknown): v is PlanId => PLANS.includes(v as PlanId);

/** Prix d'un abonnement : celui du pays de l'utilisateur, sinon le premier défini pour cette formule. */
export async function planPriceFor(plan: PlanId, country: string | null) {
  const select = { id: true, plan: true, country: true, currency: true, amount: true } as const;
  const exact = country ? await db.planPrice.findUnique({ where: { plan_country: { plan, country } }, select }) : null;
  return exact ?? (await db.planPrice.findFirst({ where: { plan }, orderBy: { country: "asc" }, select }));
}
