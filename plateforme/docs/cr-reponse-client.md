# Compte rendu de la réponse client — décisions diocèses / commissions / écrivains

Source : `reponse-client-2026-11-04.pdf` (7 pages, réponses et annotations, reçu le 04/11/2026).

Statut : **3 points bloquants** sur la partie financière, **6 points ouverts** — tous tranchés par
des valeurs par défaut (section 6), le client ayant délégué la mise en œuvre. Ces valeurs sont
appliquées telles quelles et restent modifiables sans refonte ; elles ne bloquent plus le
développement. Les lots 1 et 2 sont livrés.

---

## 1. Ce qui est acté

| Décision | Réponse du client | Ce que ça change |
|---|---|---|
| **D1** Base des 10 % | **Modifiée** : 10 % du montant **restant après les frais** mobile money / paiement | Il faut connaître les frais réels de chaque transaction. Voir point bloquant n° 1 |
| **D2** Abonnements | **Modifiée mais ambiguë** : « Non, une commission à chaque début prochain » | À reformuler. Voir point bloquant n° 3 |
| **D3** Changement de diocèse | Non cochée (la question a été reformulée « diocèse » au lieu de « paroisse ») | Hypothèse maintenue : rattachement figé au paiement. À confirmer |
| **D4** Remboursements | Non cochée | Mais D9 précise que les remboursements sont **déduits avant paiement** |
| **D5** Revenus concernés | **Accepté** : ventes d'œuvres et abonnements uniquement, publicité exclue | Le partage ne touche pas les revenus publicitaires |
| **D6** Taux | **Modifié** : taux **identique pour tous les diocèses**, modifiable par **l'administrateur seul**, historique inchangé | Le taux n'est plus un champ par diocèse mais un **réglage global**. Le figement de l'historique est conservé |
| **D7** Accès diocèse | Non cochée ; annotation « consultation » | Lecture seule retenue. À confirmer |
| **D8** Rôle écrivain | Non cochée ; hypothèse « suivi au premier lot, manuscrits plus tard » | Retenue par défaut |
| **D9** Rémunération écrivain | **Nouvelle règle** : **90 % du prix initial de vente**, remboursements déduits, versement **en début de mois suivant** | Deuxième règle de partage à modéliser. Voir point bloquant n° 2 |
| **D10** Versement | Non cochée ; hypothèse mobile money + relevé PDF + référence | Retenue par défaut |

### Points de la section 2

| Sujet | Réponse |
|---|---|
| Champs obligatoires à l'inscription (diocèse, paroisse, consentement) | **Oui** |
| Comptes existants sans paroisse et comptes du personnel | **« À revoir »** — non tranché |
| Paroisse inactive, fusionnée ou renommée | **« Fusionner »** — procédure à formaliser |
| Données visibles par le diocèse (inscrits, paroisse, date, statistiques agrégées) | **Oui** |
| Commandes détaillées, coordonnées privées et mots de passe inaccessibles au diocèse | **À confirmer** |
| Un avis par œuvre, note obligatoire de 1 à 5 | **Oui** |
| Règles de modification / suppression des avis | **Oui** |
| Commentaires validés avant publication | **Non** → publication immédiate, modération **a posteriori** |
| Contrats, comptabilité, fiscalité validés par un comptable/juriste | **Oui** |
| Calendrier des relevés, seuil de paiement, approbateur | **Oui**, à définir |
| Préciser les frais de paiement et leur prise en charge | **Non** ← contredit D1 |
| Rapprochement paiements / commissions / versements | **Oui** |

### Le référentiel fourni

Le client a répondu à la demande de liste officielle par **trois diocèses** et **douze paroisses** :

- **Diocèse Bénin** : Mont Sinaï (Vodjè, Cotonou), Cadjèhoun (Cotonou), Saint Samuel (Hindé, Cotonou),
  Saint Michel de Tanto (Tanto, Cotonou).
- **Diocèse Togo** : Temple d'Israël (Nyékonakpoè, Lomé), Elohim d'Israël (Tsévié),
  Mahanaïm I (Togblékopé), Saint Michel Archange (ville non précisée).
- **Diocèse Nigeria** : CCC National Headquarters (Makoko, Lagos), CCC International Headquarters
  (Ikosi-Ketu, Lagos), Celestial City – Imeko (Imeko-Afon, État d'Ogun), CCC Elisha Parish (Lagos).

> **Correction importante par rapport à mon premier document** : il s'agit de diocèses de
> l'**Église du Christianisme Céleste**, organisés par pays, et non de diocèses catholiques.
> Le mot « archidiocèse » n'a plus lieu d'être, et il n'y a pas de hiérarchie à deux niveaux :
> **Diocèse (pays) → Paroisse**. La liste fournie est un échantillon, pas un référentiel complet.

---

## 2. Les trois points bloquants

### Bloquant 1 — Les 10 % « après frais » sont incalculables aujourd'hui

Le client a répondu **deux choses incompatibles** :

- D1 : les 10 % se calculent sur le montant **après** déduction des frais de paiement ;
- Section 2, finances : **« non »** à la demande de préciser les frais de paiement et leur prise en charge.

Or **l'application ne connaît aucun frais**. Le prestataire de paiement est aujourd'hui un
**adaptateur de démonstration** (`src/lib/payments/index.ts`) : aucun encaissement réel n'a lieu,
aucun frais n'est transmis, et aucune règle ne permet de les estimer. Le seul événement financier
est une commande passée à `PAID` avec son montant brut.

**Conséquence** : tant que les frais ne sont pas connus, la commission ne peut pas être calculée
selon la règle demandée. Il faut soit que le prestataire réel transmette le montant net (FedaPay,
CinetPay et Stripe le font), soit que la plateforme applique un barème de frais configuré.

**Ce qu'il faut obtenir du client** : accepter que les frais soient **enregistrés transaction par
transaction** (champ `feeAmount` sur la commande, alimenté par le prestataire), et non estimés.
Question à poser : *« Confirmez-vous que les 10 % se calculent sur le net réellement reçu, et que
la plateforme doit donc enregistrer les frais de chaque transaction ? »*

### Bloquant 2 — 90 % + 10 % font plus que 100 %

Deux règles ont été données sur **deux bases différentes** :

- diocèse : **10 % du net** (après frais) ;
- écrivain : **90 % du prix initial de vente** (donc du brut, avant frais).

Sur un livre vendu 2 000 F CFA avec 2,5 % de frais (50 F) :

| | Calcul | Montant |
|---|---|---|
| Prix payé par l'acheteur | | 2 000 F |
| Frais de paiement | 2,5 % | −50 F |
| **Net encaissé** | | **1 950 F** |
| Part du diocèse | 10 % du **net** | 195 F |
| Part de l'écrivain | 90 % du **brut** | 1 800 F |
| **Total reversé** | | **1 995 F** |
| **Ce qui reste à la plateforme** | 1 950 − 1 995 | **−45 F** |

La plateforme **perd 45 F sur chaque vente** : elle paie 1 995 F alors qu'elle n'a encaissé que
1 950 F. Et même en alignant les deux bases sur le net, 90 % + 10 % = 100 % : la plateforme
ne conserverait rien du tout, et devrait encore payer les frais.

**Ce n'est pas un détail d'arrondi, c'est la structure économique du projet.** Il faut que le
client écrive lui-même la répartition, en pourcentage du prix payé par l'acheteur, avec un total
qui ne dépasse pas 100 % :

| Bénéficiaire | Part proposée (exemple, à remplacer) |
|---|---|
| Écrivain | 70 % |
| Diocèse | 10 % |
| Plateforme (frais + fonctionnement) | 20 % |
| **Total** | **100 %** |

Trois scénarios cohérents possibles, à choisir :

1. **Une seule base (le net) et des taux qui somment à moins de 100 %** — le plus sain.
2. **90 % / 10 % maintenus, frais payés par l'acheteur en plus du prix** — la plateforme ne gagne
   toujours rien sur la vente, et vit de la publicité et des abonnements.
3. **La part du diocèse est prélevée sur celle de la plateforme**, pas sur celle de l'écrivain —
   il faut alors un taux différent.

Tant que ce point n'est pas tranché, je ne peux pas coder le calcul : ce serait coder une perte.

### Bloquant 3 — D2 n'est pas exploitable en l'état

Réponse : « **Non, une commission à chaque début prochain** ». Deux lectures possibles :

- **Lecture A** : pas de commission à chaque mensualité ; une seule commission, calculée au
  début du mois suivant le paiement.
- **Lecture B** : la commission n'est pas calculée au moment du paiement, mais **liquidée en
  début de mois** pour tous les paiements du mois écoulé.

Ces deux lectures n'ont pas les mêmes conséquences : la A fait perdre au diocèse ses 10 % sur
les abonnés mensuels, la B ne change que le calendrier. **À faire reformuler par écrit.**

---

## 3. Les six points encore ouverts

| # | Sujet | Ce qu'il faut décider |
|---|---|---|
| 1 | **D3** changement de diocèse | Confirmer le figement au moment du paiement |
| 2 | **D4** remboursements | Confirmer : annulation si non versé, régularisation si déjà versé |
| 3 | **D7** pouvoirs du diocèse | Confirmer : consultation seule. Et **qui crée les administrateurs de diocèse** (les annotations « administrateur / consultation » ne désignent pas la personne qui les nomme) |
| 4 | **D10** versement | Qui verse, par quel moyen, à quelle fréquence, avec quel justificatif, quel seuil minimum, qui approuve |
| 5 | **Comptes existants sans paroisse** (« à revoir ») | Proposition : le champ reste facultatif ; à la prochaine connexion, le fidèle est invité à choisir sa paroisse ; le personnel en est dispensé |
| 6 | **Paroisse fusionnée** (« fusionner ») | Proposition : jamais de suppression ; paroisse désactivée + lien vers la paroisse de rattachement ; les fidèles sont réaffectés en une opération tracée dans le journal d'audit |

S'y ajoutent trois **textes à fournir**, indispensables avant le lot 3 :

- le **texte de consentement** au partage des données avec le diocèse (la case est obligatoire,
  mais son libellé n'est pas validé) ;
- les **motifs de signalement** et qui modère (la case est restée vide) ;
- la **liste complète** des paroisses : le client en a donné douze, en précisant lui-même qu'il
  faut « la liste officielle et à jour ». Une des entrées (Saint Michel Archange, Togo) n'a pas de ville.

---

## 4. Deux constats techniques à connaître

**1. Aucun paiement réel n'a lieu aujourd'hui.** Le prestataire est un adaptateur de démonstration :
l'utilisateur clique lui-même sur « payé » ou « échec ». Il n'y a ni webhook de confirmation, ni
frais, ni transaction. La chaîne « encaissement → commission → versement » ne peut donc pas être
testée sur de l'argent réel avant l'intégration d'un prestataire (FedaPay, CinetPay ou autre),
laquelle n'est pas dans le périmètre des lots actuels.

**2. Le remboursement n'existe pas dans le code.** Le statut `REFUNDED` existe dans le schéma et
dans l'affichage, mais **aucune action ne le produit**. Or D9 conditionne le versement aux
écrivains à « remboursements déduits » : il faut donc créer l'action de remboursement, et la
brancher sur les commissions et les droits d'auteur. C'est un petit lot à ajouter avant le lot 5.

---

## 5. Ce qui peut démarrer tout de suite

Indépendamment des trois bloquants :

- **Lot 1** — diocèses, paroisses, inscription avec cascade et consentement, administration du
  référentiel. Les décisions sont prises (3 diocèses, 12 paroisses, champs obligatoires).
- **Lot 2** — avis et commentaires. Les règles sont validées : un avis par œuvre, note 1 à 5
  obligatoire, publication immédiate des commentaires, modération a posteriori.
- **Lot 3** — espace diocèse en lecture seule, une fois le texte de consentement fourni.

Le calcul des commissions (lot 4) attend les bloquants 1 et 2 ; les versements (lot 5) attendent
en plus D10 et l'action de remboursement ; l'espace écrivain (lot 6) attend le bloquant 2.

---

## 6. Décisions retenues

Les propositions ci-dessous sont **appliquées par défaut depuis le 05/11/2026**, le client ayant
délégué la mise en œuvre. Aucune ne demande de refonte : pour revenir sur l'une d'elles, il suffit
d'indiquer la ligne concernée. Le tableau sert de trace de ce qui a été décidé, et par qui.

### B · Les trois bloquants

| # | Question | Proposition | Votre réponse |
|---|---|---|---|
| B1 | Comment connaître les frais de paiement, puisque les 10 % se calculent après eux ? | Enregistrer les frais **transaction par transaction**, tels que le prestataire les transmet. Aucune estimation. La commission attend si les frais sont inconnus | ☐ d'accord ☐ autre : ____ |
| B2 | Répartition du prix d'un livre | **Écrivain 90 % · Diocèse 10 % · Plateforme 0 %**, les frais de paiement étant **payés par l'acheteur** en plus du prix. La plateforme se rémunère sur les abonnements et la publicité | ☐ d'accord ☐ autre : ____ / ____ / ____ % |
| B2b | Si les frais ne peuvent pas être payés par l'acheteur | Alors il faut réduire une part : **80 % / 10 % / 10 %** ou prélever la dîme du diocèse sur la part de l'écrivain (**81 / 9 / 10**) | ☐ 80/10/10 ☐ 81/9/10 ☐ autre : ____ |
| B3 | D2 — abonnements | Une commission **à chaque paiement** (donc chaque mois pour un mensuel, une seule fois pour un annuel), **liquidée en début de mois suivant** | ☐ d'accord ☐ autre : ____ |

### A · Les six points ouverts

| # | Question | Proposition | Votre réponse |
|---|---|---|---|
| O1 | D3 — changement de diocèse | Le diocèse retenu est celui **au moment du paiement** ; les commissions passées ne changent jamais | ☐ d'accord ☐ autre : ____ |
| O2 | D4 — remboursement | Avant versement : commission annulée. Après versement : **déduite du relevé suivant** | ☐ d'accord ☐ autre : ____ |
| O3 | D7 — pouvoirs et nomination | Espace en **consultation seule**. Les administrateurs sont nommés **par le super-administrateur** uniquement, avec deux rôles : administrateur ou consultation | ☐ d'accord ☐ autre : ____ |
| O4 | D10 — versement | Relevé du mois civil généré le 1er, versement **avant le 10**, **seuil de 5 000 F** (en dessous, reporté), mobile money par le comptable, référence de transaction obligatoire. Le comptable prépare, le super-administrateur approuve | ☐ d'accord ☐ autre : ____ |
| O5 | Comptes existants sans paroisse | Champ facultatif ; relance discrète à la connexion pour choisir sa paroisse ; personnel dispensé | ☐ d'accord ☐ autre : ____ |
| O6 | Paroisse fusionnée ou renommée | Jamais de suppression : désactivation + rattachement à la paroisse cible, fidèles réaffectés, opération tracée. Le renommage et la ville sont modifiables | ☐ d'accord ☐ autre : ____ |

### C · Les textes à fournir

| # | Élément | Proposition | Votre réponse |
|---|---|---|---|
| T1 | Texte de consentement à l'inscription | « J'accepte que mon diocèse et ma paroisse reçoivent mon nom, ma paroisse et ma date d'inscription, afin de suivre les fidèles inscrits et de percevoir sa part des revenus. Mes coordonnées, mes achats et mes lectures ne leur sont pas communiqués. Je peux changer de paroisse à tout moment depuis mon compte. » | ☐ d'accord ☐ autre : ____ |
| T2 | Liste complète des diocèses et paroisses | Les douze paroisses reçues sont en place. Complétez la ville de la **Paroisse Saint Michel Archange (Togo)** et ajoutez les paroisses manquantes | ☐ liste jointe ☐ à compléter plus tard |
| T3 | Motifs de signalement et sanctions | Modération **a posteriori** : tout compte peut signaler ; le personnel masque, rétablit ou suspend un compte. Motifs : contenu haineux, diffamatoire, hors sujet, spam | ☐ d'accord ☐ autre : ____ |
