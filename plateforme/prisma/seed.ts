// Données de démonstration — à lancer avec : npm run db:seed
// Aucune œuvre réelle : uniquement des exempless pour tester l'application.
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function hash(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@ccc.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin-ccc-dev-2026";

  await db.user.upsert({
    where: { email },
    update: { staffRole: "SUPER_ADMIN" },
    create: {
      email,
      name: "Administrateur",
      country: "BJ",
      staffRole: "SUPER_ADMIN",
      passwordHash: hash(password),
    },
  });

  type Demo = {
    slug: string;
    type: "BOOK" | "FILM" | "DOCUMENTARY";
    title: string;
    author: string;
    description: string;
    access: "FREE" | "PURCHASE" | "SUBSCRIPTION";
    pages?: number;
    fileKey?: string; // fichier du livre dans storage/books
    durationMin?: number;
    price?: number; // F CFA
  };
  const demo: Demo[] = [
    {
      slug: "exemple-livre-gratuit",
      type: "BOOK",
      title: "Prières du matin",
      author: "Auteur",
      description: "Recueil de prières et de méditations pour commencer la journée.",
      access: "FREE",
      pages: 120,
      fileKey: "exemple-livre-gratuit.epub",
    },
    {
      slug: "exemple-documentaire",
      type: "DOCUMENTARY",
      title: "Aux sources de la foi",
      author: "Réalisateur",
      description: "Documentaire sur les origines et les premiers pas d’une communauté chrétienne.",
      access: "SUBSCRIPTION",
      durationMin: 52,
      fileKey: "exemple-documentaire.mp4",
    },
    {
      slug: "demo-livre-histoire",
      type: "BOOK",
      title: "Les chemins de la foi",
      author: "Auteur",
      description: "Livre : un récit de foi et de persévérance, pour tester les livres payants à l’unité.",
      access: "PURCHASE",
      pages: 240,
      price: 3000,
      fileKey: "demo-livre-histoire.epub",
    },
    {
      slug: "demo-livre-temoignages",
      type: "BOOK",
      title: "Témoignages de grâce",
      author: "Collectif",
      description: "Recueil de témoignages de fidèles, pour tester une seconde ligne du catalogue.",
      access: "PURCHASE",
      pages: 180,
      price: 2500,
      fileKey: "demo-livre-temoignages.epub",
    },
    {
      slug: "demo-livre-priere",
      type: "BOOK",
      title: "Cantiques et louanges",
      author: "Auteur",
      description: "Recueil de cantiques, gratuit, pour tester la rangée des contenus gratuits.",
      access: "FREE",
      pages: 64,
      fileKey: "demo-livre-priere.epub",
    },
    {
      slug: "demo-documentaire-histoire",
      type: "DOCUMENTARY",
      title: "Mémoire et héritage de l’Église",
      author: "Réalisateur",
      description: "Documentaire sur l’histoire et la transmission au sein d’une Église.",
      access: "SUBSCRIPTION",
      durationMin: 74,
      fileKey: "demo-documentaire-histoire.mp4",
    },
    {
      slug: "demo-documentaire-gratuit",
      type: "DOCUMENTARY",
      title: "Visages de la communauté",
      author: "Réalisateur",
      description: "Documentaire gratuit : portraits de fidèles, pour découvrir la plateforme.",
      access: "FREE",
      durationMin: 28,
      fileKey: "demo-documentaire-gratuit.mp4",
    },
    {
      slug: "demo-film-1",
      type: "FILM",
      title: "Le berger et la lumière",
      author: "Réalisateur",
      description: "Film inspiré d’une parabole, pour tester l’affichage des films.",
      access: "SUBSCRIPTION",
      durationMin: 98,
      fileKey: "demo-film-1.mp4",
    },
    {
      slug: "demo-film-2",
      type: "FILM",
      title: "Le retour du fils",
      author: "Réalisateur",
      description: "Film acheté à l’unité, pour tester les prix.",
      access: "PURCHASE",
      durationMin: 105,
      price: 2000,
      fileKey: "demo-film-2.mp4",
    },
    {
      slug: "demo-film-3",
      type: "FILM",
      title: "La route de l’espérance",
      author: "Réalisateur",
      description: "Film gratuit : un voyage, une rencontre, une promesse.",
      access: "FREE",
      durationMin: 87,
      fileKey: "demo-film-3.mp4",
    },
    {
      slug: "demo-film-4",
      type: "FILM",
      title: "Veillée de nuit",
      author: "Réalisateur",
      description: "Film sur une nuit de prière dans un village, pour tester l’abonnement.",
      access: "SUBSCRIPTION",
      durationMin: 112,
      fileKey: "demo-film-4.mp4",
    },
    {
      slug: "demo-documentaire-chants",
      type: "DOCUMENTARY",
      title: "Chants de louange",
      author: "Réalisateur",
      description: "Documentaire sur la musique et le chant dans la vie d’une communauté.",
      access: "SUBSCRIPTION",
      durationMin: 46,
      fileKey: "demo-documentaire-chants.mp4",
    },
    {
      slug: "demo-livre-vivre",
      type: "BOOK",
      title: "Vivre en Christ au quotidien",
      author: "Auteur",
      description: "Livre : méditations pour la vie de tous les jours.",
      access: "PURCHASE",
      pages: 150,
      price: 2000,
      fileKey: "demo-livre-vivre.epub",
    },
  ];

  for (const { price, ...w } of demo) {
    await db.work.upsert({
      where: { slug: w.slug },
      update: { title: w.title, description: w.description, ...(w.fileKey ? { fileKey: w.fileKey } : {}) },
      create: {
        ...w,
        status: "PUBLISHED",
        publishedAt: new Date(),
        licenses: { create: { countries: ["BJ", "TG", "FR"], contractRef: "DEMO-000" } },
        ...(price ? { prices: { create: { country: "BJ", currency: "XOF", amount: price } } } : {}),
      },
    });
  }

  // Prix d'abonnement de démonstration (valeurs d'exemple : à fixer après enquête, voir cahier des charges 24).
  const plans = [
    { plan: "MONTHLY" as const, country: "BJ", currency: "XOF", amount: 2000 },
    { plan: "YEARLY" as const, country: "BJ", currency: "XOF", amount: 20000 },
    { plan: "MONTHLY" as const, country: "TG", currency: "XOF", amount: 2000 },
    { plan: "YEARLY" as const, country: "TG", currency: "XOF", amount: 20000 },
    { plan: "MONTHLY" as const, country: "FR", currency: "EUR", amount: 499 },
    { plan: "YEARLY" as const, country: "FR", currency: "EUR", amount: 4990 },
  ];
  for (const p of plans) {
    await db.planPrice.upsert({
      where: { plan_country: { plan: p.plan, country: p.country } },
      update: {},
      create: p,
    });
  }

  console.log(`Administrateur de démonstration : ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
