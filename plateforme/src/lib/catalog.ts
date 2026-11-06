import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Lang } from "@/lib/i18n";

export const WORKS_TAG = "works";

export const publicSelect = {
  id: true,
  slug: true,
  type: true,
  title: true,
  author: true,
  description: true,
  coverUrl: true,
  language: true,
  access: true,
  durationMin: true,
  pages: true,
  downloadable: true,
  fileKey: true,
  publishedAt: true,
  translationGroupId: true,
  translationPrimary: true,
  prices: { select: { country: true, currency: true, amount: true } },
  licenses: { select: { countries: true, allowWeb: true, allowOffline: true, startsAt: true, endsAt: true } },
} as const;

/**
 * Une seule fiche par titre traduit dans les listes : l'édition de référence. Les autres éditions
 * restent accessibles par leur adresse et par le sélecteur de langue de la fiche.
 */
const NOT_A_SECOND_EDITION: Prisma.WorkWhereInput = {
  OR: [{ translationGroupId: null }, { translationPrimary: true }],
};

export async function getPublishedWorks() {
  "use cache";
  cacheTag(WORKS_TAG);
  cacheLife("minutes");
  return db.work.findMany({
    where: { status: "PUBLISHED", ...NOT_A_SECOND_EDITION },
    orderBy: { publishedAt: "desc" },
    select: publicSelect,
  });
}

export async function getPublishedWork(slug: string) {
  "use cache";
  cacheTag(WORKS_TAG);
  cacheLife("minutes");
  return db.work.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: publicSelect,
  });
}

export async function searchPublishedWorks(query: string) {
  "use cache";
  cacheTag(WORKS_TAG);
  cacheLife("minutes");
  return db.work.findMany({
    where: {
      status: "PUBLISHED",
      AND: [
        NOT_A_SECOND_EDITION,
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { author: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: { publishedAt: "desc" },
    select: publicSelect,
  });
}

/** Les éditions d'un même titre (versions en plusieurs langues), référence en tête. */
export async function getEditions(groupId: string) {
  "use cache";
  cacheTag(WORKS_TAG);
  cacheLife("minutes");
  return db.work.findMany({
    where: { translationGroupId: groupId, status: "PUBLISHED" },
    orderBy: [{ translationPrimary: "desc" }, { language: "asc" }],
    select: { id: true, slug: true, title: true, language: true, translationPrimary: true },
  });
}

/** Prix applicable : celui du pays de l'utilisateur, sinon le premier prix défini. */
export function priceFor<P extends { country: string }>(prices: P[], country: string | null): P | undefined {
  return prices.find((p) => p.country === country) ?? prices[0];
}

export const TYPE_LABEL = {
  BOOK: "Livre",
  FILM: "Film",
  DOCUMENTARY: "Documentaire",
} as const;

export const ACCESS_LABEL = {
  FREE: "Gratuit",
  PURCHASE: "Achat à l’unité",
  SUBSCRIPTION: "Abonnement",
} as const;

export function formatPrice(p: { currency: string; amount: number }) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: p.currency === "XOF" ? 0 : 2,
  }).format(p.currency === "XOF" ? p.amount : p.amount / 100);
}

export type CardItem = {
  id: string;
  slug: string;
  type: "BOOK" | "FILM" | "DOCUMENTARY";
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  /** Langue de l'interface : les composants d'affichage traduisent leurs textes avec elle. */
  ui: Lang;
  access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
  /** Prix à l'unité, dans la devise d'origine (plus petite unité) ; null si l'œuvre n'est pas à l'achat. */
  priceAmount: number | null;
  priceCurrency: string | null;
  free: boolean;
  language: string;
  meta: string | null;
  isNew: boolean;
  /** Livre dont le fichier est disponible : il peut être ouvert dans le lecteur. */
  readable: boolean;
  /** Film ou documentaire dont la vidéo est disponible : il peut être ouvert dans le lecteur vidéo. */
  watchable: boolean;
};

type CardSource = Awaited<ReturnType<typeof getPublishedWorks>>[number];

/** Version sérialisable d'une œuvre, prête à être passée aux composants d'affichage. */
export function toCard(w: CardSource, isNew = false, ui: Lang = "fr"): CardItem {
  const price = w.prices[0];
  const meta = w.durationMin ? `${w.durationMin} min` : w.pages ? `${w.pages} pages` : null;
  return {
    id: w.id,
    slug: w.slug,
    type: w.type,
    title: w.title,
    author: w.author,
    description: w.description,
    coverUrl: w.coverUrl,
    ui,
    access: w.access,
    priceAmount: w.access === "PURCHASE" && price ? price.amount : null,
    priceCurrency: w.access === "PURCHASE" && price ? price.currency : null,
    free: w.access === "FREE",
    language: w.language.toUpperCase(),
    meta,
    isNew,
    readable: w.type === "BOOK" && !!w.fileKey,
    watchable: w.type !== "BOOK" && !!w.fileKey,
  };
}
