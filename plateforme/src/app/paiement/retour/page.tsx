import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatMoney } from "@/lib/currency";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { syncFedaPayOrder } from "@/lib/payments/fedapay";

export const metadata = { title: "Résultat du paiement — CCC" };

export default function PaymentReturnPage({ searchParams }: PageProps<"/paiement/retour">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Suspense fallback={<p className="text-muted" aria-busy="true">…</p>}>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/paiement/retour">["searchParams"] }) {
  const lang = await getLang();
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const raw = (await searchParams).order;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const order = id
    ? await db.order.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true, amount: true, currency: true, plan: true, provider: true, providerRef: true, work: { select: { title: true, slug: true } } },
      })
    : null;

  if (!order) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-muted">{t(lang, "pay.notFound")}</p>
        <Link href="/compte" className="btn btn-primary mt-4">
          {t(lang, "nav.myAccount")}
        </Link>
      </div>
    );
  }

  // FedaPay ajoute ?id=…&status=… à l'URL de retour : ce statut n'est pas fiable. Si le webhook n'est
  // pas encore passé, on revérifie la transaction auprès de l'API avant d'afficher quoi que ce soit.
  const status =
    order.provider === "fedapay"
      ? await syncFedaPayOrder({
          id: order.id,
          providerRef: order.providerRef,
          amount: order.amount,
          status: order.status,
        })
      : order.status;

  const label = order.plan ? t(lang, "sub.name", { plan: t(lang, `sub.planLower.${order.plan}`) }) : (order.work?.title ?? t(lang, "pay.purchase"));
  const tone = {
    PAID: { icon: "✓", title: t(lang, "pay.paidTitle"), text: t(lang, "pay.paidText"), cls: "text-emerald-600" },
    PENDING: { icon: "…", title: t(lang, "pay.pendingTitle"), text: t(lang, "pay.pendingText"), cls: "text-amber-600" },
    FAILED: { icon: "✕", title: t(lang, "pay.failedTitle"), text: t(lang, "pay.failedText"), cls: "text-red-600" },
    REFUNDED: { icon: "↩", title: t(lang, "pay.refundedTitle"), text: t(lang, "pay.refundedText"), cls: "text-muted" },
  }[status];

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
      <p className={`text-5xl ${tone.cls}`} aria-hidden>
        {tone.icon}
      </p>
      <h1 className="font-display mt-3 text-2xl font-semibold text-ink">{tone.title}</h1>
      <p className="mt-1 text-sm text-muted">{tone.text}</p>
      <p className="mt-4 text-sm text-ink">
        {label} · <strong>{formatMoney(order.amount, order.currency, lang)}</strong>
      </p>
      <p className="font-mono text-xs text-muted">{t(lang, "pay.ref", { ref: order.id.slice(-8).toUpperCase() })}</p>
      <div className="mt-6 flex flex-col gap-3">
        {status === "PAID" && order.work && (
          <Link href={`/oeuvres/${order.work.slug}`} className="btn btn-primary">
            {t(lang, "pay.openWork")}
          </Link>
        )}
        {status === "PAID" && order.plan && (
          <Link href="/documentaires" className="btn btn-primary">
            {t(lang, "pay.discoverDocs")}
          </Link>
        )}
        {status === "FAILED" && (
          <Link href={order.work ? `/oeuvres/${order.work.slug}` : "/abonnement"} className="btn btn-primary">
            {t(lang, "pay.retry")}
          </Link>
        )}
        <Link href="/compte" className="text-sm font-medium text-brand underline underline-offset-4">
          {t(lang, "pay.accountLink")}
        </Link>
      </div>
    </div>
  );
}
