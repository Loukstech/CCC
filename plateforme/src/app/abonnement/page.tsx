import Link from "next/link";
import { Suspense } from "react";
import { cancelSubscription, startSubscription } from "@/app/actions/payments";
import { getActiveSubscription } from "@/lib/access";
import { formatPrice } from "@/lib/catalog";
import { COUNTRY_NAME } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { PLANS, PLAN_LABEL, PLAN_PERIOD, planPriceFor, type PlanId } from "@/lib/plans";
import { getCountry } from "@/lib/rights";

export const metadata = { title: "Abonnement — CCC" };

const BENEFITS = [
  "Tous les documentaires et films de l’abonnement",
  "Reprise là où vous vous êtes arrêté, sur tous vos appareils",
  "Résiliable à tout moment, sans appel téléphonique",
];

const dateFr = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function SubscriptionPage() {
  return (
    <main className="flex-1">
      <section className="hero-bg text-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-5 sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Abonnement CCC</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-balance sm:text-5xl">
            Documentaires et films, sans limite
          </h1>
          <p className="mt-3 max-w-xl text-white/75">
            Choisissez la formule qui vous convient. Vous voyez le prix, la durée et les conditions avant de payer.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
        <Suspense fallback={<p className="text-muted">Chargement…</p>}>
          <Plans />
        </Suspense>
      </section>
    </main>
  );
}

async function Plans() {
  const user = await getCurrentUser();
  const country = await getCountry(user);
  const sub = user ? await getActiveSubscription(user.id) : null;
  const prices = await Promise.all(PLANS.map((p) => planPriceFor(p, country)));
  const byPlan = Object.fromEntries(PLANS.map((p, i) => [p, prices[i]])) as Record<PlanId, (typeof prices)[number]>;
  const monthly = byPlan.MONTHLY;
  const yearly = byPlan.YEARLY;
  const saving =
    monthly && yearly && monthly.currency === yearly.currency ? monthly.amount * 12 - yearly.amount : 0;
  const demo = (process.env.PAYMENT_PROVIDER ?? "demo") === "demo";

  return (
    <>
      {demo && (
        <p role="note" className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-200">
          <strong>Mode démonstration :</strong> le paiement est simulé, aucune somme réelle n’est débitée.
        </p>
      )}

      {sub && (
        <div className="mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="font-semibold text-ink">
            ✓ Abonnement {PLAN_LABEL[sub.plan].toLowerCase()} {sub.status === "ACTIVE" ? "actif" : "résilié"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {sub.status === "ACTIVE"
              ? `Accès jusqu’au ${dateFr(sub.endsAt)}. Il ne se renouvelle pas tout seul : prolongez-le avant cette date.`
              : `Résilié : votre accès reste ouvert jusqu’au ${dateFr(sub.endsAt)}.`}
          </p>
          {sub.status === "ACTIVE" && (
            <form action={cancelSubscription} className="mt-3">
              <button type="submit" className="text-sm font-medium text-red-600 underline underline-offset-4">
                Résilier mon abonnement
              </button>
            </form>
          )}
        </div>
      )}

      <ul className="grid gap-5 md:grid-cols-2">
        {PLANS.map((plan) => {
          const price = byPlan[plan];
          const best = plan === "YEARLY";
          return (
            <li
              key={plan}
              className={`relative flex flex-col rounded-2xl border bg-surface p-6 shadow-sm ${best ? "border-gold ring-2 ring-gold/40" : "border-line"}`}
            >
              {best && saving > 0 && (
                <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-brand-night">
                  Économisez {formatPrice({ currency: yearly!.currency, amount: saving })}
                </span>
              )}
              <h2 className="font-display text-2xl font-semibold text-brand">{PLAN_LABEL[plan]}</h2>
              {price ? (
                <p className="mt-2">
                  <span className="font-display text-3xl font-semibold text-ink">{formatPrice(price)}</span>
                  <span className="text-muted"> / {PLAN_PERIOD[plan]}</span>
                </p>
              ) : (
                <p className="mt-2 text-muted">Prix à venir pour votre pays.</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-ink">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden className="text-gold">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-2">
                {!price ? (
                  <button type="button" disabled className="btn btn-primary w-full opacity-50">
                    Indisponible
                  </button>
                ) : user ? (
                  <form action={startSubscription}>
                    <input type="hidden" name="plan" value={plan} />
                    <button type="submit" className="btn btn-primary w-full">
                      {sub ? "Prolonger" : "S’abonner"} · {PLAN_LABEL[plan].toLowerCase()}
                    </button>
                  </form>
                ) : (
                  <Link href="/connexion" className="btn btn-primary w-full">
                    Se connecter pour s’abonner
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        <p className="font-semibold text-ink">Avant de payer</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Prix et devise : ceux de votre pays{country ? ` (${COUNTRY_NAME[country] ?? country})` : ""}, affichés ci-dessus.
          </li>
          <li>Durée : un mois ou un an à partir du paiement.</li>
          <li>Renouvellement : manuel. Rien n’est prélevé sans votre action ; vous prolongez avant l’échéance.</li>
          <li>Résiliation : à tout moment depuis « Mon compte » ; l’accès reste valable jusqu’à la fin de la période payée.</li>
        </ul>
      </div>
    </>
  );
}
