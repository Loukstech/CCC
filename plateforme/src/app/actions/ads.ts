"use server";

import { revalidatePath, updateTag } from "next/cache";
import { AD_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { ADS_TAG } from "@/lib/ads";
import { keep, type FormState } from "@/lib/form";

const PLACEMENTS = ["HOME", "CATALOG", "WORK", "STICKY"] as const;

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

const parseDate = (raw: FormDataEntryValue | null) => {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const refresh = () => {
  updateTag(ADS_TAG); // les bandeaux sont mis en cache : on les renouvelle tout de suite
  revalidatePath("/admin/publicites");
};

export async function createAd(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff(AD_ROLES);
  const values = keep(formData, ["placement", "title", "advertiser", "text", "imageUrl", "linkUrl", "startsAt", "endsAt"]);
  const placement = values.placement;
  const title = values.title.trim();
  const advertiser = values.advertiser.trim();
  const linkUrl = values.linkUrl.trim();
  const imageUrl = values.imageUrl.trim();
  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));

  if (!(PLACEMENTS as readonly string[]).includes(placement)) return { error: "Emplacement invalide.", values };
  if (title.length < 2) return { error: "Indiquez le titre de la publicité.", values };
  if (advertiser.length < 2) return { error: "Indiquez le nom de l’annonceur.", values };
  if (!isHttpUrl(linkUrl)) return { error: "Le lien doit commencer par https://", values };
  if (imageUrl && !isHttpUrl(imageUrl)) return { error: "L’adresse de l’image doit commencer par https://", values };
  if (startsAt === undefined || endsAt === undefined) return { error: "Date invalide.", values };
  if (startsAt && endsAt && endsAt < startsAt) return { error: "La date de fin précède la date de début.", values };

  const ad = await db.ad.create({
    data: {
      placement: placement as (typeof PLACEMENTS)[number],
      title,
      advertiser,
      text: values.text.trim() || null,
      imageUrl: imageUrl || null,
      linkUrl,
      startsAt,
      endsAt,
    },
    select: { id: true },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "ad.create", target: ad.id, details: { title, advertiser, placement } },
  });
  refresh();
  return undefined;
}

export async function toggleAd(formData: FormData) {
  const user = await requireStaff(AD_ROLES);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  await db.ad.update({ where: { id }, data: { active } }).catch(() => null);
  await db.auditLog.create({ data: { actorId: user.id, action: "ad.toggle", target: id, details: { active } } });
  refresh();
}

export async function deleteAd(formData: FormData) {
  const user = await requireStaff(AD_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.ad.delete({ where: { id } }).catch(() => null);
  await db.auditLog.create({ data: { actorId: user.id, action: "ad.delete", target: id } });
  refresh();
}
