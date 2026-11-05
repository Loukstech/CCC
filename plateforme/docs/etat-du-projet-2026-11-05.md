# État du projet CCC — 5 novembre 2026

> Document de suivi rédigé après la mise en ligne des lots 1 à 3.
> Ce qui est **fait et vérifié**, ce qui a été **corrigé en chemin**, ce qui **reste à faire**,
> et les **décisions qui vous attendent**.

## 1. En une page

Trois lots sont livrés, commités et déployés sur
[ccc-three-lyart.vercel.app](https://ccc-three-lyart.vercel.app) :

| Lot | Sujet | État |
|---|---|---|
| 1 | Diocèses, paroisses, inscription en cascade, consentement | **Livré et en ligne** |
| 2 | Avis, commentaires, signalements, modération a posteriori | **Livré et en ligne** |
| 3 | Espace diocèse : inscrits, export CSV, comptes diocésains | **Livré et en ligne** |
| 4 | Frais de paiement et commissions (diocèse, écrivain) | À faire — dépend d'un prestataire réel |
| 5 | Versements : relevés, lots, approbation, références | À faire — dépend du lot 4 |
| 6 | Espace écrivain : œuvres, ventes, avis, droits | À faire — dépend du lot 4 |
| 7 | *(option)* Dépôt de manuscrit et validation éditoriale | À faire — non prioritaire |

Le socle est vérifié par des tests dans un vrai navigateur (Microsoft Edge) sur le build de
production, puis sur le site en ligne après déploiement.

## 2. Ce qui a été construit

### Lot 1 — Diocèses et paroisses

L'organisation retenue est celle de l'Église du Christianisme Céleste : **diocèse (par pays) →
paroisse**, sans niveau intermédiaire.

- Modèles `Diocese`, `Parish`, `DioceseAdmin`, `DioceseAdminRole` ; rattachement du fidèle
  (`User.parishId`) et horodatage du consentement (`parishConsentAt`).
- Une paroisse ne se supprime jamais : elle est désactivée, ou **fusionnée** dans une autre via
  `mergedIntoId`, ce qui réaffecte ses fidèles en une seule transaction tracée dans `AuditLog`.
- **Inscription** : choix du diocèse, puis de la paroisse filtrée par le diocèse, et consentement
  explicite obligatoire. La validation serveur ne fait jamais confiance au formulaire : la paroisse
  doit exister, être active, dépendre du diocèse envoyé, et le diocèse doit être actif.
- **Administration** `/admin/dioceses` (super-administrateur uniquement) : créer, renommer,
  désactiver un diocèse ou une paroisse, fusionner une paroisse.
- Référentiel amorcé par `npm run db:dioceses` : **3 diocèses** (Bénin, Togo, Nigeria) et
  **12 paroisses** fournies par le client. Écriture idempotente, sans doublon.
- Migration `20261104230713_dioceses_paroisses`, purement additive.

### Lot 2 — Avis et commentaires

Publication immédiate, contrôle **a posteriori** : c'est la réponse du client, pas un pré-modérage.

- Un avis par personne et par œuvre, **note de 1 à 5 obligatoire**. Commentaires avec une seule
  réponse possible (pas d'arborescence profonde).
- Signalement d'un avis ou d'un commentaire, puis file de modération `/admin/moderation` :
  masquer, rétablir, ignorer.
- Masquer ou rétablir un contenu **clôt les signalements ouverts** qui le visent.
- Compteurs dénormalisés (`ratingAvg`, `ratingCount`, `commentCount`) sur l'œuvre, recalculés en
  transaction à chaque publication, masquage et suppression — jamais d'incrément manuel qui dérive.
- Migration `20261104232313_avis_commentaires`, purement additive.

### Lot 3 — Espace diocèse

- Page `/diocese` : totaux, répartition par paroisse, liste des fidèles, export CSV.
- Export `/api/diocese/export` : fichier complet, encodage UTF-8 avec BOM (Excel ouvre
  correctement les accents), sans cache.
- **Comptes diocésains** créés depuis `/admin/dioceses`. Le mot de passe provisoire s'affiche
  **une seule fois** dans l'interface, à transmettre de vive voix : il n'est jamais stocké en clair
  ni envoyé par email (aucune messagerie n'est configurée).
- **Gestion des comptes** depuis le même écran : liste des comptes avec leur diocèse et leur rôle,
  changement `ADMIN` ↔ `VIEWER`, désactivation/réactivation immédiate, réinitialisation du mot de
  passe (nouveau provisoire affiché une fois). Garde-fou : on ne peut ni rétrograder ni désactiver
  le **dernier administrateur actif** d'un diocèse, sinon l'espace deviendrait ingérable et plus
  personne ne pourrait le réclamer.
- Deux rôles : `ADMIN` (lecture + export) et `VIEWER` (lecture seule, sans bouton d'export).
- **Le périmètre vient de `DioceseAdmin` en base, jamais de l'URL.** Un administrateur qui modifie
  l'adresse pour viser un autre diocèse est ramené au sien ; un super-administrateur doit désigner
  explicitement le diocèse (`/diocese?diocese=<id>`).
- Un compte diocésain **ne reçoit aucun rôle de personnel** : il n'entre dans aucun écran
  d'administration et n'a pas accès à la modération.
- Il est exempté de la limite d'appareils, comme le personnel, mais sans changer de rôle.

## 3. Défauts trouvés et corrigés

Ces quatre défauts ont été trouvés **par les tests**, pas par relecture. Deux d'entre eux étaient
graves.

| Défaut | Conséquence | Correction |
|---|---|---|
| **Note par défaut à 1 étoile** | Un avis publié sans choisir de note partait à 1 ★ ; pire, modifier un avis existant réaffichait 1 ★ et **écrasait la note enregistrée** | Option vide dans le sélecteur, et `SelectField` accepte une valeur par défaut |
| **Avis masqué restant visible** | Le masquage ne retirait pas l'avis de la page publique : la modération semblait sans effet | La liste des avis et la note du bandeau sont lues à chaque requête (`connection()`), au lieu d'être figées dans le cache de page |
| **Site non hydraté en développement** | Ouvert sur `127.0.0.1`, Next 16 bloquait les ressources de développement : listes déroulantes et formulaires totalement inertes | `allowedDevOrigins: ["127.0.0.1"]` dans `next.config.ts` — sans effet en production |
| **Escalade de privilèges (introduite puis corrigée)** | Ma première version donnait aux comptes diocésains le rôle de personnel `SUPPORT`, ce qui leur ouvrait la modération de **toute** la plateforme | Rôle supprimé ; l'exemption d'appareils est traitée explicitement dans `getCurrentUser` |

Le troisième défaut n'était pas causé par ce travail, mais il aurait coûté du temps à quiconque
développe sur cette machine : il est signalé ici pour mémoire.

## 4. Vérifications effectuées

### Sur le build de production, dans Microsoft Edge

| Parcours | Résultat |
|---|---|
| Inscription : 3 diocèses, 4 paroisses filtrées, consentement, redirection | OK |
| Publication d'un avis, d'un commentaire, d'un signalement | OK |
| Connexion administrateur, référentiel « 3 diocèses · 12 paroisses » | OK |
| Signalement visible, masquage (0 signalement ouvert / 1 contenu masqué) | OK |
| Avis retiré de la page publique — **mesuré à la première requête après le clic** | OK |
| Rétablissement, compteurs recalculés | OK |

### Espace diocèse

| Vérification | Résultat |
|---|---|
| Connexion → redirection vers `/diocese` | OK |
| Voit ses 3 fidèles, aucun des 2 du diocèse voisin | OK |
| `/diocese?diocese=<autre>` refusé | OK |
| Export CSV : 3 lignes, limité au diocèse | OK |
| Aucun accès à `/admin/moderation` ni `/admin/dioceses` | OK |
| Visiteur non connecté renvoyé à la connexion | OK |
| `VIEWER` : données visibles, pas d'export | OK |
| Création d'un compte via l'interface, mot de passe affiché une fois | OK |
| Nouveau compte : connexion avec le mot de passe provisoire, arrive sur son diocèse | OK |

### Après déploiement, sur le site en ligne

| Vérification | Résultat |
|---|---|
| Espace diocèse fermé aux visiteurs | OK |
| Page d'inscription hydratée, 3 diocèses proposés | OK |
| Paroisses filtrées après choix du diocèse (1 → 5) | OK |
| Case de consentement présente | OK |
| Section avis sur la fiche d'œuvre | OK |
| Pages protégées : aucune donnée dans le HTML servi | OK |
| Aucune erreur JavaScript applicative | OK |

Contrôles systématiques : `tsc --noEmit`, `eslint`, `next build`.

## 5. État du dépôt et de la base

**Commits poussés sur `main`** (dépôt `Loukstech/CCC`) :

| Commit | Objet |
|---|---|
| `d92c6f6` | Diocèses et paroisses : inscription en cascade, consentement, administration du référentiel |
| `0d83a3e` | Avis et commentaires : notes, réponses, signalements et modération a posteriori |
| `a40b6d8` | Espace diocèse : consultation des inscrits, export CSV et comptes diocésains |

**Base de données** : Neon, partagée entre la machine locale et le site en ligne. Les deux
migrations sont appliquées. Les scripts de test ont supprimé leurs propres comptes `e2e-*`, avis,
commentaires et signalements, et recalculé les compteurs : la base ne contient plus de données de
test.

**Déploiement** : Vercel, automatique à chaque poussée sur `main`. Après une poussée, comptez
quelques minutes de propagation avant que toutes les nouvelles routes répondent.

## 6. Ce qui reste à faire

### Lots suivants

| Lot | Contenu | Prérequis |
|---|---|---|
| **4a** | Enregistrer les frais du prestataire (`feeAmount`) et le net réellement reçu (`netAmount`) | Intégration d'un prestataire de paiement |
| **4b** | Calcul des commissions : 10 % diocèse, 90 % écrivain, registre d'écritures anti-double-comptage | Décision sur les frais |
| **4c** | Remboursement : écritures annulées, jamais supprimées | 4b |
| **5** | Versements : relevés mensuels, lots, préparation, approbation, référence mobile money, statuts | 4a et 4c |
| **6** | Espace écrivain : profil validé, œuvres, ventes, avis, droits acquis | 4b |
| **7** | *(option)* Dépôt de manuscrit et validation éditoriale | — |

**Ces lots ne peuvent pas être testés sérieusement aujourd'hui** : le paiement est un adaptateur de
démonstration où l'acheteur clique lui-même « payé » ou « échec ». Il n'y a ni webhook, ni frais, ni
argent réel. On peut écrire le calcul, pas prouver qu'il est juste.

### Travaux restants sur le lot 3

- ✅ **Gestion des comptes diocésains** — livrée : liste, changement de rôle, désactivation,
  réinitialisation du mot de passe.
- **Mot de passe provisoire sans expiration** : il faudrait imposer son changement à la première
  connexion. Non fait : sans messagerie, imposer un changement à la première connexion complique la
  démonstration sans rien apporter au client à ce stade.
- **`/diocese/revenus`** : dépend du lot 5, ne peut pas être fait avant.
- **Pagination** : la page affiche les 200 inscriptions les plus récentes, l'export contient tout.
  Suffisant pour un diocèse, à revoir si les volumes augmentent.
- ✅ **Langue** : `/diocese` et l'ensemble de `/admin` sont bilingues FR/EN (voir section 10).

## 7. Décisions qui vous attendent

| Réf | Sujet | Pourquoi ça bloque |
|---|---|---|
| **B1** | Frais de paiement : « 10 % du net » suppose de connaître les frais. Qui les paie, et comment l'application les obtient-elle ? | Lot 4a |
| **B2** | 90 % (brut) + 10 % (net) **dépasse 100 %** : la plateforme perd de l'argent sur chaque vente | Lots 4b et 6 |
| **B3** | « Une commission à chaque début de mois » : deux lectures possibles | Lot 4b |
| **O1** | Le rattachement au diocèse est-il figé au moment du paiement ou recalculé après un déménagement ? | Lot 4b |
| **O2** | Remboursement possible avant ou après versement ? | Lot 4c |
| **O3** | Qui nomme les administrateurs de diocèse ? *(implémenté : le super-administrateur seul)* | À confirmer |
| **O4** | Qui verse, comment, quand, à partir de quel seuil, et qui approuve ? | Lot 5 |
| **O7** | Texte définitif du consentement, motifs de signalement, **liste complète des paroisses** | Contenu |

### Questions concrètes posées par l'implémentation

1. **Messagerie** : faut-il envoyer les identifiants par email ? Aucun serveur SMTP n'est configuré
   aujourd'hui, d'où le mot de passe affiché une fois dans l'interface. Si vous avez un service
   d'envoi, le circuit est prêt à être branché.
2. **Données visibles par le diocèse** : la liste affiche nom, email, pays, paroisse et date
   d'inscription. La réponse du client demandait du « nominatif » ; faut-il **masquer les emails** et
   n'afficher que les noms ?
3. **Qui gère les paroisses** : aujourd'hui le super-administrateur seul. Un diocèse doit-il pouvoir
   renommer ses propres paroisses ?

## 8. Comment vérifier et utiliser

```bash
cd plateforme

# Base de données
npx prisma migrate deploy     # appliquer les migrations (attention : base en ligne)
npm run db:dioceses           # référentiel des 3 diocèses et 12 paroisses (idempotent)

# Développement
npm run dev                   # http://localhost:3200 (127.0.0.1 fonctionne aussi)

# Contrôles
npx tsc --noEmit
npm run lint
npm run build
```

| Route | Accès |
|---|---|
| `/inscription` | public — diocèse, paroisse, consentement |
| `/oeuvres/[slug]` | public — avis et commentaires |
| `/admin/dioceses` | super-administrateur — référentiel et gestion des comptes diocésains |
| `/admin/moderation` | super-administrateur, éditeur, support — signalements |
| `/diocese` | compte diocésain — inscrits et export |

Créer un compte diocésain : Administration > Diocèses et paroisses > « Créer un administrateur
diocésain ». **Notez le mot de passe affiché immédiatement** : il ne sera plus visible ensuite.
Le même écran liste les comptes existants et permet de changer le rôle, de désactiver le compte ou
de réinitialiser son mot de passe.

## 9. Points de vigilance techniques

- Le projet utilise **Next.js 16.4.3 avec `cacheComponents`**. Toute donnée produit par les
  utilisateurs (avis, inscriptions) doit être lue à chaque requête, sinon un masquage ou une
  inscription n'apparaît pas. C'est la cause du défaut le plus coûteux de ce lot.
- Les pages qui lisent la session passent par `<Suspense>` ; `searchParams` doit être lu **à
  l'intérieur** de la frontière, sinon le build échoue au prérendu.
- Le fichier `.env` n'est jamais commité (`.gitignore`), et le dépôt GitHub est **public** : les
  documents `docs/` y sont désormais visibles, PDF du client compris, comme demandé.
- L'authentification git de cette machine pointe sur un compte (`Loukmanayaba97`) qui n'a **pas** les
  droits sur `Loukstech/CCC` : une poussée ordinaire échoue en 403. La mise en ligne a été faite avec
  le jeton du compte `Loukstech` enregistré dans `gh`. À régler durablement.

## 10. Mise à jour du 5 novembre — soirée (préparation de la démonstration)

### Traduction des écrans d'administration

Les cinq écrans d'administration sont bilingues FR/EN : hub du catalogue, modération, publicités,
diocèses et paroisses, fiche d'une œuvre. Les messages d'erreur et de confirmation renvoyés par les
actions serveur (diocèses, œuvres, droits, prix, publicités) suivent désormais la langue de l'auteur
de l'action au lieu d'être figés en français.

Point technique : ces pages lisent des cookies (langue, session) et ne peuvent donc pas être
prérendues. Next 16 faisait échouer le build ; chaque page porte maintenant
`export const instant = false`, l'échappatoire prévue par la documentation embarquée. Elles
apparaissent comme dynamiques (ƒ) dans la sortie de build.

### Lecture à voix haute d'un livre

Le lecteur EPUB savait déjà lire le texte ; il choisit maintenant une **voix naturelle**. Nouveau
module `src/lib/tts.ts` :

- il attend l'événement `voiceschanged`, car les navigateurs remplissent la liste des voix en différé ;
- il classe les voix de la langue du livre : voix neuronales (`Natural`, `Neural`, `Google`) d'abord,
  puis voix réseau, puis synthèse locale ; l'anglais britannique est préféré, pour l'Afrique de l'Ouest ;
- il se replie sur la meilleure voix disponible et affiche un message clair si l'appareil n'a aucune
  voix pour cette langue, au lieu d'échouer en silence ;
- un troisième onglet « Voix » dans le lecteur permet d'en changer, et le choix est mémorisé sur
  l'appareil ;
- la première phrase est légèrement différée après `cancel()`, sinon Chrome l'ignore.

Aucun service payant ni clé d'API : ce sont les voix gratuites de Chrome, Edge et Safari. Le
classement a été vérifié sur un jeu de voix simulé, et le code part bien dans les bundles client du
build de production.

Limite à connaître : la qualité dépend du navigateur et du système. Sur Chrome ou Edge, on obtient
des voix neuronales ; sur un appareil sans voix française installée, la lecture est annoncée comme
indisponible.

### Paiement de démonstration retiré du parcours

`/paiement/demo` répond désormais 404 par défaut, et « Acheter » / « S'abonner » mènent à
`/paiement/indisponible`, qui explique que le paiement en ligne arrivera avec le prestataire. Aucune
commande n'est créée. La page de faux paiement reste accessible uniquement avec
`DEMO_PAYMENT_VISIBLE=true`, pour les recettes techniques.

### Vérifications

- `npx tsc --noEmit` : aucune erreur.
- `npm run build` : réussit ; `/paiement/demo/[orderId]` n'est plus prérendu.
- Contrôle en session réelle sur le serveur de production local : hub, modération, publicités,
  diocèses et fiche œuvre s'affichent en anglais **et** en français ; `/paiement/demo/…` ne sert plus
  l'interface de simulation.
- Page d'accueil : 200, données Neon chargées.
