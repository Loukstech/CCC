"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { registerDevice } from "@/lib/devices";
import { createSession } from "@/lib/session";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import {
  claimableWhere,
  codeError,
  inspectCode,
  normalizeCode,
  partnerCodesRequired,
} from "@/lib/partner-codes";
import { getBool } from "@/lib/settings";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inscription d'un écrivain / réalisateur partenaire. Même parcours que l'inscription d'un fidèle,
 * mais avec un code de partenariat : sa consommation crée un profil d'auteur APPROUVÉ, ce qui
 * ouvre /ecrivain sans attendre une validation manuelle (le contrat a déjà été signé hors ligne).
 */
export async function signupWriter(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  if (await getBool("maintenance_mode")) return { error: t(lang, "err.maintenance") };
  const values = keep(formData, ["name", "email", "country", "dioceseId", "parishId"]);
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const country = values.country.trim().toUpperCase() || null;
  const dioceseId = values.dioceseId.trim();
  const parishId = values.parishId.trim();
  const consent = formData.get("parishConsent") === "on";
  const partnerCode = normalizeCode(String(formData.get("partnerCode") ?? ""));

  if (name.length < 2) return { error: t(lang, "err.name"), values };
  if (!EMAIL.test(email)) return { error: t(lang, "err.email"), values };
  if (password.length < 8) return { error: t(lang, "err.pwShort"), values };
  if (password !== passwordConfirm) return { error: t(lang, "err.pwMismatch"), values };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: t(lang, "err.country"), values };
  if (!parishId) return { error: t(lang, "err.parish"), values };
  if (!consent) return { error: t(lang, "err.consent"), values };

  const gated = partnerCodesRequired();
  let code: Awaited<ReturnType<typeof inspectCode>> = { ok: false, reason: "invalid" };
  if (gated || partnerCode) {
    code = await inspectCode(partnerCode, "WRITER");
    if (!code.ok) return { error: codeError(lang, code.reason), values };
  }

  const parish = await db.parish.findFirst({
    where: { id: parishId, active: true, dioceseId, diocese: { active: true } },
    select: { id: true },
  });
  if (!parish) return { error: t(lang, "err.parishInvalid"), values };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: t(lang, "err.exists"), values };
  }

  let userId: string;
  try {
    userId = await db.$transaction(async (tx) => {
      if (code.ok) {
        const claim = await tx.partnerCode.updateMany({
          where: claimableWhere(partnerCode, "WRITER"),
          data: { usedAt: new Date() },
        });
        if (claim.count !== 1) throw new Error("CODE_CLAIM_FAILED");
      }
      const user = await tx.user.create({
        data: {
          name,
          email,
          country,
          passwordHash: await hashPassword(password),
          parishId: parish.id,
          parishConsentAt: new Date(),
          writerProfile: {
            create: {
              penName: name,
              status: code.ok ? "APPROVED" : "PENDING",
              note: code.ok ? `Code partenariat ${code.id} · ${code.contractRef ?? "contrat signé"}` : null,
            },
          },
        },
        select: { id: true },
      });
      if (code.ok) {
        await tx.partnerCode.update({ where: { id: code.id }, data: { usedByUserId: user.id } });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "writer.partnerSignup",
          target: user.id,
          details: { email, name, partnerCode: code.ok ? code.id : null },
        },
      });
      return user.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CODE_CLAIM_FAILED") {
      return { error: codeError(lang, "used"), values };
    }
    throw e;
  }

  const device = await registerDevice(userId);
  await createSession(userId, device.ok ? device.deviceId : null);
  redirect("/ecrivain");
}
