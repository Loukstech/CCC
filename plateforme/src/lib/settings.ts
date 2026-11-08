import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Paramètres applicatifs de la console d'administration.
 *
 * Deux catégories, volontairement séparées :
 * - `SETTING_DEFS` : valeurs éditables, stockées dans `AppSetting`, lues à chaque requête et
 *   réellement utilisées par le code (annonce, maintenance, densité de la console, outils…).
 * - `ENV_ENTRIES` : configuration d'infrastructure, en lecture seule. Ces valeurs viennent de
 *   Vercel et ne doivent jamais être modifiables depuis l'interface (secrets, base, prestataires) :
 *   les afficher comme éditables donnerait une illusion de contrôle et exposerait des secrets.
 *
 * `getSettings` est mémoïsé par requête (`cache`) : le bandeau d'annonce du layout racine et la
 * console peuvent le lire plusieurs fois sans requêter la base autant de fois.
 */

export type Bilingual = { fr: string; en: string };
export type SettingGroup = "announcement" | "console" | "tools" | "display";
export type SettingKind = "bool" | "text" | "number" | "select";

export type SettingDef = {
  key: string;
  group: SettingGroup;
  kind: SettingKind;
  def: string;
  label: Bilingual;
  hint: Bilingual;
  options?: { value: string; label: Bilingual }[];
  min?: number;
  max?: number;
};

const RANGE_OPTIONS: SettingDef["options"] = [
  { value: "7d", label: { fr: "7 jours", en: "7 days" } },
  { value: "30d", label: { fr: "30 jours", en: "30 days" } },
  { value: "90d", label: { fr: "90 jours", en: "90 days" } },
  { value: "12m", label: { fr: "12 mois", en: "12 months" } },
];

export const SETTING_GROUPS: { id: SettingGroup; label: Bilingual; hint: Bilingual }[] = [
  {
    id: "announcement",
    label: { fr: "Annonce et disponibilité", en: "Announcement & availability" },
    hint: { fr: "Bandeau public en haut du site et mode maintenance.", en: "Public banner at the top of the site and maintenance mode." },
  },
  {
    id: "display",
    label: { fr: "Affichage et modération", en: "Display & moderation" },
    hint: { fr: "Comportement public : publicité fixe, avis, coordonnées, devise.", en: "Public behaviour: sticky ads, reviews, contact details, currency." },
  },
  {
    id: "console",
    label: { fr: "Console d’administration", en: "Admin console" },
    hint: { fr: "Préférences d’affichage du tableau de bord (propres à la console).", en: "Dashboard display preferences (console only)." },
  },
  {
    id: "tools",
    label: { fr: "Outils et données", en: "Tools & data" },
    hint: { fr: "Bornes de sécurité appliquées aux outils d’exploitation.", en: "Safety limits applied to operational tools." },
  },
];

export const SETTING_DEFS: SettingDef[] = [
  // — Annonce et disponibilité —
  {
    key: "announcement_active", group: "announcement", kind: "bool", def: "false",
    label: { fr: "Afficher l’annonce", en: "Show announcement" },
    hint: { fr: "Affiche un bandeau d’information sur toutes les pages publiques.", en: "Shows an information banner on every public page." },
  },
  {
    key: "announcement_fr", group: "announcement", kind: "text", def: "",
    label: { fr: "Texte de l’annonce (FR)", en: "Announcement text (FR)" },
    hint: { fr: "160 caractères maximum. Laisser vide pour ne rien afficher.", en: "Up to 160 characters. Leave empty to hide it." },
  },
  {
    key: "announcement_en", group: "announcement", kind: "text", def: "",
    label: { fr: "Texte de l’annonce (EN)", en: "Announcement text (EN)" },
    hint: { fr: "Version anglaise du bandeau.", en: "English version of the banner." },
  },
  {
    key: "maintenance_mode", group: "announcement", kind: "bool", def: "false",
    label: { fr: "Mode maintenance", en: "Maintenance mode" },
    hint: { fr: "Bloque les nouvelles inscriptions et affiche un avertissement.", en: "Blocks new sign-ups and shows a warning." },
  },
  // — Affichage et modération —
  {
    key: "ads_sticky_enabled", group: "display", kind: "bool", def: "true",
    label: { fr: "Bandeau publicitaire fixe", en: "Sticky ad banner" },
    hint: { fr: "Active ou coupe le bandeau fixe en bas des pages.", en: "Enables or disables the sticky bottom banner." },
  },
  {
    key: "reviews_auto_publish", group: "display", kind: "bool", def: "true",
    label: { fr: "Publier les avis immédiatement", en: "Publish reviews immediately" },
    hint: { fr: "Désactiver pour envoyer les nouveaux avis en modération.", en: "Turn off to send new reviews to the moderation queue." },
  },
  {
    key: "support_email", group: "display", kind: "text", def: "",
    label: { fr: "E-mail de contact", en: "Contact e-mail" },
    hint: { fr: "Remplace CCC_CONTACT_EMAIL sur la page « Nous contacter ».", en: "Overrides CCC_CONTACT_EMAIL on the contact page." },
  },
  {
    key: "support_phone", group: "display", kind: "text", def: "",
    label: { fr: "Téléphone de contact", en: "Contact phone" },
    hint: { fr: "Remplace CCC_CONTACT_PHONE.", en: "Overrides CCC_CONTACT_PHONE." },
  },
  {
    key: "support_whatsapp", group: "display", kind: "text", def: "",
    label: { fr: "WhatsApp (chiffres)", en: "WhatsApp (digits)" },
    hint: { fr: "Numéro international sans le « + ». Remplace CCC_CONTACT_WHATSAPP.", en: "International number without '+'. Overrides CCC_CONTACT_WHATSAPP." },
  },
  {
    key: "default_currency", group: "display", kind: "select", def: "XOF",
    label: { fr: "Devise de la console", en: "Console currency" },
    hint: { fr: "Devise utilisée pour les montants du tableau de bord.", en: "Currency used for dashboard amounts." },
    options: ["XOF", "NGN", "EUR", "USD", "GBP"].map((v) => ({ value: v, label: { fr: v, en: v } })),
  },
  // — Console —
  {
    key: "console_dense", group: "console", kind: "bool", def: "true",
    label: { fr: "Vue dense (grand écran)", en: "Dense view (large screen)" },
    hint: { fr: "Réduit les espacements pour afficher un maximum de données.", en: "Reduces spacing to fit as much data as possible." },
  },
  {
    key: "console_range", group: "console", kind: "select", def: "12m",
    label: { fr: "Période par défaut", en: "Default period" },
    hint: { fr: "Fenêtre statistique chargée à l’ouverture du tableau de bord.", en: "Statistical window loaded when the dashboard opens." },
    options: RANGE_OPTIONS,
  },
  {
    key: "console_rows", group: "console", kind: "select", def: "25",
    label: { fr: "Lignes par tableau", en: "Rows per table" },
    hint: { fr: "Nombre de lignes affichées dans les tableaux de la console.", en: "Number of rows shown in console tables." },
    options: ["10", "25", "50"].map((v) => ({ value: v, label: { fr: v, en: v } })),
  },
  {
    key: "console_show_charts", group: "console", kind: "bool", def: "true",
    label: { fr: "Graphiques", en: "Charts" },
    hint: { fr: "Affiche les courbes d’évolution et les répartitions.", en: "Shows trend charts and breakdowns." },
  },
  {
    key: "console_show_audit", group: "console", kind: "bool", def: "true",
    label: { fr: "Activité récente", en: "Recent activity" },
    hint: { fr: "Affiche le flux du journal d’audit sur l’accueil.", en: "Shows the audit-log feed on the overview." },
  },
  // — Outils —
  {
    key: "code_validity_days", group: "tools", kind: "number", def: "30", min: 1, max: 365,
    label: { fr: "Validité des codes partenaires (jours)", en: "Partner code validity (days)" },
    hint: { fr: "Durée appliquée aux codes générés par l’outil dédié.", en: "Lifetime applied to codes generated by the dedicated tool." },
  },
  {
    key: "export_rows_limit", group: "tools", kind: "number", def: "5000", min: 100, max: 20000,
    label: { fr: "Lignes max par export", en: "Max rows per export" },
    hint: { fr: "Garde-fou contre les exports trop volumineux.", en: "Guard rail against oversized exports." },
  },
  {
    key: "bulk_max", group: "tools", kind: "number", def: "50", min: 1, max: 200,
    label: { fr: "Taille max d’un lot", en: "Max batch size" },
    hint: { fr: "Nombre maximum d’éléments traités par une action groupée.", en: "Maximum items processed by one bulk action." },
  },
  {
    key: "audit_retention_days", group: "tools", kind: "number", def: "365", min: 30, max: 3650,
    label: { fr: "Rétention du journal (jours)", en: "Audit log retention (days)" },
    hint: { fr: "Âge au-delà duquel l’outil de purge propose de supprimer les entrées.", en: "Age beyond which the purge tool offers to delete entries." },
  },
];

const DEF_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));
export type SettingKey = (typeof SETTING_DEFS)[number]["key"];
export type Settings = Record<string, string>;

/** Valeurs par défaut, sans accès à la base (utile si la table est momentanément indisponible). */
export const DEFAULT_SETTINGS: Settings = Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.def]));

/**
 * Détecte uniquement l'absence de la table `AppSetting` (migration pas encore appliquée sur la
 * base ciblée, par exemple une base de preview isolée). Toute autre erreur reste propagée : une
 * panne réelle de la base ne doit pas être masquée par des paramètres par défaut.
 */
function isMissingSettingsTable(error: unknown): boolean {
  const e = error as { code?: string; meta?: { code?: string }; message?: string } | null;
  return (
    e?.code === "P2021" ||
    e?.meta?.code === "42P01" ||
    /relation "AppSetting" does not exist|table .*AppSetting.* does not exist/i.test(e?.message ?? "")
  );
}

/**
 * Lecture groupée, dédupliquée par requête. Les clés inconnues en base sont ignorées.
 *
 * `getSettings` est appelé depuis le layout racine (bandeau d'annonce, pub fixe) : si la table
 * n'existe pas encore, on retombe sur les valeurs par défaut plutôt que de rendre tout le site
 * indisponible pendant le décalage entre le déploiement du code et l'application de la migration.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  let rows: { key: string; value: string }[];
  try {
    rows = await db.appSetting.findMany({ select: { key: true, value: true } });
  } catch (error) {
    if (!isMissingSettingsTable(error)) throw error;
    console.error("[settings] Table AppSetting absente, valeurs par défaut appliquées.", error);
    return { ...DEFAULT_SETTINGS };
  }
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (DEF_BY_KEY.has(r.key)) out[r.key] = r.value;
  return out;
});

export async function getSetting(key: string): Promise<string> {
  return (await getSettings())[key] ?? DEF_BY_KEY.get(key)?.def ?? "";
}

export async function getBool(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export async function getNumber(key: string): Promise<number> {
  const d = DEF_BY_KEY.get(key);
  const n = Number(await getSetting(key));
  if (!Number.isFinite(n)) return Number(d?.def ?? 0);
  return Math.min(d?.max ?? Infinity, Math.max(d?.min ?? -Infinity, Math.round(n)));
}

/** Validation d'une valeur soumise par le formulaire : renvoie la valeur normalisée ou null. */
export function normaliseSetting(def: SettingDef, raw: string): string | null {
  const v = raw.trim();
  switch (def.kind) {
    case "bool":
      return v === "true" || v === "on" ? "true" : v === "false" || v === "" ? "false" : null;
    case "number": {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const clamped = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, Math.round(n)));
      return String(clamped);
    }
    case "select":
      return def.options?.some((o) => o.value === v) ? v : null;
    case "text":
      return v.slice(0, 160);
  }
}

/** Valeurs d'infrastructure, affichées en lecture seule (jamais de secret en clair). */
export type EnvEntry = {
  id: string;
  label: Bilingual;
  value: string;
  configured: boolean;
  hint: Bilingual;
  secret?: boolean;
};

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname; } catch { return ""; }
}

export function getEnvironment(): EnvEntry[] {
  const present = (v: string | undefined) => Boolean(v?.trim());
  const text = (v: string | undefined, fallback = "—") => v?.trim() || fallback;
  const entry = (
    id: string, label: Bilingual, value: string, configured: boolean, hint: Bilingual, secret = false,
  ): EnvEntry => ({ id, label, value, configured, hint, ...(secret ? { secret: true } : {}) });

  return [
    entry("DATABASE_URL", { fr: "Base PostgreSQL", en: "PostgreSQL database" },
      hostOf(process.env.DATABASE_URL) || text(process.env.DATABASE_URL), present(process.env.DATABASE_URL),
      { fr: "Hôte Neon ; défini dans Vercel.", en: "Neon host; set in Vercel." }),
    entry("SESSION_SECRET", { fr: "Secret de session", en: "Session secret" },
      "••••••••", present(process.env.SESSION_SECRET),
      { fr: "Signe les sessions et les codes partenaires (HMAC).", en: "Signs sessions and partner codes (HMAC)." }, true),
    entry("PARTNER_CODE_REQUIRED", { fr: "Codes partenaires obligatoires", en: "Partner codes required" },
      text(process.env.PARTNER_CODE_REQUIRED, "false"), process.env.PARTNER_CODE_REQUIRED === "true",
      { fr: "Sécurité des inscriptions : non modifiable à chaud.", en: "Sign-up security: cannot be changed at runtime." }),
    entry("DEVICE_LIMIT", { fr: "Appareils par compte", en: "Devices per account" },
      text(process.env.DEVICE_LIMIT, "3"), present(process.env.DEVICE_LIMIT),
      { fr: "Limite appliquée par lib/devices.ts.", en: "Limit enforced by lib/devices.ts." }),
    entry("DEMO_PAYMENT_VISIBLE", { fr: "Paiement de démonstration", en: "Demo checkout" },
      process.env.DEMO_PAYMENT_VISIBLE === "false" ? "false" : "true", process.env.DEMO_PAYMENT_VISIBLE !== "false",
      { fr: "Affiche le paiement simulé en l’absence de prestataire.", en: "Shows the simulated checkout when no provider is configured." }),
    entry("PAYMENT_PROVIDER", { fr: "Prestataire de paiement", en: "Payment provider" },
      text(process.env.PAYMENT_PROVIDER, "demo"), present(process.env.PAYMENT_PROVIDER),
      { fr: "Fedapay une fois les clés fournies.", en: "Fedapay once keys are provided." }),
    entry("FEDAPAY_SECRET_KEY", { fr: "Clé Fedapay", en: "Fedapay key" },
      "••••••••", present(process.env.FEDAPAY_SECRET_KEY),
      { fr: "Clé secrète du prestataire.", en: "Provider secret key." }, true),
    entry("VIDEO_PROVIDER", { fr: "Prestataire vidéo", en: "Video provider" },
      text(process.env.VIDEO_PROVIDER, "embed"), present(process.env.VIDEO_PROVIDER),
      { fr: "Mux ou embed externe.", en: "Mux or external embed." }),
    entry("CCC_CONTACT_EMAIL", { fr: "E-mail (environnement)", en: "E-mail (environment)" },
      text(process.env.CCC_CONTACT_EMAIL), present(process.env.CCC_CONTACT_EMAIL),
      { fr: "Valeur de repli ; surchargeable ci-dessus.", en: "Fallback value; overridable above." }),
    entry("CCC_DEVELOPER_URL", { fr: "Site du prestataire", en: "Developer website" },
      text(process.env.CCC_DEVELOPER_URL), present(process.env.CCC_DEVELOPER_URL),
      { fr: "Rend le crédit MkEnterprise cliquable.", en: "Makes the MkEnterprise credit clickable." }),
  ];
}
