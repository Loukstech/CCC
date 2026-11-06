/**
 * Noms de langues, écrits **dans leur propre langue**.
 *
 * Un sélecteur de langue se lit mieux ainsi : un lecteur anglophone cherche « English », pas
 * « Anglais ». C'est aussi ce qui évite d'ajouter une clé de traduction par langue.
 */
const NATIVE: Record<string, string> = {
  fr: "Français",
  en: "English",
  pt: "Português",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  ar: "العربية",
  yo: "Yorùbá",
  ig: "Igbo",
  ha: "Hausa",
  fon: "Fon",
  sw: "Kiswahili",
  zh: "中文",
  ru: "Русский",
};

/** Nom d'une langue à partir d'un code (`fr`, `en-GB`, `pt-BR`…). À défaut : le code en capitales. */
export function languageName(code: string): string {
  const short = code.trim().toLowerCase().slice(0, 2);
  return NATIVE[short] ?? code.trim().toUpperCase();
}
