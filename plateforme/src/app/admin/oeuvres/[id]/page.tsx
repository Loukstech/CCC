import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deletePrice, savePrice, saveRights } from "@/app/actions/admin-works";
import { ActionForm, CheckField, CheckGroup, Field, SelectField } from "@/components/ActionForm";
import { COUNTRIES, COUNTRY_NAME, currencyOf } from "@/lib/countries";
import { CATALOG_ROLES, FILE_ROLES, PRICE_ROLES, RIGHTS_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { EPUB_ERROR_TEXT, type EpubError } from "@/lib/epub";
import { TYPE_LABEL, formatPrice } from "@/lib/catalog";

export const metadata = { title: "Gérer une œuvre — CCC" };

const STATUS_LABEL = { DRAFT: "Brouillon", PUBLISHED: "Publié", ARCHIVED: "Archivé" } as const;

export default function ManageWorkPage({ params, searchParams }: PageProps<"/admin/oeuvres/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-5">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← Administration
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Chargement…</p>}>
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
  const typeError = fileError === "type" ? "Seuls les livres ont un fichier EPUB." : null;
  const epubError =
    fileError === "stockage"
      ? "Le stockage des fichiers n’est pas configuré sur cet hébergement : l’envoi est impossible pour le moment."
      : fileError && fileError in EPUB_ERROR_TEXT
        ? EPUB_ERROR_TEXT[fileError as EpubError]
        : null;
  const known = new Set<string>(COUNTRIES.map((c) => c.code));
  const countryOptions = [
    ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    ...(license?.countries ?? []).filter((c) => !known.has(c)).map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="mt-4 flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-brand">{work.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {TYPE_LABEL[work.type]} · {STATUS_LABEL[work.status]} ·{" "}
          <Link href={`/oeuvres/${work.slug}`} className="underline underline-offset-4 hover:text-brand">
            voir la fiche publique
          </Link>
        </p>
      </header>

      {work.type === "BOOK" && (
        <section className={card}>
          <h2 className={h2}>Fichier du livre</h2>
          <p className="mt-1 text-sm text-muted">
            {work.fileKey ? "✓ Un fichier EPUB est en place : les lecteurs peuvent ouvrir ce livre." : "Aucun fichier : les lecteurs ne pourront pas lire ce livre."}
          </p>
          {query.ok === "fichier" && <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300">Fichier enregistré.</p>}
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
                {work.fileKey ? "Remplacer le fichier" : "Envoyer le fichier"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">Votre rôle ne permet pas d’envoyer de fichier.</p>
          )}
          <p className="mt-2 text-xs text-muted">Format EPUB, 50 Mo au maximum.</p>
        </section>
      )}

      <section className={card}>
        <h2 className={h2}>Droits et territoires</h2>
        {canRights ? (
          <div className="mt-4">
            <ActionForm action={saveRights} submitLabel="Enregistrer les droits">
              <input type="hidden" name="workId" value={work.id} />
              <CheckGroup
                label="Pays où l’œuvre est autorisée"
                name="countries"
                options={countryOptions}
                defaultValues={license?.countries ?? []}
              />
              <Field label="Référence du contrat de licence" name="contractRef" required={false} defaultValue={license?.contractRef ?? ""} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début (facultatif)" name="startsAt" type="date" required={false} defaultValue={day(license?.startsAt)} />
                <Field label="Fin (facultatif)" name="endsAt" type="date" required={false} defaultValue={day(license?.endsAt)} />
              </div>
              <CheckField label="Lecture sur le web autorisée" name="allowWeb" defaultChecked={license?.allowWeb ?? true} />
              <CheckField label="Téléchargement hors ligne autorisé" name="allowOffline" defaultChecked={license?.allowOffline ?? false} />
            </ActionForm>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Pays : {license?.countries.map((c) => COUNTRY_NAME[c] ?? c).join(", ") || "aucun"}. Seul le gestionnaire des droits peut les modifier.
          </p>
        )}
      </section>

      {work.access === "PURCHASE" && (
        <section className={card}>
          <h2 className={h2}>Prix par pays</h2>
          <ul className="mt-3 divide-y divide-line">
            {work.prices.length === 0 && <li className="py-2 text-sm text-muted">Aucun prix défini.</li>}
            {work.prices.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {COUNTRY_NAME[p.country] ?? p.country} — <strong>{formatPrice(p)}</strong>
                </span>
                {canPrice && (
                  <form action={deletePrice}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="rounded-lg px-2 py-1 text-red-600 hover:bg-red-50">
                      Retirer
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canPrice ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-sm font-medium text-ink">Ajouter ou modifier un prix</p>
              <ActionForm action={savePrice} submitLabel="Enregistrer le prix">
                <input type="hidden" name="workId" value={work.id} />
                <SelectField
                  label="Pays"
                  name="country"
                  options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${currencyOf(c.code)})` }))}
                />
                <Field label="Prix" name="amount" type="text" hint="Dans la devise du pays. Ex. 3000 pour le F CFA, 4,99 pour l’euro." />
              </ActionForm>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Votre rôle ne permet pas de modifier les prix.</p>
          )}
        </section>
      )}
    </div>
  );
}
