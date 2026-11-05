import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Field, TextAreaField, SelectField } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
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
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const lang = await getLang();

  const [profile, works, balance, ledger, manuscripts, reviews] = await Promise.all([
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
  ]);

  const sales = await db.order.aggregate({
    where: { status: "PAID", work: { authorId: user.id } },
    _count: { _all: true },
  });
  const earned = ledger.months.reduce((n, m) => n + m.earned + m.refunded, 0);
  const paid = ledger.months.reduce((n, m) => n + m.paid, 0);
  const typeKey = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "ecr.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t(lang, "ecr.lead")}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t(lang, "ecr.works", { n: works.length }), value: String(works.length) },
          { label: t(lang, "ecr.sales"), value: String(sales._count._all) },
          { label: t(lang, "ecr.balance"), value: formatMoney(balance, "XOF", lang) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="font-display mt-1 text-xl font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </section>

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
