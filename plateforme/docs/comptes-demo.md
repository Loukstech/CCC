# Comptes de démonstration

Créés par `npm run db:comptes` (script idempotent : le relancer remet ces mots de passe et
réattribue les œuvres). Domaine `@ccc.example` : réservé, aucun email ne peut partir par erreur.

| Rôle | Email | Mot de passe | Périmètre |
|---|---|---|---|
| Super administrateur | `admin@ccc.example` | `Admin-2026` | `/admin`, modération, référentiel, œuvres |
| Diocèse Bénin | `benin@ccc.example` | `Benin-2026` | ADMIN sur le diocèse Bénin |
| Diocèse Togo | `togo@ccc.example` | `Togo-2026` | ADMIN sur le diocèse Togo |
| Diocèse Nigeria | `nigeria@ccc.example` | `Nigeria-2026` | ADMIN sur le diocèse Nigeria |
| Auteur | `auteur1@ccc.example` | `Auteur1-2026` | Awa Sossou — 3 livres |
| Auteur | `auteur2@ccc.example` | `Auteur2-2026` | Kossi Agbeko — 2 livres |
| Auteur | `auteur3@ccc.example` | `Auteur3-2026` | Chidi Okonkwo — 4 documentaires |
| Auteur | `auteur4@ccc.example` | `Auteur4-2026` | Mariam Dossou — 2 films |
| Auteur | `auteur5@ccc.example` | `Auteur5-2026` | Tunde Adeyemi — 2 films |

## Ce que le script rattache

Les 13 œuvres de démonstration sont reliées à un compte via `Work.authorId` (migration
`20261105153000_auteur_oeuvres`), et le nom affiché (`Work.author`) devient celui du compte.
La suppression d'un compte ne supprime pas l'œuvre : `authorId` passe à `NULL`.

## Connexion

`/connexion` avec l'email et le mot de passe. Un administrateur diocésain est redirigé vers
`/diocese` ; le super administrateur vers `/admin`.

## À ne pas montrer en démonstration

`/paiement/demo` : l'acheteur y valide lui-même le paiement. Le lot 4 (vrai prestataire,
webhooks, frais) n'est pas fait.
