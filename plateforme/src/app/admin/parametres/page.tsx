import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { ConsoleCard, ConsoleTable, Pill, type TableRow } from "@/components/admin/ConsoleUI";
import { DASHBOARD_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { ct } from "@/lib/console-i18n";
import { getLang } from "@/lib/lang";
import {
  getEnvironment,
  getSettings,
  SETTING_DEFS,
  SETTING_GROUPS,
  type SettingDef,
} from "@/lib/settings";
import { saveSettingsGroup, resetSettingsGroup } from "@/app/actions/console";
import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Paramètres applicatifs. Toutes les valeurs éditables sont réellement consommées par le code :
 * bandeau, maintenance, publicités, modération des avis, coordonnées de contact, préférences de
 * la console et bornes des outils. L'infrastructure reste en lecture seule (variables Vercel).
 */
export const instant = false;

export async function generateMetadata() {
  return { title: `${ct(await getLang(), "set.title")} — CCC` };
}

function SettingField({ def, value, lang }: { def: SettingDef; value: string; lang: "fr" | "en" }) {
  const label = def.label[lang];
  const hint = def.hint[lang];
  if (def.kind === "bool") {
    return (
      <SelectField
        label={label}
        name={def.key}
        defaultValue={value}
        options={[
          { value: "true", label: ct(lang, "common.on") },
          { value: "false", label: ct(lang, "common.off") },
        ]}
      />
    );
  }
  if (def.kind === "select") {
    return (
      <SelectField
        label={label}
        name={def.key}
        defaultValue={value}
        options={(def.options ?? []).map((o) => ({ value: o.value, label: o.label[lang] }))}
      />
    );
  }
  return (
    <Field
      label={label}
      name={def.key}
      type={def.kind === "number" ? "number" : "text"}
      defaultValue={value}
      hint={hint}
      required={def.kind === "number"}
    />
  );
}

export default async function SettingsPage() {
  const user = await requireStaff(DASHBOARD_ROLES);
  const [lang, settings, stored] = await Promise.all([
    getLang(),
    getSettings(),
    db.appSetting.findMany({ select: { key: true, value: true, updatedAt: true, updatedBy: true } }),
  ]);
  const canEdit = (user.staffRole as StaffRole) === "SUPER_ADMIN";
  const byKey = new Map(stored.map((r) => [r.key, r]));
  const env = getEnvironment();
  const dateOf = (d: Date) =>
    d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    });

  const envRows: TableRow[] = env.map((e) => ({
    key: e.id,
    cells: [
      <span key="i" className="font-mono text-[11px] text-brand">{e.id}</span>,
      <span key="l" className="block max-w-[14rem] truncate">{e.label[lang]}</span>,
      <span key="v" className="font-mono text-[11px]">{e.secret ? "••••••••" : e.value}</span>,
      <Pill key="s" tone={e.configured ? "brand" : "neutral"}>
        {e.configured ? ct(lang, "set.env.configured") : ct(lang, "set.env.absent")}
      </Pill>,
      <span key="h" className="block max-w-[18rem] truncate text-muted">{e.hint[lang]}</span>,
    ],
  }));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">{ct(lang, "eyebrow")}</p>
        <h1 className="font-display text-2xl font-semibold text-brand xl:text-3xl">{ct(lang, "set.title")}</h1>
        <p className="mt-1 max-w-3xl text-xs text-muted">{ct(lang, "set.lead", { n: SETTING_DEFS.length })}</p>
        <p className="mt-1 text-[11px] text-muted">{ct(lang, "set.note")}</p>
      </header>

      {!canEdit && (
        <p className="rounded-lg border border-gold/40 bg-gold-soft/25 px-3 py-2 text-xs text-ink">
          {ct(lang, "set.restricted")}
        </p>
      )}

      {/* Aperçu du bandeau tel qu'il apparaîtra sur le site public. */}
      <ConsoleCard title={ct(lang, "set.preview")} lead={ct(lang, "group.overview")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["fr", "en"] as const).map((l) => {
            const text = settings[`announcement_${l}`]?.trim() || settings[`announcement_${l === "fr" ? "en" : "fr"}`]?.trim();
            const visible = settings.announcement_active === "true" || settings.maintenance_mode === "true";
            return (
              <div key={l} className="rounded-lg border border-line p-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{l.toUpperCase()}</p>
                <div className={`rounded-md border px-3 py-2 text-xs ${visible ? "border-brand-light/40 bg-brand/10 text-brand" : "border-dashed border-line text-muted"}`}>
                  {settings.maintenance_mode === "true" && <strong className="mr-1">{l === "fr" ? "Maintenance en cours —" : "Maintenance in progress —"}</strong>}
                  {text || (visible ? (l === "fr" ? "Les nouvelles inscriptions sont temporairement suspendues." : "New registrations are temporarily suspended.") : ct(lang, "common.off"))}
                </div>
                <p className="mt-1.5 text-[10px] text-muted">
                  {visible ? ct(lang, "common.on") : ct(lang, "common.off")}
                </p>
              </div>
            );
          })}
        </div>
      </ConsoleCard>

      <div className="grid gap-3 2xl:grid-cols-2">
        {SETTING_GROUPS.map((group) => {
          const defs = SETTING_DEFS.filter((d) => d.group === group.id);
          const last = defs.map((d) => byKey.get(d.key)?.updatedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
          const readRows: TableRow[] = defs.map((d) => ({
            key: d.key,
            cells: [
              <span key="l" className="block max-w-[16rem] truncate font-medium">{d.label[lang]}</span>,
              <span key="v" className="font-mono text-[11px]">{settings[d.key]}</span>,
              <span key="h" className="block max-w-[20rem] truncate text-muted">{d.hint[lang]}</span>,
            ],
          }));
          return (
            <ConsoleCard
              key={group.id}
              title={group.label[lang]}
              lead={group.hint[lang]}
              aside={
                last ? (
                  <span className="text-[10px] text-muted">{ct(lang, "set.lastUpdate")} · {dateOf(last)}</span>
                ) : undefined
              }
            >
              {canEdit ? (
                <div className="flex flex-col gap-3">
                  <ActionForm action={saveSettingsGroup} submitLabel={ct(lang, "set.save")} lang={lang}>
                    <input type="hidden" name="group" value={group.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {defs.map((d) => (
                        <div key={d.key} className="min-w-0">
                          <SettingField def={d} value={settings[d.key] ?? d.def} lang={lang} />
                          <p className="mt-1 text-[10px] leading-snug text-muted">{d.hint[lang]}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted/70">{d.key}</p>
                        </div>
                      ))}
                    </div>
                  </ActionForm>
                  <ActionForm action={resetSettingsGroup} submitLabel={ct(lang, "set.reset")} lang={lang}>
                    <input type="hidden" name="group" value={group.id} />
                  </ActionForm>
                </div>
              ) : (
                <ConsoleTable
                  head={[ct(lang, "set.env.variable"), ct(lang, "col.value"), ct(lang, "col.key")]}
                  rows={readRows}
                  empty={ct(lang, "common.empty")}
                />
              )}
            </ConsoleCard>
          );
        })}
      </div>

      <ConsoleCard title={ct(lang, "set.env.title")} lead={ct(lang, "set.env.lead")}>
        <ConsoleTable
          head={[
            ct(lang, "set.env.variable"), ct(lang, "col.key"), ct(lang, "set.env.value"),
            ct(lang, "set.env.state"), ct(lang, "col.value"),
          ]}
          rows={envRows}
          empty={ct(lang, "common.empty")}
        />
      </ConsoleCard>
    </div>
  );
}
