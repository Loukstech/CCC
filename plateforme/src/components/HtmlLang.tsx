"use client";

import { useEffect } from "react";
import type { Lang } from "@/lib/i18n";

/** Met à jour l'attribut lang de la page dès que l'utilisateur change de langue (sans rechargement). */
export function HtmlLang({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
