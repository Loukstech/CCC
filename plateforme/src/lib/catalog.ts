import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const WORKS_TAG = "works";

const publicSelect = {
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
  prices: { select: { country: true, currency: true, amount: true } },
  licenses: { select: { countries: true, allowOffline: true, startsAt: true, endsAt: true } },
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
