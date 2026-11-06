import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { PARTNER_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { CODE_VALIDITY_DAYS, partnerCodesRequired } from "@/lib/partner-codes";
import { createPartnerCode, revokePartnerCode, setWriterStatus } from "@/app/actions/partnerships";

export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "part.title")} — CCC` };
}

const day = (d: Date, lang: Lang) =>
  d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "UTC" });

export default async function PartnershipsAdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "mod.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "part.title")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{t(lang, "part.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <PartnershipsContent />
      </Suspense>
    </main>
  );
}

async function PartnershipsContent() {
  await requireStaff(PARTNER_ROLES);
  const lang = await getLang();
  const now = new Date();
  const gated = partnerCodesRequired();

  const [codes, dioceses, writers] = await Promise.all([
    db.partnerCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, label: true, kind: true, contractRef: true, dioceseId: true,
        expiresAt: true, usedAt: true, revokedAt: true, createdAt: true,
        diocese: { select: { name: true } },
        usedBy: { select: { name: true, email: true } },
      },
    }),
    db.diocese.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, country: true },
    }),
    db.user.findMany({
      where: { OR: [{ writerProfile: { isNot: null } }, { works: { some: {} } }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, name: true, email: true,
        writerProfile: { select: { status: true, penName: true } },
        _count: { select: { works: true } },
      },
    }),
  ]);

  const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
  const h2 = "font-display text-xl font-semibold text-brand";

  return (
    <div className="flex flex-col gap-6">
      <p className={`rounded-xl px-4 py-3 text-sm ring-1 ${gated ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
        {t(lang, gated ? "part.flagOn" : "part.flagOff")}
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className={`${h2} mb-3`}>{t(lang, "part.codesTitle", { n: codes.length })}</h2>
          {codes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
              {t(lang, "part.codesEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {codes.map((c) => {
                const state = c.revokedAt ? "revoked" : c.usedAt ? "used" : c.expiresAt <= now ? "expired" : "available";
                return (
                  <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{c.label}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {t(lang, `part.kind.${c.kind}`)} · {t(lang, `part.status.${state}`)} ·{" "}
                          {t(lang, "part.expires", { date: day(c.expiresAt, lang) })}
                          {c.diocese ? ` · ${c.diocese.name}` : ""}
                          {c.contractRef ? ` · ${c.contractRef}` : ""}
                        </p>
                        {c.usedBy && (
                          <p className="mt-1 text-xs text-muted">
                            {t(lang, "part.usedBy", { name: c.usedBy.name ?? c.usedBy.email ?? "—" })}
                          </p>
                        )}
                      </div>
                      {state === "available" && (
                        <form action={revokePartnerCode}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:border-red-300 hover:text-red-700">
                            {t(lang, "part.revoke")}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${card} h-fit`}>
          <h2 className={`${h2} mb-4`}>{t(lang, "part.newCode")}</h2>
          <ActionForm action={createPartnerCode} lang={lang} submitLabel={t(lang, "part.generate")}>
            <SelectField
              label={t(lang, "part.fieldKind")}
              name="kind"
              options={[
                { value: "WRITER", label: t(lang, "part.kind.WRITER") },
                { value: "DIOCESE", label: t(lang, "part.kind.DIOCESE") },
              ]}
            />
            <Field label={t(lang, "part.fieldLabel")} name="label" hint={t(lang, "part.fieldLabelHint")} />
            <Field label={t(lang, "part.fieldContract")} name="contractRef" required={false} />
            <SelectField
              label={t(lang, "part.fieldDiocese")}
              name="dioceseId"
              options={[
                { value: "", label: t(lang, "part.anyDiocese") },
                ...dioceses.map((d) => ({ value: d.id, label: `${d.name} (${d.country})` })),
              ]}
            />
            <Field
              label={t(lang, "part.fieldDays")}
              name="days"
              type="number"
              defaultValue={String(CODE_VALIDITY_DAYS)}
              hint={t(lang, "part.fieldDaysHint")}
            />
          </ActionForm>
          <p className="mt-3 text-xs text-muted">{t(lang, "part.codeOnce")}</p>
        </section>

        <section className="lg:col-span-2">
          <h2 className={`${h2} mb-1`}>{t(lang, "part.writersTitle", { n: writers.length })}</h2>
          <p className="mb-3 max-w-3xl text-sm text-muted">{t(lang, "part.writersLead")}</p>
          {writers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
              {t(lang, "part.writersEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {writers.map((w) => {
                const status = w.writerProfile?.status ?? "NONE";
                const name = w.name ?? w.email ?? w.id;
                return (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                    <div>
                      <p className="font-semibold text-ink">{name}</p>
                      <p className="text-xs text-muted">
                        {w.email} · {t(lang, "part.works", { n: w._count.works })} ·{" "}
                        <span className="font-semibold text-brand">{t(lang, `part.status.${status}`)}</span>
                      </p>
                    </div>
                    <ActionForm action={setWriterStatus} lang={lang} submitLabel={t(lang, "part.saveStatus")}>
                      <input type="hidden" name="userId" value={w.id} />
                      <SelectField
                        label={t(lang, "part.statusLabel")}
                        name="status"
                        defaultValue={status === "NONE" ? "PENDING" : status}
                        options={[
                          { value: "PENDING", label: t(lang, "part.status.PENDING") },
                          { value: "APPROVED", label: t(lang, "part.status.APPROVED") },
                          { value: "REJECTED", label: t(lang, "part.status.REJECTED") },
                        ]}
                      />
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
