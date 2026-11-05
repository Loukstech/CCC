# Plateforme CCC

Site web, administration et service central de CCC (livres, documentaires, films).
Next.js 16 · TypeScript · Prisma 7 · PostgreSQL.

Cahier des charges : `../Cahier_des_charges_CCC_v1.0.pdf`. Mise en ligne de démonstration : [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Démarrer sur un nouvel ordinateur

Il faut : **Node.js 20.9 ou plus** (testé avec la version 24), **Docker Desktop** (pour la base locale) et Git.

1. **Récupérer le code**
   ```
   git clone https://github.com/Loukstech/CCC.git
   cd CCC/plateforme
   ```
2. **Installer les dépendances**
   ```
   npm install
   ```
3. **Créer le fichier `.env`** à partir du modèle, puis l'adapter :
   ```
   cp .env.example .env
   ```
   Pour une base locale (Docker), mettez dans `.env` :
   ```
   DATABASE_URL="postgresql://ccc:ccc_dev_password@localhost:5432/ccc?schema=public"
   SESSION_SECRET="<64 caractères aléatoires>"
   ```
   (`DATABASE_URL_POOLED` est facultative : elle ne sert qu’avec Neon.)
   Générer le secret : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
4. **Démarrer la base de données** (Docker Desktop doit être lancé)
   ```
   npm run db:up
   ```
5. **Créer les tables, puis les données de démonstration**
   ```
   npx prisma migrate deploy
   npm run db:seed
   ```
6. **Lancer le site**
   ```
   npm run dev
   ```
   Ouvrir http://localhost:3200

Compte administrateur de démonstration : `admin@ccc.local` / `admin-ccc-dev-2026`
(à changer avant toute mise en ligne : `npm run admin:password`).

## Si la page ne s'ouvre pas

| Symptôme | Cause | Solution |
|---|---|---|
| `listen EACCES` sur le port 3000 | Windows réserve certains ports | Le projet utilise le port **3200**. Ne lancez pas `next dev` seul, utilisez `npm run dev`. |
| Erreur 500, `Unknown field ... for select statement` | Le client Prisma généré est périmé (il n'est pas dans Git) | `npx prisma generate`, puis relancer `npm run dev` (fait automatiquement par `npm run dev`). |
| `Cannot resolve environment variable: DATABASE_URL` | Pas de fichier `.env` | Étape 3 ci-dessus. |
| `Can't reach database server` | La base n'est pas démarrée | Lancer Docker Desktop, puis `npm run db:up`. |
| Tables inconnues (`relation ... does not exist`) | Migrations non appliquées | `npx prisma migrate deploy`. |
| `SESSION_SECRET manquant` | Variable absente de `.env` | Étape 3 ci-dessus. |

## Commandes utiles

| Commande | Effet |
|---|---|
| `npm run dev` | Site en développement (port 3200) |
| `npm run build` puis `npm start` | Version de production |
| `npm run db:up` | Démarre la base PostgreSQL locale (Docker) |
| `npm run db:migrate` | Crée une migration après un changement du schéma |
| `npm run db:seed` | Données de démonstration |
| `npm run db:dioceses` | Référentiel des diocèses et paroisses (idempotent, à lancer après une migration) |
| `npm run admin:password` | Change le mot de passe administrateur |

## Langues, devises, publicités

- **Langues** : français et anglais. Le choix (boutons FR / EN) est gardé dans un cookie ; sans choix, la langue du navigateur est utilisée. Les textes sont dans `src/lib/i18n/fr.ts` et `en.ts` : toute clé ajoutée en français doit l'être en anglais (sinon la compilation échoue). Les pages d'administration restent en français.
- **Devises** : le sélecteur propose FCFA, naira, euro, dollar et livre sterling. La conversion est **indicative** et ne sert qu'à l'affichage : le paiement est facturé dans la devise du prix d'origine. Les taux sont dans `src/lib/currency.ts` (l'euro est à parité fixe avec le F CFA ; les autres taux sont à mettre à jour régulièrement).
- **Pays** : liste dans `src/lib/countries.ts` (30 pays). Une œuvre n'est visible que dans les pays de sa licence.
- **Publicités** : quatre emplacements (accueil, pages catalogue, fiche d'œuvre, bandeau fixe en bas de l'écran). On les gère dans Administration > Gérer les publicités. Chaque bandeau porte la mention « Publicité » et les clics sont comptés.
- **Lecture à voix haute** : dans le lecteur de livres, le bouton casque lit le livre avec la voix du navigateur (vitesse réglable). Ce n'est pas un livre audio enregistré.
- **Diocèses et paroisses** : à l'inscription, le fidèle choisit son diocèse puis sa paroisse, et accepte le partage de son inscription avec son diocèse. Le référentiel se gère dans Administration > Diocèses et paroisses (super-administrateur). Une paroisse n'est jamais supprimée : elle est désactivée ou fusionnée dans une autre, ce qui réaffecte ses fidèles.
- **Espace diocèse** : chaque diocèse peut recevoir un compte de consultation sur `/diocese` (totaux, répartition par paroisse, liste des fidèles, export CSV). Le compte se crée dans Administration > Diocèses et paroisses : le mot de passe provisoire s'affiche **une seule fois**, à communiquer de vive voix. Deux rôles : administrateur (export autorisé) et observateur (lecture seule). Un administrateur de diocèse ne voit que son diocèse, même en modifiant l'adresse de la page, et n'a accès à aucun autre écran d'administration.
- **Avis et commentaires** : un avis par personne et par œuvre, note de 1 à 5 obligatoire ; commentaires avec une réponse possible. La publication est immédiate et le contrôle se fait après coup, par signalement puis Administration > Modération.

## Mettre à jour la base de données

Après un `git pull`, appliquer les nouvelles migrations :

```
npx prisma migrate deploy
```

Attention : avec les adresses Neon dans `.env`, cette commande modifie la base **en ligne**, la même que celle du site déployé. Appliquez-la **avant** de publier le nouveau code sur Vercel, sinon le site en ligne cherchera une table qui n'existe pas encore.

## Organisation

- `prisma/` : schéma de la base et migrations
- `src/app/` : pages et actions du serveur
- `src/lib/` : accès à la base, sessions, droits par pays, paiement, vidéo
- `src/components/` : éléments d'interface
