import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, CheckField, Field, SelectField } from "@/components/ActionForm";
import { CATALOG_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { TYPE_LABEL } from "@/lib/catalog";
import { createWork, setWorkStatus } from "@/app/actions/works";

export const metadata = { title: "Administration — CCC" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-brand">Administration du catalogue</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/moderation"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            Modération
          </Link>
          <Link
            href="/admin/dioceses"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            Diocèses et paroisses
          </Link>
          <Link
            href="/admin/publicites"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-brand/5"
          >
            Gérer les publicités
          </Link>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

const STATUS_LABEL = { DRAFT: "Brouillon", PUBLISHED: "Publié", ARCHIVED: "Archivé" } as const;

async function AdminContent() {
  await requireStaff(CATALOG_ROLES);
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
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">Œuvres ({works.length})</h2>
        {works.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">
            Aucune œuvre pour le moment. Ajoutez la première avec le formulaire.
          </p>
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
                      {TYPE_LABEL[w.type]} · {STATUS_LABEL[w.status]} ·{" "}
                      {documented ? "droits documentés" : "droits à documenter"}
                      {w.type === "BOOK" && (w.fileKey ? " · fichier en place" : " · fichier manquant")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/oeuvres/${w.id}`}
                    className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
                  >
                    Gérer
                  </Link>
                  <form action={setWorkStatus}>
                    <input type="hidden" name="id" value={w.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={w.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"}
                    />
                    <button
                      type="submit"
                      disabled={w.status !== "PUBLISHED" && !documented}
                      className="rounded-full border border-line px-4 py-1.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {w.status === "PUBLISHED" ? "Dépublier" : "Publier"}
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
        <h2 className="mb-4 font-display text-xl font-semibold text-brand">Ajouter une œuvre</h2>
        <ActionForm action={createWork} submitLabel="Enregistrer">
          <Field label="Titre" name="title" />
          <SelectField
            label="Type"
            name="type"
            options={[
              { value: "BOOK", label: "Livre" },
              { value: "DOCUMENTARY", label: "Documentaire" },
              { value: "FILM", label: "Film" },
            ]}
          />
          <Field label="Auteur ou réalisateur" name="author" required={false} />
          <Field label="Résumé" name="description" required={false} />
          <Field label="Langue" name="language" defaultValue="fr" />
          <SelectField
            label="Accès"
            name="access"
            options={[
              { value: "FREE", label: "Gratuit" },
              { value: "PURCHASE", label: "Achat à l’unité" },
              { value: "SUBSCRIPTION", label: "Abonnement" },
            ]}
          />
          <Field label="Prix (F CFA)" name="price" type="number" required={false} hint="Seulement pour l’achat à l’unité." />

          <fieldset className="flex flex-col gap-3 rounded-2xl bg-gold-soft/50 p-3">
            <legend className="px-1 text-sm font-semibold text-brand">Droits (obligatoires pour publier)</legend>
            <Field label="Pays autorisés" name="countries" required={false} hint="Codes à 2 lettres séparés par des virgules : BJ, TG, FR" />
            <Field label="Référence du contrat de licence" name="contractRef" required={false} />
            <CheckField label="Téléchargement hors ligne autorisé" name="allowOffline" />
          </fieldset>

          <CheckField label="Publier tout de suite" name="publish" />
        </ActionForm>
      </section>
    </div>
  );
}
