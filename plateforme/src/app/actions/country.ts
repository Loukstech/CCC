"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { isCountryCode } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { COUNTRY_COOKIE } from "@/lib/rights";

/** Change le pays utilisé pour vérifier la disponibilité des œuvres (et le profil si l'on est connecté). */
export async function setCountry(formData: FormData) {
  const country = String(formData.get("country") ?? "").toUpperCase();
  if (!isCountryCode(country)) return;

  (await cookies()).set(COUNTRY_COOKIE, country, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { country } });
}
