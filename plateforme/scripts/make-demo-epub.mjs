// Génère les livres EPUB de démonstration (textes fictifs) dans storage/books/.
//
//   npm run demo:epub
//
// Ce ne sont pas des œuvres réelles : ils servent uniquement à tester le lecteur.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "storage", "books");

const BOOKS = [
  {
    slug: "exemple-livre-gratuit",
    title: "Prières du matin (démo)",
    author: "Auteur fictif",
    chapters: [
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
    ],
  },
  {
    slug: "demo-livre-histoire",
    title: "Les chemins de la foi (démo)",
    author: "Auteur fictif",
    chapters: [
      {
        title: "Le départ",
        text: [
          "Quand Amavi quitta son village à l’aube, il n’emportait qu’un sac de toile et une question qu’il n’osait formuler. Le chemin descendait vers la rivière, puis remontait vers des collines que personne, dans sa famille, n’avait jamais franchies.",
          "Sa mère l’avait accompagné jusqu’au dernier manguier. Elle ne lui avait pas donné de conseils, seulement une phrase : « Marche, et ne cesse pas de demander. »",
          "Il ne savait pas encore que demander est déjà une manière de croire.",
        ],
      },
      {
        title: "La traversée",
        text: [
          "À la rivière, un passeur attendait. Il connaissait chaque bas-fond, chaque courant, et il parlait peu. Pendant la traversée, Amavi lui confia sa question. Le passeur sourit sans répondre, puis tendit la perche : « Pour avancer, appuie-toi d’abord sur ce qui tient. »",
          "De l’autre côté, le sol était rouge et sec. Amavi marcha des heures, la gorge brûlante, en se répétant cette phrase simple. Appuyer sur ce qui tient : le souvenir d’un visage, une promesse, une prière apprise enfant.",
          "Le soir, il découvrit qu’il n’avait pas été seul : à chaque détour, quelqu’un avait déposé de l’eau et du pain, sans rien demander.",
        ],
      },
      {
        title: "L’arrivée",
        text: [
          "Les collines n’avaient rien d’extraordinaire. Au sommet, il n’y avait pas de révélation, seulement une petite maison, un banc, et une vieille femme qui épluchait des haricots. Elle ne parut pas surprise de le voir.",
          "« Tu as marché longtemps, dit-elle. Assieds-toi. » Il comprit alors que ce qu’il cherchait n’était pas au bout du chemin, mais dans la manière de le parcourir : la patience, l’accueil, la gratitude pour l’eau reçue.",
          "Il resta jusqu’au coucher du soleil, puis redescendit, plus léger. La question n’avait pas disparu. Elle était devenue une compagne.",
          "Fin du livre de démonstration.",
        ],
      },
    ],
  },
  {
    slug: "demo-livre-temoignages",
    title: "Témoignages de grâce (démo)",
    author: "Collectif fictif",
    chapters: [
      {
        title: "Une porte restée ouverte",
        text: [
          "Je m’appelle Mireille. Pendant des années j’ai cru que l’on ne revenait pas quand on s’était éloigné. J’avais honte, et la honte est une porte qui se ferme de l’intérieur.",
          "Un dimanche, sans trop savoir pourquoi, je me suis assise au dernier rang. Personne ne m’a posé de question. Une voisine m’a simplement tendu un chant imprimé, avec un sourire. C’est tout. Et pourtant, ce jour-là, quelque chose s’est détendu en moi.",
        ],
      },
      {
        title: "Le poids partagé",
        text: [
          "Je suis Kossi, artisan menuisier. Après un incendie dans mon atelier, j’ai tout perdu en une nuit : les outils, le stock, les commandes. J’étais écrasé.",
          "Ce qui m’a relevé n’est pas un miracle spectaculaire. Ce sont des gens ordinaires : un voisin qui m’a prêté une scie, une famille qui a apporté des planches, une église qui a ouvert ses salles pour que je puisse travailler. J’ai compris que la grâce prend souvent le visage des autres.",
        ],
      },
      {
        title: "Le chant retrouvé",
        text: [
          "Je m’appelle Fatou. J’avais cessé de chanter après la mort de ma sœur. La musique me faisait mal. Pendant deux ans, je suis restée muette aux célébrations.",
          "Un soir, en préparant le repas, j’ai fredonné sans m’en rendre compte une mélodie de mon enfance. Les larmes sont venues, puis un grand calme. Depuis, je chante à nouveau, doucement, comme on rouvre une fenêtre dans une maison restée fermée.",
          "Fin du recueil de démonstration.",
        ],
      },
    ],
  },
  {
    slug: "demo-livre-priere",
    title: "Cantiques et louanges (démo)",
    author: "Auteur fictif",
    chapters: [
      {
        title: "Chants du matin",
        text: [
          "Lève-toi, mon âme, le jour est venu.",
          "Que la lumière entre dans la maison, que la paix entre dans le cœur, que la joie entre dans les mains.",
          "Tu m’as gardé pendant la nuit, tu me gardes encore. Je te rends grâce pour le souffle, pour le pain, pour le chemin.",
          "Que mes pas te cherchent, que mes mots te bénissent, que mon travail te serve.",
        ],
      },
      {
        title: "Chants du soir",
        text: [
          "Le soleil se retire, la maison se tait.",
          "Je dépose ici mes fatigues, mes oublis, mes colères. Je ne les emporterai pas dans le sommeil.",
          "Garde ceux que j’aime, garde ceux qui sont seuls, garde ceux qui veillent.",
          "Que la nuit soit douce, que le repos soit vrai, que le matin nous retrouve reconnaissants.",
          "Fin du recueil de démonstration.",
        ],
      },
    ],
  },
  {
    slug: "demo-livre-vivre",
    title: "Vivre en Christ au quotidien (démo)",
    author: "Auteur fictif",
    chapters: [
      {
        title: "Dans les petites choses",
        text: [
          "On imagine souvent la vie spirituelle comme une affaire de grandes décisions et d’heures solennelles. Elle se joue pourtant surtout dans les petites choses : la manière de répondre à quelqu’un de pressé, de remercier le chauffeur, de tenir une promesse minuscule.",
          "Cette fidélité discrète forge le caractère plus sûrement que les grandes résolutions. Commencez par une seule habitude, simple et réaliste, et tenez-la une semaine.",
        ],
      },
      {
        title: "Au travail",
        text: [
          "Le travail bien fait est déjà une forme de respect, pour ceux qui en bénéficient comme pour soi-même. Être honnête dans un compte, ponctuel dans un rendez-vous, patient avec un collègue difficile : voilà des gestes concrets.",
          "Ne séparez pas ce que vous êtes le dimanche de ce que vous êtes le lundi. La cohérence est un témoignage silencieux, souvent plus entendu que les discours.",
        ],
      },
      {
        title: "En famille",
        text: [
          "La maison est le lieu où l’on se montre tel que l’on est, fatigué, impatient, parfois injuste. C’est aussi le lieu où l’on apprend le plus. Demander pardon à un enfant, écouter un parent sans l’interrompre, partager un repas sans écran : autant de petites conversions quotidiennes.",
          "Fin du livre de démonstration.",
        ],
      },
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

async function build({ slug, title, author, chapters }) {
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
  const uid = `urn:ccc:demo:${slug}`;

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="fr">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:creator>${esc(author)}</dc:creator>
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
<li><a href="titre.xhtml">${esc(title)}</a></li>
${files.map((f) => `<li><a href="${f.href}">${esc(f.title)}</a></li>`).join("\n")}
</ol></nav>`,
    ),
  );

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <navMap>
    <navPoint id="np0" playOrder="1"><navLabel><text>${esc(title)}</text></navLabel><content src="titre.xhtml"/></navPoint>
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
      title,
      `<h1>${esc(title)}</h1><p>${esc(author)}</p><p><em>Livre de démonstration : texte fictif, uniquement pour tester le lecteur CCC.</em></p>`,
    ),
  );
  for (const f of files) {
    zip.file(
      `OEBPS/${f.href}`,
      page(f.title, `<p class="part">${esc(title)}</p><h1>${esc(f.title)}</h1>${f.text.map((t) => `<p>${esc(t)}</p>`).join("")}`),
    );
  }

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
  writeFileSync(join(outDir, `${slug}.epub`), buf);
  return buf.length;
}

mkdirSync(outDir, { recursive: true });
for (const book of BOOKS) {
  const size = await build(book);
  console.log(`EPUB de démonstration : ${book.slug}.epub (${Math.round(size / 1024)} Ko)`);
}
