import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { AD_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { createAd, deleteAd, toggleAd } from "@/app/actions/ads";

export const metadata = { title: "Publicités — CCC" };

const PLACEMENT_LABEL = {
  HOME: "Accueil (bandeau)",
  CATALOG: "Pages Livres, Documentaires, Films (bandeau)",
  WORK: "Fiche d’une œuvre (bandeau)",
  STICKY: "Bandeau fixe en bas de l’écran",
} as const;

export default function AdsAdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← Administration
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">Publicités</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Chaque publicité est affichée avec la mention « Publicité » à l’emplacement choisi. Vérifiez le contenu avant
        de l’activer : il doit respecter l’esprit de la plateforme et la loi.
      </p>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <AdsContent />
      </Suspense>
    </main>
  );
}

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");

async function AdsContent() {
  await requireStaff(AD_ROLES);
  const ads = await db.ad.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">Publicités ({ads.length})</h2>
        {ads.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">
            Aucune publicité. Ajoutez-en une avec le formulaire : elle apparaîtra à l’emplacement choisi.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ads.map((a) => (
              <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">
                      {a.advertiser} · {PLACEMENT_LABEL[a.placement]}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Du {fmt(a.startsAt)} au {fmt(a.endsAt)} · {a.clicks} clic(s) ·{" "}
                      <span className={a.active ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                        {a.active ? "active" : "désactivée"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleAd}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
                        {a.active ? "Désactiver" : "Activer"}
                      </button>
                    </form>
                    <form action={deleteAd}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                        Supprimer
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-display text-xl font-semibold text-brand">Ajouter une publicité</h2>
        <ActionForm action={createAd} submitLabel="Enregistrer">
          <SelectField
            label="Emplacement"
            name="placement"
            options={(Object.keys(PLACEMENT_LABEL) as (keyof typeof PLACEMENT_LABEL)[]).map((k) => ({
              value: k,
              label: PLACEMENT_LABEL[k],
            }))}
          />
          <Field label="Titre" name="title" />
          <Field label="Annonceur" name="advertiser" />
          <Field label="Texte court" name="text" required={false} hint="Facultatif. Sinon le nom de l’annonceur est affiché." />
          <Field label="Adresse de l’image" name="imageUrl" required={false} hint="Facultatif. Lien https:// d’une image (format paysage)." />
          <Field label="Lien de destination" name="linkUrl" hint="Où mène un clic. Doit commencer par https://" />
          <Field label="Début de diffusion" name="startsAt" type="date" required={false} />
          <Field label="Fin de diffusion" name="endsAt" type="date" required={false} />
        </ActionForm>
      </section>
    </div>
  );
}
