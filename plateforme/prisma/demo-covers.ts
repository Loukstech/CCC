// Attribue des photos libres (Pexels) aux œuvres de démonstration sans couverture.
// À lancer avec : npm run db:covers (ajouter -- --refresh pour remplacer les photos déjà attribuées)
// Les vraies couvertures viendront des ayants droit : ce script ne touche qu'aux œuvres « démo ».
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const QUERIES = {
  BOOK: "bible open book candle light",
  DOCUMENTARY: "church community africa worship",
  FILM: "church stained glass light",
} as const;

type Photo = { src: { portrait: string } };

async function search(query: string): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY manquante dans .env");
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=20`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) throw new Error(`Pexels : HTTP ${res.status}`);
  const data = (await res.json()) as { photos: Photo[] };
  return data.photos.map((p) => p.src.portrait);
}

async function main() {
  const works = await db.work.findMany({
    where: {
      ...(process.argv.includes("--refresh") ? {} : { coverUrl: null }),
      OR: [{ slug: { startsWith: "demo-" } }, { slug: { startsWith: "exemple-" } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, type: true },
  });

  const pools = {
    BOOK: await search(QUERIES.BOOK),
    DOCUMENTARY: await search(QUERIES.DOCUMENTARY),
    FILM: await search(QUERIES.FILM),
  };
  const used = { BOOK: 0, DOCUMENTARY: 0, FILM: 0 };

  for (const w of works) {
    const pool = pools[w.type];
    const url = pool[used[w.type]++ % pool.length];
    if (!url) continue;
    await db.work.update({ where: { id: w.id }, data: { coverUrl: url } });
    console.log(`${w.slug} → photo attribuée`);
  }
  console.log(`${works.length} œuvre(s) de démonstration mise(s) à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
