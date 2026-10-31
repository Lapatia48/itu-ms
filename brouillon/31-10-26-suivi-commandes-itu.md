# 31/10/2026 — Mise en place du suivi de commandes ITU Motor Society

Première session : base, API, boutique et console. Le projet part de zéro, il
reprend le socle de conventions d'Adema (`lib/liste.js`, `components/ui.jsx`,
feuilles de style) avec la palette du logo ITU.

## Palette

Le logo donne deux couleurs et une seule surface : marine `#0E3449`, rouge
`#D51816`, blanc. Elles ont été relevées sur le fichier fourni, pas choisies à
l'œil ; `public/logoitu.png` est le disque du logo découpé à sa résolution
d'origine, fond transparent, servi tel quel par le composant `Logo` et comme
favicon.

- `--brand` `#0E3449` : action principale, lien, élément courant, panneau vif.
  Texte blanc dessus à 12,9:1.
- `--brand-vif` `#D51816`, le rouge du logo : **graphismes seulement** — bandes
  obliques, filet de l'élément actif, étoiles d'une note, série de graphique.
  4,1:1 sur blanc, donc jamais un texte, jamais un bouton.
- `--danger` `#9C1C13`, plus sombre que le rouge de marque : un refus s'écrit,
  il ne se devine pas à la teinte.

L'anneau de focus est passé du rouge au marine : un anneau rouge se lit comme
une erreur. Même raison pour les `:focus-visible` du tableau de bord.

## Base

Un seul dump, `sql/script_final.sql` : `create database itu_ms` puis exécution
du fichier, et le code fonctionne. Il est rejouable (les `drop` sont en tête).

Suppression logique partout (`etat` 1/0, `supprime_le`, `supprime_par`), aucune
ligne n'est effacée. La vue `v_corbeille` met à plat ce qui est supprimé, toutes
tables confondues, et la console la restaure.

Le cycle de vie d'une commande vit dans `commande_statut` : une ligne par
passage, jamais de mise à jour. Les chemins possibles sont dans
`transition_commande`, les droits dans `transition_commande_profil`.

Ce que la base refuse elle-même, et pas seulement l'écran :

| Déclencheur | Refus |
| --- | --- |
| `fn_chk_transition` | passage non déclaré, profil non habilité, acompte insuffisant pour confirmer, solde non réglé pour livrer |
| `fn_chk_paiement` | encaissement supérieur au reste dû, encaissement sur une commande annulée |
| `fn_chk_ligne` | modification des articles d'une commande qui a quitté son statut initial |
| `fn_chk_avis` | avis sur un article qui n'a pas été reçu |

L'acompte minimum est un paramètre (`parametre.acompte_minimum`, 50 %), lu au
moment du passage et pas au moment de la commande.

`v_commande.reste_a_payer` est la seule colonne qui dit ce que la boutique
attend : une commande annulée ne doit rien, même si elle porte des articles.
Liste des commandes, fiche, tableau de bord et compteurs lisent tous celle-là.

## API

`backend/`, Express + `pg`, modules `auth`, `catalogue`, `commandes`, `avis`,
`administration`, `tableauDeBord`. Chaque module a son modèle et ses routes.

- Mots de passe : `crypto.scrypt` de la bibliothèque standard, pas de
  dépendance native à compiler sous Windows. Format `scrypt$sel$empreinte`.
- Le profil est relu **en base** à chaque appel, jamais pris dans le jeton : un
  compte rétrogradé ou mis à la corbeille perd ses droits sans attendre
  l'expiration de son jeton.
- Un compte ouvert par le bureau reçoit un mot de passe provisoire rendu **une
  fois**, dans la réponse de la création ; il n'est écrit nulle part ailleurs.
- Images d'article : le format est lu dans le contenu du fichier (signature
  JPEG/PNG/WebP), jamais dans son nom ni dans le type annoncé par le
  navigateur. Un fichier refusé ne laisse rien sur le disque.
- Les agrégats du tableau de bord sont calculés en base : l'écran reçoit des
  sommes, jamais des lignes à additionner.

Piège rencontré : une lecture faite *dans* une transaction passe par une autre
connexion du pool et ne voit rien. La fiche est donc relue après le `commit`
(`commandes/modele.js`, `catalogue/modele.js`).

## Écrans

Les deux applications partagent `lib/liste.js` à l'identique : `useFiltres`,
`filtrer`, `usePagination`. Aucun écran ne découpe sa liste lui-même.

- Toute liste se pagine de dix en dix.
- Les critères sont dans le panneau de `BoutonFiltres`, jamais au-dessus du
  tableau, et `FiltresActifs` affiche les puces sous l'en-tête.
- Les compteurs posés au-dessus d'un tableau (total commandé, reste à
  encaisser) se lisent sur la liste filtrée entière, pas sur la page affichée.
- Les onglets de statut n'existent pas : un onglet est un filtre affiché en
  permanence, il rejoint le panneau.

Côté console : angles nets, typographie dense, barre latérale blanche dont seul
l'élément actif porte la couleur. Côté boutique : rayons doux, catalogue ouvert
à tous, le compte n'est demandé qu'au moment de valider le panier ou de
consulter ses propres commandes — l'entrée demandant une connexion s'affiche
quand même, avec un cadenas, et conserve sa destination (`/connexion?suite=`).

Un passage réservé à un autre profil, ou bloqué par l'argent, reste affiché
grisé avec son motif (`motifBlocage` dans `CommandeFiche.jsx`) : jamais un
bouton qui échoue au clic. Le motif est calculé avec les mêmes règles que le
déclencheur de la base.

## Vérifications faites

- Rejeu complet de `script_final.sql` sur une base neuve, sans erreur.
- Six refus de la base vérifiés un par un (livraison sans solde, confirmation
  sans acompte, passage par un profil non habilité, avis sans achat,
  trop-perçu, modification d'articles après confirmation).
- Scénario de bout en bout par l'API : commande, acompte, confirmation,
  préparation, prête, solde, livraison, puis avis ; droits du gestionnaire et
  de l'administrateur ; corbeille et restauration ; ouverture d'un compte avec
  mot de passe provisoire.
- Dépôt d'image : un `.sql` renommé `.png` est refusé et ne laisse rien.
- Les 23 écrans des deux applications rendus hors navigateur avec les réponses
  réelles de l'API : aucun `undefined`, `NaN` ni `Invalid Date` dans le rendu.

## Reste à faire

- Pas de vérification dans un vrai navigateur (pas d'outil de capture dans
  cette session) : à repasser à l'œil, surtout la mise en page sous 760 px.
- Les articles du jeu de démonstration n'ont pas de photo : la vignette montre
  un pictogramme. Les photos se déposent depuis *Articles > Modifier*.
- Le filtrage et la pagination se font dans le navigateur, sur le périmètre
  complet renvoyé par le serveur. Ça tient tant qu'un écran tient dans une
  réponse ; passé le millier de lignes il faudra du LIMIT/OFFSET en SQL, et
  alors demander aussi les agrégats au serveur.
