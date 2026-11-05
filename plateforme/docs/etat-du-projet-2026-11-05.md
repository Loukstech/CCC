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
| `6cde03f` | Comptes de démonstration, auteur des œuvres, accès diocésain autonome |
| `143b01a` | Retrait des mentions de démonstration dans les titres et descriptions |
| `338d1e2` | Gestion des comptes diocésains : liste, rôle, désactivation, mot de passe |
| `8dc2d9d` | Administration bilingue, lecture à voix haute naturelle, paiement de démo retiré du parcours |

**Base de données** : Neon, partagée entre la machine locale et le site en ligne. Les deux
migrations sont appliquées. Les scripts de test ont supprimé leurs propres comptes `e2e-*`, avis,
commentaires et signalements, et recalculé les compteurs : la base ne contient plus de données de
test.

**Déploiement** : Vercel. Le redéploiement automatique à chaque poussée n'est **pas** confirmé : le
dépôt ne porte aucun webhook Vercel, et le site en ligne ne servait pas encore `8dc2d9d` le 5 novembre
au soir. À publier depuis le tableau de bord Vercel (Deployments → Redeploy), puis à vérifier en
ouvrant `/paiement/indisponible`, qui n'existe que dans cette version. Voir `DEPLOIEMENT.md`.

## 6. Ce qui reste à faire

### Lots 4 à 7 — livrés (détail en section 11)

| Lot | Contenu | État |
|---|---|---|
| **4a** | Frais du prestataire (`feeAmount`) et net réellement reçu (`netAmount`) | ✅ |
| **4b** | Commissions écrivain / diocèse / plateforme, registre d'écritures anti-double-comptage | ✅ |
| **4c** | Remboursement : contre-écritures, jamais de suppression | ✅ |
| **5** | Versements : relevés mensuels, lots, approbation, référence mobile money, statuts | ✅ |
| **6** | Espace écrivain : profil, œuvres, ventes, avis, droits acquis | ✅ |
| **7** | *(option)* Dépôt de manuscrit et validation éditoriale | ✅ (fichier par lien) |

**Ce qui n'est toujours pas prouvé** : le paiement reste un adaptateur de démonstration où l'acheteur
clique lui-même « payé » ou « échec ». Les calculs sont justes et vérifiés au franc près, mais il n'y a
ni webhook, ni frais réels, ni argent. Premier point des travaux restants (section 11).

### Travaux restants sur le lot 3

- ✅ **Gestion des comptes diocésains** — livrée : liste, changement de rôle, désactivation,
  réinitialisation du mot de passe.
- **Mot de passe provisoire sans expiration** : décision prise avec le client — on n'impose pas de
  changement à la première connexion. Le provisoire s'affiche une seule fois et se transmet de vive
  voix ; l'administration peut le réinitialiser à tout moment.
- ✅ **Revenus du diocèse** : section « Revenus du diocèse » dans `/diocese` (lot 5, voir section 11).
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

`/paiement/demo` est **ouvert par défaut** : c'est ce qui permet de dérouler tout le parcours
(achat → commissions → versement) tant qu'aucun prestataire n'est branché. Mettre
`DEMO_PAYMENT_VISIBLE=false` ferme la page (404) et renvoie vers `/paiement/indisponible`, à faire le
jour où le site est montré avec un vrai prestataire.

### Vérifications

- `npx tsc --noEmit` : aucune erreur.
- `npm run build` : réussit ; `/paiement/demo/[orderId]` n'est plus prérendu.
- Contrôle en session réelle sur le serveur de production local : hub, modération, publicités,
  diocèses et fiche œuvre s'affichent en anglais **et** en français ; `/paiement/demo/…` ne sert plus
  l'interface de simulation.
- Page d'accueil : 200, données Neon chargées.

## 11. Lots 4 à 7 — commissions, versements, espace écrivain, manuscrits

Implémentés le 5 novembre au soir, avec **paiement simulé** utilisable pour la démonstration.
Migration appliquée sur Neon : `20261105184021_lots_4_a_7`.

### Le barème retenu (question B2 du cahier des charges)

Le cahier des charges demandait « 90 % écrivain + 10 % diocèse », calculés sur le brut : cela ne
laissait **aucune place aux frais du prestataire** et la somme dépassait 100 % du net. Le barème
appliqué part du **net réellement encaissé** (brut moins les frais) :

| Bénéficiaire | Part du net | Pourquoi |
|---|---|---|
| Écrivain | **70 %** | reste majoritaire : c'est ce que le client veut défendre |
| Diocèse | **10 %** | la part promise aux diocèses |
| Plateforme | **20 %** | hébergement, vidéo, support, frais |

Frais du prestataire : **2 %** du montant encaissé, déduits avant partage.
Sur un abonnement (pas d'écrivain à rémunérer) : diocèse 10 %, plateforme 90 % du net.

Tout est réglable sans toucher au code :
`CCC_FEE_PPM=200`, `CCC_WRITER_PPM=7000`, `CCC_DIOCESE_PPM=1000`, `CCC_PLATFORM_PPM=2000`,
`CCC_SUB_DIOCESE_PPM=1000` (points de base, 10 000 = 100 %).

Exemple contrôlé en base : vente de 3 000 F CFA → frais 60, net 2 940, écrivain 2 058,
diocèse 294, plateforme 588.

### Lot 4 — registre des commissions

- Table `CommissionEntry` : une écriture par bénéficiaire et par vente (écrivain, diocèse, plateforme).
- **Clé d'idempotence** unique par écriture (`sale:<commande>:<bénéficiaire>`) : un webhook rejoué, un
  double encaissement ou une réconciliation ne peuvent pas payer deux fois.
- Les champs `feePpm`, `feeAmount`, `netAmount` sont enregistrés sur la commande : on peut expliquer
  un calcul des mois après.
- **Remboursement = contre-écritures négatives**, jamais de suppression (lot 4c).
- Réconciliation : bouton « Réparer les commissions manquantes » qui rattrape les commandes payées
  sans écritures (5 commandes historiques ont été rattrapées ainsi).
- Sans auteur identifié ou sans diocèse, la part concernée revient à la plateforme : l'argent reçu est
  toujours affecté en totalité.

### Lot 5 — versements

- Table `PayoutBatch` + `PayoutItem` : préparation d'un lot par caisse (écrivains ou diocèses) et par
  mois, référence lisible (`VRS-2026-11-ECR-001`), statuts `DRAFT → APPROVED → PAID`, ou `CANCELED`.
- Un lot validé ne se modifie plus ; le versement exige une **référence de paiement** (mobile money,
  bordereau).
- Solde d'un bénéficiaire = somme des écritures − montants déjà réservés dans les lots non annulés.
- Écran `/admin/finances` (rôles `SUPER_ADMIN`, `FINANCE`) : barème, totaux, soldes, lots, dernières
  commandes et remboursement en un clic.
- Espace diocèse : section « Revenus du diocèse » (solde à recevoir, acquis du mois, versé cette
  année, relevé mensuel) — le lien `/diocese/revenus` du cahier est ainsi couvert.

### Lot 6 — espace écrivain

`/ecrivain` (lien dans l'en-tête) : profil d'auteur (nom de plume, présentation, coordonnées de
versement, statut de validation), œuvres rattachées, nombre de ventes, solde à verser, relevés
mensuels, versements reçus et avis sur ses œuvres.

### Lot 7 — manuscrits (option)

Dépôt d'un manuscrit depuis l'espace écrivain (titre, langue, résumé, lien vers le fichier) et file de
lecture `/admin/manuscrits` avec décisions « à l'étude / accepté / refusé » et note au comité.
L'envoi de fichier binaire n'est pas possible sur Vercel (pas de disque inscriptible) : c'est un lien.

### Vérifications faites sur la base réelle

- `npx prisma migrate dev` : migration appliquée, client régénéré.
- 4 ventes simulées, 1 remboursement, 1 lot préparé → validé → versé : tous les statuts traversés.
- **Identité comptable vérifiée** : écrivains 7 889 + diocèses 735 + plateforme 2 646 = **11 270 =
  net encaissé**, au franc près.
- Idempotence : rejouer un encaissement n'ajoute aucune écriture.
- `npx tsc --noEmit` et `npm run lint` : propres. `npm run build` : réussit.
- Écrans contrôlés en session réelle (jetons de test supprimés ensuite) : `/admin/finances`,
  `/ecrivain`, `/diocese` (revenus), `/admin/manuscrits`, en français **et** en anglais.

### Données de démonstration ajoutées en base

Un acheteur `fidele.demo@ccc.example` (mot de passe `Fidele-2026`), rattaché à la Paroisse Mont Sinaï
(diocèse Bénin), 4 ventes payées, 1 remboursée, et un lot `VRS-2026-11-ECR-001` versé avec la
référence `MM-DEMO-0001`. De quoi montrer des chiffres réels dès l'ouverture.

### Ce qui reste à faire (par ordre d'utilité)

1. **Prestataire de paiement réel** (FedaPay, CinetPay ou Stripe) : webhook signé, frais réels
   transmis par le prestataire au lieu du forfait de 2 %, gestion des échecs. Tant qu'il n'est pas là,
   les commissions sont justes mais l'argent n'existe pas.
2. **Validation des profils écrivains** : le statut existe (`PENDING/APPROVED/REJECTED`) mais aucun
   écran d'administration ne permet de l'accorder. À ajouter dans `/admin` (30 lignes).
3. **Versement par bénéficiaire** : aujourd'hui un lot porte **une seule** référence de paiement pour
   tous ses bénéficiaires. En pratique, un versement mobile money = une transaction par personne : il
   faut une référence par ligne du lot.
4. **Multi-devises** : les écrans Finances, écrivain et diocèse calculent en **XOF** uniquement. Les
   ventes en naira ou en euro sont enregistrées correctement, mais n'apparaissent pas dans ces soldes.
5. **Export des relevés** (CSV/PDF) pour les écrivains et les diocèses : non fait.
6. **Remboursement d'un abonnement** : la commande est remboursée et les commissions annulées, mais
   l'abonnement en cours n'est pas résilié automatiquement — décision humaine à trancher.
7. **Demande de versement par le bénéficiaire** : aujourd'hui seul l'administrateur prépare les lots.
8. **Tests automatisés** : les contrôles ci-dessus ont été faits par scripts ponctuels, non conservés.
   Une suite de tests sur le registre (idempotence, équilibre, remboursement) serait la bienvenue.
9. **Déploiement** : voir `DEPLOIEMENT.md` — aucun webhook Vercel n'est branché sur le dépôt, donc
   une poussée sur `main` ne publie rien automatiquement.
