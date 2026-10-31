import { Suspense } from "react";
import { ActionForm, CheckField, Field, SelectField } from "@/components/ActionForm";
import { CATALOG_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { TYPE_LABEL } from "@/lib/catalog";
import { createWork, setWorkStatus } from "@/app/actions/works";

export const metadata = { title: "Administration — CCC" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-[#14213D]">Administration du catalogue</h1>
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
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
      licenses: { select: { countries: true, contractRef: true } },
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#14213D]">Œuvres ({works.length})</h2>
        {works.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500">
            Aucune œuvre pour le moment. Ajoutez la première avec le formulaire.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {works.map((w) => {
              const documented = w.licenses.some((l) => l.countries.length > 0 && l.contractRef);
              return (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{w.title}</p>
                    <p className="text-xs text-zinc-500">
                      {TYPE_LABEL[w.type]} · {STATUS_LABEL[w.status]} ·{" "}
                      {documented ? "droits documentés" : "droits à documenter"}
                    </p>
                  </div>
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
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {w.status === "PUBLISHED" ? "Dépublier" : "Publier"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="h-fit rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-[#14213D]">Ajouter une œuvre</h2>
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

          <fieldset className="flex flex-col gap-3 rounded-lg bg-[#F6EFDD] p-3">
            <legend className="px-1 text-sm font-semibold text-[#14213D]">Droits (obligatoires pour publier)</legend>
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
