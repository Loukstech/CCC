import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deletePrice, savePrice, saveRights, saveVideoKey } from "@/app/actions/admin-works";
import { ActionForm, CheckField, CheckGroup, Field, SelectField } from "@/components/ActionForm";
import { COUNTRIES, countryName, currencyOf } from "@/lib/countries";
import { formatMoney } from "@/lib/currency";
import { CATALOG_ROLES, FILE_ROLES, PRICE_ROLES, RIGHTS_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import type { EpubError } from "@/lib/epub";

// Écran authentifié et bilingue : il lit les cookies (langue, session), donc il ne peut pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "wk.title")} — CCC` };
}

const TYPE_KEY = { BOOK: "type.BOOK", FILM: "type.FILM", DOCUMENTARY: "type.DOCUMENTARY" } as const;
const STATUS_KEY = { DRAFT: "adm.status.DRAFT", PUBLISHED: "adm.status.PUBLISHED", ARCHIVED: "adm.status.ARCHIVED" } as const;
const EPUB_KEY = {
  vide: "wk.epubEmpty",
  taille: "wk.epubSize",
  format: "wk.epubFormat",
  illisible: "wk.epubUnreadable",
} as const;

export default async function ManageWorkPage({ params, searchParams }: PageProps<"/admin/oeuvres/[id]">) {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-5">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "wk.back")}
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">{t(lang, "adm.loading")}</p>}>
        <Manage params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
const h2 = "font-display text-xl font-semibold text-brand";

async function Manage({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/oeuvres/[id]">["params"];
  searchParams: PageProps<"/admin/oeuvres/[id]">["searchParams"];
}) {
  const staff = await requireStaff(CATALOG_ROLES);
  const lang = await getLang();
  const { id } = await params;
  const query = await searchParams;

  const work = await db.work.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      status: true,
      access: true,
      fileKey: true,
      prices: { orderBy: { country: "asc" }, select: { id: true, country: true, currency: true, amount: true } },
      licenses: { orderBy: { createdAt: "asc" }, select: { countries: true, contractRef: true, allowWeb: true, allowOffline: true, startsAt: true, endsAt: true } },
    },
  });
  if (!work) notFound();

  const role = staff.staffRole!;
  const canFile = FILE_ROLES.includes(role);
  const canRights = RIGHTS_ROLES.includes(role);
  const canPrice = PRICE_ROLES.includes(role);
  const license = work.licenses[0];
  const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const fileError = typeof query.erreur === "string" ? query.erreur : null;
  const typeError = fileError === "type" ? t(lang, "wk.typeErr") : null;
  const epubError =
    fileError === "stockage"
      ? t(lang, "wk.storageErr")
      : fileError && fileError in EPUB_KEY
        ? t(lang, EPUB_KEY[fileError as EpubError])
        : null;
  const known = new Set<string>(COUNTRIES.map((c) => c.code));
  const countryOptions = [
    ...COUNTRIES.map((c) => ({ value: c.code, label: countryName(c.code, lang) })),
    ...(license?.countries ?? []).filter((c) => !known.has(c)).map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="mt-4 flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-brand">{work.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {t(lang, TYPE_KEY[work.type])} · {t(lang, STATUS_KEY[work.status])} ·{" "}
          <Link href={`/oeuvres/${work.slug}`} className="underline underline-offset-4 hover:text-brand">
            {t(lang, "wk.seePublic")}
          </Link>
        </p>
      </header>

      {work.type === "BOOK" && (
        <section className={card}>
          <h2 className={h2}>{t(lang, "wk.bookFile")}</h2>
          <p className="mt-1 text-sm text-muted">{work.fileKey ? t(lang, "wk.filePresent") : t(lang, "wk.fileAbsent")}</p>
          {query.ok === "fichier" && (
            <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">
              {t(lang, "wk.fileSaved")}
            </p>
          )}
          {(epubError || typeError) && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {epubError ?? typeError}
            </p>
          )}
          {canFile ? (
            <form action={`/api/admin/works/${work.id}/file`} method="post" encType="multipart/form-data" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                name="file"
                required
                accept=".epub,application/epub+zip"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />
              <button type="submit" className="btn btn-primary">
                {work.fileKey ? t(lang, "wk.replaceFile") : t(lang, "wk.uploadFile")}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">{t(lang, "wk.roleNoFile")}</p>
          )}
          <p className="mt-2 text-xs text-muted">{t(lang, "wk.fileFormat")}</p>
        </section>
      )}

      {work.type !== "BOOK" && (
        <section className={card}>
          <h2 className={h2}>{t(lang, "wk.video")}</h2>
          <p className="mt-1 text-sm text-muted">{work.fileKey ? t(lang, "wk.videoPresent") : t(lang, "wk.videoAbsent")}</p>
          {canFile ? (
            <div className="mt-4">
              <ActionForm action={saveVideoKey} submitLabel={t(lang, "adm.save")} lang={lang}>
                <input type="hidden" name="workId" value={work.id} />
                <Field
                  label={t(lang, "wk.videoKey")}
                  name="videoKey"
                  required={false}
                  defaultValue={work.fileKey ?? ""}
                  hint={t(lang, "wk.videoKeyHint")}
                />
              </ActionForm>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t(lang, "wk.roleNoVideo")}</p>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className={h2}>{t(lang, "wk.rights")}</h2>
        {canRights ? (
          <div className="mt-4">
            <ActionForm action={saveRights} submitLabel={t(lang, "wk.saveRights")} lang={lang}>
              <input type="hidden" name="workId" value={work.id} />
              <CheckGroup
                label={t(lang, "wk.rightsCountries")}
                name="countries"
                options={countryOptions}
                defaultValues={license?.countries ?? []}
              />
              <Field label={t(lang, "wk.contract")} name="contractRef" required={false} defaultValue={license?.contractRef ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t(lang, "wk.from")} name="startsAt" type="date" required={false} defaultValue={day(license?.startsAt)} />
                <Field label={t(lang, "wk.to")} name="endsAt" type="date" required={false} defaultValue={day(license?.endsAt)} />
              </div>
              <CheckField label={t(lang, "wk.allowWeb")} name="allowWeb" defaultChecked={license?.allowWeb ?? true} />
              <CheckField label={t(lang, "wk.allowOffline")} name="allowOffline" defaultChecked={license?.allowOffline ?? false} />
            </ActionForm>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {t(lang, "wk.rightsReadonly", {
              countries:
                (license?.countries ?? []).map((c) => countryName(c, lang)).join(", ") || t(lang, "wk.none"),
            })}
          </p>
        )}
      </section>

      {work.access === "PURCHASE" && (
        <section className={card}>
          <h2 className={h2}>{t(lang, "wk.prices")}</h2>
          <ul className="mt-3 divide-y divide-line">
            {work.prices.length === 0 && <li className="py-2 text-sm text-muted">{t(lang, "wk.noPrices")}</li>}
            {work.prices.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {countryName(p.country, lang)} — <strong>{formatMoney(p.amount, p.currency, lang)}</strong>
                </span>
                {canPrice && (
                  <form action={deletePrice}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50">
                      {t(lang, "wk.remove")}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canPrice ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-sm font-medium text-ink">{t(lang, "wk.addPrice")}</p>
              <ActionForm action={savePrice} submitLabel={t(lang, "wk.savePrice")} lang={lang}>
                <input type="hidden" name="workId" value={work.id} />
                <SelectField
                  label={t(lang, "wk.country")}
                  name="country"
                  options={COUNTRIES.map((c) => ({ value: c.code, label: `${countryName(c.code, lang)} (${currencyOf(c.code)})` }))}
                />
                <Field label={t(lang, "wk.amount")} name="amount" type="text" hint={t(lang, "wk.amountHint")} />
              </ActionForm>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t(lang, "wk.roleNoPrice")}</p>
          )}
        </section>
      )}
    </div>
  );
}
