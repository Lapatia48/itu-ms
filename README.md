# ITU Motor Society — suivi de commandes

Boutique en ligne et console de gestion des commandes de vêtements du club.
Aucun paiement en ligne, aucune gestion de stock : on commande ici, on paie et
on retire au local, et le bureau enregistre les acomptes au fur et à mesure.

- `sql/script_final.sql` — dump de conception : schéma, paramétrage, et le
  seul compte `ADMIN`. Toute correction de schéma se fait dans ce fichier,
  jamais en ALTER sur une base vivante. Joué seul, il donne une base vierge —
  c'est l'état dans lequel l'application est livrée.
- `sql/jeu_demonstration.sql` — facultatif : catégories, articles, comptes et
  commandes de démonstration. À jouer après le précédent.
- `backend/` — API Express + PostgreSQL (port 4000 en local, Worker
  Cloudflare en ligne).
- `frontoffice/` — la boutique, côté étudiant (port 5173).
- `backoffice/` — la console de gestion, côté bureau (port 5174).
- `brouillon/` — comptes rendus de session, un par jour de travail.

## Installation

```sh
createdb -U postgres itu_ms
psql -U postgres -d itu_ms -f sql/script_final.sql
psql -U postgres -d itu_ms -f sql/jeu_demonstration.sql   # facultatif

cd backend     && npm install && copy .env.example .env   # puis renseigner PGPASSWORD
cd frontoffice && npm install
cd backoffice  && npm install
```

Le script active `pgcrypto` lui-même : les mots de passe sont hachés en bcrypt
**par la base**, et aucune empreinte n'est écrite en clair dans les fichiers.

## Lancement

`start.bat` démarre les trois services, `stop.bat` les arrête — tous deux
travaillent par port (4000, 5173, 5174) et non par nom de processus, donc ils
ne touchent pas aux autres `node.exe` du poste. À la main :

```sh
cd backend     && npm run dev
cd frontoffice && npm run dev
cd backoffice  && npm run dev
```

## Comptes du jeu de démonstration

| Numéro ETU | Mot de passe | Profil        |
| ---------- | ------------ | ------------- |
| `ADMIN`    | `itu2026`    | Administrateur |
| `GEST01`   | `itu2026`    | Gestionnaire  |
| `ETU1201`  | `etudiant`   | Étudiant      |

Les autres étudiants (`ETU1388`, `ETU1402`, `ETU1455`, `ETU1510`) partagent le
mot de passe `etudiant`. Sans le jeu de démonstration, il n'y a que `ADMIN` /
`itu2026` : tout le reste s'ouvre depuis la console.

## Qui fait quoi

- l'**étudiant** commande, suit ses commandes, annule tant que rien n'est
  lancé, et note les articles qu'il a reçus ;
- le **gestionnaire** tient le guichet et la caisse : encaissements, passages
  de statut, comptes étudiants ;
- l'**administrateur** tient le catalogue, les catégories, les comptes
  internes, les paramètres et la corbeille.

Les droits de passage d'un statut à l'autre sont déclarés en base
(`transition_commande_profil`) et relus à chaque appel : la console les affiche
dans *Paramétrage > Cycle de vie*.

## Repartir sur une base vierge

*Paramétrage > Paramètres > Réinitialiser la base* (administrateur seulement)
efface le catalogue, les commandes, la caisse, les avis et tous les comptes
sauf celui qui le demande. Restent le paramétrage, les tailles, les modes de
paiement et le cycle de vie — ce n'est pas de la saisie, c'est le mode d'emploi
de la base.

C'est la **seule** opération du projet qui efface vraiment des lignes : partout
ailleurs la suppression est logique (`etat = 0`) et la corbeille rattrape. Elle
demande donc de recopier un mot, et la base revérifie le profil de son côté
(`fn_reinitialiser`). L'état obtenu est exactement celui de
`sql/script_final.sql` joué seul.

## En ligne

L'application tourne en hébergement gratuit, sans mise en veille :

- la boutique et la console sur **Cloudflare Workers** (fichiers statiques) ;
- l'API sur **Cloudflare Workers** aussi, par `httpServerHandler` — c'est le
  même Express qu'en local, voir `backend/src/worker.js` ;
- la base sur **Neon**, atteinte par **Cloudflare Hyperdrive** qui tient les
  connexions chaudes.

Pour déployer ce site de zéro sur vos propres comptes, pas à pas :
**[deploiement.md](deploiement.md)** — création des comptes, jetons, chargement
du schéma, mise en ligne, vérifications, et les neuf pièges rencontrés.

Le récit de la mise en ligne réelle, avec les liens vivants :
`brouillon/01-11-26-deploiement.md`.
