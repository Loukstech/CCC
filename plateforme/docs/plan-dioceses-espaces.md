# Plan technique v2 — Diocèses, commissions, écrivains, avis et commentaires

> Version 2, après la réponse du client du 04/11/2026 (voir `cr-reponse-client.md`).
> Les points marqués **BLOQUANT** ne peuvent pas être codés avant décision écrite.
> Rien n'est implémenté à ce stade.

## 1. Contexte corrigé

L'organisation est celle de l'**Église du Christianisme Céleste** : la structure est
**Diocèse (par pays) → Paroisse**, sans niveau intermédiaire. Trois diocèses connus
(Bénin, Togo, Nigeria) et onze paroisses fournies à titre d'échantillon.

Deux règles de partage coexistent désormais :

| Bénéficiaire | Taux | Base | Rythme |
|---|---|---|---|
| Diocèse | 10 % | **net** (après frais de paiement) | à chaque paiement |
| Écrivain | 90 % | **prix initial de vente** (brut) | liquidation mensuelle |
| Plateforme | — | — | **BLOQUANT 2** : la somme dépasse 100 % |

## 2. Décisions actées et points ouverts

### Actées

- Taux **identique pour tous les diocèses**, modifiable par l'administrateur seul, historique figé.
- Revenus partagés : **ventes d'œuvres et abonnements**, publicité exclue.
- Inscription : diocèse, paroisse et **consentement explicite obligatoires**.
- Espace diocèse en **consultation seule** (à confirmer formellement).
- Avis : **un par œuvre**, note **1 à 5 obligatoire**.
- Commentaires : **publication immédiate**, modération a posteriori, signalement.
- Écrivain : suivi des œuvres au premier lot ; dépôt de manuscrit traité séparément.

### Ouvertes

| Réf | Sujet | Bloque |
|---|---|---|
| **B1** | Frais de paiement : D1 dit « net après frais », la section finances dit « non » à leur prise en charge. L'application ne connaît aucun frais | Lot 4 |
| **B2** | 90 % (brut) + 10 % (net) > 100 % : la plateforme perd de l'argent sur chaque vente | Lots 4 et 6 |
| **B3** | D2 : « une commission à chaque début prochain » — deux lectures possibles | Lot 4 |
| O1 | D3 : figement du rattachement au moment du paiement | Lot 4 |
| O2 | D4 : remboursement avant / après versement | Lot 4 |
| O3 | D7 : consultation seule + qui nomme les administrateurs de diocèse | Lot 3 |
| O4 | D10 : qui verse, comment, quand, quel seuil, qui approuve | Lot 5 |
| O5 | Comptes existants sans paroisse (« à revoir ») | Lot 1 |
| O6 | Paroisse fusionnée / renommée (« fusionner ») | Lot 1 |
| O7 | Texte de consentement, motifs de signalement, liste complète des paroisses | Lots 1 à 3 |

## 3. Modèle de données v2

### 3.1 Référentiel : Diocèse → Paroisse

```prisma
model Diocese {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String // « Diocèse Bénin »
  country   String // code ISO : BJ, TG, NG
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  parishes Parish[]
  admins   DioceseAdmin[]
  earnings Earning[]
  payouts  Payout[]
}

model Parish {
  id           String   @id @default(cuid())
  dioceseId    String
  diocese      Diocese  @relation(fields: [dioceseId], references: [id], onDelete: Restrict)
  name         String // « Paroisse Mont Sinaï »
  city         String?
  active       Boolean  @default(true)
  /// Paroisse de rattachement si celle-ci a été fusionnée. Jamais de suppression.
  mergedIntoId String?
  mergedInto   Parish?  @relation("ParishMerge", fields: [mergedIntoId], references: [id])
  mergedFrom   Parish[] @relation("ParishMerge")
  createdAt    DateTime @default(now())

  users    User[]
  earnings Earning[]

  @@unique([dioceseId, name])
  @@index([dioceseId, active])
}
```

Une paroisse ne se **supprime jamais** : elle passe à `active = false` et reçoit un
`mergedIntoId`. Les utilisateurs sont réaffectés en une opération tracée dans `AuditLog`
(réponse client « fusionner »).

### 3.2 Rattachement de l'utilisateur

```prisma
model User {
  // … champs existants inchangés …
  parishId        String?
  parish          Parish?   @relation(fields: [parishId], references: [id], onDelete: SetNull)
  /// Horodatage du consentement explicite au partage avec le diocèse.
  parishConsentAt DateTime?
}
```

`parishId` reste **nullable** : les comptes existants et le personnel n'en ont pas. La validation
d'obligation se fait dans `signup`, pas au niveau du schéma — c'est ce qui permet de traiter les
comptes existants sans migration destructive (point O5).

### 3.3 Réglage global du taux

```prisma
model PlatformSetting {
  id          String   @id @default("singleton")
  /// Part du diocèse, en points de base. 1000 = 10 %.
  dioceseBps  Int      @default(1000)
  /// Part de l'écrivain, en points de base. 9000 = 90 %.
  authorBps   Int      @default(9000)
  updatedAt   DateTime @updatedAt
  updatedById String?
}
```

Le taux est **global** (réponse D6), mais chaque écriture comptable conserve **son propre taux**
(`rateBps` dans `Earning`) : modifier le réglage ne réécrit donc jamais l'historique.

**Garde-fou à implémenter** : l'action de modification refuse une configuration où
`dioceseBps + authorBps > 10000`, et journalise l'ancienne et la nouvelle valeur. Aujourd'hui
la configuration par défaut (1000 + 9000 = 10000) occupe **100 % du prix** et laisse zéro à la
plateforme. C'est exactement le **BLOQUANT 2** : le garde-fou doit refuser une somme supérieure
à 100 %, mais il ne peut pas décider de la marge de la plateforme à la place du client.

### 3.4 Frais de paiement (BLOQUANT 1)

```prisma
model Order {
  // … champs existants inchangés …
  /// Frais du prestataire, en plus petite unité de la devise, connus au moment de la confirmation.
  feeAmount  Int       @default(0)
  /// Montant net réellement reçu : amount − feeAmount, figé à la confirmation.
  netAmount  Int?
  refundedAt DateTime?
}
```

Sans `feeAmount`, la règle « 10 % du net » est inapplicable. Deux façons de le remplir :

1. **le prestataire le transmet** (FedaPay, CinetPay, Stripe renvoient le net ou la commission) —
   à privilégier ;
2. **un barème configuré** par prestataire et par moyen de paiement, en dernier recours.

Dans les deux cas, **jamais d'estimation silencieuse** : si les frais sont inconnus, la commission
reste en attente et l'écran de finance le signale. Une commission calculée sur un net supposé est
une commission fausse.

### 3.5 Écritures comptables : un seul registre, deux bénéficiaires

Plutôt que deux tables parallèles (commissions diocèses et droits d'auteur), un registre unique :
les rapports, les lots de versement et le rapprochement sont identiques pour les deux.

```prisma
enum BeneficiaryKind {
  DIOCESE
  AUTHOR
}

enum EarningStatus {
  ACCRUED // acquis, pas encore versé
  PAID    // inclus dans un versement
  VOID    // annulé (remboursement)
}

/// Brut ou net : la base utilisée est stockée, ce qui rend visible toute incohérence de règles.
enum EarningBase {
  GROSS
  NET
}

model Earning {
  id         String          @id @default(cuid())
  orderId    String
  order      Order           @relation(fields: [orderId], references: [id], onDelete: Restrict)
  kind       BeneficiaryKind
  dioceseId  String?
  diocese    Diocese?        @relation(fields: [dioceseId], references: [id], onDelete: Restrict)
  authorId   String?
  author     Author?         @relation(fields: [authorId], references: [id], onDelete: Restrict)
  currency   String
  base       EarningBase
  baseAmount Int
  rateBps    Int
  amount     Int
  status     EarningStatus   @default(ACCRUED)
  payoutId   String?
  payout     Payout?         @relation(fields: [payoutId], references: [id], onDelete: SetNull)
  createdAt  DateTime        @default(now())

  /// Une seule part diocèse et une seule part auteur par commande : anti-double comptage.
  @@unique([orderId, kind])
  @@index([dioceseId, status])
  @@index([authorId, status])
}
```

`@@unique([orderId, kind])` est la garantie centrale : le prestataire peut confirmer deux fois la
même commande, la base refuse la seconde écriture. Aucune correction applicative ne peut
contourner cette contrainte.

### 3.6 Versements

```prisma
enum PayoutStatus {
  DRAFT
  APPROVED
  SENT
  CONFIRMED
}

model Payout {
  id           String          @id @default(cuid())
  kind         BeneficiaryKind
  dioceseId    String?
  diocese      Diocese?        @relation(fields: [dioceseId], references: [id], onDelete: Restrict)
  authorId     String?
  author       Author?         @relation(fields: [authorId], references: [id], onDelete: Restrict)
  periodStart  DateTime
  periodEnd    DateTime
  currency     String
  amount       Int
  status       PayoutStatus    @default(DRAFT)
  method       String? // « mobile money », « virement »
  reference    String? // n° de transaction ou de virement
  approvedById String?
  paidAt       DateTime?
  createdAt    DateTime        @default(now())

  earnings Earning[]

  @@index([kind, status])
}
```

Le statut `APPROVED` existe parce que la réponse client demande « la personne qui approuve un
versement » (O4) : séparer la préparation et l'approbation est la seule façon de le garantir.

### 3.7 Écrivains

```prisma
enum AuthorStatus {
  PENDING
  APPROVED
  SUSPENDED
}

model Author {
  id          String       @id @default(cuid())
  userId      String       @unique
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName String
  bio         String?
  status      AuthorStatus @default(PENDING)
  createdAt   DateTime     @default(now())

  works    Work[]
  earnings Earning[]
  payouts  Payout[]
}

model Work {
  // … champs existants, dont le champ texte `author` conservé pour l'affichage …
  authorId String?
  authorRef Author? @relation(fields: [authorId], references: [id], onDelete: SetNull)

  reviews      Review[]
  comments     Comment[]
  ratingAvg    Float @default(0)
  ratingCount  Int   @default(0)
  commentCount Int   @default(0)
}
```

La part de l'écrivain est calculée en `base = GROSS`, celle du diocèse en `base = NET`
(reproduction fidèle des réponses D9 et D1). Ce choix **rend le conflit visible en base** :
un rapport sommant les deux parts montre immédiatement le dépassement.

### 3.8 Avis, commentaires, signalements

Identiques à la v1, avec la publication immédiate confirmée :

```prisma
enum ContentStatus {
  PENDING
  PUBLISHED
  HIDDEN
}

model Review {
  id        String        @id @default(cuid())
  workId    String
  work      Work          @relation(fields: [workId], references: [id], onDelete: Cascade)
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int
  body      String?
  status    ContentStatus @default(PUBLISHED)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@unique([userId, workId])
  @@index([workId, status])
}

model Comment {
  id        String        @id @default(cuid())
  workId    String
  work      Work          @relation(fields: [workId], references: [id], onDelete: Cascade)
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  body      String
  status    ContentStatus @default(PUBLISHED)
  parentId  String?
  parent    Comment?      @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[]     @relation("CommentReplies")
  createdAt DateTime      @default(now())

  @@index([workId, status, createdAt])
}
```

## 4. Le calcul, une fois les bloquants levés

Dans la transaction de `markOrderPaid()` (déjà idempotente), après la mise à `PAID` :

```ts
// esquisse — les taux viennent du réglage global, la base de la règle
const settings = await tx.platformSetting.findUnique({ where: { id: "singleton" } });
const parish = await tx.user.findUnique({ where: { id: order.userId } })
  .parish({ select: { dioceseId: true } });

// Part du diocèse : 10 % du net (BLOQUANT 1 : netAmount doit être connu)
if (parish && order.netAmount != null) { /* Earning { kind: DIOCESE, base: NET } */ }

// Part de l'écrivain : 90 % du brut, seulement pour une vente d'œuvre
if (order.work?.authorId) { /* Earning { kind: AUTHOR, base: GROSS } */ }
```

**Ne coder ceci qu'après B1 et B2.** En l'état, la seconde écriture rend le total supérieur au net
encaissé (voir le tableau du compte rendu). Le code serait juste et le résultat faux.

## 5. Écrans

| Route | Accès | Contenu | Lot |
|---|---|---|---|
| `/inscription` | public | Diocèse → paroisse en cascade, consentement obligatoire | 1 |
| `/admin/dioceses` | staff | CRUD diocèses/paroisses, fusion, taux global | 1 |
| `/oeuvres/[slug]` | public | Avis (moyenne + formulaire) et commentaires | 2 |
| `/admin/moderation` | staff | File des signalements, masquer, rétablir | 2 |
| `/diocese` | admin diocèse | Inscrits, répartition par paroisse, export CSV | 3 ✅ |
| `/diocese/revenus` | admin diocèse | Écritures, solde, versements reçus | 3 (avec le lot 5) |
| `/admin/finances` | staff FINANCE | Écritures, génération des lots, approbation, références | 5 |
| `/ecrivain` | auteur validé | Ses œuvres, ventes, avis, droits acquis | 6 |

### Contraintes de la plateforme

- **Next.js 16.4.3, `cacheComponents: true`** : toute page lisant la session ou la base passe par
  `<Suspense>` + `PageFallback` ; après chaque mutation, `revalidatePath()` — sinon les compteurs
  restent figés.
- **i18n obligatoire** : chaque écran alimente `src/lib/i18n/fr.ts` **et** `en.ts`.
- **Action serveur = point d'entrée public** : chaque action revérifie les droits elle-même.

### Le select en cascade

Composant client `ParishPicker` recevant diocèses et paroisses, filtrage en mémoire (le référentiel
tient en quelques dizaines de lignes). Le choix de la paroisse **exige JavaScript** : sans lui, la
liste des paroisses reste vide. C'est accepté pour ce formulaire, mais la validation serveur reste
indépendante — elle vérifie que la paroisse appartient bien au diocèse envoyé, quel que soit ce
qu'envoie le navigateur.

## 6. Sécurité et vie privée

1. `requireDioceseAdmin()` dans `src/lib/dal.ts` : le `dioceseId` est lu depuis `DioceseAdmin`,
   **jamais** depuis l'URL ou un champ de formulaire. Chaque requête porte `where: { dioceseId }`.
   Test manuel : modifier l'identifiant dans l'URL doit produire un 404.
2. Consentement horodaté (`parishConsentAt`), texte à valider (O7).
3. Données visibles par le diocèse : nom, paroisse, date d'inscription, statistiques agrégées.
   Ni commandes détaillées, ni coordonnées, ni mots de passe — la réponse client demande de le
   confirmer, donc l'implémentation doit rester sur ce périmètre minimal.
4. Commentaires visibles immédiatement (réponse « non » à la pré-modération) : le signalement
   et la file de modération deviennent le seul garde-fou. Prévoir un délai de traitement.
5. `AuditLog` : changements de taux, création/approbation de versement, masquages, fusions de paroisse.

## 7. Lots et conditions de démarrage

| Lot | Contenu | Condition | Estimation |
|---|---|---|---|
| **1** | Diocèses, paroisses, inscription en cascade, consentement, administration du référentiel, fusion | O5, O6, O7 (texte de consentement) | 2–3 j |
| **2** | Avis, commentaires, moyenne, modération a posteriori | O7 (motifs de signalement) | 3–4 j |
| **3** | Espace diocèse en lecture seule + export | O3, O7 | 2 j — **livré** |
| **4a** | Enregistrement des frais (`feeAmount`, `netAmount`) et du net | B1 | 1–2 j |
| **4b** | Calcul des écritures (diocèse et écrivain) + suivi | B1, B2, B3, O1, O2 | 2–3 j |
| **4c** | Action de remboursement (aujourd'hui inexistante dans le code) | O2 | 1–2 j |
| **5** | Relevés, lots de versement, approbation, références | O4, 4c | 3–4 j |
| **6** | Espace écrivain : profil validé, œuvres, ventes, avis, droits | B2 | 3–4 j |
| **7** | *(option)* Dépôt de manuscrit et validation éditoriale | — | 4–6 j |

Les lots 1 à 3 démarrent **immédiatement** : les décisions nécessaires sont prises, seul le texte
de consentement manque pour le lot 1 et peut être rédigé en parallèle pendant le développement.

> **État au 05/11/2026.**
> **Lot 1 livré** : modèles `Diocese`, `Parish`, `DioceseAdmin` et rattachement de l'utilisateur ;
> inscription avec cascade diocèse → paroisse et consentement obligatoire ; administration du
> référentiel (création, renommage, désactivation, fusion) réservée au super-administrateur ;
> référentiel des 3 diocèses et 12 paroisses amorcé par `npm run db:dioceses`.
> **Lot 2 livré** : avis (un par œuvre, note 1 à 5), commentaires avec une réponse, signalements,
> file de modération a posteriori, compteurs dénormalisés recalculés en transaction.
> **Lot 3 livré** : espace `/diocese` en lecture (totaux, répartition par paroisse, liste des
> fidèles), export CSV, et création des comptes diocésains depuis `/admin/dioceses` avec mot de
> passe provisoire affiché une seule fois. Rôles `ADMIN` (export autorisé) et `VIEWER` (lecture
> seule). Le périmètre vient de `DioceseAdmin` et **jamais** de l'URL : un administrateur qui
> demande un autre diocèse est ramené au sien.
> Migrations `20261104230713_dioceses_paroisses` et `20261104232313_avis_commentaires`, toutes
> deux purement additives. Le lot 3 n'ajoute aucune migration : `DioceseAdmin` existait déjà.
>
> Les bloquants B1 à B3 ne sont plus bloquants : ils ont reçu une valeur par défaut
> (voir `cr-reponse-client.md`, section 6) et ne concernent que les lots 4 à 6.

## 8. Risques à signaler au client

1. **Aucun paiement réel n'existe aujourd'hui.** Le prestataire est un adaptateur de démonstration :
   l'acheteur clique lui-même sur « payé » ou « échec ». Il n'y a ni webhook, ni frais, ni argent.
   Toute la chaîne financière (lots 4 et 5) sera donc développée **avant** de pouvoir être testée
   sur des encaissements réels. L'intégration d'un prestataire (FedaPay, CinetPay…) est un
   chantier distinct, non chiffré ici.
2. **Le taux par défaut distribue 100 % du prix** (1000 + 9000 points de base) : la plateforme ne
   conserve rien et paie les frais. C'est le BLOQUANT 2, et il est visible dès le premier réglage.
3. **Les deux bases de calcul divergent** (net pour le diocèse, brut pour l'écrivain). Même avec des
   taux corrigés, toute évolution future devra traiter les deux bases séparément.
4. **La liste des paroisses est incomplète** (onze entrées, dont une sans ville) alors que le client
   demande lui-même un référentiel officiel.
