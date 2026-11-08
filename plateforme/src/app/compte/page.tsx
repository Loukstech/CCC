import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { authorizeThisDevice, revokeDevice } from "@/app/actions/devices";
import { cancelSubscription } from "@/app/actions/payments";
import { getActiveSubscription } from "@/lib/access";
import { BookIcon, BookmarkIcon, GlobeIcon, ShieldIcon } from "@/components/icons";
import { countryName } from "@/lib/countries";
import { formatMoney } from "@/lib/currency";
import { getCurrentUser } from "@/lib/dal";
import { DEVICE_LIMIT } from "@/lib/devices";
import { db } from "@/lib/db";
import { t, type Key, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { partnerCodesRequired } from "@/lib/partner-codes";

export const metadata = { title: "Mon compte — CCC" };

const STATUS = {
  PAID: { label: "pay.status.PAID", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  PENDING: { label: "pay.status.PENDING", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  FAILED: { label: "pay.status.FAILED", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  REFUNDED: { label: "pay.status.REFUNDED", cls: "bg-line text-muted" },
} as const satisfies Record<string, { label: Key; cls: string }>;

const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
const h2 = "font-display text-xl font-semibold text-brand";
const dateOf = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Hub des espaces : un seul endroit, visible sur toutes les tailles d'écran, qui liste les accès
 * réellement ouverts au compte. Le header masque ces liens sur téléphone (`sm:block`), et la barre
 * d'onglets mobile n'en contient aucun : sans ce bloc, un administrateur sur mobile ne peut pas
 * rejoindre la console. Les tuiles sont filtrées par rôle pour ne jamais promettre un accès refusé.
 */
async function SpaceLinks({
  lang,
  userId,
  staffRole,
  dioceseId,
}: {
  lang: Lang;
  userId: string;
  staffRole: string | null;
  dioceseId: string | null;
}) {
  const codesRequired = partnerCodesRequired();
  const profile = codesRequired
    ? await db.writerProfile.findUnique({ where: { userId }, select: { status: true } })
    : null;
  const writerAllowed = !codesRequired || profile?.status === "APPROVED";

  const spaces: { href: string; label: Key; hint: Key; icon: typeof BookIcon }[] = [
    { href: "/bibliotheque", label: "space.library", hint: "space.libraryHint", icon: BookmarkIcon },
  ];
  if (staffRole) {
    spaces.unshift({ href: "/admin", label: "space.admin", hint: "space.adminHint", icon: ShieldIcon });
  }
  if (writerAllowed) {
    spaces.push({ href: "/ecrivain", label: "space.writer", hint: "space.writerHint", icon: BookIcon });
  }
  if (dioceseId || staffRole === "SUPER_ADMIN") {
    spaces.push({ href: "/diocese", label: "space.diocese", hint: "space.dioceseHint", icon: GlobeIcon });
  }

  return (
    <section id="espaces" className={card} aria-labelledby="espaces-title">
      <h2 id="espaces-title" className={h2}>{t(lang, "space.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t(lang, "space.lead")}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {spaces.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-brand hover:bg-brand/5"
            >
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{t(lang, label)}</span>
                <span className="block text-xs text-muted">{t(lang, hint)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-5 sm:py-12">
      <Suspense fallback={<p className="mt-6 text-muted" aria-busy="true">…</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const lang = await getLang();
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
    <>
    <h1 className="font-display text-3xl font-semibold text-brand sm:text-4xl">{t(lang, "nav.myAccount")}</h1>
    <div className="mt-6 flex flex-col gap-6">
      <Suspense fallback={<p className="text-muted" aria-busy="true">…</p>}>
        <SpaceLinks lang={lang} userId={user.id} staffRole={user.staffRole} dioceseId={user.dioceseId} />
      </Suspense>
      {!user.deviceOk && devices.length >= DEVICE_LIMIT && (
        <p role="alert" className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100">
          <strong>{t(lang, "account.deviceLimit", { max: DEVICE_LIMIT })}</strong> {t(lang, "account.deviceLimitText")}
        </p>
      )}
      {!user.deviceOk && devices.length < DEVICE_LIMIT && (
        <div role="alert" className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100">
          <p>
            <strong>{t(lang, "account.deviceNew")}</strong>{" "}
            {t(lang, "account.deviceNewText", { used: devices.length, max: DEVICE_LIMIT })}
          </p>
          <form action={authorizeThisDevice} className="mt-3">
            <button type="submit" className="btn btn-primary h-10">
              {t(lang, "account.authorize")}
            </button>
          </form>
        </div>
      )}

      <section className={card}>
        <h2 className={h2}>{t(lang, "account.profile")}</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">{t(lang, "account.name")}</dt>
            <dd className="font-medium text-ink">{user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t(lang, "account.email")}</dt>
            <dd className="font-medium break-all text-ink">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">{t(lang, "account.country")}</dt>
            <dd className="font-medium text-ink">{user.country ? countryName(user.country, lang) : "—"}</dd>
          </div>
        </dl>
      </section>

      <section id="appareils" className={card}>
        <h2 className={h2}>
          {t(lang, "account.devices")} <span className="text-sm font-normal text-muted">({devices.length}/{DEVICE_LIMIT})</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          {t(lang, "account.devicesText")}
        </p>
        <ul className="mt-3 divide-y divide-line">
          {devices.length === 0 && <li className="py-2 text-sm text-muted">{t(lang, "account.noDevice")}</li>}
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {d.name}
                  {d.id === user.deviceId && (
                    <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{t(lang, "account.thisDevice")}</span>
                  )}
                </p>
                <p className="text-xs text-muted">{t(lang, "account.lastSeen", { date: dateOf(d.lastSeenAt, lang) })}</p>
              </div>
              <form action={revokeDevice}>
                <input type="hidden" name="deviceId" value={d.id} />
                <button type="submit" className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                  {t(lang, "account.remove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form action={logout} className="sm:hidden">
        <button type="submit" className="h-11 w-full rounded-xl border border-line text-sm font-medium text-ink">
          {t(lang, "account.logout")}
        </button>
      </form>

      <section className={card}>
        <h2 className={h2}>{t(lang, "account.mySub")}</h2>
        {sub ? (
          <>
            <p className="mt-2 text-sm text-ink">
              {t(lang, "account.planLabel")} <strong>{t(lang, `sub.planLower.${sub.plan}`)}</strong> —{" "}
              {sub.status === "ACTIVE" ? t(lang, "account.stateActive") : t(lang, "account.stateCanceled")}
            </p>
            <p className="mt-1 text-sm text-muted">
              {sub.status === "ACTIVE"
                ? t(lang, "account.activeUntil", { date: dateOf(sub.endsAt, lang) })
                : t(lang, "account.canceledUntil", { date: dateOf(sub.endsAt, lang) })}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link href="/abonnement" className="btn btn-primary h-10">
                {t(lang, "sub.extend")}
              </Link>
              {sub.status === "ACTIVE" && (
                <form action={cancelSubscription}>
                  <button type="submit" className="text-sm font-medium text-red-600 underline underline-offset-4">
                    {t(lang, "account.cancel")}
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t(lang, "account.noSub")}</p>
            <Link href="/abonnement" className="btn btn-primary mt-4 h-10">
              {t(lang, "account.seeSubs")}
            </Link>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className={h2}>{t(lang, "account.purchases")}</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t(lang, "account.noPurchases")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {orders.map((o) => {
              const st = STATUS[o.status];
              const title = o.plan ? t(lang, "sub.name", { plan: t(lang, `sub.planLower.${o.plan}`) }) : (o.work?.title ?? t(lang, "pay.purchase"));
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
                      {dateOf(o.createdAt, lang)} · {t(lang, "pay.ref", { ref: o.id.slice(-8).toUpperCase() })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-ink">{formatMoney(o.amount, o.currency, lang)}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{t(lang, st.label)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
    </>
  );
}
