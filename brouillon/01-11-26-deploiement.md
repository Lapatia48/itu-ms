# 01/11/2026 — Mise en ligne, et ce qu'elle a coûté au code

Troisième session, la première qui sorte du poste. Objectif : le site en ligne
sur de l'hébergement vraiment gratuit, sans mise en veille, avec une base vide
et un seul compte administrateur. S'y ajoutent deux demandes : un `stop.bat`,
et un bouton de remise à zéro dans la console.

## Les liens

| | |
| --- | --- |
| Boutique | https://itu-ms-boutique.itu-motor-society.workers.dev |
| Console | https://itu-ms-console.itu-motor-society.workers.dev |
| API | https://itu-ms-api.itu-motor-society.workers.dev/api/v1 |

Entrée : `ADMIN` / `itu2026`. La base est vierge — ni catégorie, ni article, ni
commande : tout s'ouvre depuis la console.

> **Une seule chose reste à faire, et elle est urgente :** la base a été
> provisionnée en mode « Claimable » — sans compte Neon — et un projet non
> réclamé **est supprimé au bout de 72 heures** (ici le 04/11/2026 à 06:12 UTC).
> La réclamer la rattache au compte gratuit du bureau. Attention : le
> rattachement **change le mot de passe de la base**, donc Hyperdrive doit être
> reconfiguré juste après, sinon l'API tombe. La marche à suivre est dans
> `deploiement.md`, section 10.

Le mode opératoire complet, écrit pour quelqu'un qui n'a jamais déployé :
[`deploiement.md`](../deploiement.md).

## Le choix d'hébergeur

Le besoin qui a tout décidé : **pas de réveil lent**. Render endort un service
gratuit après quinze minutes et met près d'une minute à le réveiller ; pour un
étudiant qui consulte sa commande une fois par semaine, c'est une minute d'écran
vide à chaque fois. Écarté pour cette seule raison.

Reste Cloudflare Workers, dont les isolats démarrent en quelques millisecondes :
pas de veille, donc pas de réveil. Les trois services y tiennent — les deux
fronts en fichiers statiques, l'API en Worker. Et comme Vercel Hobby interdit
l'usage commercial, ce qu'une boutique de club est tout de même un peu, la
question ne se posait plus.

La base est chez **Neon** (PostgreSQL, 1 Go par projet, offre permanente, sans
carte), atteinte par **Hyperdrive**, le mandataire de Cloudflare qui garde les
connexions chaudes devant elle.

L'analyse de départ proposait de réécrire l'API en Hono pour tenir sur Workers.
Ça n'a pas été nécessaire : Cloudflare sait désormais faire tourner un serveur
HTTP de node par `httpServerHandler` (`cloudflare:node`), donc **c'est le même
Express qu'en local**. Un seul jeu de routes, un seul comportement, et « ça
marche chez moi » veut encore dire quelque chose.

## Trois murs, et comment ils ont déplacé le code

Aucun des trois n'était prévisible depuis le poste. Chacun aurait suffi à faire
échouer la mise en ligne.

### 1. Le mot de passe ne peut plus être haché dans l'API

Workers plafonne le temps **processeur** à 10 ms par requête sur l'offre
gratuite. Or un `scrypt` coûte cinquante à cent millisecondes de calcul pur :
toute connexion aurait été tuée en vol, et le plafond ne se négocie pas.

Le hachage descend donc **en base**, en bcrypt (`pgcrypto`). Ce n'est pas un
contournement : attendre la base est une entrée-sortie, et l'attente n'est pas
comptée dans le temps processeur. Trois bénéfices au passage — la comparaison se
fait en C, à temps constant, dans la clause `where` ; aucune empreinte ne remonte
dans le code applicatif ; et les scripts SQL n'ont plus d'empreinte recopiée à la
main, ils écrivent `crypt('itu2026', gen_salt('bf', 10))`.

`utils/motDePasse.js` ne produit donc plus d'empreinte : il rend les deux
fragments de SQL (`hacher`, `verifie`) et le mot de passe provisoire. `connexion`
tient désormais en une seule requête, qui ne distingue pas le compte inconnu du
mauvais mot de passe — c'était déjà le comportement voulu, il est maintenant
structurel.

### 2. Express ne se construisait pas pour le moteur Workers

Le Worker refusait de démarrer :

```
Uncaught TypeError: require_streams(...) is not a function
  at node_modules/iconv-lite/lib/index.js
```

La chaîne : `express` lit `body-parser` **à son chargement** (`exports.json =
bodyParser.json`), ce qui tire `raw-body`, qui tire `iconv-lite`. Or `iconv-lite`
déclare `"./lib/streams": false` dans son champ `browser` ; le paquet le remplace
donc par un objet vide — mais `iconv-lite` l'appelle quand même, parce qu'il se
croit sous node (`process.versions.node` existe avec `nodejs_compat`). L'erreur
tombe à l'import, avant la première requête, et aucun réglage ne l'évite.

Deux changements, qui se tiennent :

- l'API **lit son corps de requête elle-même** (`middlewares/corps.js`, vingt
  lignes) : plus de `express.json` ni de `express.raw` ;
- `body-parser` est remplacé dans le paquet du Worker par un
  [stub](../backend/src/vendor/body-parser-absent.js) qui lève une erreur
  explicite si on l'appelle, raccordé par `alias` dans `wrangler.jsonc`.

Le dépôt de photo, lui, a perdu `multer` — qui tient à `node:stream`. Le
multipart est maintenant décodé par **la plateforme** : `Request.formData()`
existe à l'identique sous node 18+ et dans un Worker. Une bibliothèque de moins,
un analyseur de moins à maintenir, et le contrat HTTP est inchangé — le
formulaire de la console n'a pas bougé d'une ligne.

`jsonwebtoken` a cédé la place à `jose` pour la même raison de fond : `jose`
signe avec Web Crypto, présent partout, là où `jsonwebtoken` passe par
`node:crypto`. Un HMAC-SHA256 ne coûte rien en processeur.

### 3. Les photos ne peuvent plus vivre sur le disque

Aucun hébergement gratuit ne garde son disque, et un Worker n'en a même pas.
Les photos passent en `bytea`, table `produit_image`, servies par la route
ouverte `/images/:nom`.

Le nom est tiré au dépôt et ne se réutilise jamais : l'URL d'une photo désigne
donc toujours les mêmes octets, ce qui la rend cachable sans fin
(`immutable`) et évite qu'un navigateur garde l'ancienne après un remplacement.
Ce qu'on y gagne sans l'avoir cherché : la photo et la fiche qu'elle illustre
sont écrites dans **la même transaction**, jamais l'une sans l'autre — l'ancien
code posait le fichier, puis écrivait la ligne, et un échec laissait un orphelin.

Côté écrans, `/images/...` était écrit en relatif, ce qui ne marchait que derrière
le proxy de Vite. `lib/api.js` expose maintenant `urlImage()`, qui déduit
l'adresse des photos de celle de l'API : une seule variable à poser
(`VITE_API_URL`), pas deux à tenir d'accord.

## Le pool de connexions, qui ne peut plus être partagé

Un Worker **refuse** qu'une socket ouverte pour une requête serve à la suivante
(« Cannot perform I/O on behalf of a different request »). Le pool unique de
processus, qui est exactement ce qu'il faut en local, est donc interdit en ligne.

`db.js` porte les deux durées de vie sans que les modèles le sachent : un
`AsyncLocalStorage` tient le pool de la requête en cours, et retombe sur le pool
partagé quand il n'y en a pas. Le point d'entrée choisit — `src/index.js` ouvre un
pool pour tout le processus, `src/worker.js` en fabrique un par requête et le
ferme à la fin de la réponse. C'est Hyperdrive qui absorbe le coût, en gardant
les connexions chaudes de son côté.

D'où la séparation en trois fichiers : `app.js` construit l'application et ne
connaît ni port ni pilote, `index.js` et `worker.js` ne font que lire
l'environnement, ouvrir la base et se mettre à l'écoute.

## La base, obtenue sans compte

Point de blocage réel : créer un compte Neon demande une validation par
navigateur, qu'un agent ne peut pas faire — et Cloudflare ne propose pas de
PostgreSQL. Porter le schéma sur D1 (SQLite, disponible sur le compte) aurait
voulu dire abandonner le plpgsql, les vues et `pgcrypto`, c'est-à-dire tous les
refus garantis par la base : le cœur de la conception.

La sortie est le mode **« Claimable »** de Neon : `neon claim create` provisionne
un projet PostgreSQL *avant* qu'un compte existe, qu'un humain rattache ensuite
au sien. PostgreSQL 17.11, Francfort, 72 heures pour le réclamer.

Au passage, le poste de travail a le **port 5432 bloqué en sortie** — réseau
filtré, seuls 80 et 443 passent. `psql` ne pouvait donc pas atteindre Neon. Le
schéma a été chargé par le pilote serverless de Neon, qui tunnelle le protocole
PostgreSQL en WebSocket sur le 443. Ce n'est un problème que depuis ce poste :
en production, c'est Cloudflare qui se connecte, depuis son propre réseau.

## Le cache d'Hyperdrive, qui annulait la sécurité du projet

La trouvaille de la session, et elle ne pouvait venir que d'un test contre le
site **déployé**. Le scénario de bout en bout a d'abord échoué six fois, toutes
dues à une seule cause : **Hyperdrive met les `SELECT` en cache par défaut.**

Trois symptômes, de gravité croissante :

- une fiche de commande relue juste après un encaissement affichait l'**ancien
  reste à payer** — le guichet aurait réclamé de l'argent déjà versé ;
- une photo supprimée **continuait d'être servie** ;
- et un compte mis à la corbeille **gardait ses droits**, parce que la requête
  qui relit son profil répondait depuis le cache.

Ce dernier point annule l'invariant posé à la première session : « le profil est
relu **en base** à chaque appel, jamais pris dans le jeton : un compte rétrogradé
ou mis à la corbeille perd ses droits sans attendre l'expiration de son jeton ».
Toute la sécurité du projet repose là-dessus, et le cache la défaisait en
silence.

```
wrangler hyperdrive update <id> --caching-disabled
```

La mise en commun des connexions, elle, est conservée — c'est ce qu'on venait
chercher. La raison est écrite dans `backend/wrangler.jsonc`, parce que
quiconque recréera la configuration Hyperdrive un jour la recréera avec son
cache actif.

Rien de tout cela n'apparaît en développement local, où il n'y a pas
d'Hyperdrive.

## Le CORS, trouvé en le testant

Le prévol `OPTIONS` répondait 500. Le middleware de base passait avant `cors` :
il échouait, et la réponse d'erreur partait **sans en-têtes CORS**. Le navigateur
aurait annoncé « erreur CORS » à la place du message que l'API avait pris la peine
d'écrire — un faux diagnostic, sur toutes les erreurs serveur.

`cors` est désormais le premier middleware. Un prévol ne touche plus la base, et
une erreur garde ses en-têtes.

`ORIGINES` nomme les deux fronts, un par un. Pas de `*` : le jeton de session
voyage en en-tête, il serait lisible depuis n'importe quelle page.

## Base vierge, et le bouton qui y ramène

Le dump a été coupé en deux, sans rien dupliquer :

- `sql/script_final.sql` — schéma, paramétrage, et le **seul** compte `ADMIN`.
  Joué seul, il donne la base livrée.
- `sql/jeu_demonstration.sql` — catégories, articles, comptes et commandes de
  démonstration. Facultatif.

Ce qui reste dans le premier n'est pas un oubli : tailles, modes de paiement,
statuts et transitions ne sont pas de la saisie, c'est le mode d'emploi de la
base. Sans tailles, aucun article ne peut être créé.

Le bouton *Paramétrage > Paramètres > Réinitialiser la base* appelle
`fn_reinitialiser`, **en base** — un seul endroit décrit ce que « vierge » veut
dire, et `jeu_demonstration.sql` commence par l'appeler, ce qui le rend
rejouable.

L'ordre des suppressions y est commenté parce qu'il n'est pas libre :
`trg_chk_ligne` refuse qu'on touche aux articles d'une commande qui a quitté son
statut initial. En vidant `commande_statut` **d'abord**, `fn_statut_courant` ne
renvoie plus rien et le déclencheur laisse passer. Sans cette ruse il faudrait le
désactiver, ce qui demande des droits qu'on n'a pas sur une base hébergée.

C'est la seule opération du projet qui efface vraiment des lignes — partout
ailleurs la suppression est logique et la corbeille rattrape. D'où un mot à
recopier plutôt qu'un « êtes-vous sûr ? », le décompte de ce qui est parti rendu
en réponse, et un triple contrôle : l'écran, l'API (`exigerProfil('ADMIN')`) et la
base (`fn_reinitialiser` refuse tout autre profil).

## stop.bat

Pendant de `start.bat`, et par port (4000, 5173, 5174) plutôt que par nom
d'image : tuer tous les `node.exe` du poste emporterait ce qui n'a rien à voir
avec le projet.

Deux pièges de `cmd` rencontrés, tous deux silencieux :

- **les fins de ligne.** En LF, `cmd` perd la trace de ses labels : un
  `call :tuer` sur trois réussissait. Les deux `.bat` sont en CRLF — `start.bat`
  était en LF et marchait par chance.
- **le corps de boucle entre parenthèses.** Un bloc `for (...)` contenant un
  `REM` et de l'expansion différée ne s'exécute pas comme il se lit : le PID était
  trouvé, et la variable restait vide. Le corps est sorti en sous-routine
  (`call :abattre`), ce qui supprime le besoin d'expansion différée.

Le même service écoutant souvent en IPv4 et en IPv6, son PID sort deux fois :
`tasklist` sert de garde, et le second passage se tait au lieu d'annoncer un échec
qui n'en est pas un.

## Vérifications faites

- **Scénario de bout en bout, 50+ contrôles, passé sur les deux moteurs** : node
  en local *et* workerd réel (`wrangler dev`, Hyperdrive émulé sur une base
  locale). Connexions bcrypt, jeton `jose`, signature altérée refusée, changement
  de mot de passe, mot de passe provisoire, dépôt et remplacement de photo,
  `.sql` renommé `.png` refusé sans rien laisser, remise à zéro et ses quatre
  refus, puis réouverture d'une catégorie et d'un article sur la base vidée.
- Rejeu de `script_final.sql` sur une base neuve, puis du jeu de démonstration,
  puis du jeu de démonstration **deux fois** (idempotence) : références toujours
  de `CMD-26-0001` à `0007`.
- `fn_reinitialiser` refusée au gestionnaire, à l'étudiant et à un identifiant
  inconnu ; après son passage, les sept tables de données à zéro, la corbeille
  vide, le paramétrage et les tailles intacts, séquences remises à 1.
- `stop.bat` sur trois services vivants (ports décalés, pour ne pas toucher aux
  services en cours) : trois arrêts, ports libérés ; puis cas mixte (un seul en
  service) et second passage.
- Builds de production des trois applications, sans avertissement. Worker :
  897 Kio, 168 Kio compressé — le plafond est à 3 Mio.
- En ligne : les deux fronts en 200, **routes profondes comprises**
  (`/catalogue`, `/commandes`), ce qui valide `not_found_handling`.
- CORS en ligne : prévol depuis les deux fronts accepté avec l'origine renvoyée,
  prévol depuis un tiers sans en-tête `Allow-Origin`.
- Plan B éprouvé d'avance : `pg` en connexion directe depuis workerd, sans
  Hyperdrive, répond sur `/sante` et sur la connexion.
- **Scénario complet rejoué contre le site EN LIGNE, depuis la base vierge, et
  passé intégralement.** Il remonte tout le cycle d'une commande et vérifie
  chaque refus de la base avec son message :
  - confirmer sans acompte → *« Acompte insuffisant : 0 Ar versés sur 40000 Ar
    attendus. »*
  - confirmer avec 30 000 sur 40 000 → même refus, chiffres à jour
  - encaisser plus que le dû → *« Reste à payer : 50000 Ar. »*
  - sauter de Confirmée à Livrée → *« Passage de CONFIRMEE a LIVREE non
    prévu. »*
  - un client qui lance la préparation → *« Profil CLIENT non habilité pour ce
    passage. »*
  - livrer avec 40 000 restants → *« Solde restant : 40000 Ar. »*
  - noter un article jamais commandé → *« Article non reçu : aucun avis. »*
  - noter deux fois → *« Vous avez déjà noté cet article. »*
  
  S'y ajoutent : références repartant de `ART-0001` et `CMD-26-0001`, total
  calculé en base, statut initial posé par le déclencheur, historique des cinq
  passages conservé, note moyenne et quantité vendue justes, photo servie depuis
  la base puis partie avec son article, remise à zéro refusée au gestionnaire et
  sur mot erroné, et base rendue vierge à la fin — le scénario ne laisse rien
  derrière lui.
- Base locale `itu_ms` rejouée sur le nouveau schéma, pile locale relancée par
  `start.bat`, connexions `ADMIN` et `ETU1201` vérifiées à travers les deux
  proxys Vite.

## Reste à faire

- **Réclamer le projet Neon avant le 04/11/2026, 06:12 UTC**, puis reconfigurer
  Hyperdrive avec la nouvelle chaîne de connexion. C'est le seul point qui peut
  encore faire tomber le site, et il a une date limite.
- **Toujours aucune vérification dans un vrai navigateur.** C'est la troisième
  session où ce point revient. Le bouton de remise à zéro est éprouvé côté API et
  côté base, pas à l'œil : la modale, le bouton inerte tant que le mot n'est pas
  recopié, et le décompte affiché après coup n'ont jamais été vus.
- Les trois films de la vitrine pèsent 4,2 Mo et sont servis tels quels. Sur une
  connexion lente malgache, c'est long ; il faudrait une version courte et une
  affiche, donc un encodeur, qu'il n'y a pas ici.
- `backend/uploads/` est mort depuis que les photos sont en base, mais la
  politique du poste a refusé sa suppression. Il ne reste qu'un `.gitkeep` vide.
- Le plafond de 10 ms de processeur n'a pas été mesuré sous charge. Les requêtes
  lourdes (catalogue complet, tableau de bord) passent, mais le filtrage et la
  pagination se font toujours dans le navigateur sur le périmètre entier : passé
  le millier de lignes, il faudra du `LIMIT`/`OFFSET` en SQL — et ce jour-là, le
  plafond processeur comptera plus que la taille de la réponse.
- Hyperdrive est limité à 100 000 requêtes par jour sur l'offre gratuite, et
  Workers à 100 000 requêtes par jour. Largement au-dessus des besoins d'un club,
  mais ce sont des plafonds journaliers, pas mensuels.
