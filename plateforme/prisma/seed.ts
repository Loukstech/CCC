// Données de démonstration — à lancer avec : npm run db:seed
// Aucune œuvre réelle : uniquement des exemples fictifs pour tester l'application.
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

  const demo = [
    {
      slug: "exemple-livre-gratuit",
      type: "BOOK" as const,
      title: "Exemple de livre gratuit (démo)",
      author: "Auteur fictif",
      description: "Œuvre fictive pour tester l’affichage du catalogue.",
      access: "FREE" as const,
    },
    {
      slug: "exemple-documentaire",
      type: "DOCUMENTARY" as const,
      title: "Exemple de documentaire (démo)",
      author: "Réalisateur fictif",
      description: "Œuvre fictive pour tester les abonnements.",
      access: "SUBSCRIPTION" as const,
    },
  ];

  for (const w of demo) {
    await db.work.upsert({
      where: { slug: w.slug },
      update: {},
      create: {
        ...w,
        status: "PUBLISHED",
        publishedAt: new Date(),
        licenses: { create: { countries: ["BJ", "TG", "FR"], contractRef: "DEMO-000" } },
      },
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
