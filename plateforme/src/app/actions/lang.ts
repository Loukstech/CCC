"use server";

import { cookies } from "next/headers";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

/** Change la langue de l'interface (cookie d'un an). */
export async function setLang(formData: FormData) {
  const lang = String(formData.get("lang") ?? "");
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
