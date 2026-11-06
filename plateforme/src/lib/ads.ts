import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const ADS_TAG = "ads";

export type AdPlacementKey = "HOME" | "CATALOG" | "WORK" | "STICKY" | "INTERSTITIAL";

/**
 * Journée de facturation, ramenée à l'heure du pilote (UTC+1 : Bénin, Togo, Nigeria, Cameroun).
 * Un affichage à 23 h 30 à Cotonou compte donc bien pour le jour même, pas pour la veille en UTC.
 */
export function dayKey(at: Date = new Date()) {
  const shifted = new Date(at.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

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

/**
 * Affichages et clics des derniers jours, tous emplacements confondus.
 * Mis en cache une minute : c'est un écran de pilotage, pas un compteur temps réel.
 */
export async function getAdDailyStats(days = 7) {
  "use cache";
  cacheTag(ADS_TAG);
  cacheLife("minutes");
  const since = dayKey(new Date(Date.now() - (days - 1) * 86_400_000));
  try {
    return await db.adDailyStat.groupBy({
      by: ["day"],
      where: { day: { gte: since } },
      _sum: { impressions: true, clicks: true },
      orderBy: { day: "asc" },
    });
  } catch (error) {
    console.error("Statistiques publicitaires indisponibles :", error);
    return [];
  }
}
