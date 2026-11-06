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
   | `PARTNER_CODE_REQUIRED` | `true` : un code de partenariat est exigé pour créer un compte diocèse ou écrivain. Absent ou `false` : inscriptions ouvertes. Voir « Codes de partenariat et directs ». |

4. **Deploy.** La région des fonctions est déjà réglée sur Francfort (`vercel.json`), à côté de la base Neon.
5. Ouvrir l'adresse fournie et dérouler le parcours de démonstration ci-dessous.

Le redéploiement est **automatique** : chaque poussée sur `main` déclenche un déploiement Vercel.
Vérifié le 5 novembre 2026 : après une poussée, le site servait les nouvelles routes en quelques
minutes, et le commit portait le statut « Vercel : Deployment has completed ».

Attention au piège de diagnostic : Vercel passe par une **GitHub App**, donc
`GET /repos/Loukstech/CCC/hooks` n'affiche aucun webhook — ce n'est **pas** une preuve d'absence
d'intégration. Pour savoir où en est le site : statut du commit sur GitHub, ou tableau de bord Vercel →
**Deployments** (le dernier commit doit être celui de `main`).

Si une poussée ne publie vraiment rien : tableau de bord Vercel → projet → **Deployments** →
**Redeploy** ; si aucun déploiement n'apparaît, reconnecter le dépôt dans Settings → Git.

> **Sécurité** : ce dépôt est public. `docs/comptes-demo.md` y publie les mots de passe des comptes de
> démonstration, dont un super-administrateur, et le site en ligne partage la base de démonstration.
> Changer ce mot de passe (`npm run admin:password`) et retirer les mots de passe du document, ou
> passer le dépôt en privé. Voir `docs/etat-du-projet-2026-11-05.md`, section 12.

## Parcours à montrer au client

1. **Accueil** : carrousel, trois espaces. Réduire la fenêtre (ou ouvrir sur téléphone) : barre du bas, en-tête transparent.
2. **Films** puis **Livres** puis **Documentaires** : trois univers différents. Changer de thème (icône en haut ou pied de page).
3. **Recherche** : taper « foi ».
4. **Créer un compte** (pays : Bénin), ouvrir « Prières du matin (démo) », **Ajouter gratuitement**, puis **Lire**.
   Tourner les pages, régler le texte, poser un **signet**, quitter, rouvrir : retour à la bonne page.
5. **Ma bibliothèque** : « Continuer la lecture ».
6. **Achat** : ouvrir « Les chemins de la foi (démo) » (3 000 F CFA pour le Bénin, 4,99 € pour la France),
   **Acheter**, puis « Payer (simulation) » sur la page de démonstration, puis **Lire**. Essayer aussi « Simuler un échec ».
7. **Abonnement** : page « Abonnement » (menu du pied de page) : choisir mensuel ou annuel, payer en simulation,
   puis ouvrir un documentaire : « Inclus dans votre abonnement ». Résilier depuis « Mon compte » : l'accès reste
   ouvert jusqu'à la fin de la période payée.
8. **Appareils** : « Mon compte » > « Mes appareils » (3 maximum). Se connecter depuis un 4e navigateur : la lecture est
   bloquée jusqu'à ce qu'on retire un appareil.
9. **Droits par pays** : sur une fiche, choisir « États-Unis » : l'œuvre n'est plus disponible.
10. **Administration** (compte administrateur) : « Gérer » une œuvre : droits par pays, prix par pays.
11. **Partenariats** (compte administrateur) : « Partenariats » > émettre un code pour un diocèse ou un
    écrivain. Le code s'affiche **une seule fois**. Le saisir ensuite sur `/diocese/inscription` ou
    `/ecrivain/inscription` : le compte est créé et l'accès ouvert.
12. **Direct** : « En direct » dans l'en-tête. L'événement de démonstration est *programmé* (aucun flux
    n'est chargé). Pour un vrai direct, voir la section suivante.

## Ce qui ne fonctionne pas encore en ligne

- **Paiement réel** : le paiement est une **simulation** (aucune somme débitée, page marquée « Mode démonstration »).
  Le jour où le prestataire est choisi (FedaPay recommandé), on ajoute son adaptateur dans `src/lib/payments/` et on
  règle la variable `PAYMENT_PROVIDER` ; le reste du parcours ne change pas.
- **Abonnement** : la période se prolonge à la main (pas de prélèvement automatique).
- **Envoi de fichiers de livres** depuis l'administration : les fonctions Vercel n'ont pas de disque inscriptible.
  Les livres de démonstration sont inclus dans le déploiement ; pour de vrais livres, il faudra brancher un stockage
  (fonctions `readBookFile` et `saveBookFile` dans `src/lib/storage.ts`).
- **Pas encore faits** : lecture hors connexion, mot de passe oublié, double authentification du personnel.
- **Directs** : la vidéo vient d'un prestataire externe (YouTube/Facebook/Vimeo ou Mux). Une fonction
  Vercel ne peut pas recevoir un flux RTMP : elle sert la page, pas la vidéo.
- **Codes de partenariat de démonstration** : ils sont valides 30 jours et doivent être révoqués avant
  une vraie production (voir la section suivante).
- **Sessions ouvertes avant la limite d'appareils** : un lecteur déjà connecté voit un bouton « Autoriser cet appareil »
  dans « Mon compte » (ou se reconnecte).
- Le site est volontairement **non indexé** par les moteurs de recherche (`src/app/robots.ts` et `metadata.robots`).
  À retirer au lancement.

## Vidéo réelle avec Mux (offre gratuite pour essayer)

1. Mux > **Settings > Signing Keys > Generate new key** : notez l'identifiant de la clé et la clé privée (base64, affichée une seule fois).
2. Mux > **Video > Upload** : téléverser un fichier (par exemple `plateforme/public/demo-video/demo-film-1.mp4`), avec la
   politique de lecture **Signed**. Quand la vidéo est prête, copier son **Playback ID**.
3. Dans `plateforme/.env` (et dans les variables de Vercel) : `MUX_SIGNING_KEY_ID` et `MUX_SIGNING_PRIVATE_KEY`.
4. Administration > « Gérer » le film > **Identifiant de la vidéo** : coller le Playback ID.
5. Se connecter avec un compte abonné : « Regarder ». Le lecteur reçoit une adresse signée et ajuste la qualité à la connexion.

Une clé qui se termine par `.mp4` reste une vidéo de démonstration : les deux types peuvent coexister.
Ne collez jamais la clé privée dans un message ou un dépôt.

## Codes de partenariat et directs

Documentation complète : [`docs/lot-8-partenariats-et-directs.md`](docs/lot-8-partenariats-et-directs.md).

### Codes de partenariat

Un diocèse ou un écrivain ne s'inscrit plus librement : il signe un contrat, reçoit un code, et le
saisit à l'inscription. L'inscription d'un simple lecteur reste libre.

1. Se connecter en super-administrateur, ouvrir **`/admin/partenariats`**.
2. Choisir le type (`Écrivain` ou `Diocèse`), le nom du partenaire, la référence du contrat et,
   pour un diocèse, le diocèse concerné. Durée : 30 jours par défaut.
3. **Copier le code immédiatement** : il n'est affiché qu'une fois. La base ne contient que son
   empreinte, jamais le code lui-même.
4. Le partenaire le saisit sur `/ecrivain/inscription` ou `/diocese/inscription`. Le code est
   consommé une seule fois, dans la même transaction que la création du compte.

Un code peut être **révoqué** tant qu'il n'a pas servi. Un auteur déjà existant peut être approuvé
manuellement depuis la même page, sans code.

**Activer ou désactiver le contrôle** : variable `PARTNER_CODE_REQUIRED` (`true` en production
actuellement). Après changement, redéployer. Un code saisi reste vérifié même quand le contrôle est
désactivé.

> Changer `SESSION_SECRET` invalide tous les codes déjà émis, et toutes les sessions ouvertes.

### Passer un direct en ligne

1. **Créer le direct chez le prestataire** : YouTube Studio > « En direct » (récupérer l'URL
   `https://www.youtube.com/embed/...`), ou un live Mux (noter le *Playback ID*).
2. **`/admin/lives`** : programmez l'événement (titre, source, date UTC, visibilité), choisissez un
   **diffuseur** et enregistrez.
3. **Donner le badge** : un compte ne peut être désigné diffuseur que s'il porte le badge
   « diffuseur approuvé ». Il s'attribue par e-mail, dans la même page.
4. Le jour J, **passer le statut à `LIVE`** : la page `/live/<slug>` affiche le lecteur.
5. À la fin, passer à `ENDED` et renseigner l'**URL du replay** si elle existe.

Sources acceptées pour l'intégration : YouTube, Facebook, Vimeo, Dailymotion, Twitch (HTTPS
uniquement, liste fermée pour empêcher l'injection d'une page arbitraire). Visibilité : tout public,
membres connectés, ou abonnés.

## Quand ce sera pour de vrai

Créer une branche Neon séparée pour la production (ne pas partager la base de démonstration), un domaine à
votre nom, un vrai stockage de fichiers, et retirer la génération du livre de démonstration dans le script `build`
de `package.json`.
