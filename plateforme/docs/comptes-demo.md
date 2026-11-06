# Comptes de démonstration

Créés par `npm run db:comptes` (script idempotent : le relancer remet ces mots de passe et
réattribue les œuvres). Domaine `@ccc.example` : réservé, aucun email ne peut partir par erreur.

| Rôle | Email | Mot de passe | Périmètre |
|---|---|---|---|
| Super administrateur | `admin@ccc.example` | `Admin-2026` | `/admin`, modération, référentiel, œuvres, finances, manuscrits |
| Diocèse Bénin | `benin@ccc.example` | `Benin-2026` | ADMIN sur le diocèse Bénin |
| Diocèse Togo | `togo@ccc.example` | `Togo-2026` | ADMIN sur le diocèse Togo |
| Diocèse Nigeria | `nigeria@ccc.example` | `Nigeria-2026` | ADMIN sur le diocèse Nigeria |
| Auteur | `auteur1@ccc.example` | `Auteur1-2026` | Awa Sossou — 3 livres |
| Auteur | `auteur2@ccc.example` | `Auteur2-2026` | Kossi Agbeko — 2 livres |
| Auteur | `auteur3@ccc.example` | `Auteur3-2026` | Chidi Okonkwo — 4 documentaires |
| Auteur | `auteur4@ccc.example` | `Auteur4-2026` | Mariam Dossou — 2 films |
| Auteur | `auteur5@ccc.example` | `Auteur5-2026` | Tunde Adeyemi — 2 films |
| Fidèle acheteur | `fidele.demo@ccc.example` | `Fidele-2026` | Paroisse Mont Sinaï (diocèse Bénin), consentement donné |

## Ce que le script rattache

- Les 13 œuvres de démonstration sont reliées à un compte via `Work.authorId` (migration
  `20261105153000_auteur_oeuvres`), et le nom affiché (`Work.author`) devient celui du compte.
  La suppression d'un compte ne supprime pas l'œuvre : `authorId` passe à `NULL`.
- `fidele.demo` est rattaché à une paroisse avec consentement : c'est le compte à utiliser pour
  dérouler un achat et voir apparaître une commission diocèse.

## Connexion

`/connexion` avec l'email et le mot de passe. Un administrateur diocésain est redirigé vers
`/diocese` ; le super administrateur vers `/admin` ; un auteur peut ouvrir `/ecrivain`.

## Inscriptions partenaires (lot 8)

Depuis le 6 novembre 2026, un diocèse ou un écrivain **ne s'inscrit plus librement** : il lui faut un
code de partenariat, remis après signature du contrat.

- Émission : `/admin/partenariats` (super-administrateur). Le code s'affiche **une seule fois**.
- Saisie : `/ecrivain/inscription` (écrivain) ou `/diocese/inscription` (diocèse).
- Chaque code est **à usage unique** et valable 30 jours par défaut.
- L'inscription d'un simple lecteur (`/inscription`) reste libre.

Les codes de démonstration ne sont **pas** versionnés ici : ce dépôt est public, et les publier
annulerait la protection qu'ils apportent. Ils sont conservés hors dépôt ; en cas de perte, il suffit
d'en réémettre depuis `/admin/partenariats`.

Voir [lot-8-partenariats-et-directs.md](./lot-8-partenariats-et-directs.md).

## Parcours de démonstration des lots 4 à 7

1. **Achat** : connecté en `fidele.demo`, ouvrir une œuvre payante, « Acheter », puis « Payer »
   sur `/paiement/demo`. Le paiement est simulé, aucune somme n'est débitée.
2. **Commissions** : en `admin`, aller dans `/admin/finances`. La vente apparaît, découpée en part
   écrivain / diocèse / plateforme, avec les frais du prestataire.
3. **Espace écrivain** : en `auteur1`, ouvrir `/ecrivain` : ses œuvres, ses ventes, son solde, ses
   relevés mensuels et les avis reçus.
4. **Versement** : en `admin`, préparer un lot pour les écrivains sur le mois, le valider, puis le
   marquer versé avec une référence (par exemple `MM-2026-001`).
5. **Diocèse** : en `benin@ccc.example`, `/diocese` affiche les revenus du diocèse et son relevé.
6. **Manuscrit** : en `auteur1`, déposer un manuscrit depuis `/ecrivain` ; en `admin`, le retrouver
   dans `/admin/manuscrits` et le passer « à l'étude », « accepté » ou « refusé ».

## Données déjà en base

> **État au 6 novembre 2026** : la base de démonstration a été remise à zéro (aucune vente, aucun
> abonnement, aucune commission). Les écrans `/admin/finances`, `/ecrivain` et `/diocese` sont donc
> vides au départ, ce qui est normal. Les chiffres ci-dessous décrivent le jeu de données historique,
> restaurable depuis une sauvegarde.

4 ventes payées, 1 remboursée, un lot `VRS-2026-11-ECR-001` versé (référence `MM-DEMO-0001`) et un
solde disponible. Les totaux sont réels : écrivains + diocèses + plateforme = net encaissé.

## À ne pas montrer en démonstration

Rien d'obligatoire, mais sachez que `/paiement/demo` est une **simulation** (l'acheteur valide
lui-même le paiement). Pour la fermer : `DEMO_PAYMENT_VISIBLE=false` dans les variables
d'environnement ; les boutons d'achat renvoient alors vers `/paiement/indisponible`.
