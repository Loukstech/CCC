// Amorçage du référentiel diocèses / paroisses — à lancer avec : npm run db:dioceses
// Idempotent : relancer le script ne crée pas de doublon et n'écrase pas les corrections faites
// depuis l'administration, sauf le nom du diocèse et la ville des paroisses.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DIOCESES } from "./referentiel-dioceses";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  let dioceses = 0;
  let parishes = 0;

  for (const d of DIOCESES) {
    const diocese = await db.diocese.upsert({
      where: { slug: d.slug },
      update: { name: d.name, country: d.country },
      create: { slug: d.slug, name: d.name, country: d.country },
      select: { id: true },
    });
    dioceses++;

    for (const p of d.parishes) {
      await db.parish.upsert({
        where: { dioceseId_name: { dioceseId: diocese.id, name: p.name } },
        update: { city: p.city },
        create: { dioceseId: diocese.id, name: p.name, city: p.city },
      });
      parishes++;
    }
  }

  console.log(`${dioceses} diocèses et ${parishes} paroisses en place.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
