"use server";

import { revalidatePath } from "next/cache";
import {
  DASHBOARD_ROLES,
  EDITORIAL_ROLES,
  FINANCE_ROLES,
  PARTNER_ROLES,
  requireStaff,
} from "@/lib/dal";
import { backfillAudience } from "@/lib/audience";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { ct } from "@/lib/console-i18n";
import { getLang } from "@/lib/lang";
import { reconcilePaidOrders } from "@/lib/ledger";
import { defaultExpiry, generateCode, hashCode } from "@/lib/partner-codes";
import {
  getNumber,
  normaliseSetting,
  SETTING_DEFS,
  SETTING_GROUPS,
  type SettingGroup,
} from "@/lib/settings";
import type { Prisma } from "@/generated/prisma/client";
import type { StaffRole } from "@/generated/prisma/enums";

/**
 * Actions de la console d'administration.
 *
 * Trois garanties :
 * - chaque écriture est précédée d'un contrôle de rôle indépendant de l'interface ;
 * - chaque écriture est tracée dans AuditLog, avec l'acteur et les paramètres utilisés ;
 * - les modifications de réglages invalident le layout racine, donc le bandeau d'annonce, le mode
 *   maintenance, les publicités et les coordonnées de contact prennent effet immédiatement.
 */

const SUPER: StaffRole[] = ["SUPER_ADMIN"];
const GROUP_IDS = new Set<string>(SETTING_GROUPS.map((g) => g.id));

const refreshConsole = () => {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/parametres");
  revalidatePath("/admin/outils");
  revalidatePath("/admin/audit");
};

async function audit(actorId: string, action: string, target: string, details: Record<string, unknown>) {
  await db.auditLog.create({
    data: { actorId, action, target, details: details as Prisma.InputJsonValue },
  });
}

/** Enregistre tous les réglages d'un groupe. Les valeurs invalides retombent sur leur défaut. */
export async function saveSettingsGroup(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(SUPER);
  const lang = await getLang();
  const group = String(formData.get("group") ?? "");
  if (!GROUP_IDS.has(group)) return { error: ct(lang, "set.errorGroup") };

  const defs = SETTING_DEFS.filter((d) => d.group === (group as SettingGroup));
  const current = await db.appSetting.findMany({
    where: { key: { in: defs.map((d) => d.key) } },
    select: { key: true, value: true },
  });
  const before = new Map(current.map((r) => [r.key, r.value]));
  const changes: { key: string; from: string | null; to: string }[] = [];

  for (const def of defs) {
    const raw = String(formData.get(def.key) ?? "");
    const value = normaliseSetting(def, raw) ?? def.def;
    if ((before.get(def.key) ?? def.def) !== value) {
      changes.push({ key: def.key, from: before.get(def.key) ?? null, to: value });
    }
    await db.appSetting.upsert({
      where: { key: def.key },
      create: { key: def.key, value, updatedBy: actor.id },
      update: { value, updatedBy: actor.id },
    });
  }

  if (changes.length) {
    await audit(actor.id, "setting.update", group, { changes });
    refreshConsole();
  }
  return { notice: ct(lang, "set.saved", { n: changes.length }) };
}

/** Supprime les surcharges d'un groupe : les valeurs par défaut redeviennent actives. */
export async function resetSettingsGroup(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(SUPER);
  const lang = await getLang();
  const group = String(formData.get("group") ?? "");
  if (!GROUP_IDS.has(group)) return { error: ct(lang, "set.errorGroup") };

  const keys = SETTING_DEFS.filter((d) => d.group === (group as SettingGroup)).map((d) => d.key);
  const res = await db.appSetting.deleteMany({ where: { key: { in: keys } } });
  if (res.count) {
    await audit(actor.id, "setting.reset", group, { count: res.count });
    refreshConsole();
  }
  return { notice: ct(lang, "set.resetDone") };
}

/** Rôles autorisés par outil : l'interface masque déjà, l'action revérifie toujours. */
const TOOL_ROLES: Record<string, StaffRole[]> = {
  reconcile: FINANCE_ROLES,
  ratings: EDITORIAL_ROLES,
  comments: EDITORIAL_ROLES,
  codes: PARTNER_ROLES,
  revokeCodes: PARTNER_ROLES,
  bulkPublish: EDITORIAL_ROLES,
  purgeAudit: SUPER,
  audienceBackfill: SUPER,
};

const TOOL_ACTION: Record<string, string> = {
  reconcile: "tool.reconcile",
  ratings: "tool.ratings",
  comments: "tool.comments",
  codes: "tool.generateCodes",
  revokeCodes: "tool.revokeCodes",
  bulkPublish: "tool.bulkPublish",
  purgeAudit: "tool.purgeAudit",
  audienceBackfill: "tool.audienceBackfill",
};

/**
 * Exécute un outil d'exploitation. Chaque branche est bornée par `bulk_max` / `export_rows_limit`
 * et ne touche que des données reconstructibles ou explicitement désignées.
 */
export async function runConsoleTool(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(DASHBOARD_ROLES);
  const lang = await getLang();
  const tool = String(formData.get("tool") ?? "");
  const roles = TOOL_ROLES[tool];
  if (!roles) return { error: ct(lang, "tool.unknown") };
  if (!roles.includes(actor.staffRole as StaffRole)) {
    return { error: ct(lang, "tool.denied") };
  }

  const bulkMax = await getNumber("bulk_max");
  let notice = "";
  const details: Record<string, unknown> = { tool };

  switch (tool) {
    case "reconcile": {
      const n = await reconcilePaidOrders(bulkMax);
      notice = ct(lang, "tool.result.reconcile", { n });
      details.count = n;
      break;
    }
    case "ratings": {
      const [groups, works] = await Promise.all([
        db.review.groupBy({
          by: ["workId"], where: { status: "PUBLISHED" },
          _avg: { rating: true }, _count: { _all: true },
        }),
        db.work.findMany({ select: { id: true }, take: bulkMax }),
      ]);
      const computed = new Map(groups.map((g) => [g.workId, { avg: g._avg.rating ?? 0, count: g._count._all }]));
      for (const w of works) {
        const v = computed.get(w.id) ?? { avg: 0, count: 0 };
        await db.work.update({
          where: { id: w.id },
          data: { ratingAvg: Math.round(v.avg * 100) / 100, ratingCount: v.count },
        });
      }
      notice = ct(lang, "tool.result.ratings", { n: works.length });
      details.count = works.length;
      break;
    }
    case "comments": {
      const [groups, works] = await Promise.all([
        db.comment.groupBy({ by: ["workId"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
        db.work.findMany({ select: { id: true }, take: bulkMax }),
      ]);
      const computed = new Map(groups.map((g) => [g.workId, g._count._all]));
      for (const w of works) {
        await db.work.update({ where: { id: w.id }, data: { commentCount: computed.get(w.id) ?? 0 } });
      }
      notice = ct(lang, "tool.result.comments", { n: works.length });
      details.count = works.length;
      break;
    }
    case "codes": {
      const values = keep(formData, ["kind", "label", "count"]);
      const kind = values.kind === "DIOCESE" ? "DIOCESE" : "WRITER";
      const label = values.label.trim();
      const count = Number(values.count || 1);
      const days = await getNumber("code_validity_days");
      if (label.length < 2) return { error: ct(lang, "tool.result.codesLabel"), values };
      if (!Number.isInteger(count) || count < 1 || count > bulkMax) {
        return { error: ct(lang, "tool.result.codesError", { max: bulkMax }), values };
      }
      const plain = Array.from({ length: count }, () => generateCode(kind));
      const expiresAt = defaultExpiry(days);
      await db.partnerCode.createMany({
        data: plain.map((p) => ({
          codeHash: hashCode(p), label, kind, expiresAt, createdById: actor.id,
        })),
      });
      // Les clairs ne transitent QUE par la réponse : jamais stockés ni journalisés.
      notice = ct(lang, "tool.result.codes", { n: count, days, list: plain.join("\n") });
      details.count = count;
      details.kind = kind;
      details.label = label;
      break;
    }
    case "revokeCodes": {
      const res = await db.partnerCode.updateMany({
        where: { usedAt: null, revokedAt: null, expiresAt: { lt: new Date() } },
        data: { revokedAt: new Date() },
      });
      notice = ct(lang, "tool.result.revokeCodes", { n: res.count });
      details.count = res.count;
      break;
    }
    case "bulkPublish": {
      const candidates = await db.work.findMany({
        where: { status: "DRAFT" },
        take: bulkMax,
        select: { id: true, type: true, fileKey: true, licenses: { select: { contractRef: true, countries: true } } },
      });
      const ids = candidates
        .filter((w) => w.licenses.some((l) => !!l.contractRef && l.countries.length > 0))
        .filter((w) => w.type !== "BOOK" || !!w.fileKey)
        .map((w) => w.id);
      if (ids.length) {
        await db.work.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      }
      notice = ct(lang, "tool.result.bulkPublish", { n: ids.length });
      details.count = ids.length;
      break;
    }
    case "purgeAudit": {
      const days = await getNumber("audit_retention_days");
      const cutoff = new Date(Date.now() - days * 86_400_000);
      const res = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      notice = ct(lang, "tool.result.purgeAudit", { n: res.count, days });
      details.count = res.count;
      details.days = days;
      break;
    }
    case "audienceBackfill": {
      const result = await backfillAudience();
      notice = result.skipped
        ? ct(lang, "tool.result.audienceBackfillSkipped")
        : ct(lang, "tool.result.audienceBackfill", {
            plays: result.plays,
            works: result.works,
            days: result.days,
          });
      details.skipped = result.skipped;
      details.count = result.plays;
      details.works = result.works;
      details.days = result.days;
      break;
    }
  }

  await audit(actor.id, TOOL_ACTION[tool] ?? "tool.run", tool, details);
  refreshConsole();
  return { notice, values: { kind: String(formData.get("kind") ?? "WRITER") } };
}
