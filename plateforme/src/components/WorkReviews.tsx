import { ActionForm, SelectField, TextAreaField } from "@/components/ActionForm";
import { Stars } from "@/components/Stars";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { REPORT_REASONS } from "@/lib/moderation";
import { BODY_MAX, RATING_MAX } from "@/lib/reviews";
import {
  addComment,
  deleteComment,
  deleteOwnReview,
  reportContent,
  saveReview,
} from "@/app/actions/reviews";

const fmtDate = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

/** Formulaire de signalement, replié par défaut pour ne pas encombrer la page. */
function ReportBox({
  lang,
  slug,
  targetType,
  targetId,
}: {
  lang: Lang;
  slug: string;
  targetType: "REVIEW" | "COMMENT";
  targetId: string;
}) {
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-muted hover:text-brand">{t(lang, "rev.report")}</summary>
      <div className="mt-2 max-w-xs rounded-xl bg-paper/60 p-3">
        <ActionForm action={reportContent} lang={lang} submitLabel={t(lang, "report.submit")}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <SelectField
            label={t(lang, "report.reason")}
            name="reason"
            options={REPORT_REASONS.map((r) => ({ value: r, label: t(lang, `report.reason.${r}` as const) }))}
          />
        </ActionForm>
      </div>
    </details>
  );
}

/**
 * Avis et commentaires d'une œuvre. La publication est immédiate (réponse client) : le contrôle
 * se fait après coup, par signalement puis file de modération.
 */
export async function WorkReviews({
  workId,
  slug,
  lang,
  userId,
}: {
  workId: string;
  slug: string;
  lang: Lang;
  userId: string | null;
}) {
  // Contenus produits par les utilisateurs : rendus à chaque requête, jamais depuis le cache de page.
  await connection();
  const [reviews, mine, comments] = await Promise.all([
    db.review.findMany({
      where: { workId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, rating: true, body: true, createdAt: true, user: { select: { name: true } } },
    }),
    userId
      ? db.review.findUnique({ where: { userId_workId: { userId, workId } }, select: { rating: true, body: true } })
      : null,
    db.comment.findMany({
      where: { workId, status: "PUBLISHED", parentId: null },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true } },
        replies: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, createdAt: true, userId: true, user: { select: { name: true } } },
        },
      },
    }),
  ]);

  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingOptions = [
    // Pas de note par défaut : sans ce choix vide, un avis publié vaudrait 1 étoile par inadvertance.
    { value: "", label: "—" },
    ...Array.from({ length: RATING_MAX }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ★` })),
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-5">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="font-display mb-1 text-2xl font-semibold text-brand">{t(lang, "rev.title")}</h2>
          {reviews.length > 0 ? (
            <p className="mb-4 flex items-center gap-2 text-sm text-muted">
              <Stars value={average} className="text-lg" />
              {t(lang, "rev.summary", { avg: average.toFixed(1), n: reviews.length })}
            </p>
          ) : (
            <p className="mb-4 text-sm text-muted">{t(lang, "rev.none")}</p>
          )}

          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">{r.user.name ?? "—"}</p>
                  <p className="text-xs text-muted">{fmtDate(r.createdAt, lang)}</p>
                </div>
                <Stars value={r.rating} className="text-sm" />
                {r.body && <p className="mt-1 whitespace-pre-line text-sm leading-7 text-ink">{r.body}</p>}
                {userId && <ReportBox lang={lang} slug={slug} targetType="REVIEW" targetId={r.id} />}
              </li>
            ))}
          </ul>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display mb-3 text-lg font-semibold text-brand">{t(lang, "rev.yours")}</h3>
          {userId ? (
            <>
              <ActionForm
                action={saveReview}
                lang={lang}
                submitLabel={t(lang, mine ? "rev.update" : "rev.submit")}
              >
                <input type="hidden" name="workId" value={workId} />
                <input type="hidden" name="slug" value={slug} />
                <SelectField
                  label={t(lang, "rev.rating")}
                  name="rating"
                  options={ratingOptions}
                  defaultValue={mine ? String(mine.rating) : ""}
                />
                <TextAreaField
                  label={t(lang, "rev.body")}
                  name="body"
                  hint={t(lang, "rev.bodyHint")}
                  defaultValue={mine?.body ?? ""}
                />
              </ActionForm>
              {mine && (
                <form action={deleteOwnReview} className="mt-3">
                  <input type="hidden" name="workId" value={workId} />
                  <input type="hidden" name="slug" value={slug} />
                  <button type="submit" className="text-xs text-muted underline underline-offset-2 hover:text-brand">
                    {t(lang, "rev.delete")}
                  </button>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">{t(lang, "rev.signIn")}</p>
          )}
        </aside>
      </div>

      <div className="mt-10">
        <h2 className="font-display mb-3 text-2xl font-semibold text-brand">{t(lang, "cmt.title")}</h2>

        {userId ? (
          <div className="mb-6 max-w-2xl rounded-2xl border border-line bg-surface p-4">
            <ActionForm action={addComment} lang={lang} submitLabel={t(lang, "cmt.submit")}>
              <input type="hidden" name="workId" value={workId} />
              <input type="hidden" name="slug" value={slug} />
              <TextAreaField label={t(lang, "cmt.body")} name="body" hint={`${BODY_MAX} max.`} rows={3} />
            </ActionForm>
          </div>
        ) : (
          <p className="mb-6 text-sm text-muted">{t(lang, "cmt.signIn")}</p>
        )}

        {comments.length === 0 ? (
          <p className="text-sm text-muted">{t(lang, "cmt.none")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {comments.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">{c.user.name ?? "—"}</p>
                  <p className="text-xs text-muted">{fmtDate(c.createdAt, lang)}</p>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-7 text-ink">{c.body}</p>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
                  {userId && <ReportBox lang={lang} slug={slug} targetType="COMMENT" targetId={c.id} />}
                  {userId === c.userId && (
                    <form action={deleteComment}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button type="submit" className="underline underline-offset-2 hover:text-brand">
                        {t(lang, "cmt.delete")}
                      </button>
                    </form>
                  )}
                </div>

                {c.replies.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-4">
                    {c.replies.map((r) => (
                      <li key={r.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{r.user.name ?? "—"}</p>
                          <p className="text-xs text-muted">{fmtDate(r.createdAt, lang)}</p>
                        </div>
                        <p className="mt-0.5 whitespace-pre-line text-sm leading-7 text-ink">{r.body}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
                          {userId && <ReportBox lang={lang} slug={slug} targetType="COMMENT" targetId={r.id} />}
                          {userId === r.userId && (
                            <form action={deleteComment}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="slug" value={slug} />
                              <button type="submit" className="underline underline-offset-2 hover:text-brand">
                                {t(lang, "cmt.delete")}
                              </button>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {userId && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted hover:text-brand">
                      {t(lang, "cmt.replyTo", { name: c.user.name ?? "—" })}
                    </summary>
                    <div className="mt-2 max-w-xl rounded-xl bg-paper/60 p-3">
                      <ActionForm action={addComment} lang={lang} submitLabel={t(lang, "cmt.reply")}>
                        <input type="hidden" name="workId" value={workId} />
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="parentId" value={c.id} />
                        <TextAreaField label={t(lang, "cmt.body")} name="body" rows={2} />
                      </ActionForm>
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
