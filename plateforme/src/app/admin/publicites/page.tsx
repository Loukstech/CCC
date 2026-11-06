import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { getAdDailyStats } from "@/lib/ads";
import { AD_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createAd, deleteAd, toggleAd } from "@/app/actions/ads";

// Écran authentifié et bilingue : il lit les cookies (langue, session), donc il ne peut pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "adsAdm.title")} — CCC` };
}

const PLACEMENTS = ["HOME", "CATALOG", "WORK", "STICKY", "INTERSTITIAL"] as const;
const PLACEMENT_KEY = {
  HOME: "adsAdm.placement.HOME",
  CATALOG: "adsAdm.placement.CATALOG",
  WORK: "adsAdm.placement.WORK",
  STICKY: "adsAdm.placement.STICKY",
  INTERSTITIAL: "adsAdm.placement.INTERSTITIAL",
} as const;

export default async function AdsAdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "mod.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "adsAdm.title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t(lang, "adsAdm.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <AdsContent />
      </Suspense>
    </main>
  );
}

const date = (d: Date | null, lang: Lang) =>
  d ? d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" }) : "—";

/** Taux de clic en pourcentage, arrondi au dixième. */
const ctr = (impressions: number, clicks: number) =>
  impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;

async function AdsContent() {
  await requireStaff(AD_ROLES);
  const lang = await getLang();
  const [ads, daily] = await Promise.all([
    db.ad.findMany({ orderBy: { createdAt: "desc" } }),
    // Sept derniers jours, journées calculées à l'heure du pilote (UTC+1) : c'est la base de la facture.
    getAdDailyStats(7),
  ]);
  const weekImpressions = daily.reduce((n, d) => n + (d._sum.impressions ?? 0), 0);
  const weekClicks = daily.reduce((n, d) => n + (d._sum.clicks ?? 0), 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "adsAdm.list", { n: ads.length })}</h2>
        {ads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "adsAdm.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ads.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">
                      {a.advertiser} · {t(lang, PLACEMENT_KEY[a.placement])}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t(lang, "adsAdm.dates", { from: date(a.startsAt, lang), to: date(a.endsAt, lang) })} ·{" "}
                      {t(lang, "adsAdm.impressions", { n: a.impressions })} ·{" "}
                      {t(lang, "adsAdm.clicks", { n: a.clicks })} ·{" "}
                      {t(lang, "adsAdm.ctr", { p: ctr(a.impressions, a.clicks) })} ·{" "}
                      <span className={a.active ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                        {a.active ? t(lang, "adsAdm.active") : t(lang, "adsAdm.inactive")}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleAd}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
                        {a.active ? t(lang, "adsAdm.deactivate") : t(lang, "adsAdm.activate")}
                      </button>
                    </form>
                    <form action={deleteAd}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                        {t(lang, "adsAdm.delete")}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-display text-lg font-semibold text-brand">{t(lang, "adsAdm.week")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t(lang, "adsAdm.weekTotals", { impressions: weekImpressions, clicks: weekClicks, p: ctr(weekImpressions, weekClicks) })}
          </p>
          {daily.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t(lang, "adsAdm.weekEmpty")}</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted uppercase">
                  <th className="py-1 font-medium">{t(lang, "adsAdm.day")}</th>
                  <th className="py-1 text-right font-medium">{t(lang, "adsAdm.impressionsShort")}</th>
                  <th className="py-1 text-right font-medium">{t(lang, "adsAdm.clicksShort")}</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.day.toISOString()} className="border-t border-line">
                    <td className="py-1">{date(d.day, lang)}</td>
                    <td className="py-1 text-right tabular-nums">{d._sum.impressions ?? 0}</td>
                    <td className="py-1 text-right tabular-nums">{d._sum.clicks ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "adsAdm.add")}</h2>
        <ActionForm action={createAd} submitLabel={t(lang, "adm.save")} lang={lang}>
          <SelectField
            label={t(lang, "adsAdm.placement")}
            name="placement"
            options={PLACEMENTS.map((k) => ({ value: k, label: t(lang, PLACEMENT_KEY[k]) }))}
          />
          <Field label={t(lang, "adsAdm.titleField")} name="title" />
          <Field label={t(lang, "adsAdm.advertiser")} name="advertiser" />
          <Field label={t(lang, "adsAdm.text")} name="text" required={false} hint={t(lang, "adsAdm.hintText")} />
          <Field label={t(lang, "adsAdm.image")} name="imageUrl" required={false} hint={t(lang, "adsAdm.hintImage")} />
          <Field label={t(lang, "adsAdm.link")} name="linkUrl" hint={t(lang, "adsAdm.hintLink")} />
          <Field label={t(lang, "adsAdm.startsAt")} name="startsAt" type="date" required={false} />
          <Field label={t(lang, "adsAdm.endsAt")} name="endsAt" type="date" required={false} />
        </ActionForm>
      </section>
    </div>
  );
}
