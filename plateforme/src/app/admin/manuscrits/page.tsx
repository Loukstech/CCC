import Link from "next/link";
import { Suspense } from "react";
import { EDITORIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { reviewManuscript } from "@/app/actions/manuscripts";

// Écran authentifié et bilingue : il lit les cookies, il ne peut donc pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "ms.title")} — CCC` };
}

const day = (d: Date, lang: Lang) => d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" });

export default async function ManuscriptsPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "ms.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "ms.title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t(lang, "ms.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <Manuscripts />
      </Suspense>
    </main>
  );
}

async function Manuscripts() {
  await requireStaff(EDITORIAL_ROLES);
  const lang = await getLang();
  const manuscripts = await db.manuscript.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      language: true,
      synopsis: true,
      fileUrl: true,
      status: true,
      reviewerNote: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  return manuscripts.length === 0 ? (
    <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "ms.empty")}</p>
  ) : (
    <ul className="flex flex-col gap-3">
      {manuscripts.map((manuscript) => (
        <li key={manuscript.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-ink">
              {manuscript.title} <span className="text-xs font-normal text-muted">({manuscript.language.toUpperCase()})</span>
            </p>
            <p className="text-xs text-muted">
              <span className="font-semibold text-brand">{t(lang, `ms.status.${manuscript.status}`)}</span> ·{" "}
              {day(manuscript.createdAt, lang)}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted">
            {t(lang, "ms.author")} : {manuscript.author.name ?? manuscript.author.email ?? "—"}
          </p>
          {manuscript.synopsis && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{manuscript.synopsis}</p>}
          {manuscript.fileUrl && (
            <p className="mt-1 text-xs">
              <a href={manuscript.fileUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">
                {t(lang, "ms.file")}
              </a>
            </p>
          )}
          {manuscript.reviewerNote && <p className="mt-2 text-xs text-muted">« {manuscript.reviewerNote} »</p>}

          <form action={reviewManuscript} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={manuscript.id} />
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-ink">
              {t(lang, "ms.note")}
              <input
                name="note"
                defaultValue={manuscript.reviewerNote ?? ""}
                className="h-9 rounded-lg border border-line bg-paper/50 px-2 text-sm"
              />
            </label>
            <button type="submit" name="status" value="REVIEWING" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
              {t(lang, "ms.reviewing")}
            </button>
            <button type="submit" name="status" value="ACCEPTED" className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
              {t(lang, "ms.accept")}
            </button>
            <button type="submit" name="status" value="REJECTED" className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50">
              {t(lang, "ms.reject")}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
