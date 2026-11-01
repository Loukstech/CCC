// Génère un livre EPUB de démonstration (texte fictif) dans storage/books/.
//
//   npm run demo:epub
//
// Ce n'est pas une œuvre réelle : il sert uniquement à tester le lecteur.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "storage", "books");
const outFile = join(outDir, "exemple-livre-gratuit.epub");

const TITLE = "Prières du matin (démo)";
const AUTHOR = "Auteur fictif";

const chapters = [
  {
    title: "S’éveiller dans la paix",
    text: [
      "Avant que la maison ne s’agite, avant les nouvelles et les messages, il existe un moment très court où le jour n’appartient encore à personne. C’est ce moment que ce petit recueil voudrait vous aider à habiter.",
      "Ouvrez les yeux lentement. Remerciez pour la nuit qui s’achève, même si elle fut courte, même si elle fut lourde. Le simple fait de respirer ce matin est un don que personne ne mérite et que chacun reçoit.",
      "Il n’est pas nécessaire de trouver de belles phrases. Une parole simple suffit : « Me voici. » Cette parole-là contient déjà tout ce qu’il faut pour commencer.",
      "Asseyez-vous si vous le pouvez. Posez vos mains ouvertes sur vos genoux, comme pour dire que vous ne retenez rien et que vous êtes prêt à recevoir. Laissez les pensées passer sans les suivre, comme des nuages au-dessus d’un champ.",
      "Quand vous êtes calme, dites intérieurement : « Que ce jour soit vécu dans la paix. Que mes paroles soient justes, que mes gestes soient doux, que mon cœur reste attentif. »",
      "Restez encore un instant. Le silence aussi est une prière.",
    ],
  },
  {
    title: "Rendre grâce",
    text: [
      "La gratitude change le regard avant de changer la vie. Celui qui apprend à remercier découvre, peu à peu, que ses journées sont plus riches qu’il ne le croyait.",
      "Prenez trois choses simples : un repas partagé hier, un visage qui vous a souri, une difficulté traversée. Nommez-les une à une. Ne cherchez pas l’extraordinaire : le quotidien est rempli de bienfaits que l’habitude a rendus invisibles.",
      "Remerciez aussi pour ce que vous n’avez pas encore. L’espérance est une façon de dire merci à l’avance, avec confiance, pour ce qui viendra.",
      "Puis pensez à ceux dont le travail rend votre matin possible : ceux qui ont préparé le pain, nettoyé les rues, allumé les lumières. Une petite bénédiction pour eux est une manière de rester humble et relié.",
      "Terminez par ces mots : « Merci pour ce qui est, pour ce qui fut, pour ce qui sera. »",
    ],
  },
  {
    title: "Confier la journée",
    text: [
      "Avant de partir, déposez ce qui vous inquiète. Il est inutile de porter seul le poids de toute la journée : elle se vivra heure après heure, et chaque heure aura sa force.",
      "Nommez ce qui vous attend : une rencontre, un travail, une décision, une visite. Confiez-le simplement, comme on confie un message à un ami fiable. Vous n’avez pas à tout maîtriser.",
      "Si une peur revient, ne la combattez pas. Reconnaissez-la, puis dites : « Je ne suis pas seul. » Répétez-le aussi souvent qu’il le faudra, jusqu’à ce que votre respiration se calme.",
      "Demandez la patience pour les moments d’attente, le courage pour les paroles difficiles, la lucidité pour les choix qui engagent. Demandez aussi la joie : elle est une force, pas un luxe.",
      "Puis levez-vous. La journée vous attend, et vous n’y entrez pas les mains vides.",
    ],
  },
  {
    title: "Bénir ceux que l’on aime",
    text: [
      "Avant de fermer le livre, pensez à ceux qui comptent pour vous. Les proches d’abord, ceux qui dorment encore ou qui sont déjà partis. Puis ceux qui sont loin, dont vous n’avez pas de nouvelles depuis longtemps.",
      "Souhaitez-leur simplement du bien : la santé, la paix, du travail, des amis fidèles. Ne cherchez pas à décider à leur place de ce qui leur est bon. Bénir, c’est vouloir le bien sans condition.",
      "N’oubliez pas ceux avec qui les relations sont tendues. C’est peut-être là que cette prière demande le plus de courage, et qu’elle porte le plus de fruits. Une bénédiction sincère adoucit toujours quelque chose, d’abord en vous.",
      "Que la paix de ce matin vous accompagne jusqu’au soir. Et si le soir vous trouve fatigué, revenez ici : ces pages seront toujours ouvertes.",
      "Fin du recueil de démonstration.",
    ],
  },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const css = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.65; margin: 0; padding: 0 0.4em; }
h1 { font-size: 1.5em; margin: 1.2em 0 0.8em; line-height: 1.25; }
p { margin: 0 0 1em; text-align: justify; }
.part { font-size: 0.8em; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.6; margin-top: 1.5em; }
`;

const page = (title, body) => `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file(
  "META-INF/container.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
);

const files = chapters.map((c, i) => ({ id: `chap${i + 1}`, href: `chap${i + 1}.xhtml`, ...c }));

zip.file(
  "OEBPS/content.opf",
  `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="fr">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:ccc:demo:exemple-livre-gratuit</dc:identifier>
    <dc:title>${esc(TITLE)}</dc:title>
    <dc:creator>${esc(AUTHOR)}</dc:creator>
    <dc:language>fr</dc:language>
    <meta property="dcterms:modified">2026-11-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="title" href="titre.xhtml" media-type="application/xhtml+xml"/>
${files.map((f) => `    <item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`).join("\n")}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
${files.map((f) => `    <itemref idref="${f.id}"/>`).join("\n")}
  </spine>
</package>`,
);

zip.file(
  "OEBPS/nav.xhtml",
  page(
    "Sommaire",
    `<nav epub:type="toc" id="toc"><h1>Sommaire</h1><ol>
<li><a href="titre.xhtml">${esc(TITLE)}</a></li>
${files.map((f) => `<li><a href="${f.href}">${esc(f.title)}</a></li>`).join("\n")}
</ol></nav>`,
  ),
);

zip.file(
  "OEBPS/toc.ncx",
  `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:ccc:demo:exemple-livre-gratuit"/></head>
  <docTitle><text>${esc(TITLE)}</text></docTitle>
  <navMap>
    <navPoint id="np0" playOrder="1"><navLabel><text>${esc(TITLE)}</text></navLabel><content src="titre.xhtml"/></navPoint>
${files
  .map(
    (f, i) =>
      `    <navPoint id="np${i + 1}" playOrder="${i + 2}"><navLabel><text>${esc(f.title)}</text></navLabel><content src="${f.href}"/></navPoint>`,
  )
  .join("\n")}
  </navMap>
</ncx>`,
);

zip.file("OEBPS/style.css", css);
zip.file(
  "OEBPS/titre.xhtml",
  page(
    TITLE,
    `<h1>${esc(TITLE)}</h1><p>${esc(AUTHOR)}</p><p><em>Livre de démonstration : texte fictif, uniquement pour tester le lecteur CCC.</em></p>`,
  ),
);
for (const f of files) {
  zip.file(
    `OEBPS/${f.href}`,
    page(f.title, `<p class="part">${esc(TITLE)}</p><h1>${esc(f.title)}</h1>${f.text.map((t) => `<p>${esc(t)}</p>`).join("")}`),
  );
}

mkdirSync(outDir, { recursive: true });
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
writeFileSync(outFile, buf);
console.log(`EPUB de démonstration créé : ${outFile} (${Math.round(buf.length / 1024)} Ko)`);
