// Ajoute les deux livres fournis par le client à la base (catalogue + licence).
//
//   npm run db:client-books
//
// Idempotent : relancer le script ne crée pas de doublon. Les EPUB correspondants sont
// régénérés au build par scripts/make-demo-epub.mjs depuis scripts/client-books.json.
// Ces œuvres sont GRATUITES : le lecteur les ajoute à sa bibliothèque en un clic, ce qui
// permet de tester immédiatement la lecture à voix haute sans passer par un paiement.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Tous les pays du pilote : la disponibilité dépend du pays détecté chez le visiteur.
const COUNTRIES = [
  "BJ", "TG", "NG", "GH", "NE", "BF", "CI", "SN", "ML", "LR", "SL",
  "CM", "GA", "CG", "CD", "KE", "ZA",
  "FR", "GB", "BE", "CH", "DE", "IT", "ES", "PT", "NL",
  "CA", "US", "BR",
];

const CONTRACT_REF = "DOC-CLIENT-2026-11-06 (test de lecture)";

const BOOKS = [
  {
    slug: "client-lumiere-christianisme-celeste",
    title: "Lumière sur le christianisme céleste",
    author: "Texte fourni par le client",
    description:
      "Document historique sur l'Église du Christianisme Céleste (préambule, histoire, hiérarchie et usages). " +
      "Source : PDF de 35 pages fourni par le client. Texte importé pour les tests du lecteur et de la lecture à voix haute.",
    pages: 35,
  },
  {
    slug: "client-constitution-bleue",
    title: "Constitution bleue — acte de constitution",
    author: "Texte fourni par le client",
    description:
      "Acte de constitution de l'Église du Christianisme Céleste, diocèse du Nigeria (29 mars 1980, chapitre 107). " +
      "Source : PDF de 5 pages fourni par le client. Texte importé pour les tests du lecteur et de la lecture à voix haute.",
    pages: 5,
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  for (const book of BOOKS) {
    const fileKey = `${book.slug}.epub`;
    const { rows } = await client.query(
      `INSERT INTO "Work"
         (id, type, slug, title, author, description, language, status, access,
          "publishedAt", "fileKey", pages, downloadable)
       VALUES
         ($1, 'BOOK'::"WorkType", $2, $3, $4, $5, 'fr', 'PUBLISHED'::"WorkStatus",
          'FREE'::"AccessMode", now(), $6, $7, false)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         author = EXCLUDED.author,
         description = EXCLUDED.description,
         language = 'fr',
         status = 'PUBLISHED'::"WorkStatus",
         access = 'FREE'::"AccessMode",
         "fileKey" = EXCLUDED."fileKey",
         pages = EXCLUDED.pages,
         "publishedAt" = COALESCE("Work"."publishedAt", now())
       RETURNING id`,
      [randomUUID(), book.slug, book.title, book.author, book.description, fileKey, book.pages],
    );
    const workId = rows[0].id;

    // Une seule licence par œuvre : pays, web autorisé, référence de contrat documentée.
    const licence = await client.query('SELECT id FROM "License" WHERE "workId" = $1 LIMIT 1', [workId]);
    if (licence.rows.length === 0) {
      await client.query(
        `INSERT INTO "License" (id, "workId", countries, "allowWeb", "allowMobile", "allowOffline", "contractRef")
         VALUES ($1, $2, $3::text[], true, true, false, $4)`,
        [randomUUID(), workId, COUNTRIES, CONTRACT_REF],
      );
    } else {
      await client.query(
        `UPDATE "License" SET countries = $2::text[], "allowWeb" = true, "contractRef" = $3 WHERE id = $1`,
        [licence.rows[0].id, COUNTRIES, CONTRACT_REF],
      );
    }

    console.log(`${book.slug} → ${workId} (${book.pages} p., gratuit, ${COUNTRIES.length} pays)`);
  }

  await client.query("COMMIT");
  console.log("Livres du client présents dans le catalogue.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import annulé :", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
