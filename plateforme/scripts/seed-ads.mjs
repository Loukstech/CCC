// Publicités de démonstration, pour que l'écran publicitaire et les bandeaux ne soient pas vides.
//
//   npm run db:ads
//
// Idempotent : une publicité déjà présente (même annonceur + même titre) est mise à jour, pas dupliquée.
// Les images sont des visuels locaux (public/ads) : aucun service extérieur n'est appelé, et le rendu
// reste identique même sans connexion. Les annonceurs sont fictifs : à remplacer par les vrais.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ADS = [
  {
    placement: "HOME",
    advertiser: "Librairie La Bonne Nouvelle",
    title: "Bibles, cantiques et livres de méditation",
    text: "Livraison à Cotonou, Porto-Novo et Lomé. −10 % avec le code CCC10.",
    imageUrl: "/ads/librairie.svg",
    linkUrl: "https://exemple-ccc.test/librairie",
  },
  {
    placement: "CATALOG",
    advertiser: "Imprimerie Béthel",
    title: "Imprimez vos livres à petit prix",
    text: "Couverture, dos collé, 100 exemplaires minimum. Devis en 48 heures.",
    imageUrl: "/ads/imprimerie.svg",
    linkUrl: "https://exemple-ccc.test/imprimerie",
  },
  {
    placement: "WORK",
    advertiser: "Agence Espérance Voyages",
    title: "Pèlerinage en Terre Sainte — 2027",
    text: "Douze jours accompagnés par un guide de l’Église. Inscriptions ouvertes.",
    imageUrl: "/ads/pelerinage.svg",
    linkUrl: "https://exemple-ccc.test/pelerinage",
  },
  {
    placement: "STICKY",
    advertiser: "Radio Céleste FM",
    title: "La prière du matin, en direct à 5 h",
    text: "Écoutez la radio de l’Église où que vous soyez.",
    imageUrl: "/ads/radio.svg",
    linkUrl: "https://exemple-ccc.test/radio",
  },
  {
    placement: "INTERSTITIAL",
    advertiser: "Rencontre des jeunes — Cotonou",
    title: "Trois jours de retraite, du 12 au 14 mars",
    text: "Chants, enseignements et veillée. Participation libre, repas compris.",
    imageUrl: "/ads/rencontre.svg",
    linkUrl: "https://exemple-ccc.test/rencontre",
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  for (const ad of ADS) {
    const { rows } = await client.query('SELECT id FROM "Ad" WHERE advertiser = $1 AND title = $2', [
      ad.advertiser,
      ad.title,
    ]);

    if (rows.length > 0) {
      await client.query(
        `UPDATE "Ad" SET placement = $2, text = $3, "imageUrl" = $4, "linkUrl" = $5, active = true WHERE id = $1`,
        [rows[0].id, ad.placement, ad.text, ad.imageUrl, ad.linkUrl],
      );
      console.log(`mis à jour · ${ad.placement} · ${ad.title}`);
      continue;
    }

    await client.query(
      `INSERT INTO "Ad" (id, placement, title, advertiser, text, "imageUrl", "linkUrl", active, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, now())`,
      [randomUUID(), ad.placement, ad.title, ad.advertiser, ad.text, ad.imageUrl, ad.linkUrl],
    );
    console.log(`créée · ${ad.placement} · ${ad.title}`);
  }

  await client.query("COMMIT");
  console.log("Publicités de démonstration en place.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Import annulé :", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
