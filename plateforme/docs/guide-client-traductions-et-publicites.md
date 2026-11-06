# Guide — traductions et publicités

> Deux sujets que le client a demandés, expliqués sans vocabulaire technique.
> Ce document peut être envoyé tel quel à l'équipe qui administre le site.

## 1. Publier un livre dans une autre langue

Un livre traduit n'est **pas** une traduction automatique : c'est le même livre, publié une
deuxième fois dans une autre langue. Chaque version garde son fichier, son prix, son pays et sa part
d'auteur.

**Les trois gestes, dans l'ordre :**

1. **Créer la version.** Dans `/admin/oeuvres`, créez la fiche comme d'habitude : titre dans la
   langue, fichier EPUB, prix. Elle vit sa vie toute seule.
2. **La rattacher.** Ouvrez la fiche de la version française, descendez à la section
   **« Traductions de ce titre »**, choisissez la nouvelle version dans la liste, cliquez
   **« Ajouter cette traduction »**.
3. **Choisir celle qui s'affiche en premier.** Une des deux porte la mention
   **« Affichée en premier »** : c'est celle que les visiteurs voient dans le catalogue et dans la
   recherche. Les autres restent accessibles par le bouton de langue de la fiche.

**Ce que le visiteur voit :** sur la page du livre, sous le nom de l'auteur, une rangée
« Aussi disponible en — English ». Le catalogue, lui, ne montre le titre qu'une seule fois.

**Pour retirer une version de la liste :** bouton **« Retirer de la liste »**. Les deux fiches
redeviennent indépendantes ; rien n'est supprimé, ni le fichier, ni les ventes.

> Un livre ne peut être rattaché qu'à un livre, un film qu'à un film. Si une version appartient déjà
> à un autre titre traduit, retirez-la d'abord de l'autre liste.

## 2. Les publicités

### Où elles apparaissent

| Emplacement | Où le visiteur la voit |
|---|---|
| Accueil | Bandeau en haut de la page d'accueil |
| Pages catalogue | Bandeau sur Livres, Documentaires et Films |
| Fiche d'une œuvre | Bandeau sur la page d'un livre ou d'un film |
| Bandeau fixe | Bandeau en bas de l'écran, que le visiteur peut fermer |
| **Plein écran** | Pendant un contenu **gratuit** : après un moment de film, ou une minute de lecture |

### La publicité qui s'intercale

C'est celle qui répond à la question « une pub se lance automatiquement pendant un contenu gratuit ».

- Elle ne concerne **que les œuvres gratuites**. Un visiteur qui a acheté le livre ou le film ne la
  voit jamais.
- Elle arrive **après un moment de lecture réelle** : environ un tiers de la durée pour un court
  extrait, une minute et demie pour un long film. Si le visiteur met en pause, le compte s'arrête.
- Le film se met en pause, l'annonce s'affiche huit secondes, puis le bouton **« Continuer »**
  ramène au film, exactement là où il s'était arrêté.
- **Une seule fois par œuvre et par visite** : un visiteur qui relance le film ne la revoit pas.

### Ajouter une publicité

`/admin/publicités` → formulaire de droite. Il faut : un emplacement, un titre, le nom de
l'annonceur, l'adresse du site de destination, et éventuellement une image et des dates de diffusion.

### Les chiffres

| Colonne | Ce qu'elle compte |
|---|---|
| **Affichages** | Nombre de fois où la publicité a été vue. Un même visiteur n'est compté qu'une fois par visite. |
| **Clics** | Nombre de fois où quelqu'un a cliqué pour aller sur le site de l'annonceur. |
| **% de clic** | Clics ÷ affichages. C'est le chiffre qui se vend : 1 % à 2 % est courant. |

Le tableau **« Sept derniers jours »** donne le total jour par jour — c'est la base d'une facture
mensuelle. Les journées sont comptées à l'heure du Bénin (UTC+1), pas à l'heure de Paris.

> Les cinq publicités présentes aujourd'hui sont des exemples, avec des annonceurs fictifs et des
> liens qui ne mènent nulle part (`exemple-ccc.test`). Elles servent à montrer le rendu. Il suffit de
> les désactiver ou de les supprimer quand les vrais annonceurs arrivent.
