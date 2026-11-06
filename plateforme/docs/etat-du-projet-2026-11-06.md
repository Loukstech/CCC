# État du projet CCC — 6 novembre 2026

> Suite de [etat-du-projet-2026-11-05.md](./etat-du-projet-2026-11-05.md), qui couvre les lots 1 à 7.
>
> **Dernière révision : 6 novembre, 22 h 30.** Le local, GitHub (`origin/main`) et le site en ligne
> servent le même commit d'application (`0435956`) ; ce document et celui du lot 8 ne modifient que
> la documentation. Base Neon à jour (`prisma migrate deploy` appliqué). Déploiement Vercel
> automatique.
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
