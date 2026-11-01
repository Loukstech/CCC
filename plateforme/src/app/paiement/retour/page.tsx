import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatPrice } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { PLAN_LABEL } from "@/lib/plans";

export const metadata = { title: "Résultat du paiement — CCC" };

export default function PaymentReturnPage({ searchParams }: PageProps<"/paiement/retour">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/paiement/retour">["searchParams"] }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const raw = (await searchParams).order;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const order = id
    ? await db.order.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true, amount: true, currency: true, plan: true, work: { select: { title: true, slug: true } } },
      })
    : null;

  if (!order) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-muted">Commande introuvable.</p>
        <Link href="/compte" className="btn btn-primary mt-4">
          Mon compte
        </Link>
      </div>
    );
  }

  const label = order.plan ? `Abonnement ${PLAN_LABEL[order.plan].toLowerCase()}` : (order.work?.title ?? "Achat");
  const tone = {
    PAID: { icon: "✓", title: "Paiement réussi", text: "Merci ! Votre accès est ouvert.", cls: "text-emerald-600" },
    PENDING: { icon: "…", title: "Paiement en attente", text: "Nous attendons la confirmation de votre paiement.", cls: "text-amber-600" },
    FAILED: { icon: "✕", title: "Paiement échoué", text: "Aucune somme n’a été débitée. Vous pouvez réessayer.", cls: "text-red-600" },
    REFUNDED: { icon: "↩", title: "Paiement remboursé", text: "Cette commande a été remboursée.", cls: "text-muted" },
  }[order.status];

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
      <p className={`text-5xl ${tone.cls}`} aria-hidden>
        {tone.icon}
      </p>
      <h1 className="font-display mt-3 text-2xl font-semibold text-ink">{tone.title}</h1>
      <p className="mt-1 text-sm text-muted">{tone.text}</p>
      <p className="mt-4 text-sm text-ink">
        {label} · <strong>{formatPrice(order)}</strong>
      </p>
      <p className="font-mono text-xs text-muted">Réf. {order.id.slice(-8).toUpperCase()}</p>
      <div className="mt-6 flex flex-col gap-3">
        {order.status === "PAID" && order.work && (
          <Link href={`/oeuvres/${order.work.slug}`} className="btn btn-primary">
            Ouvrir l’œuvre
          </Link>
        )}
        {order.status === "PAID" && order.plan && (
          <Link href="/documentaires" className="btn btn-primary">
            Découvrir les documentaires
          </Link>
        )}
        {order.status === "FAILED" && (
          <Link href={order.work ? `/oeuvres/${order.work.slug}` : "/abonnement"} className="btn btn-primary">
            Réessayer
          </Link>
        )}
        <Link href="/compte" className="text-sm font-medium text-brand underline underline-offset-4">
          Mon compte et mes achats
        </Link>
      </div>
    </div>
  );
}
