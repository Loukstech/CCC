import { NextResponse } from "next/server";
import { dayKey } from "@/lib/ads";
import { db } from "@/lib/db";

/**
 * Compte un affichage de publicité. Appelée par le navigateur une seule fois par publicité et par
 * séance : le bandeau se recharge à chaque page, mais un visiteur ne doit pas gonfler le compteur.
 *
 * La réponse est vide (204) : l'appel part en arrière-plan, rien ne doit s'afficher ni bloquer la page.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const day = dayKey();

  // Une publicité supprimée entre l'affichage et l'appel ne doit pas produire d'erreur visible.
  await db
    .$transaction([
      db.ad.update({ where: { id }, data: { impressions: { increment: 1 } }, select: { id: true } }),
      db.adDailyStat.upsert({
        where: { adId_day: { adId: id, day } },
        update: { impressions: { increment: 1 } },
        create: { adId: id, day, impressions: 1 },
      }),
    ])
    .catch(() => null);

  return new NextResponse(null, { status: 204 });
}
