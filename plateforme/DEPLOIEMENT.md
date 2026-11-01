# Mise en ligne de démonstration (Vercel)

But : montrer le site au client sur une adresse web, avec les données de démonstration.
Ce n'est **pas** une mise en production : voir la section « Ce qui ne fonctionne pas encore en ligne ».

## Avant de publier : sécurité (15 minutes)

1. **Changer le mot de passe administrateur.** Le mot de passe de démonstration est écrit dans le dépôt.
   ```
   npm run admin:password
   ```
   Notez le mot de passe affiché (il ne le sera qu'une fois).
2. **Un nouveau secret de session** pour la mise en ligne (ne pas réutiliser celui de votre PC) :
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Ne jamais publier `.env` ni le fichier `API USEFULL` (déjà ignorés par git).
4. Idéal : régénérer le mot de passe de la base Neon (console Neon), puis mettre à jour les deux adresses de connexion.

## Publier sur Vercel

Il faut un compte Vercel. L'offre gratuite (Hobby) est réservée à l'usage non commercial : pour montrer le site à
un client, prenez l'offre **Pro** (environ 20 $ par mois, résiliable après la démonstration).

1. Mettre le code sur GitHub (dépôt `Loukstech/CCC`).
2. Sur vercel.com : **Add New → Project**, choisir le dépôt, et indiquer le dossier racine : **`plateforme`**.
3. Variables d'environnement (Settings → Environment Variables) :

   | Nom | Valeur |
   |---|---|
   | `DATABASE_URL` | adresse **directe** Neon |
   | `DATABASE_URL_POOLED` | adresse **pooler** Neon (celle qui contient `-pooler`) |
   | `SESSION_SECRET` | le nouveau secret de l'étape 2 |

4. **Deploy.** La région des fonctions est déjà réglée sur Francfort (`vercel.json`), à côté de la base Neon.
5. Ouvrir l'adresse fournie et dérouler le parcours de démonstration ci-dessous.

Chaque modification poussée sur GitHub redéploie automatiquement le site.

## Parcours à montrer au client

1. **Accueil** : carrousel, trois espaces. Réduire la fenêtre (ou ouvrir sur téléphone) : barre du bas, en-tête transparent.
2. **Films** puis **Livres** puis **Documentaires** : trois univers différents. Changer de thème (icône en haut ou pied de page).
3. **Recherche** : taper « foi ».
4. **Créer un compte** (pays : Bénin), ouvrir « Prières du matin (démo) », **Ajouter gratuitement**, puis **Lire**.
   Tourner les pages, régler le texte, poser un **signet**, quitter, rouvrir : retour à la bonne page.
5. **Ma bibliothèque** : « Continuer la lecture ».
6. **Droits par pays** : sur une fiche, choisir « États-Unis » : l'œuvre n'est plus disponible.
7. **Administration** (compte administrateur) : « Gérer » une œuvre : droits par pays, prix par pays.

## Ce qui ne fonctionne pas encore en ligne

- **Envoi de fichiers de livres** depuis l'administration : les fonctions Vercel n'ont pas de disque inscriptible.
  Le livre de démonstration est inclus dans le déploiement ; pour de vrais livres, il faudra brancher un stockage
  (fonctions `readBookFile` et `saveBookFile` dans `src/lib/storage.ts`).
- **Achat et abonnement** : boutons désactivés (prestataire de paiement à choisir).
- **Lecture hors connexion**, lecteur vidéo, appareils autorisés, mot de passe oublié : pas encore faits.
- Le site est volontairement **non indexé** par les moteurs de recherche (`src/app/robots.ts` et `metadata.robots`).
  À retirer au lancement.

## Quand ce sera pour de vrai

Créer une branche Neon séparée pour la production (ne pas partager la base de démonstration), un domaine à
votre nom, un vrai stockage de fichiers, et retirer la génération du livre de démonstration dans le script `build`
de `package.json`.
