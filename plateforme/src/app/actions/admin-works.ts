"use server";

import { revalidatePath, updateTag } from "next/cache";
import { currencyOf, isCountryCode, toMinorUnits } from "@/lib/countries";
import { FILE_ROLES, PRICE_ROLES, RIGHTS_ROLES, requireStaff } from "@/lib/dal";
import { isVideoKey } from "@/lib/video";
import { db } from "@/lib/db";
import { WORKS_TAG } from "@/lib/catalog";
import type { FormState } from "@/lib/form";

const refresh = (workId: string) => {
  updateTag(WORKS_TAG); // le catalogue public est mis en cache : on le renouvelle tout de suite
  revalidatePath(`/admin/oeuvres/${workId}`);
  revalidatePath("/admin");
};

const parseDate = (raw: FormDataEntryValue | null) => {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Droits d'une œuvre : pays, contrat, supports, période. Réservé au gestionnaire des droits. */
export async function saveRights(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(RIGHTS_ROLES);
  const workId = String(formData.get("workId") ?? "");
  const countries = [...new Set(formData.getAll("countries").map((c) => String(c).toUpperCase()))];
  const contractRef = String(formData.get("contractRef") ?? "").trim() || null;
  const allowWeb = formData.get("allowWeb") === "on";
  const allowOffline = formData.get("allowOffline") === "on";
  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  const values = {
    countries: countries.join(","),
    contractRef: contractRef ?? "",
    allowWeb: allowWeb ? "on" : "",
    allowOffline: allowOffline ? "on" : "",
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };

  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) return { error: "Pays invalide.", values };
  if (startsAt === undefined || endsAt === undefined) return { error: "Date invalide.", values };
  if (startsAt && endsAt && endsAt < startsAt) return { error: "La date de fin précède la date de début.", values };

  const work = await db.work.findUnique({
    where: { id: workId },
    select: { id: true, status: true, licenses: { orderBy: { createdAt: "asc" }, select: { id: true } } },
  });
  if (!work) return { error: "Œuvre introuvable.", values };

  // Règle du cahier (section 17) : une œuvre publiée garde des droits documentés.
  if (work.status === "PUBLISHED" && (countries.length === 0 || !contractRef)) {
    return { error: "Cette œuvre est publiée : dépubliez-la avant de retirer des pays ou la référence du contrat.", values };
  }

  const data = { countries, contractRef, allowWeb, allowOffline, startsAt, endsAt };
  const first = work.licenses[0];
  if (first) await db.license.update({ where: { id: first.id }, data });
  else await db.license.create({ data: { workId, ...data } });
  await db.work.update({ where: { id: workId }, data: { downloadable: allowOffline } });

  await db.auditLog.create({
    data: { actorId: user.id, action: "work.rights", target: workId, details: { countries, contractRef, allowWeb, allowOffline } },
  });
  refresh(workId);
  return undefined;
}

/** Prix d'une œuvre pour un pays (devise déduite du pays). */
export async function savePrice(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(PRICE_ROLES);
  const workId = String(formData.get("workId") ?? "");
  const country = String(formData.get("country") ?? "").toUpperCase();
  const raw = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const values = { country, amount: raw };

  if (!isCountryCode(country)) return { error: "Choisissez un pays.", values };
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) return { error: "Indiquez un prix supérieur à zéro.", values };

  const currency = currencyOf(country);
  const minor = toMinorUnits(currency, amount);
  if (minor <= 0 || minor > 100_000_000) return { error: "Prix hors limites.", values };

  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return { error: "Œuvre introuvable.", values };

  await db.price.upsert({
    where: { workId_country: { workId, country } },
    update: { currency, amount: minor },
    create: { workId, country, currency, amount: minor },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.price", target: workId, details: { country, currency, amount: minor } },
  });
  refresh(workId);
  return undefined;
}

/** Identifiant de la vidéo d'un film ou documentaire (chez le prestataire vidéo). */
export async function saveVideoKey(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(FILE_ROLES);
  const workId = String(formData.get("workId") ?? "");
  const key = String(formData.get("videoKey") ?? "").trim();
  const values = { videoKey: key };

  if (key && !isVideoKey(key)) return { error: "Identifiant invalide : lettres, chiffres, points et tirets seulement.", values };
  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true, type: true } });
  if (!work) return { error: "Œuvre introuvable.", values };
  if (work.type === "BOOK") return { error: "Les livres utilisent un fichier EPUB.", values };

  await db.work.update({ where: { id: workId }, data: { fileKey: key || null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "work.video", target: workId, details: { key } } });
  refresh(workId);
  return undefined;
}

export async function deletePrice(formData: FormData) {
  const user = await requireStaff(PRICE_ROLES);
  const id = String(formData.get("id") ?? "");
  const price = await db.price.findUnique({ where: { id }, select: { id: true, workId: true, country: true } });
  if (!price) return;
  await db.price.delete({ where: { id } });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.price.delete", target: price.workId, details: { country: price.country } },
  });
  refresh(price.workId);
}
