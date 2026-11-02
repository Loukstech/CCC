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
  const values = keep(formData, ["name", "email", "country"]);

  if (name.length < 2) return { error: t(lang, "err.name"), values };
  if (!EMAIL.test(email)) return { error: t(lang, "err.email"), values };
  if (password.length < 8) return { error: t(lang, "err.pwShort"), values };
  if (password !== passwordConfirm) return { error: t(lang, "err.pwMismatch"), values };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: t(lang, "err.country"), values };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: t(lang, "err.exists"), values };

  const user = await db.user.create({
    data: { name, email, country, passwordHash: await hashPassword(password) },
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
    select: { id: true, passwordHash: true, disabledAt: true, staffRole: true },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok || user.disabledAt) {
    return { error: t(lang, "err.badLogin"), values: keep(formData, ["email"]) };
  }

  // Appareil : enregistré s'il reste une place. Sinon la session est ouverte sans appareil autorisé et l'on
  // est envoyé vers « Mon compte » pour en retirer un (sauf le personnel, non soumis à la limite).
  const device = await registerDevice(user.id);
  await createSession(user.id, device.ok ? device.deviceId : null);
  redirect(device.ok || user.staffRole ? "/" : "/compte?appareils=limite");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
