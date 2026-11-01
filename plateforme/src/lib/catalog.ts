import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

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
  prices: { select: { country: true, currency: true, amount: true } },
  licenses: { select: { countries: true, allowWeb: true, allowOffline: true, startsAt: true, endsAt: true } },
} as const;

export async function getPublishedWorks() {
  "use cache";
  cacheTag(WORKS_TAG);
  cacheLife("minutes");
  return db.work.findMany({
    where: { status: "PUBLISHED" },
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
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { author: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    select: publicSelect,
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
  typeLabel: string;
  priceLabel: string;
  free: boolean;
  language: string;
  meta: string | null;
  isNew: boolean;
  /** Livre dont le fichier est disponible : il peut être ouvert dans le lecteur. */
  readable: boolean;
};

type CardSource = Awaited<ReturnType<typeof getPublishedWorks>>[number];

/** Version sérialisable d'une œuvre, prête à être passée aux composants d'affichage. */
export function toCard(w: CardSource, isNew = false): CardItem {
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
    typeLabel: TYPE_LABEL[w.type],
    priceLabel: w.access === "PURCHASE" && price ? formatPrice(price) : ACCESS_LABEL[w.access],
    free: w.access === "FREE",
    language: w.language.toUpperCase(),
    meta,
    isNew,
    readable: w.type === "BOOK" && !!w.fileKey,
  };
}
