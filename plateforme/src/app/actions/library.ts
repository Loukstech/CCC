"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { getCountry, isAvailable } from "@/lib/rights";

/**
 * Ajoute une œuvre gratuite à la bibliothèque. Toutes les règles sont revérifiées ici :
 * compte connecté, œuvre publiée et gratuite, disponible dans le pays de l'utilisateur.
 */
export async function addToLibrary(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const workId = String(formData.get("workId") ?? "");
  const work = await db.work.findFirst({
    where: { id: workId, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      access: true,
      licenses: { select: { countries: true, allowWeb: true, startsAt: true, endsAt: true } },
    },
  });
  if (!work || work.access !== "FREE") return;

  const country = await getCountry(user);
  if (!country || !isAvailable(work.licenses, country, new Date())) return;

  const owned = await db.order.findFirst({
    where: { userId: user.id, workId: work.id, status: "PAID" },
    select: { id: true },
  });
  if (!owned) {
    await db.order.create({
      data: {
        userId: user.id,
        workId: work.id,
        status: "PAID",
        currency: "XOF",
        amount: 0,
        provider: "free",
        paidAt: new Date(),
      },
    });
  }

  revalidatePath(`/oeuvres/${work.slug}`);
  revalidatePath("/bibliotheque");
}
