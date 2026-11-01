import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { authorizeThisDevice, revokeDevice } from "@/app/actions/devices";
import { cancelSubscription } from "@/app/actions/payments";
import { getActiveSubscription } from "@/lib/access";
import { formatPrice } from "@/lib/catalog";
import { COUNTRY_NAME } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { DEVICE_LIMIT } from "@/lib/devices";
import { db } from "@/lib/db";
import { PLAN_LABEL } from "@/lib/plans";

export const metadata = { title: "Mon compte — CCC" };

const STATUS = {
  PAID: { label: "Payé", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  PENDING: { label: "En attente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  FAILED: { label: "Échoué", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  REFUNDED: { label: "Remboursé", cls: "bg-line text-muted" },
} as const;

const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
const h2 = "font-display text-xl font-semibold text-brand";
const dateFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
      <h1 className="font-display text-3xl font-semibold text-brand sm:text-4xl">Mon compte</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Chargement…</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const [sub, devices, orders] = await Promise.all([
    getActiveSubscription(user.id),
    db.device.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, name: true, lastSeenAt: true },
    }),
    db.order.findMany({
      where: { userId: user.id, status: { in: ["PAID", "FAILED", "REFUNDED"] }, amount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, status: true, amount: true, currency: true, plan: true, createdAt: true, work: { select: { title: true, slug: true } } },
    }),
  ]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      {!user.deviceOk && devices.length >= DEVICE_LIMIT && (
        <p role="alert" className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100">
          <strong>Limite d’appareils atteinte ({DEVICE_LIMIT}).</strong> Pour lire sur cet appareil, retirez-en un de la
          liste « Mes appareils » ci-dessous : celui-ci sera alors autorisé automatiquement.
        </p>
      )}
      {!user.deviceOk && devices.length < DEVICE_LIMIT && (
        <div role="alert" className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100">
          <p>
            <strong>Cet appareil n’est pas encore autorisé.</strong> Autorisez-le pour lire vos livres ici
            ({devices.length}/{DEVICE_LIMIT} appareils utilisés).
          </p>
          <form action={authorizeThisDevice} className="mt-3">
            <button type="submit" className="btn btn-primary h-10">
              Autoriser cet appareil
            </button>
          </form>
        </div>
      )}

      <section className={card}>
        <h2 className={h2}>Profil</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Nom</dt>
            <dd className="font-medium text-ink">{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium break-all text-ink">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Pays</dt>
            <dd className="font-medium text-ink">{user.country ? (COUNTRY_NAME[user.country] ?? user.country) : "—"}</dd>
          </div>
        </dl>
      </section>

      <section id="appareils" className={card}>
        <h2 className={h2}>
          Mes appareils <span className="text-sm font-normal text-muted">({devices.length}/{DEVICE_LIMIT})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Les appareils autorisés à lire vos contenus. Si vous changez de téléphone, retirez l’ancien.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {devices.length === 0 && <li className="py-2 text-sm text-muted">Aucun appareil enregistré.</li>}
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {d.name}
                  {d.id === user.deviceId && (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Cet appareil</span>
                  )}
                </p>
                <p className="text-xs text-muted">Dernière activité : {dateFr(d.lastSeenAt)}</p>
              </div>
              <form action={revokeDevice}>
                <input type="hidden" name="deviceId" value={d.id} />
                <button type="submit" className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={logout} className="sm:hidden">
        <button type="submit" className="h-11 w-full rounded-xl border border-line text-sm font-medium text-ink">
          Se déconnecter
        </button>
      </form>

      <section className={card}>
        <h2 className={h2}>Mon abonnement</h2>
        {sub ? (
          <>
            <p className="mt-2 text-sm text-ink">
              Formule <strong>{PLAN_LABEL[sub.plan].toLowerCase()}</strong> — {sub.status === "ACTIVE" ? "active" : "résiliée"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {sub.status === "ACTIVE"
                ? `Accès jusqu’au ${dateFr(sub.endsAt)}. Pas de renouvellement automatique.`
                : `Accès conservé jusqu’au ${dateFr(sub.endsAt)}.`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link href="/abonnement" className="btn btn-primary h-10">
                Prolonger
              </Link>
              {sub.status === "ACTIVE" && (
                <form action={cancelSubscription}>
                  <button type="submit" className="text-sm font-medium text-red-600 underline underline-offset-4">
                    Résilier
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">Vous n’avez pas d’abonnement en cours.</p>
            <Link href="/abonnement" className="btn btn-primary mt-4 h-10">
              Voir les abonnements
            </Link>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className={h2}>Mes achats</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucun achat pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {orders.map((o) => {
              const st = STATUS[o.status];
              const title = o.plan ? `Abonnement ${PLAN_LABEL[o.plan].toLowerCase()}` : (o.work?.title ?? "Achat");
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    {o.work ? (
                      <Link href={`/oeuvres/${o.work.slug}`} className="block truncate font-medium text-ink hover:text-brand">
                        {title}
                      </Link>
                    ) : (
                      <p className="truncate font-medium text-ink">{title}</p>
                    )}
                    <p className="text-xs text-muted">
                      {dateFr(o.createdAt)} · Réf. {o.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-ink">{formatPrice(o)}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
