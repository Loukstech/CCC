import Link from "next/link";
import { ActionForm, Field, TextAreaField, SelectField } from "@/components/ActionForm";
import { DashboardCard, StatCard, TrendChart, compact, type ChartSeries } from "@/components/dashboard";
import { requireWriterAccess } from "@/lib/writer-access";
import { getWriterAudience } from "@/lib/audience";
import { db } from "@/lib/db";
import { getWriterDashboard } from "@/lib/dashboard";
import { formatMoney } from "@/lib/currency";
import { balanceOf, statement } from "@/lib/ledger";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { saveWriterProfile, submitManuscript } from "@/app/actions/writer";

// Écran authentifié et bilingue : il lit les cookies, il ne peut donc pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "ecr.title")} — CCC` };
}

const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
const h2 = "font-display text-xl font-semibold text-brand";
const day = (d: Date, lang: Lang) => d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" });

export default function WriterPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Writer />
    </main>
  );
}

async function Writer() {
  // Lot 8 : quand PARTNER_CODE_REQUIRED=true, seul un profil d'auteur APPROUVÉ (code de
  // partenariat consommé ou validation en back-office) peut ouvrir l'espace écrivain.
  const user = await requireWriterAccess();
  const lang = await getLang();
  const now = new Date();

  const [profile, works, balance, ledger, manuscripts, reviews, stats, audience] = await Promise.all([
    db.writerProfile.findUnique({ where: { userId: user.id } }),
    db.work.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, type: true, status: true, access: true },
    }),
    balanceOf("WRITER", { userId: user.id }, "XOF"),
    statement("WRITER", { userId: user.id }, "XOF"),
    db.manuscript.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, reviewerNote: true, createdAt: true },
    }),
    db.review.findMany({
      where: { work: { authorId: user.id }, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        rating: true,
        body: true,
        createdAt: true,
        user: { select: { name: true } },
        work: { select: { slug: true, title: true } },
      },
    }),
    getWriterDashboard(user.id, now),
    getWriterAudience(user.id, lang, now),
  ]);

  const earned = ledger.months.reduce((n, m) => n + m.earned + m.refunded, 0);
  const paid = ledger.months.reduce((n, m) => n + m.paid, 0);
  const typeKey = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;
  const months = stats.trend.map((m) => m.key);
  const series: ChartSeries[] = [
    {
      label: t(lang, "wr.trend.sales"),
      values: stats.trend.map((m) => m.sales),
      color: "var(--brand)",
      format: (n) => String(n),
    },
    {
      label: t(lang, "wr.trend.reads"),
      values: stats.trend.map((m) => m.reads),
      color: "var(--gold)",
      format: (n) => String(n),
    },
  ];
  const audienceEvents = audience.totals.views + audience.totals.downloads + audience.totals.plays;
  const audienceMonths = audience.trend.map((m) => m.key);
  const audienceLabels = audience.trend.map((m) => m.label);
  const audienceSeries: ChartSeries[] = [
    {
      label: t(lang, "wr.analytics.views"),
      values: audience.trend.map((m) => m.views),
      color: "var(--brand)",
      format: (n) => String(n),
    },
    {
      label: t(lang, "wr.analytics.downloads"),
      values: audience.trend.map((m) => m.downloads),
      color: "var(--gold)",
      format: (n) => String(n),
    },
    {
      label: t(lang, "wr.analytics.plays"),
      values: audience.trend.map((m) => m.plays),
      color: "var(--brand-light)",
      format: (n) => String(n),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "ecr.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "ecr.lead")}</p>
      </header>

      {/* Vue d'ensemble : indicateurs financiers ET d'audience, pour ne pas réduire l'espace
          auteur à un simple relevé de ventes souvent vide en phase de démonstration. */}
      <section aria-label={t(lang, "wr.overview")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t(lang, "ecr.works", { n: works.length })} value={String(works.length)} hint={t(lang, "wr.hint.works")} />
        <StatCard label={t(lang, "ecr.sales")} value={String(stats.totals.sales)} hint={t(lang, "wr.hint.sales")} />
        <StatCard label={t(lang, "wr.reads")} value={compact(stats.totals.reads, lang)} hint={t(lang, "wr.hint.reads")} accent="gold" />
        <StatCard label={t(lang, "ecr.balance")} value={formatMoney(balance, "XOF", lang)} hint={t(lang, "wr.hint.balance")} accent="gold" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <DashboardCard title={t(lang, "wr.trend.title")} lead={t(lang, "wr.trend.lead")}>
          <TrendChart months={months} series={series} lang={lang} ariaLabel={t(lang, "wr.trend.title")} />
        </DashboardCard>

        <DashboardCard title={t(lang, "wr.audience.title")} lead={t(lang, "wr.audience.lead")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: t(lang, "wr.favorites"), value: String(stats.totals.favorites) },
              { label: t(lang, "wr.bookmarks"), value: String(stats.totals.bookmarks) },
              { label: t(lang, "wr.reviews"), value: String(stats.totals.reviews) },
              { label: t(lang, "wr.rating"), value: stats.totals.ratingAvg ? `${stats.totals.ratingAvg.toFixed(1)} / 5` : "—" },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-brand/5 px-3 py-2.5">
                <dt className="text-[11px] uppercase tracking-wide text-muted">{x.label}</dt>
                <dd className="font-display mt-0.5 text-xl font-semibold text-brand tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{t(lang, "wr.audience.note")}</p>
        </DashboardCard>
      </div>

      {/* Vraies statistiques d'audience : compteurs cumulés, courbe mensuelle et classement privé. */}
      <DashboardCard
        title={t(lang, "wr.analytics.title")}
        lead={t(lang, "wr.analytics.lead")}
        aside={
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
            {audience.firstDay
              ? t(lang, "wr.analytics.since", { date: day(audience.firstDay, lang) })
              : t(lang, "wr.analytics.noFirst")}
          </span>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
              <StatCard label={t(lang, "wr.analytics.views")} value={compact(audience.totals.views, lang)} />
              <StatCard label={t(lang, "wr.analytics.downloads")} value={compact(audience.totals.downloads, lang)} accent="gold" />
              <StatCard label={t(lang, "wr.analytics.plays")} value={compact(audience.totals.plays, lang)} />
            </div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t(lang, "wr.analytics.trend")}</p>
            <TrendChart
              months={audienceMonths}
              labels={audienceLabels}
              series={audienceSeries}
              lang={lang}
              ariaLabel={t(lang, "wr.analytics.trend")}
            />
          </div>
          <div className="min-w-0 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <h3 className={h2}>{t(lang, "wr.analytics.top")}</h3>
            <p className="mb-2 text-xs text-muted">{t(lang, "wr.analytics.topLead")}</p>
            {audience.top.length === 0 ? (
              <p className="rounded-xl bg-brand/5 px-3 py-4 text-xs text-muted">{t(lang, "wr.analytics.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {audience.top.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <Link href={`/oeuvres/${w.slug}`} className="block truncate font-medium text-ink hover:text-brand hover:underline">
                        {w.title}
                      </Link>
                      <span className="text-xs text-muted">{t(lang, typeKey[w.type as keyof typeof typeKey])}</span>
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-muted">
                      <span className="block font-semibold text-ink tabular-nums">{t(lang, "wr.analytics.workViews", { n: w.views })}</span>
                      {t(lang, "wr.analytics.workDownloads", { n: w.downloads })}
                      {" · "}
                      {t(lang, "wr.analytics.workPlays", { n: w.plays })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t(lang, "wr.analytics.note")}</p>
      </DashboardCard>

      {stats.emptyAudience && audienceEvents === 0 && (
        <p className="rounded-xl border border-gold/40 bg-gold-soft/30 px-4 py-3 text-xs text-ink">
          {t(lang, "wr.emptyAudience")}
        </p>
      )}

      {stats.topWorks.length > 0 && (
        <DashboardCard title={t(lang, "wr.top.title")} lead={t(lang, "wr.top.lead")}>
          <ul className="flex flex-col divide-y divide-line">
            {stats.topWorks.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link href={`/oeuvres/${w.slug}`} className="block truncate font-medium text-ink hover:text-brand hover:underline">
                    {w.title}
                  </Link>
                  <span className="text-xs text-muted">{t(lang, typeKey[w.type])}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted">
                  <span className="block font-semibold text-ink tabular-nums">{t(lang, "wr.top.reads", { n: w.reads })}</span>
                  {t(lang, "wr.top.sales", { n: w.sales })}
                  {w.ratingCount > 0 && ` · ${w.ratingAvg.toFixed(1)} / 5`}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>{t(lang, "ecr.profile")}</h2>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            {t(lang, profile ? `ecr.status.${profile.status}` : "ecr.status.PENDING")}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">{t(lang, "ecr.profileLead")}</p>
        <div className="mt-4">
          <ActionForm action={saveWriterProfile} submitLabel={t(lang, "ecr.save")} lang={lang}>
            <Field label={t(lang, "ecr.penName")} name="penName" required={false} defaultValue={profile?.penName ?? ""} />
            <TextAreaField label={t(lang, "ecr.bio")} name="bio" rows={3} defaultValue={profile?.bio ?? ""} />
            <Field
              label={t(lang, "ecr.payoutNetwork")}
              name="payoutNetwork"
              required={false}
              defaultValue={profile?.payoutNetwork ?? ""}
            />
            <Field
              label={t(lang, "ecr.payoutPhone")}
              name="payoutPhone"
              required={false}
              defaultValue={profile?.payoutPhone ?? ""}
            />
          </ActionForm>
        </div>
      </section>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>{t(lang, "ecr.works", { n: works.length })}</h2>
        {works.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "ecr.noWorks")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {works.map((work) => (
              <li key={work.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/oeuvres/${work.slug}`} className="font-medium text-ink underline-offset-4 hover:underline">
                  {work.title}
                </Link>
                <span className="text-xs text-muted">
                  {t(lang, typeKey[work.type])} · {t(lang, `adm.status.${work.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className={`${h2} mb-3`}>{t(lang, "ecr.statements")}</h2>
          <p className="mb-3 text-xs text-muted">
            {t(lang, "ecr.earned")} : {formatMoney(earned, "XOF", lang)} · {t(lang, "ecr.paid")} : {formatMoney(paid, "XOF", lang)}
          </p>
          {ledger.months.length === 0 ? (
            <p className="text-sm text-muted">{t(lang, "ecr.noStatements")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1">{t(lang, "ecr.month")}</th>
                  <th className="py-1 text-right">{t(lang, "ecr.earned")}</th>
                  <th className="py-1 text-right">{t(lang, "ecr.paid")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.months.map((month) => (
                  <tr key={month.month} className="border-t border-line">
                    <td className="py-1.5">{month.month}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(month.earned + month.refunded, "XOF", lang)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(month.paid, "XOF", lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card}>
          <h2 className={`${h2} mb-3`}>{t(lang, "ecr.payouts")}</h2>
          {ledger.payouts.length === 0 ? (
            <p className="text-sm text-muted">{t(lang, "ecr.noPayouts")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {ledger.payouts.map((payout) => (
                <li key={`${payout.reference}-${payout.createdAt}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{payout.reference}</span>
                    <span className="text-xs text-muted">
                      {day(payout.createdAt, lang)} · {t(lang, `fin.status.${payout.status}`)}
                      {payout.paymentRef ? ` · ${payout.paymentRef}` : ""}
                    </span>
                  </span>
                  <strong className="tabular-nums">{formatMoney(payout.amount, "XOF", lang)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>{t(lang, "ecr.reviews", { n: reviews.length })}</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "ecr.noReviews")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-line p-3">
                <p className="text-xs text-muted">
                  {review.rating}/5 · {review.user.name ?? "—"} · {day(review.createdAt, lang)} ·{" "}
                  <Link href={`/oeuvres/${review.work.slug}`} className="underline underline-offset-2 hover:text-brand">
                    {review.work.title}
                  </Link>
                </p>
                {review.body && <p className="mt-1 text-sm text-ink">{review.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>{t(lang, "ecr.manuscripts", { n: manuscripts.length })}</h2>
        {manuscripts.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "ecr.noManuscripts")}</p>
        ) : (
          <ul className="mb-4 divide-y divide-line">
            {manuscripts.map((manuscript) => (
              <li key={manuscript.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-ink">{manuscript.title}</span>
                <span className="text-xs text-muted">
                  {t(lang, `ecr.msStatus.${manuscript.status}`)} · {day(manuscript.createdAt, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-4 mb-2 text-sm font-semibold text-brand">{t(lang, "ecr.newManuscript")}</h3>
        <ActionForm action={submitManuscript} submitLabel={t(lang, "ecr.submitMs")} lang={lang}>
          <Field label={t(lang, "ecr.msTitle")} name="title" />
          <SelectField
            label={t(lang, "ecr.msLanguage")}
            name="language"
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
          />
          <TextAreaField label={t(lang, "ecr.msSynopsis")} name="synopsis" rows={4} />
          <Field label={t(lang, "ecr.msUrl")} name="fileUrl" type="url" required={false} hint={t(lang, "ecr.msUrlHint")} />
        </ActionForm>
      </section>
    </div>
  );
}
