import Link from "next/link";
import { Suspense } from "react";
import { cancelSubscription, startSubscription } from "@/app/actions/payments";
import { getActiveSubscription } from "@/lib/access";
import { countryName } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/currency";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { PLANS, planPriceFor, type PlanId } from "@/lib/plans";
import { getCountry } from "@/lib/rights";

export const metadata = { title: "Abonnement — CCC" };

const BENEFITS = ["sub.benefit1", "sub.benefit2", "sub.benefit3"] as const;

const dateOf = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function SubscriptionPage() {
  return (
    <main className="flex-1">
      <Suspense fallback={<p className="p-8 text-muted" aria-busy="true">…</p>}>
        <SubscriptionContent />
      </Suspense>
    </main>
  );
}

async function SubscriptionContent() {
  const lang = await getLang();
  return (
    <>
      <section className="hero-bg text-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-5 sm:py-14">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{t(lang, "sub.kicker")}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-balance sm:text-5xl">
            {t(lang, "sub.title")}
          </h1>
          <p className="mt-3 max-w-xl text-white/75">{t(lang, "sub.lead")}</p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
        <Plans lang={lang} />
      </section>
    </>
  );
}

async function Plans({ lang }: { lang: Lang }) {
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
          <strong>{t(lang, "sub.demo")}</strong> {t(lang, "sub.demoText")}
        </p>
      )}

      {sub && (
        <div className="mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="font-semibold text-ink">
            {t(lang, sub.status === "ACTIVE" ? "sub.statusActive" : "sub.statusCanceled", {
              plan: t(lang, `sub.planLower.${sub.plan}`),
            })}
          </p>
          <p className="mt-1 text-sm text-muted">
            {sub.status === "ACTIVE"
              ? t(lang, "sub.activeUntil", { date: dateOf(sub.endsAt, lang) })
              : t(lang, "sub.canceledUntil", { date: dateOf(sub.endsAt, lang) })}
          </p>
          {sub.status === "ACTIVE" && (
            <form action={cancelSubscription} className="mt-3">
              <button type="submit" className="text-sm font-medium text-red-600 underline underline-offset-4">
                {t(lang, "sub.cancel")}
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
                  {t(lang, "sub.save", { amount: formatMoney(saving, yearly!.currency, lang) })}
                </span>
              )}
              <h2 className="font-display text-2xl font-semibold text-brand">{t(lang, `sub.plan.${plan}`)}</h2>
              {price ? (
                <p className="mt-2">
                  <span className="font-display text-3xl font-semibold text-ink">{formatMoney(price.amount, price.currency, lang)}</span>
                  <span className="text-muted"> {t(lang, "sub.per", { period: t(lang, `sub.period.${plan}`) })}</span>
                </p>
              ) : (
                <p className="mt-2 text-muted">{t(lang, "sub.priceSoon")}</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-ink">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span aria-hidden className="text-gold">✓</span>
                    {t(lang, b)}
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-2">
                {!price ? (
                  <button type="button" disabled className="btn btn-primary w-full opacity-50">
                    {t(lang, "sub.unavailable")}
                  </button>
                ) : user ? (
                  <form action={startSubscription}>
                    <input type="hidden" name="plan" value={plan} />
                    <button type="submit" className="btn btn-primary w-full">
                      {sub ? t(lang, "sub.extend") : t(lang, "sub.subscribe")} · {t(lang, `sub.planLower.${plan}`)}
                    </button>
                  </form>
                ) : (
                  <Link href="/connexion" className="btn btn-primary w-full">
                    {t(lang, "sub.signinToSub")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        <p className="font-semibold text-ink">{t(lang, "sub.before")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            {t(lang, "sub.rulePrice", { country: country ? ` (${countryName(country, lang)})` : "" })}
          </li>
          <li>{t(lang, "sub.ruleDuration")}</li>
          <li>{t(lang, "sub.ruleRenewal")}</li>
          <li>{t(lang, "sub.ruleCancel")}</li>
        </ul>
      </div>
    </>
  );
}
