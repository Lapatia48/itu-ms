# ITU Motor Society — suivi de commandes

Boutique en ligne et console de gestion des commandes de vêtements du club.
Aucun paiement en ligne, aucune gestion de stock : on commande ici, on paie et
on retire au local, et le bureau enregistre les acomptes au fur et à mesure.

- `sql/script_final.sql` — dump de conception. Toute correction de schéma se
  fait dans ce fichier, jamais en ALTER sur une base vivante.
- `backend/` — API Express + PostgreSQL (port 4000).
- `frontoffice/` — la boutique, côté étudiant (port 5173).
- `backoffice/` — la console de gestion, côté bureau (port 5174).
- `brouillon/` — comptes rendus de session, un par jour de travail.

## Installation

```sh
createdb -U postgres itu_ms
psql -U postgres -d itu_ms -f sql/script_final.sql

cd backend     && npm install && copy .env.example .env   # puis renseigner PGPASSWORD
cd frontoffice && npm install
cd backoffice  && npm install
```

## Lancement

`start.bat` démarre les trois services, ou, à la main :

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
mot de passe `etudiant`.

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
