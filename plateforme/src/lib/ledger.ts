import "server-only";
import { db } from "@/lib/db";
import { PPM, effectiveFeePpm, feePpm, rates, splitSale, subscriptionRates } from "@/lib/commissions";
import type { LedgerParty } from "@/generated/prisma/enums";

/**
 * Registre des commissions (lot 4) et versements (lot 5).
 *
 * Règles tenues par ce module :
 * - le registre est **immuable** : on n'édite ni ne supprime une écriture, on ajoute une contre-écriture ;
 * - chaque écriture porte une **clé d'idempotence** unique : un double encaissement, un webhook rejoué ou
 *   une réconciliation manuelle ne peuvent pas payer deux fois la même vente ;
 * - la somme des parts vaut toujours le net encaissé (voir `splitSale`).
 */

export type Beneficiary = {
  party: LedgerParty;
  beneficiaryUserId: string | null;
  dioceseId: string | null;
  name: string;
  currency: string;
  balance: number;
};

/**
 * Écrit les commissions d'une commande payée, si elles manquent. Idempotent : appelable à volonté.
 * `actualFee` est le frais réel du prestataire ; une réconciliation ultérieure le relit sur la commande
 * et ne le remplace surtout pas par l'estimation `CCC_FEE_PPM`.
 */
export async function ensureOrderAccounting(orderId: string, actualFee?: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      plan: true,
      feeAmount: true,
      work: { select: { id: true, authorId: true, title: true } },
      user: { select: { parish: { select: { dioceseId: true } } } },
    },
  });
  if (!order || order.status !== "PAID") return;

  const knownFee = actualFee ?? (order.feeAmount > 0 ? order.feeAmount : undefined);
  const split = splitSale(order.amount, order.plan ? "SUBSCRIPTION" : "WORK", knownFee);
  const bar = order.plan ? subscriptionRates() : rates();
  const dioceseId = order.user.parish?.dioceseId ?? null;
  const authorId = order.work?.authorId ?? null;

  // Sans auteur identifié, ou sans diocèse, la part correspondante revient à la plateforme :
  // l'argent reçu est toujours affecté en totalité.
  const writer = authorId ? split.writer : 0;
  const diocese = dioceseId ? split.diocese : 0;
  const platform = split.net - writer - diocese;

  await db.order.update({
    where: { id: order.id },
    data: {
      feePpm: knownFee === undefined ? feePpm() : effectiveFeePpm(order.amount, split.fee),
      feeAmount: split.fee,
      netAmount: split.net,
    },
  });

  const common = { orderId: order.id, currency: order.currency };
  const rows = [
    {
      key: `sale:${order.id}:writer`,
      party: "WRITER" as LedgerParty,
      beneficiaryUserId: authorId,
      dioceseId: null,
      amount: writer,
      ratePpm: bar.writerPpm,
      note: order.work ? `Vente : ${order.work.title}` : null,
      ...common,
    },
    {
      key: `sale:${order.id}:diocese`,
      party: "DIOCESE" as LedgerParty,
      beneficiaryUserId: null,
      dioceseId,
      amount: diocese,
      ratePpm: bar.diocesePpm,
      note: order.work ? `Vente : ${order.work.title}` : "Abonnement",
      ...common,
    },
    {
      key: `sale:${order.id}:platform`,
      party: "PLATFORM" as LedgerParty,
      beneficiaryUserId: null,
      dioceseId: null,
      amount: platform,
      ratePpm: PPM - bar.writerPpm - bar.diocesePpm,
      note: order.work ? `Vente : ${order.work.title}` : "Abonnement",
      ...common,
    },
  ].filter((row) => row.amount !== 0 || row.party === "PLATFORM");

  await db.commissionEntry.createMany({
    data: rows.map((row) => ({ ...row, kind: "SALE" as const })),
    skipDuplicates: true,
  });
}

/** Rembourse une commande payée : contre-écritures négatives, jamais de suppression. */
export async function reverseOrderAccounting(orderId: string): Promise<boolean> {
  const order = await db.order.findFirst({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order || order.status !== "PAID") return false;

  const sales = await db.commissionEntry.findMany({
    where: { orderId, kind: "SALE" },
    select: { party: true, beneficiaryUserId: true, dioceseId: true, currency: true, amount: true, ratePpm: true },
  });

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    if (sales.length) {
      await tx.commissionEntry.createMany({
        data: sales.map((sale) => ({
          key: `refund:${orderId}:${sale.party}`,
          kind: "REFUND" as const,
          party: sale.party,
          orderId,
          beneficiaryUserId: sale.beneficiaryUserId,
          dioceseId: sale.dioceseId,
          currency: sale.currency,
          amount: -sale.amount,
          ratePpm: sale.ratePpm,
          note: "Remboursement de la commande",
        })),
        skipDuplicates: true,
      });
    }
  });
  return true;
}

/**
 * Réparateur : parcourt les commandes payées et écrit les commissions manquantes.
 * Utile après une coupure entre l'encaissement et l'écriture, ou après une reprise de données.
 */
export async function reconcilePaidOrders(limit = 200): Promise<number> {
  const orders = await db.order.findMany({
    where: { status: "PAID", ledger: { none: {} } },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: { id: true },
  });
  for (const order of orders) await ensureOrderAccounting(order.id);
  return orders.length;
}

/** Somme des écritures d'une période, par bénéficiaire. */
export async function balances(
  party: "WRITER" | "DIOCESE",
  currency: string,
  until?: Date,
): Promise<Beneficiary[]> {
  const [earned, reserved] = await Promise.all([
    db.commissionEntry.groupBy({
      by: ["beneficiaryUserId", "dioceseId"],
      where: { party, currency, ...(until ? { createdAt: { lte: until } } : {}) },
      _sum: { amount: true },
    }),
    db.payoutItem.groupBy({
      by: ["beneficiaryUserId", "dioceseId"],
      where: { party, batch: { currency, status: { in: ["DRAFT", "APPROVED", "PAID"] } } },
      _sum: { amount: true },
    }),
  ]);

  const key = (userId: string | null, dioceseId: string | null) => `${userId ?? ""}|${dioceseId ?? ""}`;
  const taken = new Map(reserved.map((r) => [key(r.beneficiaryUserId, r.dioceseId), r._sum.amount ?? 0]));

  const writerIds = earned.map((e) => e.beneficiaryUserId).filter((v): v is string => !!v);
  const dioceseIds = earned.map((e) => e.dioceseId).filter((v): v is string => !!v);
  const [users, dioceses] = await Promise.all([
    writerIds.length
      ? db.user.findMany({ where: { id: { in: writerIds } }, select: { id: true, name: true, email: true } })
      : [],
    dioceseIds.length ? db.diocese.findMany({ where: { id: { in: dioceseIds } }, select: { id: true, name: true } }) : [],
  ]);
  const userNames = new Map(users.map((u) => [u.id, u.name ?? u.email ?? "—"]));
  const dioceseNames = new Map(dioceses.map((d) => [d.id, d.name]));

  return earned
    .map((row) => {
      const total = row._sum.amount ?? 0;
      const already = taken.get(key(row.beneficiaryUserId, row.dioceseId)) ?? 0;
      return {
        party,
        beneficiaryUserId: row.beneficiaryUserId,
        dioceseId: row.dioceseId,
        name:
          party === "WRITER"
            ? (userNames.get(row.beneficiaryUserId ?? "") ?? "—")
            : (dioceseNames.get(row.dioceseId ?? "") ?? "—"),
        currency,
        balance: total - already,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

/** Solde disponible d'un seul bénéficiaire (ce qui reste à verser, réservations des lots déduites). */
export async function balanceOf(
  party: "WRITER" | "DIOCESE",
  who: { userId?: string; dioceseId?: string },
  currency: string,
): Promise<number> {
  const [earned, reserved] = await Promise.all([
    db.commissionEntry.aggregate({
      where: {
        party,
        currency,
        beneficiaryUserId: who.userId ?? null,
        dioceseId: who.dioceseId ?? null,
      },
      _sum: { amount: true },
    }),
    db.payoutItem.aggregate({
      where: {
        party,
        batch: { currency, status: { in: ["DRAFT", "APPROVED", "PAID"] } },
        ...(who.userId ? { beneficiaryUserId: who.userId } : { dioceseId: who.dioceseId }),
      },
      _sum: { amount: true },
    }),
  ]);
  return (earned._sum.amount ?? 0) - (reserved._sum.amount ?? 0);
}

/** Totaux par caisse : encaissé, frais, net, parts. */
export async function totals(from?: Date, to?: Date) {
  const where = { status: "PAID" as const, ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
  const orders = await db.order.findMany({
    where,
    select: { amount: true, currency: true, feeAmount: true, netAmount: true },
  });
  // On ne regarde que les commandes encore payées : une commande remboursée sort des totaux, et ses
  // contre-écritures aussi — sinon le remboursement serait déduit deux fois.
  const entries = await db.commissionEntry.groupBy({
    by: ["party"],
    where: { kind: { in: ["SALE", "REFUND"] }, order: { status: "PAID" } },
    _sum: { amount: true },
  });
  const gross = orders.reduce((n, o) => n + o.amount, 0);
  const fee = orders.reduce((n, o) => n + o.feeAmount, 0);
  const net = orders.reduce((n, o) => n + o.netAmount, 0);
  const part = (party: LedgerParty) => entries.find((e) => e.party === party)?._sum.amount ?? 0;
  return {
    orders: orders.length,
    currency: orders[0]?.currency ?? "XOF",
    gross,
    fee,
    net,
    writer: part("WRITER"),
    diocese: part("DIOCESE"),
    platform: part("PLATFORM"),
  };
}

/** Relevé mensuel d'un bénéficiaire (écritures et versements de la période). */
export async function statement(
  party: "WRITER" | "DIOCESE",
  who: { userId?: string; dioceseId?: string },
  currency: string,
  months = 6,
) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months + 1, 1);
  since.setUTCHours(0, 0, 0, 0);

  const filter = { party, currency, beneficiaryUserId: who.userId ?? null, dioceseId: who.dioceseId ?? null };
  const [entries, items] = await Promise.all([
    db.commissionEntry.findMany({
      where: { ...filter, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, amount: true, note: true, createdAt: true },
    }),
    db.payoutItem.findMany({
      where: { party, batch: { currency, status: { in: ["APPROVED", "PAID"] } }, ...(who.userId ? { beneficiaryUserId: who.userId } : { dioceseId: who.dioceseId }) },
      orderBy: { createdAt: "desc" },
      select: { amount: true, createdAt: true, batch: { select: { reference: true, status: true, paymentRef: true, paidAt: true } } },
    }),
  ]);

  const monthsMap = new Map<string, { month: string; earned: number; refunded: number; paid: number }>();
  const slot = (d: Date) => {
    const key = d.toISOString().slice(0, 7);
    const found = monthsMap.get(key) ?? { month: key, earned: 0, refunded: 0, paid: 0 };
    monthsMap.set(key, found);
    return found;
  };
  for (const entry of entries) {
    const row = slot(entry.createdAt);
    if (entry.amount >= 0) row.earned += entry.amount;
    else row.refunded += entry.amount;
  }
  for (const item of items) {
    if (item.batch.status !== "PAID") continue;
    slot(item.batch.paidAt ?? item.createdAt).paid += item.amount;
  }
  return {
    months: [...monthsMap.values()].sort((a, b) => b.month.localeCompare(a.month)),
    entries,
    payouts: items.map((i) => ({
      amount: i.amount,
      createdAt: i.createdAt,
      reference: i.batch.reference,
      status: i.batch.status,
      paymentRef: i.batch.paymentRef,
      paidAt: i.batch.paidAt,
    })),
  };
}

// ---- Lots de versement --------------------------------------------------------------------------

async function nextReference(party: "WRITER" | "DIOCESE"): Promise<string> {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const prefix = `VRS-${yyyy}-${mm}-${party === "WRITER" ? "ECR" : "DIO"}`;
  const count = await db.payoutBatch.count({ where: { reference: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

/** Prépare un lot : tous les soldes positifs de la période, un versement par bénéficiaire. */
export async function createBatch(input: {
  party: "WRITER" | "DIOCESE";
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  actorId: string;
  note?: string;
}) {
  const rows = (await balances(input.party, input.currency, input.periodEnd)).filter((r) => r.balance > 0);
  if (!rows.length) return null;

  const total = rows.reduce((n, r) => n + r.balance, 0);
  const reference = await nextReference(input.party);
  return db.payoutBatch.create({
    data: {
      reference,
      party: input.party,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency,
      total,
      createdById: input.actorId,
      note: input.note ?? null,
      items: {
        create: rows.map((r) => ({
          party: input.party,
          beneficiaryUserId: r.beneficiaryUserId,
          dioceseId: r.dioceseId,
          amount: r.balance,
          balanceBefore: r.balance,
        })),
      },
    },
    select: { id: true, reference: true },
  });
}

/** Valide un lot préparé. Un lot validé ne se modifie plus : il est versé ou annulé. */
export async function approveBatch(batchId: string, actorId: string) {
  const res = await db.payoutBatch.updateMany({
    where: { id: batchId, status: "DRAFT" },
    data: { status: "APPROVED", approvedById: actorId, approvedAt: new Date() },
  });
  return res.count === 1;
}

/** Marque un lot versé, avec la référence du paiement réel (mobile money, bordereau). */
export async function markBatchPaid(batchId: string, paymentRef: string) {
  const ref = paymentRef.trim();
  if (ref.length < 3) return false;
  const res = await db.payoutBatch.updateMany({
    where: { id: batchId, status: "APPROVED" },
    data: { status: "PAID", paidAt: new Date(), paymentRef: ref },
  });
  return res.count === 1;
}

/** Annule un lot : les sommes réservées retournent dans le solde des bénéficiaires. */
export async function cancelBatch(batchId: string) {
  const res = await db.payoutBatch.updateMany({
    where: { id: batchId, status: { in: ["DRAFT", "APPROVED"] } },
    data: { status: "CANCELED" },
  });
  return res.count === 1;
}
