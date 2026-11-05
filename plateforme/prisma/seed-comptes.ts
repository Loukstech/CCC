// Comptes de démonstration — à lancer avec : npm run db:comptes
//
// Idempotent : relancer le script remet les mots de passe de démonstration, réattribue les œuvres
// et ne crée pas de doublon. Les identifiants sont volontairement fixes et documentés dans
// docs/comptes-demo.md : c'est une base de démonstration, pas la production.
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

type Account = {
  email: string;
  name: string;
  password: string;
  staffRole?: "SUPER_ADMIN";
  dioceseSlug?: string;
  role?: "ADMIN" | "VIEWER";
  country?: string;
  works?: string[];
  /** Paroisse de rattachement : nécessaire pour un fidèle (et pour tester un achat, donc une commission diocèse). */
  parish?: string;
};

const ACCOUNTS: Account[] = [
  {
    email: "admin@ccc.example",
    name: "Administration CCC",
    password: "Admin-2026",
    staffRole: "SUPER_ADMIN",
    country: "BJ",
  },
  {
    email: "benin@ccc.example",
    name: "Espace diocèse Bénin",
    password: "Benin-2026",
    dioceseSlug: "benin",
    role: "ADMIN",
    country: "BJ",
  },
  {
    email: "togo@ccc.example",
    name: "Espace diocèse Togo",
    password: "Togo-2026",
    dioceseSlug: "togo",
    role: "ADMIN",
    country: "TG",
  },
  {
    email: "nigeria@ccc.example",
    name: "Espace diocèse Nigeria",
    password: "Nigeria-2026",
    dioceseSlug: "nigeria",
    role: "ADMIN",
    country: "NG",
  },
  {
    email: "auteur1@ccc.example",
    name: "Awa Sossou",
    password: "Auteur1-2026",
    country: "BJ",
    works: ["exemple-livre-gratuit", "demo-livre-histoire", "demo-livre-temoignages"],
  },
  {
    email: "auteur2@ccc.example",
    name: "Kossi Agbeko",
    password: "Auteur2-2026",
    country: "TG",
    works: ["demo-livre-priere", "demo-livre-vivre"],
  },
  {
    email: "auteur3@ccc.example",
    name: "Chidi Okonkwo",
    password: "Auteur3-2026",
    country: "NG",
    works: [
      "exemple-documentaire",
      "demo-documentaire-histoire",
      "demo-documentaire-gratuit",
      "demo-documentaire-chants",
    ],
  },
  {
    email: "auteur4@ccc.example",
    name: "Mariam Dossou",
    password: "Auteur4-2026",
    country: "BJ",
    works: ["demo-film-1", "demo-film-2"],
  },
  {
    email: "auteur5@ccc.example",
    name: "Tunde Adeyemi",
    password: "Auteur5-2026",
    country: "NG",
    works: ["demo-film-3", "demo-film-4"],
  },
  {
    email: "fidele.demo@ccc.example",
    name: "Fidèle Démo",
    password: "Fidele-2026",
    country: "BJ",
    parish: "Paroisse Mont Sinaï",
  },
];

async function main() {
  let created = 0;
  let updated = 0;
  let attached = 0;

  for (const a of ACCOUNTS) {
    const existed = await db.user.findUnique({ where: { email: a.email }, select: { id: true } });

    const user = await db.user.upsert({
      where: { email: a.email },
      update: {
        name: a.name,
        country: a.country ?? null,
        passwordHash: hash(a.password),
        disabledAt: null,
        ...(a.staffRole ? { staffRole: a.staffRole } : {}),
      },
      create: {
        email: a.email,
        name: a.name,
        country: a.country ?? null,
        locale: "fr",
        passwordHash: hash(a.password),
        staffRole: a.staffRole ?? null,
      },
      select: { id: true },
    });
    if (existed) updated++;
    else created++;

    if (a.dioceseSlug) {
      const diocese = await db.diocese.findUnique({ where: { slug: a.dioceseSlug }, select: { id: true } });
      if (!diocese) {
        console.warn(`Diocèse "${a.dioceseSlug}" introuvable — lancez d'abord npm run db:dioceses.`);
      } else {
        await db.dioceseAdmin.upsert({
          where: { userId_dioceseId: { userId: user.id, dioceseId: diocese.id } },
          update: { role: a.role ?? "ADMIN" },
          create: { userId: user.id, dioceseId: diocese.id, role: a.role ?? "ADMIN" },
        });
      }
    }

    if (a.works?.length) {
      const res = await db.work.updateMany({
        where: { slug: { in: a.works } },
        data: { authorId: user.id, author: a.name },
      });
      attached += res.count;
    }

    if (a.parish) {
      const parish = await db.parish.findFirst({
        where: { name: a.parish, active: true },
        select: { id: true },
      });
      if (!parish) {
        console.warn(`Paroisse "${a.parish}" introuvable — lancez d'abord npm run db:dioceses.`);
      } else {
        // Consentement explicite : sans lui, un fidèle ne peut pas créer de commande rattachée à un diocèse.
        await db.user.update({
          where: { id: user.id },
          data: { parishId: parish.id, parishConsentAt: new Date() },
        });
      }
    }
  }

  const orphan = await db.work.count({ where: { authorId: null } });
  console.log(`${created} compte(s) créé(s), ${updated} mis à jour, ${attached} œuvre(s) rattachée(s).`);
  if (orphan > 0) console.warn(`${orphan} œuvre(s) sans compte auteur.`);

  console.log("\nIdentifiants de démonstration :");
  for (const a of ACCOUNTS) {
    const scope = a.staffRole ?? (a.dioceseSlug ? `diocèse ${a.dioceseSlug}` : a.parish ? "fidèle" : "auteur");
    console.log(`  ${a.email.padEnd(24)} ${a.password.padEnd(14)} ${scope}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
