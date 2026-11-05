import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, CheckField, Field, SelectField } from "@/components/ActionForm";
import { CATALOG_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createWork, setWorkStatus } from "@/app/actions/works";

// Écran authentifié et bilingue : il lit les cookies (langue, session), donc il ne peut pas être
// prérendu. On autorise explicitement le rendu bloquant plutôt que d'afficher une coquille vide.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "adm.title")} — CCC` };
}

const TYPE_KEY = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;
const STATUS_KEY = { DRAFT: "adm.status.DRAFT", PUBLISHED: "adm.status.PUBLISHED", ARCHIVED: "adm.status.ARCHIVED" } as const;
const ACCESS_KEY = { FREE: "access.FREE", PURCHASE: "access.PURCHASE", SUBSCRIPTION: "access.SUBSCRIPTION" } as const;

export default async function AdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-brand">{t(lang, "adm.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/moderation"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            {t(lang, "adm.moderation")}
          </Link>
          <Link
            href="/admin/dioceses"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            {t(lang, "adm.dioceses")}
          </Link>
          <Link
            href="/admin/publicites"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            {t(lang, "adm.ads")}
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  await requireStaff(CATALOG_ROLES);
  const lang = await getLang();
  const works = await db.work.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      fileKey: true,
      licenses: { select: { countries: true, contractRef: true } },
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">{t(lang, "adm.works", { n: works.length })}</h2>
        {works.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "adm.worksEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {works.map((w) => {
              const documented = w.licenses.some((l) => l.countries.length > 0 && l.contractRef);
              return (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  <div>
                    <p className="font-semibold text-ink">{w.title}</p>
                    <p className="text-xs text-muted">
                      {t(lang, TYPE_KEY[w.type])} · {t(lang, STATUS_KEY[w.status])} ·{" "}
                      {documented ? t(lang, "adm.rightsOk") : t(lang, "adm.rightsMissing")}
                      {w.type === "BOOK" && (w.fileKey ? ` · ${t(lang, "adm.fileOk")}` : ` · ${t(lang, "adm.fileMissing")}`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/oeuvres/${w.id}`}
                      className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
                    >
                      {t(lang, "adm.manage")}
                    </Link>
                    <form action={setWorkStatus}>
                      <input type="hidden" name="id" value={w.id} />
                      <input type="hidden" name="status" value={w.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                      <button
                        type="submit"
                        disabled={w.status !== "PUBLISHED" && !documented}
                        className="rounded-full border border-line px-4 py-1.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {w.status === "PUBLISHED" ? t(lang, "adm.unpublish") : t(lang, "adm.publish")}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "adm.addWork")}</h2>
        <ActionForm action={createWork} submitLabel={t(lang, "adm.save")} lang={lang}>
          <Field label={t(lang, "adm.field.title")} name="title" />
          <SelectField
            label={t(lang, "adm.field.type")}
            name="type"
            options={(["BOOK", "DOCUMENTARY", "FILM"] as const).map((v) => ({ value: v, label: t(lang, TYPE_KEY[v]) }))}
          />
          <Field label={t(lang, "adm.field.author")} name="author" required={false} />
          <Field label={t(lang, "adm.field.description")} name="description" required={false} />
          <Field label={t(lang, "adm.field.language")} name="language" defaultValue="fr" />
          <SelectField
            label={t(lang, "adm.field.access")}
            name="access"
            options={(["FREE", "PURCHASE", "SUBSCRIPTION"] as const).map((v) => ({ value: v, label: t(lang, ACCESS_KEY[v]) }))}
          />
          <Field
            label={t(lang, "adm.field.priceXof")}
            name="price"
            type="number"
            required={false}
            hint={t(lang, "adm.hint.priceXof")}
          />

          <fieldset className="flex flex-col gap-3 rounded-2xl bg-gold-soft/50 p-3">
            <legend className="px-1 text-sm font-semibold text-brand">{t(lang, "adm.rights")}</legend>
            <Field
              label={t(lang, "adm.field.countries")}
              name="countries"
              required={false}
              hint={t(lang, "adm.hint.countries")}
            />
            <Field label={t(lang, "adm.field.contract")} name="contractRef" required={false} />
            <CheckField label={t(lang, "adm.field.offline")} name="allowOffline" />
          </fieldset>

          <CheckField label={t(lang, "adm.publishNow")} name="publish" />
        </ActionForm>
      </section>
    </div>
  );
}
