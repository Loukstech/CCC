# Lot 8 — Codes de partenariat et événements en direct

> Livré le 6 novembre 2026. Commits `12b79a0` (fonctionnalité), `dc4eaa7` (correctif de build) et
> `4820e51` (message d'accès refusé), déployés sur
> [ccc-three-lyart.vercel.app](https://ccc-three-lyart.vercel.app).
>
> Ce document décrit **ce qui est en place**, **comment l'exploiter**, **comment le vérifier** et
> **ce qui reste à faire avant une vraie production**. Il ne remplace pas le cahier des charges :
> il explique les choix d'implémentation.

## 1. Les deux demandes du client

1. **Partenariats** — « Pour les diocèses et les écrivains, on doit aller les rencontrer et signer un
   partenariat, et dès qu'ils sont d'accord on va leur fournir un code, et lors de l'inscription
   c'est ce code qu'ils vont ajouter à leur formulaire pour avoir un compte sur la plateforme.
   Comme ça, ça éviterait que n'importe qui s'inscrive comme diocèse ou écrivain. »
2. **Directs** — « Il demande si on peut intégrer une page pour les live, comme ça s'il y a de grands
   événements, on peut faire des lives sur la plateforme. » Avec une règle : seuls les comptes
   **approuvés ou porteurs d'un badge** délivré par l'administration peuvent diffuser.

## 2. Codes de partenariat

### 2.1 Principe

Le contrat est signé **hors ligne**. L'administration émet ensuite un code à usage unique et le
transmet au partenaire. Le partenaire le saisit à l'inscription : le serveur vérifie le code, le
consomme, et crée le compte avec le bon périmètre (profil d'auteur approuvé, ou administrateur de
diocèse).

```
Contrat signé ──► /admin/partenariats ──► code affiché UNE fois ──► partenaire
                                                                        │
                                                                        ▼
                                    /ecrivain/inscription  ou  /diocese/inscription
                                                                        │
                                                    vérification + consommation atomique
                                                                        │
                                    ┌───────────────────────────────────┴──────────────┐
                                    ▼                                                  ▼
                        WriterProfile APPROVED                            DioceseAdmin (ADMIN)
```

### 2.2 Modèle de données

Table `PartnerCode` (migration `20261106163000_partenariats_lives`, purement additive) :

| Colonne | Rôle |
|---|---|
| `codeHash` | HMAC-SHA256 du code normalisé — **unique**, c'est la seule trace du code |
| `label` | Nom du partenaire (« Diocèse de Cotonou — Père Jean ») |
| `kind` | `WRITER` ou `DIOCESE` |
| `contractRef` | Référence du contrat signé |
| `dioceseId` | Diocèse imposé (facultatif) : le code ne vaut alors que pour celui-ci |
| `expiresAt` | Fin de validité (30 jours par défaut) |
| `usedAt`, `usedByUserId` | Consommation (qui, quand) |
| `revokedAt` | Révocation avant usage |
| `createdById` | Qui a émis le code |

Le code en clair **n'est jamais stocké** : on ne peut pas le retrouver depuis la base, seulement
vérifier qu'un code présenté correspond.

### 2.3 Où le code est exigé

Trois portes, et une seule règle : *si `PARTNER_CODE_REQUIRED=true`, un code valide est obligatoire*.

| Porte | Fichier | Effet |
|---|---|---|
| `/diocese/inscription` | `src/app/actions/dioceses.ts` → `registerDioceseAccount` | Exige un code `DIOCESE`. Un code valide autorise en plus un **second** administrateur sur un diocèse qui en a déjà un (l'ancien garde-fou `dio.errTaken` bloquait tout). |
| `/ecrivain/inscription` *(nouvelle page)* | `src/app/actions/partner-signup.ts` → `signupWriter` | Exige un code `WRITER` et crée directement un `WriterProfile` **APPROVED**. |
| `/ecrivain` | `src/lib/writer-access.ts` → `requireWriterAccess` | Exige un profil `APPROVED`, sinon redirection vers `/ecrivain/inscription?acces=refuse`. Empêche de contourner le code en ouvrant l'espace directement. |

`/inscription` (lecteur) reste **libre** : c'est la demande explicite du client.

Un code saisi est **toujours** vérifié et consommé, même quand le contrôle est désactivé. Le flag ne
change donc que le caractère obligatoire, pas la validité.

### 2.4 Sécurité

- **Aucun code en clair en base.** Empreinte HMAC-SHA256, clé = `SESSION_SECRET`.
- **Consommation atomique** : `updateMany({ where: { codeHash, kind, usedAt: null, revokedAt: null,
  expiresAt: { gt: now } } })` dans la même transaction que la création du compte. Deux inscriptions
  simultanées avec le même code ne peuvent pas réussir toutes les deux ; en cas d'échec, la
  transaction est annulée et le code reste intact.
- **Messages distincts** (`inspectCode`) : inconnu, expiré, déjà utilisé, révoqué, mauvais type,
  mauvais diocèse. L'utilisateur sait quoi corriger sans deviner.
- **Traçabilité** : chaque émission, révocation, consommation et validation d'auteur écrit une ligne
  `AuditLog`. Le code en clair n'y figure jamais.
- **Pas de réaffichage** : le code n'est renvoyé qu'une fois, dans le message de confirmation de
  `/admin/partenariats`. Il n'est ni dans les `values` du formulaire, ni dans les logs.
- **Changer `SESSION_SECRET` invalide tous les codes déjà émis** (et toutes les sessions). À ne faire
  qu'en connaissance de cause.

### 2.5 Back-office `/admin/partenariats`

Réservé à `PARTNER_ROLES = [SUPER_ADMIN]` (`src/lib/dal.ts`).

- **Émettre un code** : type, partenaire, référence de contrat, diocèse éventuel, durée (1 à 365 j,
  30 par défaut). Le code s'affiche une seule fois.
- **Liste des codes** : disponible / utilisé / révoqué / expiré, date d'expiration, diocèse, contrat,
  utilisateur. Un code disponible peut être **révoqué** (un code consommé ne l'est plus : l'historique
  reste lisible).
- **Auteurs partenaires** : liste des comptes qui portent des œuvres ou un profil, avec un statut
  modifiable (`PENDING` / `APPROVED` / `REJECTED`). C'est la **voie de secours** pour un contrat signé
  avant la mise en place des codes, ou pour régulariser un auteur existant.

### 2.6 Variables d'environnement

| Variable | Effet |
|---|---|
| `PARTNER_CODE_REQUIRED` | `true` : code obligatoire + `/ecrivain` réservé aux profils approuvés. Absent ou `false` : démonstration ouverte (un code saisi reste vérifié). |
| `SESSION_SECRET` | Clé du HMAC. La changer invalide codes et sessions. |

État actuel en production : `PARTNER_CODE_REQUIRED=true` (cibles `production` et `preview`).
Pour rouvrir temporairement les inscriptions : passer la variable à `false` puis redéployer.

## 3. Événements en direct

### 3.1 Principe : Vercel ne diffuse pas la vidéo

Une fonction serverless ne peut pas recevoir un flux RTMP. L'ingestion reste donc **chez un
prestataire** ; le site ne fait que servir la page et contrôler l'accès :

```
Caméra / OBS ──RTMP──► YouTube Live · Facebook Live · Mux Live
                              │
                              ▼  (iframe ou HLS)
                    /live/[slug]  ← contrôle de visibilité côté serveur
```

### 3.2 Modèle de données

- **`LiveEvent`** : `slug`, `title`, `description`, `provider` (`EMBED` | `MUX`), `embedUrl` ou
  `playbackId`, `replayUrl`, `status` (`DRAFT` → `SCHEDULED` → `LIVE` → `ENDED` → `ARCHIVED`),
  `visibility` (`PUBLIC` | `AUTHENTICATED` | `SUBSCRIBERS`), `startsAt`, `endsAt`, `broadcasterId`,
  `createdById`.
- **`LiveBroadcaster`** : le **badge** de diffuseur. Clé primaire = `userId`, avec `grantedById`,
  `note` et `revokedAt`. Un badge retiré (`revokedAt` renseigné) ne permet plus d'être désigné.

### 3.3 Le badge « diffuseur approuvé »

Réponse directe à la règle du client : « ceux qui peuvent faire un live doivent avoir une
approbation ou un badge de la part de l'admin ».

- Attribué depuis `/admin/lives` **par e-mail** à un compte existant.
- Seuls les porteurs d'un badge **actif** apparaissent dans la liste « diffuseur » du formulaire de
  création. Le serveur re-vérifie le badge : une requête forgée est refusée (`liveAdm.errBadge`).
- Retirer le badge n'éteint pas un direct en cours, mais empêche toute nouvelle désignation.

### 3.4 Deux sources possibles

| Source | Usage | Ce qu'il faut fournir |
|---|---|---|
| `EMBED` | Le plus rapide : YouTube Live, Facebook Live, Vimeo, Dailymotion, Twitch | L'URL d'intégration HTTPS (`.../embed/...`) |
| `MUX` | Cohérent avec l'adaptateur vidéo existant, lecture signée, replay | Le *Playback ID* du direct Mux |

Pour `MUX`, les clés déjà utilisées pour la vidéo à la demande suffisent :
`MUX_SIGNING_KEY_ID` et `MUX_SIGNING_PRIVATE_KEY` (`src/lib/video/mux.ts`). Sans elles, l'adresse HLS
reste publique — acceptable pour une démonstration, pas pour un contenu réservé.

### 3.5 Visibilité et accès

`src/lib/live.ts` → `canViewLive` :

| Visibilité | Qui peut regarder |
|---|---|
| `PUBLIC` | Tout le monde |
| `AUTHENTICATED` | Toute personne connectée |
| `SUBSCRIBERS` | Abonnement en cours (`getActiveSubscription`), personnel toujours autorisé |

Un `DRAFT` ou un `ARCHIVED` renvoie `notFound()` sauf pour le personnel (prévisualisation).
Un `SCHEDULED` affiche la date de début au lieu du lecteur ; un `ENDED` affiche le replay s'il existe.

### 3.6 Pages publiques

- `/live` — liste en trois blocs : **En direct**, **À venir**, **Replays et événements passés**.
  Chaque carte indique le statut, la visibilité, la date (UTC) et le diffuseur.
- `/live/[slug]` — lecteur plein écran sombre, même langage visuel que `/regarder/[slug]`.
  `components/LivePlayer.tsx` gère l'iframe **ou** HLS (`hls.js`, natif sur Safari), sans enregistrer
  de progression : un direct n'a pas de position de reprise.
- Navigation : lien « En direct » dans l'en-tête et 6ᵉ onglet de la barre mobile
  (`BottomNav` passe en `grid-cols-6`, icône `LiveIcon`). Traductions FR/EN complètes.

### 3.7 Back-office `/admin/lives`

Réservé à `LIVE_ROLES = [SUPER_ADMIN, EDITOR]`.

- **Programmer** un événement : titre, slug (généré depuis le titre si vide), description, source,
  date de début (UTC), visibilité, statut initial, diffuseur.
- **Piloter** : changer le statut (passer en `LIVE`, terminer, archiver), ouvrir la page publique,
  supprimer.
- **Badges** : attribuer / retirer, avec une note.

### 3.8 Sécurité des intégrations

Une iframe accepte n'importe quelle page : sans filtre, un compte éditeur pourrait injecter une page
d'hameçonnage dans le site. `safeEmbedUrl` impose donc **HTTPS** et une **liste fermée d'hôtes**
(YouTube, Facebook, Vimeo, Dailymotion, Twitch). Une URL hors liste est refusée à la création.
Pour Mux, `isPlaybackId` n'accepte qu'un identifiant (lettres, chiffres, `-`, `_`), jamais une URL.

## 4. Mise en direct, pas à pas

1. **Créer le direct chez le prestataire** (ex. YouTube Studio → « En direct »), récupérer l'URL
   d'intégration, ou créer un live Mux et noter le *Playback ID*.
2. **`/admin/lives`** → programmer l'événement avec cette source, la visibilité et le diffuseur.
3. Le jour J, **passer le statut à `LIVE`** : la page publique affiche le lecteur.
4. À la fin, **passer à `ENDED`** (la date de fin est enregistrée automatiquement) et renseigner
   l'**URL du replay** si elle existe.
5. Archiver quand l'événement n'a plus d'intérêt.

## 5. Fichiers concernés

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | Enums `PartnerKind`, `LiveProvider`, `LiveStatus`, `LiveVisibility` ; modèles `PartnerCode`, `LiveBroadcaster`, `LiveEvent` |
| `prisma/migrations/20261106163000_partenariats_lives/migration.sql` | Migration additive (3 tables, 4 enums, index, clés étrangères) |
| `src/lib/partner-codes.ts` | Normalisation, HMAC, génération, inspection, condition de consommation, messages |
| `src/lib/writer-access.ts` | `requireWriterAccess` |
| `src/lib/live.ts` | `safeEmbedUrl`, `isPlaybackId`, `canViewLive` |
| `src/app/actions/partnerships.ts` | Émettre, révoquer, valider un auteur |
| `src/app/actions/partner-signup.ts` | Inscription écrivain avec code |
| `src/app/actions/lives.ts` | Créer, changer le statut, supprimer, badge |
| `src/app/actions/dioceses.ts` | Inscription diocèse avec code |
| `src/app/admin/partenariats/page.tsx` | Back-office partenariats |
| `src/app/admin/lives/page.tsx` | Back-office directs |
| `src/app/ecrivain/inscription/page.tsx` | Inscription écrivain (nouvelle page) |
| `src/app/live/page.tsx`, `src/app/live/[slug]/page.tsx` | Pages publiques |
| `src/components/LivePlayer.tsx` | Lecteur iframe / HLS |
| `src/lib/dal.ts` | `PARTNER_ROLES`, `LIVE_ROLES` |
| `src/lib/i18n/fr.ts`, `src/lib/i18n/en.ts` | Traductions (clés `part.*`, `live.*`, `liveAdm.*`, `nav.live`) |
| `src/components/Header.tsx`, `BottomNav.tsx`, `icons.tsx` | Navigation et icône |
| `.env.example` | `PARTNER_CODE_REQUIRED`, note Mux Live |

## 6. Vérifications effectuées en production

| Vérification | Résultat |
|---|---|
| Bannière `/admin/partenariats` | « Contrôle ACTIF… » |
| Émission de 4 codes depuis l'interface | 4 codes créés, affichés une seule fois |
| Badge diffuseur attribué par e-mail | « Badge de diffuseur attribué à Administration CCC. » |
| Création d'un événement avec diffuseur | `messe-de-demonstration`, statut `SCHEDULED`, diffuseur = admin |
| `/live` | « À venir (1) », carte complète |
| `/live/messe-de-demonstration` | « Programmé », diffuseur affiché, « La diffusion n'a pas encore commencé », **0 iframe** |
| `/ecrivain/inscription` et `/diocese/inscription` | Champ `partnerCode` présent et **obligatoire** |
| En-tête | Lien `/live` présent |
| **Usage unique** | 1ʳᵉ utilisation → compte créé, profil `APPROVED`, accès à `/ecrivain`. 2ᵉ tentative → « Ce code de partenariat a déjà été utilisé. », aucune session créée |
| Auteur de démo existant (`auteur1`) | `/ecrivain` toujours accessible (profil approuvé créé avant l'activation du contrôle) |
| Lecteur connecté sans profil (`fidele.demo`) | Redirigé vers l'explication, **sans** formulaire d'inscription trompeur |
| Routes | `/`, `/live`, `/live/<slug>`, `/inscription`, `/ecrivain/inscription`, `/diocese/inscription`, `/admin/partenariats`, `/admin/lives` = **200** |

## 7. Codes de démonstration

Quatre codes ont été émis depuis l'interface de production (donc avec le vrai `SESSION_SECRET` — l'API
Vercel ne renvoie jamais un secret de type `sensitive`, impossible de les calculer de façon fiable en
local). Ils expirent le **6 décembre 2026** et n'ont pas été consommés.

| Type | Partenaire | Référence contrat |
|---|---|---|
| Écrivain | Awa Sossou (démo) | `DEMO-LOT8-W1` |
| Écrivain | Kossi Agbeko (démo) | `DEMO-LOT8-W2` |
| Diocèse | Diocèse Bénin | `DEMO-LOT8-D1` |
| Diocèse | Diocèse Togo | `DEMO-LOT8-D2` |

> **Les codes en clair ne sont pas versionnés.** Le dépôt est public : publier les codes annulerait
> exactement la protection qu'ils apportent. Ils sont conservés hors dépôt, et peuvent être
> réémis à tout moment depuis `/admin/partenariats` (un code ne s'affiche qu'une fois : notez-le
> immédiatement).

Chaque code ne sert **qu'une fois**. Un test le consomme définitivement.

## 8. Limites connues et travail restant

| Point | État |
|---|---|
| Révoquer les codes de démonstration | À faire avant une vraie production |
| Flux de démonstration | L'événement `messe-de-demonstration` est `SCHEDULED` : aucun flux n'est chargé. Remplacer la source avant de le passer en `LIVE` |
| Mux Live | Nécessite `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` pour une lecture signée |
| Comptes existants | Un compte déjà créé ne peut pas « devenir » écrivain en saisissant un code : il doit être approuvé depuis `/admin/partenariats` (le parcours prévu par le client est une inscription **avec** code) |
| `createWork` | Ne renseigne toujours pas `Work.authorId` : une œuvre créée dans `/admin` n'apparaît pas dans l'espace de son auteur et sa part de 80 % tombe dans la part plateforme (antérieur au lot 8) |
| `SESSION_SECRET` | Le changer invalide tous les codes et toutes les sessions |
