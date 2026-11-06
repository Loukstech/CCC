"use server";

import { revalidatePath } from "next/cache";
import { PARTNER_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { CODE_VALIDITY_DAYS, defaultExpiry, generateCode, hashCode } from "@/lib/partner-codes";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type WriterStatus = (typeof STATUSES)[number];

const refresh = () => {
  revalidatePath("/admin/partenariats");
  revalidatePath("/ecrivain");
  revalidatePath("/ecrivain/inscription");
  revalidatePath("/diocese/inscription");
};

/**
 * Émet un code après signature du contrat. Le code en clair n'est renvoyé QU'UNE fois dans le
 * message de confirmation : la base ne contient que son HMAC (voir lib/partner-codes.ts).
 */
export async function createPartnerCode(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(PARTNER_ROLES);
  const lang = await getLang();
  const values = keep(formData, ["kind", "label", "contractRef", "dioceseId", "days"]);
  const kind = values.kind === "DIOCESE" ? "DIOCESE" : "WRITER";
  const label = values.label.trim();
  const contractRef = values.contractRef.trim() || null;
  const dioceseId = kind === "DIOCESE" ? values.dioceseId.trim() : "";
  const days = Number(values.days || CODE_VALIDITY_DAYS);

  if (label.length < 2) return { error: t(lang, "part.errLabel"), values };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: t(lang, "part.errDays"), values };
  if (kind === "DIOCESE" && dioceseId) {
    const diocese = await db.diocese.findUnique({ where: { id: dioceseId }, select: { id: true } });
    if (!diocese) return { error: t(lang, "part.errDiocese"), values };
  }

  const plain = generateCode(kind);
  const row = await db.partnerCode.create({
    data: {
      codeHash: hashCode(plain),
      label,
      kind,
      contractRef,
      dioceseId: kind === "DIOCESE" && dioceseId ? dioceseId : null,
      expiresAt: defaultExpiry(days),
      createdById: actor.id,
    },
    select: { id: true },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "partnerCode.create",
      target: row.id,
      // Le code en clair n'est jamais journalisé.
      details: { label, kind, contractRef, dioceseId: dioceseId || null, days },
    },
  });
  refresh();
  return {
    notice: t(lang, "part.created", { code: plain, label, days }),
    values: { kind, label: "", contractRef: "", dioceseId, days: String(days) },
  };
}

/** Révoque un code non consommé. Un code déjà utilisé ne peut plus être révoqué (historique). */
export async function revokePartnerCode(formData: FormData) {
  const actor = await requireStaff(PARTNER_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const row = await db.partnerCode.findUnique({
    where: { id },
    select: { label: true, usedAt: true, revokedAt: true },
  });
  if (!row || row.usedAt || row.revokedAt) return;

  await db.partnerCode.update({ where: { id }, data: { revokedAt: new Date() } });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "partnerCode.revoke", target: id, details: { label: row.label } },
  });
  refresh();
}

/**
 * Validation manuelle d'un auteur par l'administration (alternative au code : contrat signé mais
 * compte créé avant la mise en place des codes). Un profil APPROUVÉ ouvre /ecrivain quand
 * PARTNER_CODE_REQUIRED=true.
 */
export async function setWriterStatus(_: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireStaff(PARTNER_ROLES);
  const lang = await getLang();
  const userId = String(formData.get("userId") ?? "");
  const raw = String(formData.get("status") ?? "");
  if (!userId || !(STATUSES as readonly string[]).includes(raw)) {
    return { error: t(lang, "part.errAccount") };
  }
  const status = raw as WriterStatus;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { error: t(lang, "part.errAccount") };
  const name = user.name ?? user.email ?? userId;

  await db.writerProfile.upsert({
    where: { userId },
    create: { userId, penName: name, status },
    update: { status },
  });
  await db.auditLog.create({
    data: { actorId: actor.id, action: "writer.status", target: userId, details: { status, name } },
  });
  refresh();
  return { notice: t(lang, "part.statusChanged", { name, status: t(lang, `part.status.${status}`) }) };
}
