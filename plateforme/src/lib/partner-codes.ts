import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { PartnerKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/**
 * Codes de partenariat (lot 8). Un diocèse ou un écrivain signe un contrat hors ligne, reçoit un
 * code, et le saisit à l'inscription. Le code en clair n'est jamais stocké : seul un HMAC est
 * conservé, ce qui permet de vérifier un code sans pouvoir le reconstituer depuis la base.
 *
 * `PARTNER_CODE_REQUIRED=false` (défaut) laisse la démonstration ouverte ; le passage à `true`
 * active l'exigence du code sur les trois portes (diocèse, écrivain, /ecrivain).
 */
const secret = () => process.env.SESSION_SECRET ?? "ccc-development-secret";

export const CODE_VALIDITY_DAYS = 30;
export const partnerCodesRequired = (): boolean => process.env.PARTNER_CODE_REQUIRED === "true";

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function hashCode(raw: string): string {
  return createHmac("sha256", secret()).update(normalizeCode(raw)).digest("hex");
}

/** Code lisible : CCC-DIO-XXXXXX-XXXXXX-XXXXXX ou CCC-ECR-… */
export function generateCode(kind: PartnerKind): string {
  const chunk = () => randomBytes(3).toString("hex").toUpperCase();
  return `CCC-${kind === "DIOCESE" ? "DIO" : "ECR"}-${chunk()}-${chunk()}-${chunk()}`;
}

export const defaultExpiry = (days = CODE_VALIDITY_DAYS): Date => new Date(Date.now() + days * 86_400_000);

export type CodeFailure = "missing" | "invalid" | "expired" | "used" | "revoked" | "wrongKind" | "wrongDiocese";

export type CodeInspection =
  | { ok: true; id: string; label: string; contractRef: string | null }
  | { ok: false; reason: CodeFailure };

/** Lecture seule : donne un message précis avant la consommation atomique en transaction. */
export async function inspectCode(
  raw: string,
  kind: PartnerKind,
  dioceseId?: string,
): Promise<CodeInspection> {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, reason: "missing" };
  const row = await db.partnerCode.findUnique({
    where: { codeHash: hashCode(code) },
    select: {
      id: true,
      label: true,
      kind: true,
      dioceseId: true,
      contractRef: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
    },
  });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (row.kind !== kind) return { ok: false, reason: "wrongKind" };
  if (kind === "DIOCESE" && dioceseId && row.dioceseId && row.dioceseId !== dioceseId) {
    return { ok: false, reason: "wrongDiocese" };
  }
  return { ok: true, id: row.id, label: row.label, contractRef: row.contractRef };
}

/**
 * Condition de consommation. `updateMany` avec `usedAt: null` est atomique : deux inscriptions
 * simultanées avec le même code ne peuvent pas réussir toutes les deux.
 */
export function claimableWhere(raw: string, kind: PartnerKind, dioceseId?: string) {
  return {
    codeHash: hashCode(normalizeCode(raw)),
    kind,
    ...(kind === "DIOCESE" && dioceseId ? { dioceseId } : {}),
    usedAt: null,
    revokedAt: null,
    expiresAt: { gt: new Date() },
  };
}

/** Traduction des échecs, utilisée par les deux formulaires d'inscription. */
export function codeError(lang: "fr" | "en", reason: CodeFailure): string {
  const messages: Record<"fr" | "en", Record<CodeFailure, string>> = {
    fr: {
      missing: "Saisissez le code de partenariat remis par l'administration.",
      invalid: "Ce code de partenariat est inconnu.",
      expired: "Ce code de partenariat est expiré.",
      used: "Ce code de partenariat a déjà été utilisé.",
      revoked: "Ce code de partenariat a été révoqué.",
      wrongKind: "Ce code ne correspond pas à ce type de compte.",
      wrongDiocese: "Ce code est attribué à un autre diocèse.",
    },
    en: {
      missing: "Enter the partnership code issued by the administration.",
      invalid: "This partnership code is unknown.",
      expired: "This partnership code has expired.",
      used: "This partnership code has already been used.",
      revoked: "This partnership code has been revoked.",
      wrongKind: "This code is not valid for this account type.",
      wrongDiocese: "This code belongs to another diocese.",
    },
  };
  return messages[lang][reason];
}
