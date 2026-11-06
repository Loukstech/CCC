# État du projet CCC — 6 novembre 2026

> Suite de [etat-du-projet-2026-11-05.md](./etat-du-projet-2026-11-05.md), qui couvre les lots 1 à 7.
>
> **Dernière révision : 7 novembre, 0 h 45.** Le local, GitHub (`origin/main`) et le site en ligne
> servent le même commit d'application (`c0c2af3`) ; ce document ne modifie que la documentation.
> Base Neon à jour (migrations `20261106210428_sous_titres`, `20261106221656_editions_reliees` et
> `20261106230137_publicites_mesurees` appliquées). Déploiement Vercel déclenché à la main par le
> lien de déploiement : le déclenchement automatique sur `push` n'a pas fonctionné pour ce commit.
>
> Ce document décrit **ce qui a été ajouté aujourd'hui**, l'**état de la base**, ce qui **reste à
> faire** et les **décisions qui vous attendent**.

## 1. En une page

| Lot | Sujet | État |
|---|---|---|
| 1–7 | Diocèses, avis, espace diocèse, commissions, versements, espace écrivain, manuscrits | Livré (voir le document du 5 novembre) |
| 8 | **Codes de partenariat** (diocèses et écrivains) et **événements en direct** | **Livré, en ligne, vérifié** |
| — | **Deux livres du client** importés, lecture à voix haute testée | **Livré, en ligne** |
| — | **Sous-titres** des films et documentaires (WebVTT, FR/EN) | **Livré, en ligne, vérifié** |
| — | **Éditions reliées** : un même titre en plusieurs langues | **Livré, en ligne, vérifié** |
| — | **Publicités mesurées** : affichages, clics, taux de clic, détail par jour | **Livré, en ligne, vérifié** |
| — | **Publicité intercalée** pendant les contenus gratuits | **Livré, en ligne, vérifié** |

Le détail du lot 8 est dans [lot-8-partenariats-et-directs.md](./lot-8-partenariats-et-directs.md).

## 2. Livres fournis par le client

Deux PDF ont été convertis en EPUB et publiés **gratuitement**, pour permettre au client de tester le
lecteur et la lecture à voix haute :

| Titre | Slug | Contenu |
|---|---|---|
| Lumière sur le christianisme céleste | `client-lumiere-christianisme-celeste` | 35 chapitres / 279 paragraphes |
| Constitution bleue — acte de constitution | `client-constitution-bleue` | 5 chapitres / 45 paragraphes |

- Le texte intégral est versionné dans `scripts/client-books.json` (dépôt **public**, avec l'accord
  explicite du client). `scripts/make-demo-epub.mjs` régénère les EPUB **à chaque build** ;
  `next.config.ts` les embarque dans la fonction serverless.
- `scripts/seed-client-books.mjs` (`npm run db:client-books`) crée les deux `Work` en `FREE` /
  `PUBLISHED` avec leurs `License` sur les 29 pays du pilote (idempotent).
- **La lecture à voix haute est celle du navigateur** (`speechSynthesis`, `src/lib/tts.ts`), pas un
  service serveur : elle fonctionne dans `/lire/[slug]`, avec les voix installées sur l'appareil.
  Vérifié en production : 3 voix françaises disponibles, bouton « Écouter ce livre à voix haute »
  actif, texte réellement lu.

## 3. Codes de partenariat et directs (lot 8)

Résumé ; le détail est dans le document dédié.

- **Codes** : émis depuis `/admin/partenariats`, à usage unique, 30 jours par défaut, stockés
  uniquement sous forme d'empreinte HMAC. Exigés à `/diocese/inscription` et à la nouvelle page
  `/ecrivain/inscription` ; `/ecrivain` est réservé aux profils d'auteur approuvés.
- **Directs** : `/live` et `/live/[slug]`, pilotés depuis `/admin/lives`. Un badge « diffuseur
  approuvé » est obligatoire pour être désigné. La vidéo vient d'un prestataire externe (iframe ou
  Mux HLS) : Vercel ne sert que la page.
- **Contrôle actif en production** (`PARTNER_CODE_REQUIRED=true`). L'inscription d'un simple lecteur
  reste libre.

## 4. État de la base de démonstration

| Donnée | Quantité |
|---|---|
| Comptes | 14 |
| Appareils autorisés | 2 — les deux comptes Gmail du client |
| Œuvres | 15 (13 de démonstration + 2 livres du client) |
| Codes de partenariat | 4, aucun consommé |
| Événements en direct | 1 (`messe-de-demonstration`, programmé) |
| Badges de diffuseur | 1 (super-administrateur) |
| Publicités | 5 de démonstration, un par emplacement |

La base a été remise à zéro le 6 novembre (aucune commande, aucun abonnement, aucune commission). Les
chiffres du jeu de données « finances » décrits dans le document du 5 novembre ne sont donc plus
présents ; ils restent restaurables depuis les sauvegardes locales.

## 5. Ce qui reste à faire avant une vraie production

| Sujet | Pourquoi |
|---|---|
| Changer les mots de passe de démonstration | Ils sont publiés dans ce dépôt |
| Révoquer les codes de partenariat de démonstration | Ils sont valides 30 jours |
| `FEDAPAY_WEBHOOK_SECRET` | Sans lui, la signature des webhooks n'est pas vérifiée |
| Clés FedaPay `live` | Le site tourne en sandbox |
| `createWork` sans `authorId` | Une œuvre créée dans `/admin` n'apparaît pas dans l'espace de son auteur, et sa part de 80 % tombe dans la part plateforme |
| Upload de fichiers | L'envoi d'EPUB par formulaire n'est pas persistant sur Vercel (les EPUB générés au build, eux, fonctionnent) |
| Mux | Sans clés de signature, les vidéos sont lisibles par quiconque connaît l'adresse |
| Workflow manuscrit → œuvre | Un manuscrit accepté ne crée toujours pas de `Work` |

## 6. Décisions en attente

1. **Maintenir ou non le contrôle par code en démonstration.** Il est actif. Pour le désactiver :
   `PARTNER_CODE_REQUIRED=false` sur Vercel, puis redéploiement.
2. **Source des directs.** Iframe (rapide, aucune clé) ou Mux Live (lecture signée, replay). Le compte
   Mux du client n'est pas encore branché.
3. **Sort des livres du client.** Ils sont gratuits pour les tests. Faut-il les passer en payant, et
   sous quel contrat ?

## 7. Sous-titres des films et documentaires

Livré et vérifié en ligne (commit `0435956`).

- **Modèle `Subtitle`** : une piste par œuvre et par langue (contrainte unique `workId` + `lang`),
  avec un libellé, l'adresse du fichier `.vtt` et un indicateur « piste par défaut ». Migration
  `20261106210428_sous_titres`, appliquée.
- **Lecteur** : chaque piste devient une balise `<track kind="subtitles">`. Un bouton **ST** dans la
  barre du lecteur fait défiler « aucun → piste 1 → piste 2 → aucun » et affiche la langue active
  (`ST · FR`). Les sous-titres démarrent désactivés. Le style `::cue` (fond sombre translucide, taille
  adaptée au mobile) est dans `globals.css`.
- **Page `/regarder/[slug]`** : lit les pistes de l'œuvre et les transmet au lecteur.
- **Administration** : section « Sous-titres » dans la fiche d'une œuvre — ajout, remplacement,
  suppression, choix de la piste par défaut. Chaque changement est journalisé (`AuditLog`).
- **Fichiers** : déposés dans `public/subtitles/`, servis par Next avec le type `text/vtt`
  (vérifié en production), ce qui est exactement ce qu'attend le navigateur.
- **Démonstration** : deux `.vtt` (français et anglais) sur les deux vidéos **gratuites**
  (`demo-film-3`, `demo-documentaire-gratuit`), attachés par `npm run db:subtitles` (idempotent).

Ce qui reste :

| Sujet | Pourquoi |
|---|---|
| Les vrais sous-titres des films du client | Les `.vtt` actuels sont des exemples de démonstration. Il faut une transcription par film et par langue, calée sur le timecode. |
| Sous-titres sur Mux | La même balise `<track>` fonctionne sur un flux HLS. On peut soit déposer le `.vtt` dans `public/subtitles`, soit créer une piste texte chez Mux (API `tracks`) pour qu'elle soit servie avec le manifeste. |
| Choix de langue mémorisé | Aujourd'hui le choix vaut pour la séance en cours. On peut le retenir par compte, comme la vitesse. |
| Sous-titres sur les directs | Non couvert : le lot 8 diffuse en direct, sans piste texte. |

## 8. Éditions reliées : un même titre en plusieurs langues

Livré et vérifié en ligne (commit `a4c17ef`). Répond à la question « faut-il traduire
automatiquement, ou ajouter chaque langue comme un livre séparé ? ».

**Le choix retenu : chaque langue reste une fiche complète, et les fiches sont reliées entre elles.**

Pourquoi pas une seule fiche traduite à la volée : le prix, la licence par pays, la part de 80 % de
l'écrivain et la position de lecture sont attachés à la fiche, pas au titre. Une traduction calculée à
l'affichage casserait la reprise de lecture (elle est enregistrée en CFI, une adresse interne au
fichier EPUB) et la lecture à voix haute (la voix est choisie d'après la langue déclarée du livre).

- **Modèle** : `Work.translationGroupId` (identifiant commun, vide si l'œuvre n'a pas de traduction)
  et `Work.translationPrimary` (l'édition de référence, celle que les listes affichent). Migration
  `20261106221656_editions_reliees`, appliquée, avec index sur `translationGroupId`.
- **Administration** (fiche d'une œuvre, section « Autres langues du même titre ») : relier une fiche
  à une autre du même type, détacher, et désigner l'édition de référence. Chaque geste est journalisé
  (`AuditLog` : `work.translation.link`, `work.translation.unlink`, `work.translation.primary`).
- **Catalogue et recherche** : une seule fiche par titre (`translationPrimary`). Les autres éditions
  restent accessibles par leur adresse directe et par le sélecteur de la fiche.
- **Fiche publique** : une rangée « Aussi disponible en » avec le nom **natif** de chaque langue
  (`src/lib/languages.ts` : English, Português, Yorùbá…), pas une clé de traduction par langue.
- **Détachement** : si le groupe perd son édition de référence, la plus ancienne fiche restante est
  promue automatiquement — un groupe ne reste jamais sans référence.

Vérifié en production : liaison de deux livres depuis `/admin/oeuvres/[id]`, apparition de la rangée
« Aussi disponible en Français », disparition de la seconde fiche de `/livres`, puis détachement et
retour à l'état initial. Les données de démonstration ont été remises à zéro (aucun groupe).

Ce qui reste :

| Sujet | Pourquoi |
|---|---|
| Traduire réellement les textes | La liaison ne traduit rien : elle regroupe. Il faut produire l'EPUB dans chaque langue (traduction hors ligne, glossaire liturgique, relecture humaine — la traduction automatique est faible en fon, yoruba et nagot). |
| Sélecteur de langue sur la page de lecture | Aujourd'hui le sélecteur est sur la fiche ; on peut aussi le mettre dans le lecteur, pour changer d'édition sans revenir en arrière. |
| Fusion de groupes | Deux groupes distincts ne se fusionnent pas : il faut détacher avant de relier. Suffisant pour la démonstration, à revoir si le catalogue grandit. |

## 9. Publicités : mesurer, puis intercaler

Livré et vérifié en ligne (commit `c0c2af3`). Répond aux deux questions restées ouvertes : « l'espace
pub qui défile, y as-tu pensé ? » et « une pub peut-elle se lancer pendant un contenu gratuit ? ».

**Avant, le bandeau existait mais rien ne comptait les affichages** : impossible de facturer un
annonceur, impossible de savoir si l'emplacement valait quelque chose. C'est le premier manque comblé.

- **Modèle** : `Ad.impressions` (compteur de toujours) et table `AdDailyStat` (un enregistrement par
  publicité et par jour : affichages, clics). Migration `20261106230137_publicites_mesurees`.
  La journée est calculée à l'heure du pilote (UTC+1) : un affichage à 23 h 30 à Cotonou compte pour
  le jour même, pas pour la veille comme le ferait l'heure UTC.
- **Comptage** : `POST /api/ads/[id]/impression`, appelé une seule fois par publicité et par séance
  (mémoire de session du navigateur). Un visiteur qui navigue ne gonfle donc pas le compteur. Le clic
  alimente les deux compteurs, global et journalier.
- **Écran `/admin/publicites`** : affichages, clics et taux de clic par publicité, plus un tableau
  « Sept derniers jours » qui donne la base d'une facture mensuelle.
- **Publicité intercalée** (`AdInterstitial`) : voile plein écran, mention « Publicité », compte à
  rebours de 8 secondes, puis retour au contenu.
  - **Œuvres gratuites seulement.** Un visiteur qui a payé ne la voit jamais.
  - **Film** : après un temps de lecture réel (35 % de la durée, plafonné à 90 secondes). Mettre en
    pause arrête le décompte. Le film est mis en pause pendant l'annonce et reprend ensuite tout seul.
  - **Livre** : après une minute de présence sur la page de lecture.
  - **Une seule fois par œuvre et par séance.**
- **Nouvel emplacement `INTERSTITIAL`** dans le formulaire d'administration. À défaut d'annonce
  prévue pour l'interruption, celles de la fiche d'œuvre sont utilisées : l'écran n'est jamais vide.
- **Cinq publicités de démonstration** (`npm run db:ads`, idempotent) avec des visuels SVG locaux
  dans `public/ads/`. Annonceurs fictifs, liens vers `exemple-ccc.test` : à remplacer.

Vérifié en production : bandeau affiché et compté, publicité intercalée ouverte après 8 secondes de
lecture du film gratuit (film en pause), compte à rebours puis reprise, statistiques à jour dans
l'administration.

Ce qui reste :

| Sujet | Pourquoi |
|---|---|
| Vrais annonceurs et vrais visuels | Les cinq publicités actuelles sont des exemples. |
| Facturation automatique | Les chiffres sont là, la facture se fait encore à la main. |
| Règles de fréquence plus fines | Aujourd'hui : une interruption par œuvre et par séance. On peut ajouter un plafond par jour, ou interdire deux interruptions d'affilée. |
| Emplacements dans le lecteur de livre | La publicité intercalée ne s'affiche pas *dans* l'EPUB, elle recouvre la page. Suffisant pour la démonstration. |

Le mode d'emploi destiné au client est dans
[guide-client-traductions-et-publicites.md](./guide-client-traductions-et-publicites.md).
