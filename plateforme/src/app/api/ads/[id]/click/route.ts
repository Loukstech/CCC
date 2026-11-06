import { NextResponse } from "next/server";
import { dayKey } from "@/lib/ads";
import { db } from "@/lib/db";

/** Compte un clic sur une publicité puis redirige vers le site de l'annonceur. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const day = dayKey();

  // Compteur de toujours (affiché dans la liste) et détail du jour (pour la facturation).
  const ad = await db.ad
    .update({ where: { id }, data: { clicks: { increment: 1 } }, select: { linkUrl: true } })
    .catch(() => null);
  if (ad) {
    await db.adDailyStat
      .upsert({
        where: { adId_day: { adId: id, day } },
        update: { clicks: { increment: 1 } },
        create: { adId: id, day, clicks: 1 },
      })
      .catch(() => null);
  }

  const target = ad && /^https?:\/\//i.test(ad.linkUrl) ? ad.linkUrl : new URL("/", request.url).toString();
  return NextResponse.redirect(target, 302);
}
