// Attache les sous-titres de démonstration aux vidéos gratuites du catalogue.
//
//   npm run db:subtitles
//
// Idempotent : relancer le script met à jour les pistes existantes sans créer de doublon
// (contrainte unique `workId` + `lang`). Les fichiers .vtt sont dans public/subtitles et
// servis tels quels par Next : le navigateur les charge directement via la balise <track>.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

// Seules les œuvres gratuites reçoivent des sous-titres de démonstration : elles se testent
// sans abonnement ni achat. Les autres pistes s'ajoutent depuis /admin.
const TRACKS = [
  { slug: "demo-film-3", lang: "fr", label: "Français", src: "/subtitles/demo-film-3.fr.vtt", isDefault: true },
  { slug: "demo-film-3", lang: "en", label: "English", src: "/subtitles/demo-film-3.en.vtt", isDefault: false },
  {
    slug: "demo-documentaire-gratuit",
    lang: "fr",
    label: "Français",
    src: "/subtitles/demo-documentaire-gratuit.fr.vtt",
    isDefault: true,
  },
  {
    slug: "demo-documentaire-gratuit",
    lang: "en",
    label: "English",
    src: "/subtitles/demo-documentaire-gratuit.en.vtt",
    isDefault: false,
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  for (const track of TRACKS) {
    const { rows } = await client.query('SELECT id FROM "Work" WHERE slug = $1', [track.slug]);
    if (rows.length === 0) {
      console.warn(`${track.slug} : œuvre absente, piste ignorée.`);
      continue;
    }
    const workId = rows[0].id;

    // Une seule piste par défaut par œuvre : on remet les autres à false avant d'écrire.
    if (track.isDefault) {
      await client.query('UPDATE "Subtitle" SET "isDefault" = false WHERE "workId" = $1', [workId]);
    }

    await client.query(
      `INSERT INTO "Subtitle" (id, "workId", lang, label, src, "isDefault")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("workId", lang) DO UPDATE SET
         label = EXCLUDED.label,
         src = EXCLUDED.src,
         "isDefault" = EXCLUDED."isDefault"`,
      [randomUUID(), workId, track.lang, track.label, track.src, track.isDefault],
    );

    console.log(`${track.slug} · ${track.lang} → ${track.src}${track.isDefault ? " (par défaut)" : ""}`);
  }

  await client.query("COMMIT");
  console.log("Sous-titres de démonstration en place.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import annulé :", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
