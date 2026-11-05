import Link from "next/link";
import { Suspense } from "react";
import { MODERATION_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { dismissReport, hideContent, restoreContent } from "@/app/actions/reviews";

// Écran authentifié et bilingue : il lit les cookies (langue, session), donc il ne peut pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "mod.title")} — CCC` };
}

const REASON_KEY = {
  hate: "report.reason.hate",
  defamation: "report.reason.defamation",
  offtopic: "report.reason.offtopic",
  spam: "report.reason.spam",
  other: "report.reason.other",
} as const;

const date = (d: Date, lang: Lang) => d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" });

export default async function ModerationPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "mod.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "mod.title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t(lang, "mod.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <ModerationContent />
      </Suspense>
    </main>
  );
}

async function ModerationContent() {
  await requireStaff(MODERATION_ROLES);
  const lang = await getLang();

  const [reports, hiddenReviews, hiddenComments] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        createdAt: true,
        reporter: { select: { name: true } },
      },
    }),
    db.review.findMany({
      where: { status: "HIDDEN" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        rating: true,
        body: true,
        createdAt: true,
        user: { select: { name: true } },
        work: { select: { slug: true, title: true } },
      },
    }),
    db.comment.findMany({
      where: { status: "HIDDEN" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { name: true } },
        work: { select: { slug: true, title: true } },
      },
    }),
  ]);

  // Les cibles sont polymorphes : on résout les contenus en deux requêtes, puis on associe en mémoire.
  const reviewIds = reports.filter((r) => r.targetType === "REVIEW").map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);
  const [reviewTargets, commentTargets] = await Promise.all([
    reviewIds.length
      ? db.review.findMany({
          where: { id: { in: reviewIds } },
          select: {
            id: true,
            status: true,
            rating: true,
            body: true,
            user: { select: { name: true } },
            work: { select: { slug: true, title: true } },
          },
        })
      : [],
    commentIds.length
      ? db.comment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            status: true,
            body: true,
            user: { select: { name: true } },
            work: { select: { slug: true, title: true } },
          },
        })
      : [],
  ]);

  const reviewsById = new Map(reviewTargets.map((r) => [r.id, r]));
  const commentsById = new Map(commentTargets.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "mod.open", { n: reports.length })}</h2>
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "mod.openEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((r) => {
              const content = r.targetType === "REVIEW" ? reviewsById.get(r.targetId) : commentsById.get(r.targetId);
              const label = r.targetType === "REVIEW" ? t(lang, "mod.review") : t(lang, "mod.comment");
              return (
                <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {label} · {t(lang, REASON_KEY[r.reason as keyof typeof REASON_KEY] ?? "report.reason.other")}
                    </p>
                    <p className="text-xs text-muted">
                      {t(lang, "mod.reportedBy", { name: r.reporter.name ?? "—", date: date(r.createdAt, lang) })}
                    </p>
                  </div>

                  {content ? (
                    <>
                      <p className="mt-2 text-sm text-ink">
                        <span className="font-semibold">{"rating" in content ? `${content.rating}/5 · ` : ""}</span>
                        {content.body || t(lang, "mod.noText")}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t(lang, "mod.by", { name: content.user.name ?? "—" })} · {t(lang, "mod.on")}{" "}
                        <Link href={`/oeuvres/${content.work.slug}`} className="underline underline-offset-2 hover:text-brand">
                          {content.work.title}
                        </Link>{" "}
                        ·{" "}
                        <span className={content.status === "HIDDEN" ? "font-semibold text-amber-600" : "text-emerald-600"}>
                          {content.status === "HIDDEN" ? t(lang, "mod.stateHidden") : t(lang, "mod.statePublished")}
                        </span>
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {content.status !== "HIDDEN" ? (
                          <form action={hideContent}>
                            <input type="hidden" name="targetType" value={r.targetType} />
                            <input type="hidden" name="targetId" value={r.targetId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
                            >
                              {t(lang, "mod.hide")}
                            </button>
                          </form>
                        ) : (
                          <form action={restoreContent}>
                            <input type="hidden" name="targetType" value={r.targetType} />
                            <input type="hidden" name="targetId" value={r.targetId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                            >
                              {t(lang, "mod.restore")}
                            </button>
                          </form>
                        )}
                        <form action={dismissReport}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                          >
                            {t(lang, "mod.dismiss")}
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">{t(lang, "mod.missing")}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">
          {t(lang, "mod.hidden", { n: hiddenReviews.length + hiddenComments.length })}
        </h2>
        {hiddenReviews.length + hiddenComments.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "mod.hiddenEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[
              ...hiddenReviews.map((r) => ({ ...r, targetType: "REVIEW" as const })),
              ...hiddenComments.map((c) => ({ ...c, targetType: "COMMENT" as const })),
            ].map((item) => (
              <li key={`${item.targetType}-${item.id}`} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm text-ink">
                  <span className="font-semibold">
                    {item.targetType === "REVIEW" ? t(lang, "mod.review") : t(lang, "mod.comment")} ·{" "}
                  </span>
                  {"rating" in item ? `${item.rating}/5 · ` : ""}
                  {item.body || t(lang, "mod.noText")}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t(lang, "mod.by", { name: item.user.name ?? "—" })} · {t(lang, "mod.on")}{" "}
                  <Link href={`/oeuvres/${item.work.slug}`} className="underline underline-offset-2 hover:text-brand">
                    {item.work.title}
                  </Link>
                </p>
                <form action={restoreContent} className="mt-3">
                  <input type="hidden" name="targetType" value={item.targetType} />
                  <input type="hidden" name="targetId" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                  >
                    {t(lang, "mod.restore")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
