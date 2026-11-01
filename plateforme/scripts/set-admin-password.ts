// Change le mot de passe de l'administrateur (à faire AVANT toute mise en ligne : le mot de passe de démonstration
// du jeu de données est écrit dans le dépôt).
//
//   npm run admin:password                 → génère un mot de passe aléatoire et l'affiche une seule fois
//   ADMIN_PASSWORD='...' npm run admin:password   → utilise le mot de passe donné (12 caractères minimum)
//   ADMIN_EMAIL='autre@exemple.fr' ...     → cible un autre compte (par défaut : admin@ccc.local)
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Même format que src/lib/password.ts : scrypt$sel$empreinte
function hash(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@ccc.local").toLowerCase();
  const given = process.env.ADMIN_PASSWORD;
  if (given !== undefined && given.length < 12) throw new Error("Le mot de passe doit contenir au moins 12 caractères.");
  const password = given ?? randomBytes(15).toString("base64url");

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`Aucun compte avec l'adresse ${email}.`);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hash(password) } });

  console.log(`Mot de passe de ${email} changé.`);
  if (!given) console.log(`Nouveau mot de passe (notez-le maintenant, il ne sera plus affiché) : ${password}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
