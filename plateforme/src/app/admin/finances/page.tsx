import Link from "next/link";
import { Suspense } from "react";
import { FINANCE_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { rateSummary } from "@/lib/commissions";
import { balances, totals } from "@/lib/ledger";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import {
  approvePayoutBatch,
  cancelPayoutBatch,
  markPayoutBatchPaid,
  preparePayoutBatch,
  reconcileAccounting,
  refundOrder,
} from "@/app/actions/finances";

// Écran authentifié et bilingue : il lit les cookies, il ne peut donc pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "fin.title")} — CCC` };
}

const fine = "rounded-2xl border border-line bg-surface p-5";
const h2 = "font-display text-xl font-semibold text-brand";

export default async function FinancesPage({ searchParams }: PageProps<"/admin/finances">) {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "fin.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "fin.title")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{t(lang, "fin.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <Finances searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const day = (d: Date, lang: Lang) => d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" });

async function Finances({ searchParams }: { searchParams: PageProps<"/admin/finances">["searchParams"] }) {
  await requireStaff(FINANCE_ROLES);
  const lang = await getLang();
  const query = await searchParams;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [all, month, writers, dioceses, batches, recent] = await Promise.all([
    totals(),
    totals(monthStart),
    balances("WRITER", "XOF"),
    balances("DIOCESE", "XOF"),
    db.payoutBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        reference: true,
        party: true,
        status: true,
        currency: true,
        total: true,
        periodStart: true,
        periodEnd: true,
        paymentRef: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.findMany({
      where: { status: { in: ["PAID", "REFUNDED"] } },
      orderBy: { paidAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        netAmount: true,
        feeAmount: true,
        paidAt: true,
        work: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const rates = rateSummary();
  const pct = (ppm: number) => `${(ppm / 100).toFixed(ppm % 100 === 0 ? 0 : 1)} %`;
  // Avec FedaPay, les frais réels sont enregistrés commande par commande : le pourcentage
  // CCC_FEE_PPM n'est alors qu'une estimation de repli, il ne doit pas être présenté comme le barème.
  const realFees = (process.env.PAYMENT_PROVIDER ?? "demo") === "fedapay";
  const monthValue = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const partyLabel = (party: "WRITER" | "DIOCESE" | "PLATFORM") =>
    party === "DIOCESE" ? t(lang, "fin.party.DIOCESE") : party === "WRITER" ? t(lang, "fin.party.WRITER") : t(lang, "fin.platformPart");

  const stat = (label: string, value: string) => (
    <div className="rounded-xl bg-paper/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {query.lot === "vide" && (
        <p role="alert" className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-500/30">
          {t(lang, "fin.emptyBatch")}
        </p>
      )}
      {typeof query.lot === "string" && query.lot !== "vide" && (
        <p role="status" className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30">
          {t(lang, "fin.emptyBatchOk", { ref: query.lot })}
        </p>
      )}

      <section className={`${fine} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className={h2}>{t(lang, "fin.rates")}</h2>
          <span className="text-xs text-muted">
            {t(lang, "fin.fee")} : {realFees ? t(lang, "fin.feeReal") : `${pct(rates.feePpm)} · ${t(lang, "fin.feeEstimate")}`}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {stat(t(lang, "fin.writerPart"), pct(rates.sale.writerPpm))}
          {stat(t(lang, "fin.diocesePart"), pct(rates.sale.diocesePpm))}
          {stat(t(lang, "fin.platformPart"), pct(rates.sale.platformPpm))}
        </div>
        <p className="text-xs text-muted">{t(lang, "fin.subNote")}</p>
      </section>

      <section className={`${fine} flex flex-col gap-4`}>
        <h2 className={h2}>{t(lang, "fin.totals")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stat(t(lang, "fin.allTime"), `${t(lang, "fin.orders", { n: all.orders })}`)}
          {stat(t(lang, "fin.gross"), formatMoney(all.gross, all.currency, lang))}
          {stat(t(lang, "fin.fee"), formatMoney(all.fee, all.currency, lang))}
          {stat(t(lang, "fin.net"), formatMoney(all.net, all.currency, lang))}
          {stat(`${t(lang, "fin.thisMonth")} · ${t(lang, "fin.gross")}`, formatMoney(month.gross, month.currency, lang))}
          {stat(t(lang, "fin.writerPart"), formatMoney(all.writer, all.currency, lang))}
          {stat(t(lang, "fin.diocesePart"), formatMoney(all.diocese, all.currency, lang))}
          {stat(t(lang, "fin.platformPart"), formatMoney(all.platform, all.currency, lang))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className={fine}>
          <h2 className={`${h2} mb-3`}>{t(lang, "fin.balancesWriters")}</h2>
          {writers.filter((b) => b.balance > 0).length === 0 ? (
            <p className="text-sm text-muted">{t(lang, "fin.noBalance")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {writers
                .filter((b) => b.balance > 0)
                .map((b) => (
                  <li key={b.beneficiaryUserId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{b.name}</span>
                    <strong className="tabular-nums">{formatMoney(b.balance, b.currency, lang)}</strong>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className={fine}>
          <h2 className={`${h2} mb-3`}>{t(lang, "fin.balancesDioceses")}</h2>
          {dioceses.filter((b) => b.balance > 0).length === 0 ? (
            <p className="text-sm text-muted">{t(lang, "fin.noBalance")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {dioceses
                .filter((b) => b.balance > 0)
                .map((b) => (
                  <li key={b.dioceseId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{b.name}</span>
                    <strong className="tabular-nums">{formatMoney(b.balance, b.currency, lang)}</strong>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      <section className={fine}>
        <h2 className={`${h2} mb-4`}>{t(lang, "fin.prepare")}</h2>
        <form action={preparePayoutBatch} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t(lang, "fin.prepareParty")}
            <select name="party" className="h-11 rounded-xl border border-line bg-paper/50 px-3 text-sm">
              <option value="WRITER">{t(lang, "fin.party.WRITER")}</option>
              <option value="DIOCESE">{t(lang, "fin.party.DIOCESE")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t(lang, "fin.prepareMonth")}
            <input
              type="month"
              name="month"
              defaultValue={monthValue}
              className="h-11 rounded-xl border border-line bg-paper/50 px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {t(lang, "fin.prepareCurrency")}
            <input
              name="currency"
              defaultValue="XOF"
              maxLength={3}
              className="h-11 w-24 rounded-xl border border-line bg-paper/50 px-3 text-sm uppercase"
            />
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium text-ink">
            {t(lang, "fin.prepareNote")}
            <input name="note" className="h-11 rounded-xl border border-line bg-paper/50 px-3 text-sm" />
          </label>
          <button type="submit" className="btn btn-primary h-11">
            {t(lang, "fin.prepare")}
          </button>
        </form>
        <form action={reconcileAccounting} className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">{t(lang, "fin.reconcileNote")}</p>
          <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
            {t(lang, "fin.reconcile")}
          </button>
        </form>
      </section>

      <section className={fine}>
        <h2 className={`${h2} mb-3`}>{t(lang, "fin.batches")}</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "fin.noBatches")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {batches.map((batch) => (
              <li key={batch.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">
                    {batch.reference} · {partyLabel(batch.party)}
                  </p>
                  <p className="font-display font-semibold text-ink">{formatMoney(batch.total, batch.currency, lang)}</p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t(lang, "fin.batchPeriod")} : {day(batch.periodStart, lang)} → {day(batch.periodEnd, lang)} ·{" "}
                  {t(lang, "fin.batchItems", { n: batch._count.items })} ·{" "}
                  <span className="font-semibold text-brand">{t(lang, `fin.status.${batch.status}`)}</span>
                  {batch.paymentRef && ` · ${t(lang, "fin.paidWith", { ref: batch.paymentRef })}`}
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {batch.status === "DRAFT" && (
                    <form action={approvePayoutBatch}>
                      <input type="hidden" name="id" value={batch.id} />
                      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
                        {t(lang, "fin.approve")}
                      </button>
                    </form>
                  )}
                  {batch.status === "APPROVED" && (
                    <form action={markPayoutBatchPaid} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={batch.id} />
                      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                        {t(lang, "fin.paymentRef")}
                        <input
                          name="paymentRef"
                          required
                          className="h-9 w-56 rounded-lg border border-line bg-paper/50 px-2 text-sm"
                        />
                      </label>
                      <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110">
                        {t(lang, "fin.markPaid")}
                      </button>
                    </form>
                  )}
                  {(batch.status === "DRAFT" || batch.status === "APPROVED") && (
                    <form action={cancelPayoutBatch}>
                      <input type="hidden" name="id" value={batch.id} />
                      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
                        {t(lang, "fin.cancelBatch")}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={fine}>
        <h2 className={`${h2} mb-3`}>{t(lang, "fin.recentOrders")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "fin.noOrders")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">
                    {order.work?.title ?? t(lang, "sub.title")}
                  </span>
                  <span className="text-xs text-muted">
                    {order.paidAt ? day(order.paidAt, lang) : "—"} · {formatMoney(order.amount, order.currency, lang)} ·{" "}
                    {t(lang, "fin.net")} {formatMoney(order.netAmount, order.currency, lang)} · {t(lang, "fin.fee")}{" "}
                    {formatMoney(order.feeAmount, order.currency, lang)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={order.status === "REFUNDED" ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                    {order.status === "REFUNDED" ? t(lang, "fin.refunded") : t(lang, "pay.status.PAID")}
                  </span>
                  {order.status === "PAID" && (
                    <form action={refundOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button type="submit" className="rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-brand/5">
                        {t(lang, "fin.refund")}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">{t(lang, "fin.refundNote")}</p>
      </section>
    </div>
  );
}
