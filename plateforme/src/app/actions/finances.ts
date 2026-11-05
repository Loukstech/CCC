"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FINANCE_ROLES, requireStaff } from "@/lib/dal";
import { approveBatch, cancelBatch, createBatch, markBatchPaid, reconcilePaidOrders } from "@/lib/ledger";
import { markOrderRefunded } from "@/lib/payments/fulfill";

const refresh = () => {
  revalidatePath("/admin/finances");
  revalidatePath("/ecrivain");
  revalidatePath("/diocese");
};

function firstDayOfMonth(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return d;
}

/** Prépare un lot de versement pour une caisse et un mois. */
export async function preparePayoutBatch(formData: FormData) {
  const user = await requireStaff(FINANCE_ROLES);
  const party = formData.get("party") === "DIOCESE" ? "DIOCESE" : "WRITER";
  const currency = String(formData.get("currency") ?? "XOF").toUpperCase().slice(0, 3);
  const raw = String(formData.get("month") ?? "");
  const parsed = /^\d{4}-\d{2}$/.test(raw) ? new Date(`${raw}-01T00:00:00Z`) : new Date();
  const periodStart = firstDayOfMonth(parsed);
  const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0, 23, 59, 59));
  const note = String(formData.get("note") ?? "").trim() || undefined;

  const batch = await createBatch({ party, periodStart, periodEnd, currency, actorId: user.id, note });
  refresh();
  if (!batch) redirect("/admin/finances?lot=vide");
  redirect(`/admin/finances?lot=${batch.reference}`);
}

/** Valide un lot préparé. */
export async function approvePayoutBatch(formData: FormData) {
  const user = await requireStaff(FINANCE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await approveBatch(id, user.id);
  refresh();
}

/** Enregistre le versement réel avec sa référence (mobile money, bordereau). */
export async function markPayoutBatchPaid(formData: FormData) {
  await requireStaff(FINANCE_ROLES);
  const id = String(formData.get("id") ?? "");
  const reference = String(formData.get("paymentRef") ?? "");
  if (!id) return;
  await markBatchPaid(id, reference);
  refresh();
}

/** Annule un lot : les montants réservés retournent dans les soldes. */
export async function cancelPayoutBatch(formData: FormData) {
  await requireStaff(FINANCE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cancelBatch(id);
  refresh();
}

/** Rembourse une commande : contre-écritures négatives, jamais de suppression. */
export async function refundOrder(formData: FormData) {
  const user = await requireStaff(FINANCE_ROLES);
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId || user.id.length === 0) return;
  await markOrderRefunded(orderId);
  refresh();
}

/** Écrit les commissions manquantes des commandes déjà encaissées. */
export async function reconcileAccounting() {
  await requireStaff(FINANCE_ROLES);
  await reconcilePaidOrders();
  refresh();
}
