import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { REFERENTIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { countryName } from "@/lib/countries";
import {
  createDiocese,
  createDioceseAdmin,
  createParish,
  deleteDiocese,
  mergeParish,
  renameParish,
  resetDioceseAdminPassword,
  toggleDiocese,
  toggleDioceseAdmin,
  toggleParish,
  updateDiocese,
  updateDioceseAdminRole,
} from "@/app/actions/dioceses";

export const metadata = { title: "Diocèses et paroisses — CCC" };

export default function DiocesesAdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        ← Administration
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">Diocèses et paroisses</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Le fidèle choisit son diocèse puis sa paroisse à l’inscription. Une paroisse n’est jamais supprimée : elle est
        désactivée, ou fusionnée dans une autre paroisse du même diocèse, ce qui réaffecte ses fidèles.
      </p>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <DiocesesContent />
      </Suspense>
    </main>
  );
}

async function DiocesesContent() {
  await requireStaff(REFERENTIAL_ROLES);

  const [dioceses, accounts] = await Promise.all([
    db.diocese.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        country: true,
        active: true,
        parishes: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            city: true,
            active: true,
            mergedIntoId: true,
            _count: { select: { users: true } },
          },
        },
      },
    }),
    db.dioceseAdmin.findMany({
      orderBy: [{ diocese: { name: "asc" } }, { createdAt: "asc" }],
      select: {
        role: true,
        createdAt: true,
        diocese: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true, disabledAt: true } },
      },
    }),
  ]);

  const totalParishes = dioceses.reduce((n, d) => n + d.parishes.length, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-brand">
          Référentiel ({dioceses.length} diocèses · {totalParishes} paroisses)
        </h2>

        {dioceses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">
            Aucun diocèse. Ajoutez le premier avec le formulaire.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {dioceses.map((d) => {
              const members = d.parishes.reduce((n, p) => n + p._count.users, 0);
              const others = d.parishes.filter((p) => p.active && !p.mergedIntoId);
              return (
                <li key={d.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{d.name}</p>
                      <p className="text-xs text-muted">
                        {countryName(d.country, "fr")} · {d.parishes.length} paroisse(s) · {members} inscrit(s) ·{" "}
                        <span className={d.active ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                          {d.active ? "actif" : "inactif"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Comptes :{" "}
                        {accounts
                          .filter((a) => a.diocese.id === d.id)
                          .map((a) => `${a.user.email ?? "sans email"} (${a.role === "ADMIN" ? "admin" : "observateur"})`)
                          .join(" · ") || "aucun — le diocèse peut créer son accès"}
                      </p>
                    </div>
                    <form action={toggleDiocese}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                      >
                        {d.active ? "Désactiver" : "Activer"}
                      </button>
                    </form>
                    <Link
                      href={`/diocese?diocese=${d.id}`}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                    >
                      Espace diocèse
                    </Link>
                  </div>

                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-brand">
                      Modifier ou supprimer ce diocèse
                    </summary>
                    <div className="mt-3 flex flex-col gap-4 rounded-xl bg-paper/50 p-3">
                      <ActionForm action={updateDiocese} submitLabel="Enregistrer">
                        <input type="hidden" name="id" value={d.id} />
                        <Field label="Nom" name="name" defaultValue={d.name} />
                        <Field label="Code pays" name="country" defaultValue={d.country} hint="2 lettres : BJ, TG, NG" />
                      </ActionForm>
                      <div className="border-t border-line pt-3">
                        <p className="mb-2 text-xs text-muted">
                          La suppression n’est possible que si aucun fidèle n’est rattaché et qu’aucun compte ne gère
                          ce diocèse. Sinon, désactivez-le.
                        </p>
                        <ActionForm action={deleteDiocese} submitLabel="Supprimer définitivement">
                          <input type="hidden" name="id" value={d.id} />
                        </ActionForm>
                      </div>
                    </div>
                  </details>

                  <ul className="mt-3 flex flex-col divide-y divide-line">
                    {d.parishes.map((p) => {
                      const mergedInto = p.mergedIntoId ? d.parishes.find((x) => x.id === p.mergedIntoId) : null;
                      return (
                        <li key={p.id} className="py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">{p.name}</p>
                              <p className="text-xs text-muted">
                                {p.city ?? "ville à compléter"} · {p._count.users} inscrit(s) ·{" "}
                                {p.mergedIntoId ? (
                                  <span className="font-semibold text-amber-600">
                                    fusionnée dans {mergedInto?.name ?? "une autre paroisse"}
                                  </span>
                                ) : (
                                  <span className={p.active ? "text-emerald-600" : "font-semibold text-amber-600"}>
                                    {p.active ? "active" : "inactive"}
                                  </span>
                                )}
                              </p>
                            </div>
                            <details className="text-sm">
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-brand/5">
                                Gérer
                              </summary>
                              <div className="mt-3 flex flex-col gap-3 rounded-xl bg-paper/50 p-3">
                                <div>
                                  <p className="mb-2 text-xs font-semibold text-brand">Renommer / corriger la ville</p>
                                  <ActionForm action={renameParish} submitLabel="Enregistrer">
                                    <input type="hidden" name="id" value={p.id} />
                                    <Field label="Nom" name="name" defaultValue={p.name} />
                                    <Field label="Ville" name="city" required={false} defaultValue={p.city ?? ""} />
                                  </ActionForm>
                                </div>

                                {!p.mergedIntoId && others.length > 1 && (
                                  <div>
                                    <p className="mb-2 text-xs font-semibold text-brand">Fusionner dans</p>
                                    <form action={mergeParish} className="flex flex-wrap items-end gap-2">
                                      <input type="hidden" name="id" value={p.id} />
                                      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink">
                                        Paroisse de rattachement
                                        <select
                                          name="intoId"
                                          className="h-10 rounded-lg border border-line bg-paper/50 px-2 text-sm"
                                        >
                                          {others
                                            .filter((x) => x.id !== p.id)
                                            .map((x) => (
                                              <option key={x.id} value={x.id}>
                                                {x.name}
                                              </option>
                                            ))}
                                        </select>
                                      </label>
                                      <button
                                        type="submit"
                                        className="h-10 rounded-lg border border-amber-300 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50"
                                      >
                                        Fusionner
                                      </button>
                                    </form>
                                    <p className="mt-1 text-xs text-muted">
                                      Les {p._count.users} fidèle(s) seront réaffecté(s). La paroisse sera désactivée, jamais supprimée.
                                    </p>
                                  </div>
                                )}

                                {!p.mergedIntoId && (
                                  <form action={toggleParish}>
                                    <input type="hidden" name="id" value={p.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                                    >
                                      {p.active ? "Désactiver la paroisse" : "Réactiver la paroisse"}
                                    </button>
                                  </form>
                                )}
                              </div>
                            </details>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <section className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">Ajouter un diocèse</h2>
          <ActionForm action={createDiocese} submitLabel="Enregistrer">
            <Field label="Nom" name="name" hint="Ex. : Diocèse Bénin" />
            <Field label="Code pays" name="country" hint="2 lettres : BJ, TG, NG" />
          </ActionForm>
        </section>

        <section className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">Ajouter une paroisse</h2>
          <ActionForm action={createParish} submitLabel="Enregistrer">
            <SelectField
              label="Diocèse"
              name="dioceseId"
              options={dioceses.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Field label="Nom" name="name" hint="Ex. : Paroisse Mont Sinaï" />
            <Field label="Ville" name="city" required={false} hint="Facultatif. Ex. : Vodjè, Cotonou" />
          </ActionForm>
        </section>

        <section className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">Créer un administrateur diocésain</h2>
          <ActionForm action={createDioceseAdmin} submitLabel="Créer le compte">
            <Field label="Email" name="email" type="email" hint="Ex. : admin-benin@ccc.local" />
            <Field label="Nom complet" name="name" hint="Ex. : Jean Dupont" />
            <SelectField
              label="Diocèse"
              name="dioceseId"
              options={dioceses.map((d) => ({ value: d.id, label: d.name }))}
            />
            <SelectField
              label="Rôle"
              name="role"
              options={[
                { value: "ADMIN", label: "Administrateur (lecture + écriture)" },
                { value: "VIEWER", label: "Observateur (lecture seule)" },
              ]}
            />
          </ActionForm>
        </section>
      </div>

      <section id="comptes" className="lg:col-span-2">
        <h2 className="mb-1 font-display text-xl font-semibold text-brand">
          Comptes diocésains ({accounts.length})
        </h2>
        <p className="mb-3 max-w-3xl text-sm text-muted">
          Un compte par diocèse. « Administrateur » consulte les inscrits et exporte la liste ; « observateur »
          consulte seulement. Désactiver un compte coupe l’accès immédiatement, sans supprimer le diocèse.
        </p>
        {accounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">
            Aucun compte diocésain. Créez-en un avec le formulaire ci-contre, ou laissez un diocèse créer son accès
            depuis la page de connexion.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {accounts.map((a) => {
              const disabled = Boolean(a.user.disabledAt);
              return (
                <li key={a.user.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {a.user.name ?? a.user.email ?? "Compte sans nom"}
                        {disabled && <span className="text-xs font-semibold text-amber-600"> · désactivé</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {a.user.email ?? "sans email"} · {a.diocese.name} ·{" "}
                        <span className="font-semibold text-brand">
                          {a.role === "ADMIN" ? "administrateur" : "observateur"}
                        </span>
                      </p>
                    </div>
                    <details className="w-full text-sm">
                      <summary className="inline-block cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-brand/5">
                        Gérer le compte
                      </summary>
                      <div className="mt-3 flex w-full max-w-md flex-col gap-4 rounded-xl bg-paper/50 p-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-brand">Rôle</p>
                          <ActionForm action={updateDioceseAdminRole} submitLabel="Changer le rôle">
                            <input type="hidden" name="userId" value={a.user.id} />
                            <SelectField
                              label="Rôle"
                              name="role"
                              defaultValue={a.role}
                              options={[
                                { value: "ADMIN", label: "Administrateur (lecture + export)" },
                                { value: "VIEWER", label: "Observateur (lecture seule)" },
                              ]}
                            />
                          </ActionForm>
                        </div>
                        <div className="border-t border-line pt-3">
                          <p className="mb-2 text-xs font-semibold text-brand">Mot de passe</p>
                          <ActionForm action={resetDioceseAdminPassword} submitLabel="Réinitialiser le mot de passe">
                            <input type="hidden" name="userId" value={a.user.id} />
                            <p className="text-xs text-muted">
                              Un mot de passe provisoire s’affichera une seule fois, à transmettre de vive voix.
                            </p>
                          </ActionForm>
                        </div>
                        <div className="border-t border-line pt-3">
                          <ActionForm
                            action={toggleDioceseAdmin}
                            submitLabel={disabled ? "Réactiver le compte" : "Désactiver le compte"}
                          >
                            <input type="hidden" name="userId" value={a.user.id} />
                            <p className="text-xs text-muted">
                              {disabled
                                ? "Le compte ne peut plus se connecter tant qu’il reste désactivé."
                                : "L’accès est coupé immédiatement. Le diocèse et ses inscrits sont conservés."}
                            </p>
                          </ActionForm>
                        </div>
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
