import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const ADS_TAG = "ads";

export type AdPlacementKey = "HOME" | "CATALOG" | "WORK" | "STICKY";

/** Publicités actives d'un emplacement (période de diffusion respectée). Mise en cache quelques minutes. */
export async function getAds(placement: AdPlacementKey) {
  "use cache";
  cacheTag(ADS_TAG);
  cacheLife("minutes");
  const now = new Date();
  try {
    return await db.ad.findMany({
      where: {
        placement,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, advertiser: true, text: true, imageUrl: true },
    });
  } catch (error) {
    // Une panne des publicités (par exemple une migration pas encore appliquée) ne doit jamais bloquer le catalogue.
    console.error("Publicités indisponibles :", error);
    return [];
  }
}
