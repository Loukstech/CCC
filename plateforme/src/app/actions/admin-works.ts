"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { currencyOf, isCountryCode, toMinorUnits } from "@/lib/countries";
import { CATALOG_ROLES, FILE_ROLES, PRICE_ROLES, RIGHTS_ROLES, requireStaff } from "@/lib/dal";
import { isVideoKey } from "@/lib/video";
import { db } from "@/lib/db";
import { WORKS_TAG } from "@/lib/catalog";
import type { FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

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
  const lang = await getLang();
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

  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) return { error: t(lang, "wk.errCountry"), values };
  if (startsAt === undefined || endsAt === undefined) return { error: t(lang, "wk.errDate"), values };
  if (startsAt && endsAt && endsAt < startsAt) return { error: t(lang, "wk.errDateOrder"), values };

  const work = await db.work.findUnique({
    where: { id: workId },
    select: { id: true, status: true, licenses: { orderBy: { createdAt: "asc" }, select: { id: true } } },
  });
  if (!work) return { error: t(lang, "wk.errWork"), values };

  // Règle du cahier (section 17) : une œuvre publiée garde des droits documentés.
  if (work.status === "PUBLISHED" && (countries.length === 0 || !contractRef)) {
    return { error: t(lang, "wk.errPublishedRights"), values };
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
  const lang = await getLang();
  const workId = String(formData.get("workId") ?? "");
  const country = String(formData.get("country") ?? "").toUpperCase();
  const raw = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const values = { country, amount: raw };

  if (!isCountryCode(country)) return { error: t(lang, "wk.errChooseCountry"), values };
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) return { error: t(lang, "wk.errPrice"), values };

  const currency = currencyOf(country);
  const minor = toMinorUnits(currency, amount);
  if (minor <= 0 || minor > 100_000_000) return { error: t(lang, "wk.errPriceRange"), values };

  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return { error: t(lang, "wk.errWork"), values };

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
  const lang = await getLang();
  const workId = String(formData.get("workId") ?? "");
  const key = String(formData.get("videoKey") ?? "").trim();
  const values = { videoKey: key };

  if (key && !isVideoKey(key)) return { error: t(lang, "wk.errVideoKey"), values };
  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true, type: true } });
  if (!work) return { error: t(lang, "wk.errWork"), values };
  if (work.type === "BOOK") return { error: t(lang, "wk.errBookVideo"), values };

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

/**
 * Piste de sous-titres d'une vidéo (fichier WebVTT).
 *
 * Le fichier n'est pas téléversé ici : on enregistre son **adresse**. Un `.vtt` déposé dans
 * `public/subtitles` est servi par Next avec le type `text/vtt`, ce qui suffit au navigateur ;
 * une adresse externe (https://…vtt) fonctionne aussi, par exemple pour un sous-titre hébergé
 * chez le prestataire vidéo.
 */
export async function saveSubtitle(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(FILE_ROLES);
  const lang = await getLang();
  const workId = String(formData.get("workId") ?? "");
  const code = String(formData.get("lang") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  const src = String(formData.get("src") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";
  const values = { lang: code, label, src, isDefault: isDefault ? "on" : "" };

  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code)) return { error: t(lang, "wk.errSubtitleLang"), values };
  if (!label || label.length > 40) return { error: t(lang, "wk.errSubtitleLabel"), values };
  // Chemin interne (/subtitles/…) ou adresse absolue, toujours vers un .vtt.
  if (!/^(\/|https?:\/\/)\S+\.vtt$/i.test(src)) return { error: t(lang, "wk.errSubtitleSrc"), values };

  const work = await db.work.findUnique({ where: { id: workId }, select: { id: true, type: true } });
  if (!work) return { error: t(lang, "wk.errWork"), values };
  if (work.type === "BOOK") return { error: t(lang, "wk.errBookSubtitle"), values };

  // Une seule piste par défaut par œuvre : les autres sont désactivées avant l'écriture.
  if (isDefault) await db.subtitle.updateMany({ where: { workId }, data: { isDefault: false } });

  await db.subtitle.upsert({
    where: { workId_lang: { workId, lang: code } },
    update: { label, src, isDefault },
    create: { workId, lang: code, label, src, isDefault },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.subtitle", target: workId, details: { lang: code, src, isDefault } },
  });
  refresh(workId);
  return { notice: t(lang, "wk.subtitleSaved") };
}

/** Retire une piste de sous-titres. */
export async function deleteSubtitle(formData: FormData) {
  const user = await requireStaff(FILE_ROLES);
  const id = String(formData.get("id") ?? "");
  const track = await db.subtitle.findUnique({ where: { id }, select: { id: true, workId: true, lang: true } });
  if (!track) return;
  await db.subtitle.delete({ where: { id } });
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.subtitle.delete", target: track.workId, details: { lang: track.lang } },
  });
  refresh(track.workId);
}

/**
 * Relie deux œuvres comme les éditions d'un même titre (la même histoire en plusieurs langues).
 *
 * Les deux fiches restent distinctes — chacune garde son fichier, son prix, sa licence et ses ventes —
 * mais elles partagent un identifiant de groupe. C'est ce groupe qui alimente le sélecteur de langue
 * sur la fiche publique, et qui évite que le catalogue affiche trois fois le même titre.
 */
export async function linkTranslation(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(CATALOG_ROLES);
  const lang = await getLang();
  const workId = String(formData.get("workId") ?? "");
  const otherId = String(formData.get("otherId") ?? "");
  const values = { otherId };

  if (!otherId || otherId === workId) return { error: t(lang, "wk.errTranslationPick"), values };

  const [work, other] = await Promise.all([
    db.work.findUnique({ where: { id: workId }, select: { id: true, type: true, translationGroupId: true } }),
    db.work.findUnique({ where: { id: otherId }, select: { id: true, type: true, translationGroupId: true } }),
  ]);
  if (!work || !other) return { error: t(lang, "wk.errWork"), values };
  if (work.type !== other.type) return { error: t(lang, "wk.errTranslationType"), values };
  // Deux groupes différents ne fusionnent pas : on demande de détacher d'abord, pour ne rien perdre.
  if (work.translationGroupId && other.translationGroupId && work.translationGroupId !== other.translationGroupId) {
    return { error: t(lang, "wk.errTranslationBusy"), values };
  }

  const groupId = work.translationGroupId ?? other.translationGroupId ?? randomUUID();
  const currentPrimary = await db.work.findFirst({
    where: { translationGroupId: groupId, translationPrimary: true },
    select: { id: true },
  });
  // L'édition de référence déjà en place est conservée ; sinon la fiche en cours devient la référence.
  const primaryId = currentPrimary?.id ?? workId;

  await db.$transaction([
    db.work.update({
      where: { id: workId },
      data: { translationGroupId: groupId, translationPrimary: workId === primaryId },
    }),
    db.work.update({
      where: { id: otherId },
      data: { translationGroupId: groupId, translationPrimary: otherId === primaryId },
    }),
  ]);
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.translation.link", target: workId, details: { otherId, groupId } },
  });
  refresh(workId);
  refresh(otherId);
  return { notice: t(lang, "wk.translationLinked") };
}

/** Détache une œuvre du groupe d'éditions auquel elle appartenait. */
export async function unlinkTranslation(formData: FormData) {
  const user = await requireStaff(CATALOG_ROLES);
  const id = String(formData.get("id") ?? "");
  const work = await db.work.findUnique({
    where: { id },
    select: { id: true, translationGroupId: true },
  });
  if (!work?.translationGroupId) return;
  const groupId = work.translationGroupId;

  await db.work.update({ where: { id }, data: { translationGroupId: null, translationPrimary: true } });

  // Le groupe doit garder une édition de référence, même après un départ.
  const rest = await db.work.findMany({
    where: { translationGroupId: groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true, translationPrimary: true },
  });
  if (rest.length > 0 && !rest.some((w) => w.translationPrimary)) {
    await db.work.update({ where: { id: rest[0].id }, data: { translationPrimary: true } });
  }

  await db.auditLog.create({
    data: { actorId: user.id, action: "work.translation.unlink", target: id, details: { groupId } },
  });
  refresh(id);
}

/** Choisit l'édition que le catalogue met en avant pour un titre traduit. */
export async function setPrimaryEdition(formData: FormData) {
  const user = await requireStaff(CATALOG_ROLES);
  const id = String(formData.get("id") ?? "");
  const work = await db.work.findUnique({ where: { id }, select: { id: true, translationGroupId: true } });
  if (!work?.translationGroupId) return;

  await db.$transaction([
    db.work.updateMany({ where: { translationGroupId: work.translationGroupId }, data: { translationPrimary: false } }),
    db.work.update({ where: { id }, data: { translationPrimary: true } }),
  ]);
  await db.auditLog.create({
    data: { actorId: user.id, action: "work.translation.primary", target: id, details: {} },
  });
  refresh(id);
}
