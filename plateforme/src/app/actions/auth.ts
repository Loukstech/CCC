"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { keep, type FormState } from "@/lib/form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const country = String(formData.get("country") ?? "").trim().toUpperCase() || null;
  const values = keep(formData, ["name", "email", "country"]);

  if (name.length < 2) return { error: "Indiquez votre nom.", values };
  if (!EMAIL.test(email)) return { error: "Adresse e-mail invalide.", values };
  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères.", values };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: "Code pays invalide (2 lettres, ex. BJ).", values };

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { error: "Un compte existe déjà avec cette adresse e-mail.", values };

  const user = await db.user.create({
    data: { name, email, country, passwordHash: await hashPassword(password) },
    select: { id: true },
  });
  await createSession(user.id);
  redirect("/");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, disabledAt: true },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok || user.disabledAt) {
    return { error: "E-mail ou mot de passe incorrect.", values: keep(formData, ["email"]) };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
