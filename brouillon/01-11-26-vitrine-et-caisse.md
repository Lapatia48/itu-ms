# 01/11/2026 — Vitrine d'accueil, suivi ouvert, caisse pré-remplie

Deuxième session. Rien de neuf en base ni dans l'API : ce sont les écrans qui
changent, plus l'ordre dans lequel la console s'ouvre.

## L'accueil : trois films, une seule image

L'accueil ouvrait sur un panneau marine et quatre chiffres. C'est juste, mais
ça ne vend rien. Il ouvre maintenant sur les trois films du club, plein cadre,
l'un après l'autre, et sur un seul appel : **Voir le catalogue**.

Les trois films n'ont ni la même lumière ni la même température — un tee marine
sous-exposé et froid, un coupé noir posé sur un fond crème surexposé, un
lettrage crème et chaud. Mis bout à bout tels quels, on voit trois vidéos ; on
veut voir une marque. Il n'y a pas d'encodeur sur ce poste, donc on ne les
réencode pas : on les étalonne au rendu, en deux temps.

1. `--grade`, **le seul réglage qui diffère d'un film à l'autre** : exposition,
   contraste, saturation, juste pour les amener au même niveau. Le film sombre
   est levé de 20 %, le film clair baissé de 14 %, les deux crèmes désaturés de
   moitié.
2. Deux calques **communs aux trois** : le marine du logo en `mix-blend-mode:
   color` à 66 % — la teinte vient du calque, la lumière reste celle du plan,
   c'est un duotone et non un aplat — puis la lueur du logo en `screen` sur les
   hautes lumières.

Le voile marine qui vient par-dessus n'étalonne rien : il garantit le texte
blanc quel que soit le film dessous. Mesuré sur le plus clair des trois, une
fois étalonné : 13,7:1 sous le titre, 9:1 sous l'accroche. Le réglage ne dépend
donc pas du plan affiché.

Le reste suit les conventions de la palette : le rouge `--brand-vif` ne sert
qu'aux graphismes — le point du sur-titre, la pastille fléchée dans le bouton,
la puce du plan courant. Le bouton, lui, reste blanc.

`prefers-reduced-motion` coupe la vidéo **et** le défilement : il reste le
panneau marine, sans rien qui bouge. Le défilement s'arrête aussi quand
l'onglet passe en arrière-plan, et le plan suivant se charge pendant que le
courant joue — sans ça, le premier fondu tombe sur du noir.

Sous la vitrine, les trois temps d'une commande (commander, verser 50 %,
retirer au local) : c'est la première question d'un visiteur qui ne connaît pas
le club, elle ne doit pas attendre la page panier.

Au passage : `panier`, `vetement`, `etoile` et `paquet` étaient appelés par la
boutique mais absents de son jeu d'icônes — `Icon` rend `null` sur un nom
inconnu, donc le panier de l'en-tête, les étoiles des notes et la vignette d'un
article sans photo ne dessinaient rien. Les quatre tracés sont repris du jeu de
la console.

## Mes commandes : la ligne dit qu'elle s'ouvre

Le lien vers le suivi existait déjà, posé sur la référence — mais `.table__lien`
n'était déclaré nulle part dans la feuille de la boutique : il sortait en lien
ordinaire, souligné au survol seulement. Personne ne pouvait deviner qu'il y
avait une fiche derrière.

La liste reprend donc la convention de la console, à l'identique : ligne
entière cliquable, curseur qui le dit, et le lien reste posé sur la référence —
c'est lui qui s'ouvre au clavier ou dans un nouvel onglet, le clic sur la ligne
n'est qu'un raccourci. S'y ajoutent une invite de fin de ligne (« Voir le
détail ») et le rang de l'étape courante sous le statut.

La fiche de suivi, elle, annonce l'avancement avant de le détailler : jauge,
« étape 3 sur 6 », date du dernier passage. Le trait vertical se colore jusqu'à
l'étape franchie et s'arrête là — celui qui part de l'étape courante mène à ce
qui n'a pas eu lieu, il reste gris. Le mot laissé par le bureau au moment du
passage est traité en citation, filet rouge compris : c'est ce que l'étudiant
vient lire.

## Caisse : l'acompte est déjà dans le champ

« Encaisser » ouvrait sur un champ vide, à charge pour le guichet de calculer
50 % du total de tête. Le champ arrive maintenant rempli avec **ce qui manque
pour atteindre l'acompte**, et non avec 50 % du total : un deuxième versement
ne propose plus une somme déjà versée. L'acompte atteint, c'est le solde qui
est proposé.

Deux montants sont offerts sous le champ (acompte, solde entier) pour passer de
l'un à l'autre sans retaper, et la mention dit le seuil, le déjà-versé et que
l'on peut verser davantage. Rien n'est imposé : le champ reste libre, `max` est
le reste dû — la même limite que `fn_chk_paiement` en base, annoncée avant le
clic plutôt que refusée après.

Le seuil est arrondi à l'ariary **supérieur** : un versement à un ariary du
seuil ferait refuser la confirmation par le déclencheur, sans que l'écran
puisse l'expliquer.

## La console ouvre sur les commandes

La racine redirige vers `/commandes` ; le tableau de bord prend son adresse
propre, `/tableau-de-bord`, et passe en deuxième dans la barre latérale. Le
bureau ouvre la console pour traiter des commandes, pas pour lire des agrégats.

## Vérifications faites

- Build de production des deux applications, sans avertissement.
- Les trois films servis en `video/mp4` par le serveur de développement, et
  repris dans `dist/videos/` par le build.
- Contrastes du texte de la vitrine calculés sur le plan le plus clair, après
  étalonnage et voile (13,7:1 et 9:1).
- Ordre de `commande.statuts` vérifié côté API (`date_statut desc`) : la tête
  est bien le passage en cours, ce dont dépendent la jauge et la date affichée.

## Reste à faire

- Toujours pas de vérification dans un vrai navigateur : à repasser à l'œil,
  surtout la vitrine sous 760 px et le fondu entre deux plans.
- Les trois films pèsent 3,9 Mo au total et sont servis tels quels. Si l'accueil
  doit tenir sur une connexion lente, il faudra une version courte et une
  affiche (`poster`) — donc un encodeur, qu'il n'y a pas ici.
- Les noms des fichiers vidéo ont été choisis d'après leur contenu
  (`impression`, `voiture`, `lettrage`) ; l'ordre de passage est celui du
  tableau `FILMS` dans `Vitrine.jsx`.
