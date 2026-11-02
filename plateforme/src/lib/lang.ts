import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n";

/** Langue de l'interface : celle choisie par l'utilisateur, sinon celle de son navigateur (anglais ou français). */
export async function getLang(): Promise<Lang> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  return accept.startsWith("en") ? "en" : "fr";
}
