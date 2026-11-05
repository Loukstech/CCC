"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { WORKS_TAG } from "@/lib/catalog";
import { MODERATION_ROLES, getCurrentUser, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { isReason, isTarget, type ReportTarget } from "@/lib/moderation";
import { BODY_MAX, RATING_MAX, RATING_MIN, recomputeComments, recomputeRating } from "@/lib/reviews";

/** Motifs et cibles : voir src/lib/moderation.ts (un fichier "use server" ne peut exporter que des fonctions). */

const refresh = (slug: string) => {
  // La fiche de l'œuvre est mise en cache : sans cela, la note moyenne resterait figée.
  updateTag(WORKS_TAG);
  revalidatePath(`/oeuvres/${slug}`);
  revalidatePath("/admin/moderation");
};

/** Enregistre l'avis de l'utilisateur : un seul par œuvre, modifiable à tout moment. */
export async function saveReview(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const values = keep(formData, ["workId", "slug", "rating", "body"]);
  const rating = Number(values.rating);
  const body = values.body.trim();

  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return { error: t(lang, "err.rating"), values };
  }
  if (body.length > BODY_MAX) return { error: t(lang, "err.tooLong"), values };

  const work = await db.work.findFirst({
    where: { id: values.workId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!work) return { error: t(lang, "err.workMissing"), values };

  await db.$transaction(async (tx) => {
    await tx.review.upsert({
      where: { userId_workId: { userId: user.id, workId: work.id } },
      update: { rating, body: body || null, status: "PUBLISHED" },
      create: { workId: work.id, userId: user.id, rating, body: body || null },
    });
    await recomputeRating(tx, work.id);
  });

  refresh(values.slug);
  return undefined;
}

/** Supprime l'avis de l'utilisateur connecté (le sien uniquement). */
export async function deleteOwnReview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const slug = String(formData.get("slug") ?? "");

  const review = await db.review.findFirst({
    where: { userId: user.id, workId: String(formData.get("workId") ?? "") },
    select: { id: true, workId: true },
  });
  if (!review) return;

  await db.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await recomputeRating(tx, review.workId);
  });
  refresh(slug);
}

export async function addComment(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const values = keep(formData, ["workId", "slug", "parentId", "body"]);
  const text = values.body.trim();
  if (!text) return { error: t(lang, "err.commentEmpty"), values };
  if (text.length > BODY_MAX) return { error: t(lang, "err.tooLong"), values };

  const work = await db.work.findFirst({
    where: { id: values.workId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!work) return { error: t(lang, "err.workMissing"), values };

  // Réponse : le commentaire parent doit appartenir à la même œuvre et être publié.
  let parentId: string | null = null;
  if (values.parentId) {
    const parent = await db.comment.findFirst({
      where: { id: values.parentId, workId: work.id, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!parent) return { error: t(lang, "err.commentEmpty"), values };
    parentId = parent.id;
  }

  await db.$transaction(async (tx) => {
    await tx.comment.create({ data: { workId: work.id, userId: user.id, body: text, parentId } });
    await recomputeComments(tx, work.id);
  });

  refresh(values.slug);
  return undefined;
}

/** Supprime un commentaire : son auteur, ou le personnel. Les réponses partent avec lui (cascade). */
export async function deleteComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");

  const comment = await db.comment.findUnique({ where: { id }, select: { id: true, userId: true, workId: true } });
  if (!comment) return;
  if (comment.userId !== user.id && !user.staffRole) return;

  await db.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id: comment.id } });
    await recomputeComments(tx, comment.workId);
  });
  refresh(slug);
}

/** Signalement : ouvert à tout compte, une seule fois par contenu et par personne. */
export async function reportContent(_: FormState, formData: FormData): Promise<FormState> {
  const lang = await getLang();
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const values = keep(formData, ["slug", "targetType", "targetId", "reason"]);
  if (!isTarget(values.targetType) || !isReason(values.reason) || !values.targetId) {
    return { error: t(lang, "err.report"), values };
  }

  await db.report.upsert({
    where: {
      targetType_targetId_reporterId: {
        targetType: values.targetType,
        targetId: values.targetId,
        reporterId: user.id,
      },
    },
    update: { reason: values.reason, status: "OPEN" },
    create: {
      targetType: values.targetType,
      targetId: values.targetId,
      reporterId: user.id,
      reason: values.reason,
    },
  });

  return undefined;
}

/** Change le statut d'un contenu et renvoie le slug de l'œuvre concernée (pour rafraîchir sa fiche). */
async function setContentStatus(targetType: ReportTarget, targetId: string, status: "PUBLISHED" | "HIDDEN") {
  if (targetType === "REVIEW") {
    const review = await db.review.update({
      where: { id: targetId },
      data: { status },
      select: { workId: true, work: { select: { slug: true } } },
    });
    await db.$transaction((tx) => recomputeRating(tx, review.workId));
    return review.work.slug;
  }
  const comment = await db.comment.update({
    where: { id: targetId },
    data: { status },
    select: { workId: true, parentId: true, work: { select: { slug: true } } },
  });
  // Masquer un commentaire masque aussi ses réponses : sinon elles apparaissent sans contexte.
  if (status === "HIDDEN" && !comment.parentId) {
    await db.comment.updateMany({
      where: { parentId: targetId, status: "PUBLISHED" },
      data: { status: "HIDDEN" },
    });
  }
  await db.$transaction((tx) => recomputeComments(tx, comment.workId));
  return comment.work.slug;
}

async function closeReports(targetType: ReportTarget, targetId: string, status: "HANDLED" | "DISMISSED") {
  await db.report.updateMany({ where: { targetType, targetId, status: "OPEN" }, data: { status } });
}

/** Masque un contenu et clôt ses signalements. */
export async function hideContent(formData: FormData) {
  const user = await requireStaff(MODERATION_ROLES);
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!isTarget(targetType) || !targetId) return;

  const slug = await setContentStatus(targetType, targetId, "HIDDEN");
  await closeReports(targetType, targetId, "HANDLED");
  await db.auditLog.create({
    data: { actorId: user.id, action: "content.hide", target: targetId, details: { targetType } },
  });
  // La fiche de l'œuvre est mise en cache : sans ces deux appels, l'avis masqué y resterait visible.
  updateTag(WORKS_TAG);
  revalidatePath(`/oeuvres/${slug}`);
  revalidatePath("/admin/moderation");
}

/** Rétablit un contenu masqué par erreur. */
export async function restoreContent(formData: FormData) {
  const user = await requireStaff(MODERATION_ROLES);
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!isTarget(targetType) || !targetId) return;

  const slug = await setContentStatus(targetType, targetId, "PUBLISHED");
  await closeReports(targetType, targetId, "DISMISSED");
  await db.auditLog.create({
    data: { actorId: user.id, action: "content.restore", target: targetId, details: { targetType } },
  });
  updateTag(WORKS_TAG);
  revalidatePath(`/oeuvres/${slug}`);
  revalidatePath("/admin/moderation");
}

/** Clôt un signalement sans toucher au contenu (signalement infondé). */
export async function dismissReport(formData: FormData) {
  const user = await requireStaff(MODERATION_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.report.update({ where: { id }, data: { status: "DISMISSED" } }).catch(() => null);
  await db.auditLog.create({ data: { actorId: user.id, action: "report.dismiss", target: id } });
  revalidatePath("/admin/moderation");
}
