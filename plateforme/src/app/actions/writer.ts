"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { keep, type FormState } from "@/lib/form";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

/** Profil d'auteur : nom de plume, présentation et coordonnées de versement. Validé ensuite par l'administration. */
export async function saveWriterProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const lang = await getLang();
  const values = keep(formData, ["penName", "bio", "payoutNetwork", "payoutPhone"]);

  const penName = values.penName.trim() || null;
  const bio = values.bio.trim() || null;
  const payoutNetwork = values.payoutNetwork.trim() || null;
  const payoutPhone = values.payoutPhone.trim() || null;
  if (penName && penName.length < 2) return { error: t(lang, "ecr.penName"), values };

  await db.writerProfile.upsert({
    where: { userId: user.id },
    update: { penName, bio, payoutNetwork, payoutPhone },
    create: { userId: user.id, penName, bio, payoutNetwork, payoutPhone },
  });
  revalidatePath("/ecrivain");
  return { notice: t(lang, "ecr.saved"), values };
}

/** Dépôt d'un manuscrit (lot 7, optionnel). Le fichier est un lien : la démonstration n'a pas de stockage. */
export async function submitManuscript(_: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const lang = await getLang();
  const values = keep(formData, ["title", "language", "synopsis", "fileUrl"]);

  const title = values.title.trim();
  const language = (values.language.trim() || "fr").toLowerCase().slice(0, 5);
  const synopsis = values.synopsis.trim() || null;
  const fileUrl = values.fileUrl.trim() || null;

  if (title.length < 2) return { error: t(lang, "ecr.msTitle"), values };
  if (fileUrl && !/^https?:\/\//i.test(fileUrl)) return { error: t(lang, "ecr.msUrl"), values };

  await db.manuscript.create({
    data: { authorId: user.id, title, language, synopsis, fileUrl },
  });
  revalidatePath("/ecrivain");
  revalidatePath("/admin/manuscrits");
  return { notice: t(lang, "ecr.msSent"), values: { title: "", language, synopsis: "", fileUrl: "" } };
}
