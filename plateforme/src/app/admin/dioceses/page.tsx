import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { REFERENTIAL_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { countryName } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
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

// Écran authentifié et bilingue : il lit les cookies (langue, session), donc il ne peut pas être prérendu.
export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "dioAdm.title")} — CCC` };
}

export default async function DiocesesAdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "mod.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "dioAdm.title")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">{t(lang, "dioAdm.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <DiocesesContent />
      </Suspense>
    </main>
  );
}

async function DiocesesContent() {
  await requireStaff(REFERENTIAL_ROLES);
  const lang = await getLang();

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
          {t(lang, "dioAdm.referential", { d: dioceses.length, p: totalParishes })}
        </h2>

        {dioceses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "dioAdm.empty")}</p>
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
                        {countryName(d.country, lang)} · {t(lang, "dioAdm.parishes", { n: d.parishes.length })} ·{" "}
                        {t(lang, "dioAdm.members", { n: members })} ·{" "}
                        <span className={d.active ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                          {d.active ? t(lang, "dioAdm.active") : t(lang, "dioAdm.inactive")}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t(lang, "dioAdm.accounts", {
                          list:
                            accounts
                              .filter((a) => a.diocese.id === d.id)
                              .map(
                                (a) =>
                                  `${a.user.email ?? t(lang, "dioAdm.noEmail")} (${
                                    a.role === "ADMIN" ? t(lang, "dioAdm.roleAdminShort") : t(lang, "dioAdm.roleViewerShort")
                                  })`,
                              )
                              .join(" · ") || t(lang, "dioAdm.noAccount"),
                        })}
                      </p>
                    </div>
                    <form action={toggleDiocese}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                      >
                        {d.active ? t(lang, "adsAdm.deactivate") : t(lang, "adsAdm.activate")}
                      </button>
                    </form>
                    <Link
                      href={`/diocese?diocese=${d.id}`}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                    >
                      {t(lang, "dioAdm.space")}
                    </Link>
                  </div>

                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-brand">
                      {t(lang, "dioAdm.editOrDelete")}
                    </summary>
                    <div className="mt-3 flex flex-col gap-4 rounded-xl bg-paper/50 p-3">
                      <ActionForm action={updateDiocese} submitLabel={t(lang, "adm.save")} lang={lang}>
                        <input type="hidden" name="id" value={d.id} />
                        <Field label={t(lang, "dioAdm.fieldName")} name="name" defaultValue={d.name} />
                        <Field
                          label={t(lang, "dioAdm.fieldCountry")}
                          name="country"
                          defaultValue={d.country}
                          hint={t(lang, "dioAdm.hintCountry")}
                        />
                      </ActionForm>
                      <div className="border-t border-line pt-3">
                        <p className="mb-2 text-xs text-muted">{t(lang, "dioAdm.deleteNote")}</p>
                        <ActionForm action={deleteDiocese} submitLabel={t(lang, "dioAdm.deleteForever")} lang={lang}>
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
                                {p.city ?? t(lang, "dioAdm.cityMissing")} · {t(lang, "dioAdm.members", { n: p._count.users })} ·{" "}
                                {p.mergedIntoId ? (
                                  <span className="font-semibold text-amber-600">
                                    {t(lang, "dioAdm.mergedInto", { name: mergedInto?.name ?? t(lang, "dioAdm.mergedUnknown") })}
                                  </span>
                                ) : (
                                  <span className={p.active ? "text-emerald-600" : "font-semibold text-amber-600"}>
                                    {p.active ? t(lang, "dioAdm.activeF") : t(lang, "dioAdm.inactiveF")}
                                  </span>
                                )}
                              </p>
                            </div>
                            <details className="text-sm">
                              <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-brand/5">
                                {t(lang, "dioAdm.manage")}
                              </summary>
                              <div className="mt-3 flex flex-col gap-3 rounded-xl bg-paper/50 p-3">
                                <div>
                                  <p className="mb-2 text-xs font-semibold text-brand">{t(lang, "dioAdm.rename")}</p>
                                  <ActionForm action={renameParish} submitLabel={t(lang, "adm.save")} lang={lang}>
                                    <input type="hidden" name="id" value={p.id} />
                                    <Field label={t(lang, "dioAdm.fieldName")} name="name" defaultValue={p.name} />
                                    <Field
                                      label={t(lang, "dioAdm.fieldCity")}
                                      name="city"
                                      required={false}
                                      defaultValue={p.city ?? ""}
                                    />
                                  </ActionForm>
                                </div>

                                {!p.mergedIntoId && others.length > 1 && (
                                  <div>
                                    <p className="mb-2 text-xs font-semibold text-brand">{t(lang, "dioAdm.mergeInto")}</p>
                                    <form action={mergeParish} className="flex flex-wrap items-end gap-2">
                                      <input type="hidden" name="id" value={p.id} />
                                      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-ink">
                                        {t(lang, "dioAdm.mergeTarget")}
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
                                        {t(lang, "dioAdm.merge")}
                                      </button>
                                    </form>
                                    <p className="mt-1 text-xs text-muted">{t(lang, "dioAdm.mergeNote", { n: p._count.users })}</p>
                                  </div>
                                )}

                                {!p.mergedIntoId && (
                                  <form action={toggleParish}>
                                    <input type="hidden" name="id" value={p.id} />
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5"
                                    >
                                      {p.active ? t(lang, "dioAdm.deactivateParish") : t(lang, "dioAdm.reactivateParish")}
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
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "dioAdm.addDiocese")}</h2>
          <ActionForm action={createDiocese} submitLabel={t(lang, "adm.save")} lang={lang}>
            <Field label={t(lang, "dioAdm.fieldName")} name="name" hint={t(lang, "dioAdm.hintDioceseName")} />
            <Field label={t(lang, "dioAdm.fieldCountry")} name="country" hint={t(lang, "dioAdm.hintCountry")} />
          </ActionForm>
        </section>

        <section className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "dioAdm.addParish")}</h2>
          <ActionForm action={createParish} submitLabel={t(lang, "adm.save")} lang={lang}>
            <SelectField
              label={t(lang, "dioAdm.fieldDiocese")}
              name="dioceseId"
              options={dioceses.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Field label={t(lang, "dioAdm.fieldName")} name="name" hint={t(lang, "dioAdm.hintParishName")} />
            <Field label={t(lang, "dioAdm.fieldCity")} name="city" required={false} hint={t(lang, "dioAdm.hintCity")} />
          </ActionForm>
        </section>

        <section className="h-fit rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-brand">{t(lang, "dioAdm.addAdmin")}</h2>
          <ActionForm action={createDioceseAdmin} submitLabel={t(lang, "dioAdm.createAccount")} lang={lang}>
            <Field label={t(lang, "dioAdm.fieldEmail")} name="email" type="email" hint={t(lang, "dioAdm.hintEmail")} />
            <Field label={t(lang, "dioAdm.fieldFullName")} name="name" hint={t(lang, "dioAdm.hintFullName")} />
            <SelectField
              label={t(lang, "dioAdm.fieldDiocese")}
              name="dioceseId"
              options={dioceses.map((d) => ({ value: d.id, label: d.name }))}
            />
            <SelectField
              label={t(lang, "dioAdm.fieldRole")}
              name="role"
              options={[
                { value: "ADMIN", label: t(lang, "dioAdm.roleAdminFull") },
                { value: "VIEWER", label: t(lang, "dioAdm.roleViewerFull") },
              ]}
            />
          </ActionForm>
        </section>
      </div>

      <section id="comptes" className="lg:col-span-2">
        <h2 className="mb-1 font-display text-xl font-semibold text-brand">
          {t(lang, "dioAdm.accountsTitle", { n: accounts.length })}
        </h2>
        <p className="mb-3 max-w-3xl text-sm text-muted">{t(lang, "dioAdm.accountsLead")}</p>
        {accounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-muted">{t(lang, "dioAdm.accountsEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {accounts.map((a) => {
              const disabled = Boolean(a.user.disabledAt);
              return (
                <li key={a.user.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {a.user.name ?? a.user.email ?? t(lang, "dioAdm.noName")}
                        {disabled && <span className="text-xs font-semibold text-amber-600">{t(lang, "dioAdm.disabledTag")}</span>}
                      </p>
                      <p className="text-xs text-muted">
                        {a.user.email ?? t(lang, "dioAdm.noEmail")} · {a.diocese.name} ·{" "}
                        <span className="font-semibold text-brand">
                          {a.role === "ADMIN" ? t(lang, "dioAdm.roleAdminShort") : t(lang, "dioAdm.roleViewerShort")}
                        </span>
                      </p>
                    </div>
                    <details className="w-full text-sm">
                      <summary className="inline-block cursor-pointer list-none rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-brand/5">
                        {t(lang, "dioAdm.manageAccount")}
                      </summary>
                      <div className="mt-3 flex w-full max-w-md flex-col gap-4 rounded-xl bg-paper/50 p-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-brand">{t(lang, "dioAdm.roleLabel")}</p>
                          <ActionForm action={updateDioceseAdminRole} submitLabel={t(lang, "dioAdm.changeRole")} lang={lang}>
                            <input type="hidden" name="userId" value={a.user.id} />
                            <SelectField
                              label={t(lang, "dioAdm.roleLabel")}
                              name="role"
                              defaultValue={a.role}
                              options={[
                                { value: "ADMIN", label: t(lang, "dioAdm.roleAdminExport") },
                                { value: "VIEWER", label: t(lang, "dioAdm.roleViewerFull") },
                              ]}
                            />
                          </ActionForm>
                        </div>
                        <div className="border-t border-line pt-3">
                          <p className="mb-2 text-xs font-semibold text-brand">{t(lang, "dioAdm.password")}</p>
                          <ActionForm action={resetDioceseAdminPassword} submitLabel={t(lang, "dioAdm.resetPassword")} lang={lang}>
                            <input type="hidden" name="userId" value={a.user.id} />
                            <p className="text-xs text-muted">{t(lang, "dioAdm.resetNote")}</p>
                          </ActionForm>
                        </div>
                        <div className="border-t border-line pt-3">
                          <ActionForm
                            action={toggleDioceseAdmin}
                            submitLabel={disabled ? t(lang, "dioAdm.reactivateAccount") : t(lang, "dioAdm.deactivateAccount")}
                            lang={lang}
                          >
                            <input type="hidden" name="userId" value={a.user.id} />
                            <p className="text-xs text-muted">
                              {disabled ? t(lang, "dioAdm.reactivateNote") : t(lang, "dioAdm.deactivateNote")}
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
