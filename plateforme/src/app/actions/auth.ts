"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { registerDevice } from "@/lib/devices";
import { createSession, deleteSession } from "@/lib/session";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const country = String(formData.get("country") ?? "").trim().toUpperCase() || null;
  const dioceseId = String(formData.get("dioceseId") ?? "").trim();
  const parishId = String(formData.get("parishId") ?? "").trim();
  const consent = formData.get("parishConsent") === "on";
  const values = keep(formData, ["name", "email", "country", "dioceseId", "parishId"]);

  if (name.length < 2) return { error: t(lang, "err.name"), values };
  if (!EMAIL.test(email)) return { error: t(lang, "err.email"), values };
  if (password.length < 8) return { error: t(lang, "err.pwShort"), values };
  if (password !== passwordConfirm) return { error: t(lang, "err.pwMismatch"), values };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: t(lang, "err.country"), values };
  if (!parishId) return { error: t(lang, "err.parish"), values };
  if (!consent) return { error: t(lang, "err.consent"), values };

  // La paroisse doit exister, être active et appartenir au diocèse choisi : les listes du formulaire
  // ne sont jamais une source de vérité. Le diocèse envoyé sert de garde-fou contre une paroisse d'un autre diocèse.
  const parish = await db.parish.findFirst({
    where: { id: parishId, active: true, dioceseId, diocese: { active: true } },
    select: { id: true },
  });
  if (!parish) return { error: t(lang, "err.parishInvalid"), values };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: t(lang, "err.exists"), values };

  const user = await db.user.create({
    data: {
      name,
      email,
      country,
      passwordHash: await hashPassword(password),
      parishId: parish.id,
      parishConsentAt: new Date(),
    },
    select: { id: true },
  });
  const device = await registerDevice(user.id);
  await createSession(user.id, device.ok ? device.deviceId : null);
  redirect("/");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      disabledAt: true,
      staffRole: true,
      dioceseAdmins: { select: { dioceseId: true }, take: 1 },
    },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok || user.disabledAt) {
    return { error: t(lang, "err.badLogin"), values: keep(formData, ["email"]) };
  }

  // Appareil : enregistré s'il reste une place. Sinon la session est ouverte sans appareil autorisé et l'on
  // est envoyé vers « Mon compte » pour en retirer un (sauf le personnel et les administrateurs de diocèse,
  // non soumis à la limite).
  const exempt = !!user.staffRole || user.dioceseAdmins.length > 0;
  const device = await registerDevice(user.id);
  await createSession(user.id, device.ok ? device.deviceId : null);
  if (user.dioceseAdmins.length > 0) redirect("/diocese");
  redirect(device.ok || exempt ? "/" : "/compte?appareils=limite");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
