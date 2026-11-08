import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { ConsoleCard, Metric, Pill } from "@/components/admin/ConsoleUI";
import {
  DASHBOARD_ROLES,
  EDITORIAL_ROLES,
  FINANCE_ROLES,
  PARTNER_ROLES,
  requireStaff,
} from "@/lib/dal";
import { db } from "@/lib/db";
import { cl, ct, type CKey } from "@/lib/console-i18n";
import { getLang } from "@/lib/lang";
import { getNumber, SETTING_DEFS } from "@/lib/settings";
import { consoleDiagnostics } from "@/lib/console-diag";
import { runConsoleTool } from "@/app/actions/console";
import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Outils d'exploitation. Toutes les actions sont de vraies écritures en base, tracées dans
 * l'audit et protégées par rôle côté serveur. Les exports CSV passent par une route dédiée.
 */
export const instant = false;

export async function generateMetadata() {
  return { title: `${ct(await getLang(), "tool.title")} — CCC` };
}

type ToolDef = {
  id: string;
  title: CKey;
  hint: CKey;
  roles: StaffRole[];
  danger?: boolean;
  withCodes?: boolean;
};

const TOOLS: ToolDef[] = [
  { id: "reconcile", title: "tool.reconcile.title", hint: "tool.reconcile.hint", roles: FINANCE_ROLES },
  { id: "ratings", title: "tool.ratings.title", hint: "tool.ratings.hint", roles: EDITORIAL_ROLES },
  { id: "comments", title: "tool.comments.title", hint: "tool.comments.hint", roles: EDITORIAL_ROLES },
  { id: "codes", title: "tool.codes.title", hint: "tool.codes.hint", roles: PARTNER_ROLES, withCodes: true },
  { id: "revokeCodes", title: "tool.revokeCodes.title", hint: "tool.revokeCodes.hint", roles: PARTNER_ROLES },
  { id: "bulkPublish", title: "tool.bulkPublish.title", hint: "tool.bulkPublish.hint", roles: EDITORIAL_ROLES, danger: true },
  { id: "purgeAudit", title: "tool.purgeAudit.title", hint: "tool.purgeAudit.hint", roles: ["SUPER_ADMIN"], danger: true },
];

const DATASETS: { id: string; label: CKey }[] = [
  { id: "users", label: "tool.export.users" },
  { id: "orders", label: "tool.export.orders" },
  { id: "works", label: "tool.export.works" },
  { id: "subscriptions", label: "tool.export.subscriptions" },
  { id: "audit", label: "tool.export.audit" },
];

export default async function ToolsPage() {
  const user = await requireStaff(DASHBOARD_ROLES);
  const lang = await getLang();
  const role = user.staffRole as StaffRole;
  const [exportLimit, bulkMax, customSettings, auditCount, diag] = await Promise.all([
    getNumber("export_rows_limit"),
    getNumber("bulk_max"),
    db.appSetting.count(),
    db.auditLog.count(),
    consoleDiagnostics(),
  ]);

  const tools = TOOLS.filter((t) => t.roles.includes(role));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{ct(lang, "eyebrow")}</p>
        <h1 className="font-display text-2xl font-semibold text-brand xl:text-3xl">{ct(lang, "tool.title")}</h1>
        <p className="mt-1 max-w-3xl text-xs text-muted">{ct(lang, "tool.lead")}</p>
      </header>

      {/* Exports CSV */}
      <ConsoleCard
        title={ct(lang, "tool.export.title")}
        lead={ct(lang, "tool.export.lead")}
        aside={<Pill tone="brand">{`${exportLimit} ${ct(lang, "col.rows").toLowerCase()} max`}</Pill>}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {DATASETS.map((d) => (
            <a
              key={d.id}
              href={`/admin/exports/${d.id}`}
              download
              className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand/5"
            >
              <span className="truncate">{ct(lang, d.label)}</span>
              <span className="shrink-0 text-[10px] font-semibold text-brand">CSV ↓</span>
            </a>
          ))}
        </div>
      </ConsoleCard>

      {/* Diagnostic */}
      <ConsoleCard title={ct(lang, "tool.diag.title")} lead={ct(lang, "tool.diag.lead")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label={ct(lang, "tool.diag.latency")} value={`${diag.dbLatencyMs} ms`} />
          <Metric label={ct(lang, "tool.diag.tables")} value={String(diag.tableCount)} />
          <Metric label={ct(lang, "tool.diag.settings")} value={`${customSettings} / ${SETTING_DEFS.length}`} tone="gold" />
          <Metric label={ct(lang, "tool.diag.audit")} value={auditCount.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} />
        </div>
      </ConsoleCard>

      {/* Outils */}
      <section aria-label={ct(lang, "tool.title")}>
        <p className="mb-2 text-[11px] text-muted">
          {ct(lang, "common.showing", { n: tools.length })} · {ct(lang, "tool.diag.settings")} : {bulkMax}
        </p>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {tools.map((tool) => (
            <ConsoleCard
              key={tool.id}
              title={ct(lang, tool.title)}
              lead={ct(lang, tool.hint)}
              aside={tool.danger ? <Pill tone="red">{ct(lang, "tool.danger")}</Pill> : undefined}
            >
              <ActionForm action={runConsoleTool} submitLabel={ct(lang, "tool.run")} lang={lang}>
                <input type="hidden" name="tool" value={tool.id} />
                {tool.withCodes && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label={ct(lang, "tool.codes.kind")}
                      name="kind"
                      options={[
                        { value: "WRITER", label: cl(lang, "WRITER") },
                        { value: "DIOCESE", label: cl(lang, "DIOCESE") },
                      ]}
                    />
                    <Field label={ct(lang, "tool.codes.count")} name="count" type="number" defaultValue="1" />
                    <div className="sm:col-span-2">
                      <Field label={ct(lang, "tool.codes.label")} name="label" defaultValue="" />
                    </div>
                  </div>
                )}
              </ActionForm>
            </ConsoleCard>
          ))}
        </div>
        {tools.length === 0 && (
          <p className="rounded-lg border border-line bg-surface px-3 py-6 text-center text-xs text-muted">
            {ct(lang, "tool.denied")}
          </p>
        )}
      </section>
    </div>
  );
}
