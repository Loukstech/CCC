import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { completeDemoPayment } from "@/app/actions/payments";
import { formatMoney } from "@/lib/currency";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { demoCheckoutVisible } from "@/lib/payments";

export const metadata = { title: "Paiement — CCC" };

export default function DemoCheckoutPage({ params }: PageProps<"/paiement/demo/[orderId]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Suspense fallback={<p className="text-muted" aria-busy="true">…</p>}>
        <Checkout params={params} />
      </Suspense>
    </main>
  );
}

async function Checkout({ params }: { params: PageProps<"/paiement/demo/[orderId]">["params"] }) {
  const lang = await getLang();
  // Page fermée par défaut : elle ne doit pas être montrée à un client (voir lib/payments).
  if (!demoCheckoutVisible) notFound();
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id, provider: "demo" },
    select: { id: true, status: true, amount: true, currency: true, plan: true, work: { select: { title: true } } },
  });
  if (!order) notFound();
  if (order.status !== "PENDING") redirect(`/paiement/retour?order=${order.id}`);

  const label = order.plan ? t(lang, "sub.name", { plan: t(lang, `sub.planLower.${order.plan}`) }) : (order.work?.title ?? t(lang, "pay.purchase"));
  const amount = formatMoney(order.amount, order.currency, lang);
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <p role="note" className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-200">
        <strong>{t(lang, "sub.demo")}</strong> {t(lang, "pay.demoNote")}
      </p>
      <h1 className="font-display mt-5 text-2xl font-semibold text-brand">{t(lang, "pay.title")}</h1>
      <dl className="mt-4 divide-y divide-line text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-muted">{t(lang, "pay.item")}</dt>
          <dd className="font-medium text-ink">{label}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-muted">{t(lang, "pay.amount")}</dt>
          <dd className="font-display text-lg font-semibold text-ink">{amount}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-muted">{t(lang, "pay.reference")}</dt>
          <dd className="font-mono text-xs text-muted">{order.id.slice(-8).toUpperCase()}</dd>
        </div>
      </dl>
      <form action={completeDemoPayment} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="orderId" value={order.id} />
        <button type="submit" name="outcome" value="paid" className="btn btn-primary w-full">
          {t(lang, "pay.payDemo", { amount })}
        </button>
        <button
          type="submit"
          name="outcome"
          value="failed"
          className="h-11 w-full rounded-xl border border-line text-sm font-medium text-ink hover:bg-brand/5"
        >
          {t(lang, "pay.failDemo")}
        </button>
      </form>
    </div>
  );
}
