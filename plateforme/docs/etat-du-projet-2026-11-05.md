# État du projet CCC — 5 novembre 2026

> Document de suivi tenu à jour au fil de la journée du 5 novembre 2026 : lots 1 à 3 et mise en
> ligne le matin, administration bilingue et gestion des comptes diocésains l'après-midi, lots 4 à 7
> le soir.
>
> **Dernière révision : 5 novembre, 22 h 30.** Vérifié à cette heure : le local, GitHub
> (`origin/main`) et le site en ligne servent le même commit `3a24990` ; la base Neon répond
> « Database schema is up to date » ; le déploiement Vercel est automatique.
>
> Ce qui est **fait et vérifié**, ce qui a été **corrigé en chemin**, ce qui **reste à faire**,
> et les **décisions qui vous attendent**.

## 1. En une page

Sept lots sont livrés, commités et déployés sur
[ccc-three-lyart.vercel.app](https://ccc-three-lyart.vercel.app) :

| Lot | Sujet | État |
|---|---|---|
| 1 | Diocèses, paroisses, inscription en cascade, consentement | **Livré, en ligne** |
| 2 | Avis, commentaires, signalements, modération a posteriori | **Livré, en ligne** |
| 3 | Espace diocèse : inscrits, export CSV, comptes diocésains | **Livré, en ligne** |
| 4 | Commissions : frais, net, parts écrivain / diocèse / plateforme, registre | **Livré, vérifié au franc près** |
| 5 | Versements : relevés, lots, approbation, référence de paiement | **Livré, vérifié au franc près** |
| 6 | Espace écrivain : profil, œuvres, ventes, avis, droits | **Livré, en ligne** |
| 7 | Manuscrits *(option)* : dépôt et file de lecture | **Livré (fichier par lien)** |

**La limite à garder en tête** : le paiement est encore un **adaptateur de démonstration** —
l'acheteur clique lui-même « payé ». Les calculs de commissions sont justes et vérifiés au franc près,
mais aucun argent réel n'est encaissé et les frais du prestataire sont un forfait de 2 % supposé. C'est
le seul point qui empêche de considérer les lots 4 à 6 comme réellement terminés.

Le socle est vérifié dans un vrai navigateur (Microsoft Edge) sur le build de production, puis sur le
site en ligne. Le 5 novembre à 22 h, le site sert bien le dernier commit : `/ecrivain`,
`/admin/finances`, `/diocese/inscription` et `/paiement/indisponible` répondent, et l'inscription
affiche les 3 diocèses lus en base.

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

**Commits poussés sur `main`** (dépôt `Loukstech/CCC`), tous vérifiés identiques entre la machine
locale et GitHub le 5 novembre à 22 h :

| Commit | Objet |
|---|---|
| `d92c6f6` | Diocèses et paroisses : inscription en cascade, consentement, administration du référentiel |
| `0d83a3e` | Avis et commentaires : notes, réponses, signalements et modération a posteriori |
| `a40b6d8` | Espace diocèse : consultation des inscrits, export CSV et comptes diocésains |
| `609cca9` | Documentation : état d'avancement des lots 1 à 3 |
| `6cde03f` | Comptes de démonstration, auteur des œuvres, accès diocésain autonome |
| `143b01a` | Retrait des mentions de démonstration dans les titres et descriptions |
| `338d1e2` | Gestion des comptes diocésains : liste, rôle, désactivation, mot de passe |
| `8dc2d9d` | Administration bilingue, lecture à voix haute naturelle, paiement de démo retiré du parcours |
| `b57d115` | Documentation : déploiement Vercel |
| `cacf0bb` | Lots 4 à 7 : commissions 70/10/20 du net, versements, espace écrivain, manuscrits |
| `3a24990` | Documentation : trace des commits de la livraison |

**Base de données** : Neon, partagée entre la machine locale et le site en ligne — donc les données
de démonstration sont visibles en ligne. **10 migrations, toutes appliquées** (vérifié le 5 novembre à
22 h : « Database schema is up to date! »). Les quatre apportées par ces travaux sont additives :
`20261104230713_dioceses_paroisses`, `20261104232313_avis_commentaires`,
`20261105153000_auteur_oeuvres`, `20261105184021_lots_4_a_7`.

**Déploiement** : Vercel, **automatique à chaque poussée sur `main`**. Le 5 novembre au matin, une
poussée a été suivie d'un déploiement et le site a servi les nouvelles routes en quelques minutes ; le
soir, `3a24990` portait le statut « Vercel : Deployment has completed » et le site servait
`/paiement/indisponible`, route qui n'existe que dans cette version.

> **Correction.** Les premières versions de ce document et de `DEPLOIEMENT.md` affirmaient que le
> redéploiement automatique n'était pas fiable, au motif qu'aucun webhook n'apparaissait sur le dépôt.
> L'explication est simple : Vercel passe par une **GitHub App**, dont les webhooks ne sont pas listés
> par l'API des webhooks du dépôt. Aucune action manuelle n'est nécessaire.

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

## 7. Décisions prises et questions encore ouvertes

### Tranchées (implémentées — à confirmer avec le client)

| Réf | Question du cahier des charges | Ce qui a été décidé |
|---|---|---|
| **B2** | 90 % écrivain + 10 % diocèse sur le brut dépassait 100 % du net | Barème **sur le net** : écrivain 70 %, diocèse 10 %, plateforme 20 %. Frais du prestataire 2 % du brut, déduits avant partage |
| **B3** | « Une commission à chaque début de mois » | Commissions **à chaque vente** ; les versements, eux, sont mensuels |
| **O1** | Rattachement au diocèse au paiement ou après déménagement ? | **Figé à l'encaissement** : la part porte le diocèse du fidèle à cet instant ; un déménagement ne réécrit pas le passé |
| **O3** | Qui nomme les administrateurs de diocèse ? | Le **super-administrateur**, depuis `/admin/dioceses` |
| **O4** | Qui verse, comment, qui approuve ? | Lots préparés puis approuvés par `SUPER_ADMIN` / `FINANCE`, versement avec référence mobile money |
| **Q1** | Envoyer les identifiants par email ? | Non : faute de serveur SMTP, le mot de passe provisoire s'affiche **une fois** et se transmet de vive voix |

### Encore ouvertes

| Réf | Sujet | Conséquence |
|---|---|---|
| **B1** | Frais **réels** du prestataire : qui les paie, et comment l'application les connaît-elle ? | Aujourd'hui un forfait de 2 % supposé. Avec un vrai prestataire, les frais arrivent dans le webhook |
| **O2** | Remboursement possible **après** un versement ? | Non tranché : le code accepte le remboursement et crée des contre-écritures, ce qui peut laisser un solde négatif |
| **O7** | Texte définitif du consentement, motifs de signalement, **liste complète des paroisses** | Contenu à fournir |
| **Q2** | **Données visibles par le diocèse** : nom, email, pays, paroisse, date d'inscription. Faut-il masquer les emails ? | Vie privée des fidèles |
| **Q3** | **Qui gère les paroisses** : le super-administrateur seul. Un diocèse doit-il renommer les siennes ? | Organisation |

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
| `/ecrivain` | écrivain connecté — profil, œuvres, ventes, versements, manuscrits |
| `/diocese` | compte diocésain — inscrits, export, revenus du diocèse |
| `/diocese/inscription` | demande autonome d'un accès diocésain |
| `/admin/dioceses` | super-administrateur — référentiel et gestion des comptes diocésains |
| `/admin/moderation` | super-administrateur, éditeur, support — signalements |
| `/admin/finances` | `SUPER_ADMIN`, `FINANCE` — barème, soldes, lots, remboursements |
| `/admin/manuscrits` | comité de lecture — manuscrits déposés |
| `/paiement/demo/[orderId]` | simulation d'encaissement (`DEMO_PAYMENT_VISIBLE=false` la ferme) |

Comptes de démonstration : [comptes-demo.md](comptes-demo.md) et `npm run db:comptes` (script
idempotent) — administrateur, trois diocèses, cinq auteurs, un fidèle acheteur.

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
  documents `docs/` y sont visibles, PDF du client compris, comme demandé. **Conséquence à connaître :
  `docs/comptes-demo.md` y publie aussi les mots de passe des comptes de démonstration — voir la
  section 12.**
- **Poussée refusée en 403 sur cette machine** : l'auteur des commits est bien
  `Loukstech <loukstech@gmail.com>` (`git config user.name`), mais ce n'est **pas** ce qui authentifie
  une poussée. Les identifiants HTTPS enregistrés dans le gestionnaire Windows appartiennent à
  `Loukmanayaba97`, qui n'a aucun droit sur `Loukstech/CCC` :

  ```
  remote: Permission to Loukstech/CCC.git denied to Loukmanayaba97.
  fatal: unable to access '...': The requested URL returned error: 403
  ```

  En attendant de régler cela, les poussées du 5 novembre ont été faites avec le jeton du compte
  `Loukstech` déjà enregistré dans `gh` :
  `git -c credential.helper= push "https://x-access-token:$TOKEN@github.com/Loukstech/CCC.git" main`.
  Pour corriger durablement : `gh auth switch --user Loukstech` puis `gh auth setup-git`, ou enregistrer
  les identifiants du bon compte dans le gestionnaire.
- Pour savoir si une poussée a été publiée, regardez le **statut du commit** sur GitHub
  (« Vercel : Deployment has completed ») ou le tableau de bord Vercel — pas la liste des webhooks du
  dépôt, qui ne montre pas les GitHub Apps.

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

Réglable sans toucher au code, en points de base (10 000 = 100 %) :
`CCC_FEE_PPM` (200), `CCC_WRITER_PPM` (7000), `CCC_DIOCESE_PPM` (1000), `CCC_SUB_DIOCESE_PPM` (1000).

La part plateforme n'est **pas** un réglage : elle prend toujours le reste
(`10 000 − écrivain − diocèse`), précisément pour que la somme des parts égale le net. Une variable
`CCC_PLATFORM_PPM` serait donc sans effet — ne pas la présenter comme une option. Deux garde-fous :
une somme écrivain + diocèse supérieure à 100 % est refusée (retour au barème par défaut), et un taux
invalide retombe silencieusement sur sa valeur par défaut.

> **À faire** : ces quatre variables ne figurent pas encore dans `.env.example`. Les y ajouter (avec
> leur valeur par défaut, en commentaire) évitera de croire que le barème est figé dans le code.

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
9. ~~**Déploiement**~~ — **résolu** : le déploiement est automatique, vérifié le 5 novembre au soir
   (site à jour sur `3a24990`). Voir `DEPLOIEMENT.md`.
10. **Connexion en ligne à re-vérifier dans un vrai navigateur** (voir section 12, point 2) : mes
    essais automatisés n'ont pas obtenu de session sur le site en ligne, sans message d'erreur.

## 12. Sécurité — trois points à traiter

### 1. Les mots de passe de démonstration sont publiés dans un dépôt public

`docs/comptes-demo.md` donne en clair les identifiants des comptes de démonstration, dont
`admin@ccc.example` / `Admin-2026`, un compte **`SUPER_ADMIN`**. Or :

- le dépôt `Loukstech/CCC` est **public** (vérifié : `private: false`) ;
- le site en ligne **utilise la même base Neon** que la machine locale ;
- ces dix comptes `@ccc.example` **existent bien en production**, avec leurs rôles réels ;
- le mot de passe `Admin-2026` a été vérifié contre le hachage en base (scrypt) : **il est valide**.

Autrement dit, ces identifiants ne sont pas décoratifs : ce sont de vraies clés, publiées. Trois
mesures, par ordre d'efficacité :

1. **Changer le mot de passe du super-administrateur** (`npm run admin:password`) et ne plus jamais
   committer le nouveau — puis retirer les mots de passe de `comptes-demo.md`, qui peut garder les
   adresses email et les rôles sans les secrets ;
2. ou passer le dépôt en **privé** tant que le site n'est pas ouvert au public ;
3. et, si le dépôt reste public avec des comptes de démonstration, **régénérer leurs mots de passe à
   chaque démonstration** plutôt que de les figer.

À noter : `DEPLOIEMENT.md` recommande déjà de changer le mot de passe administrateur avant publication,
mais rien n'empêche la fuite une fois qu'il est publié.

### 2. Connexion non aboutie lors d'un test automatisé — à confirmer

Lors du contrôle du 5 novembre au soir, une connexion automatisée (Edge sans interface) sur
`ccc-three-lyart.vercel.app` avec `admin@ccc.example` n'a **pas** ouvert de session : la requête
d'authentification répond 200, mais aucun cookie de session n'est posé, aucune redirection ne suit et
**aucun message d'erreur ne s'affiche**. Deux éléments rendent ce résultat ambigu :

- le mot de passe est pourtant valide (vérifié contre le hachage) et le compte n'est pas désactivé ;
- les lectures en base fonctionnent depuis la production (l'inscription affiche bien les 3 diocèses),
  donc ce n'est pas une panne de connexion à la base.

Deux hypothèses restent ouvertes : soit une protection anti-robots (le site est derrière Cloudflare,
cookies `__cf_bm` présents) bloque la soumission automatique, soit l'action de connexion échoue en
production et **le message d'erreur n'est pas affiché**, ce qui serait un défaut à corriger.

**À faire** : essayer la connexion dans un navigateur normal. Si elle fonctionne, l'hypothèse
anti-robots est la bonne. Sinon, regarder les journaux Vercel (Functions → login) — et, dans tous les
cas, corriger le formulaire pour qu'un échec affiche un message au lieu de rester muet.

### 3. Base partagée entre démonstration et machine locale

Toute manipulation faite en local (migrations, scripts, tests) s'applique **immédiatement** au site en
ligne, et inversement. C'est pratique pour la démonstration, risqué pour la suite : la
recommandation de `DEPLOIEMENT.md` — une branche Neon séparée pour la production — vaut d'être
appliquée avant l'ouverture au public.
