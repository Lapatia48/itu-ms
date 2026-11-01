# Déployer ce site de zéro — tutoriel pas à pas

Ce guide mène d'un dépôt sur votre disque à trois adresses publiques qui
fonctionnent, **sans rien payer et sans carte bancaire**. Il suppose que vous
n'avez jamais déployé quoi que ce soit. Chaque commande est donnée telle quelle,
avec ce qu'elle doit répondre.

Comptez **45 minutes** la première fois.

À la fin vous aurez :

| | |
| --- | --- |
| La boutique | `https://itu-ms-boutique.VOTRE-SOUS-DOMAINE.workers.dev` |
| La console | `https://itu-ms-console.VOTRE-SOUS-DOMAINE.workers.dev` |
| L'API | `https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1` |

Avec une base de données vide et un seul compte : `ADMIN` / `itu2026`.

---

## 1. Pourquoi cette pile, et pas une autre

Trois morceaux à héberger : deux applications React (des fichiers statiques) et
une API Express qui parle à PostgreSQL.

```
   navigateur
       │
       ├──────────────► Boutique    ─┐  Cloudflare Workers
       ├──────────────► Console     ─┤  (fichiers statiques)
       │                             │
       └──────────────► API Express ─┘  Cloudflare Workers
                            │
                            ▼
                       Hyperdrive        garde les connexions chaudes
                            │
                            ▼
                     PostgreSQL (Neon)
```

**Pourquoi Cloudflare Workers et pas Render ?** Un service gratuit chez Render
s'endort après 15 minutes sans trafic et met **près d'une minute** à se réveiller.
Pour une boutique consultée de temps en temps, c'est une minute d'écran vide à
chaque visite. Les Workers démarrent en quelques millisecondes : pas de veille,
donc pas de réveil.

**Pourquoi pas Vercel ?** L'offre Hobby de Vercel est réservée à un usage non
commercial. Une boutique de club vend des vêtements — autant ne pas se mettre en
faute.

**Pourquoi Neon pour la base ?** Cloudflare ne propose pas de PostgreSQL. Les
bases PostgreSQL gratuites de Render **expirent au bout de 30 jours**. L'offre
gratuite de Neon est permanente : 1 Go par projet, sans carte.

**Pourquoi Hyperdrive au milieu ?** Un Worker ne peut pas garder une connexion
ouverte d'une requête à l'autre (voir le piège nº 4). Sans Hyperdrive, chaque
requête repaierait l'ouverture d'une connexion PostgreSQL — plusieurs centaines
de millisecondes. Hyperdrive les garde chaudes de son côté. Il est gratuit
jusqu'à 100 000 requêtes par jour.

---

## 2. Avant de commencer

Vérifiez ce que vous avez déjà :

```sh
node --version     # il faut 20 ou plus — idéalement 22
npm --version
git --version
```

Si Node manque : https://nodejs.org (prenez la version LTS).

Récupérez le dépôt et installez les dépendances des trois applications :

```sh
git clone <url-du-depot> itu-motor-society
cd itu-motor-society

cd backend     && npm install && cd ..
cd frontoffice && npm install && cd ..
cd backoffice  && npm install && cd ..
```

`psql` est utile mais **pas obligatoire** — l'étape 4 donne une solution de
rechange si vous ne l'avez pas, ou si votre réseau bloque PostgreSQL.

---

## 3. Étape 1 — Le compte Cloudflare

### 3.1 Créer le compte

Allez sur https://dash.cloudflare.com/sign-up. Une adresse e-mail, un mot de
passe, un lien de confirmation à cliquer dans votre boîte. **Aucune carte
bancaire n'est demandée** et vous restez sur le plan gratuit.

### 3.2 Se connecter depuis le terminal

C'est le point que beaucoup de tutoriels compliquent inutilement. Vous
n'avez **pas besoin de créer un jeton d'API** : `wrangler` sait ouvrir votre
navigateur et récupérer une autorisation tout seul.

```sh
cd backend
npx wrangler login
```

Votre navigateur s'ouvre sur une page Cloudflare. Cliquez **« Allow »**. Le
terminal affiche :

```
Successfully logged in.
```

L'autorisation est écrite sur **votre** poste
(`~/.wrangler/config/default.toml` ou, sous Windows,
`C:\Users\<vous>\AppData\Roaming\xdg.config\.wrangler\config\default.toml`).
Rien à copier, rien à coller, aucun secret à faire circuler.

Vérifiez :

```sh
npx wrangler whoami
```

```
👋 You are logged in with an OAuth Token, associated with the email vous@exemple.com.
┌───────────────────────┬──────────────────────────────────┐
│ Account Name          │ Account ID                       │
├───────────────────────┼──────────────────────────────────┤
│ Votre compte          │ c2d34ff04da6408cd9c5353a8352d52c │
└───────────────────────┴──────────────────────────────────┘
```

**Notez l'Account ID**, il resservira.

> **Variante : avec un jeton d'API.** Utile seulement pour une intégration
> continue (GitHub Actions), où aucun navigateur ne peut s'ouvrir.
> *dash.cloudflare.com > My Profile > API Tokens > Create Token > Custom token*,
> avec les droits **Workers Scripts:Edit**, **Hyperdrive:Edit** et
> **Account Settings:Read**. Puis, avant chaque commande :
> ```sh
> export CLOUDFLARE_API_TOKEN=votre-jeton
> export CLOUDFLARE_ACCOUNT_ID=votre-account-id
> ```
> Pour un déploiement à la main, `wrangler login` est plus simple **et** plus
> sûr : le secret ne sort jamais de votre machine.

### 3.3 Choisir votre sous-domaine

Votre compte doit avoir un sous-domaine `workers.dev` : c'est lui qui donne
leur adresse à vos trois sites. **Faites-le maintenant**, sinon le premier
déploiement échouera avec
`You need to register a workers.dev subdomain before publishing`.

Ouvrez https://dash.cloudflare.com → **Workers & Pages**. À la première visite,
Cloudflare vous demande de choisir un sous-domaine. Prenez par exemple
`itu-motor-society`.

Ce nom est **définitif en pratique** : le changer casserait toutes les adresses
déjà distribuées. Choisissez-le comme vous choisiriez un nom de domaine.

Dans tout ce qui suit, remplacez `VOTRE-SOUS-DOMAINE` par ce que vous avez
choisi. Vos trois adresses sont désormais connues :

```
https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev
https://itu-ms-boutique.VOTRE-SOUS-DOMAINE.workers.dev
https://itu-ms-console.VOTRE-SOUS-DOMAINE.workers.dev
```

---

## 4. Étape 2 — La base de données

Deux chemins. Le premier évite toute inscription, le second est le chemin
classique.

### Chemin A — sans créer de compte (« Claimable Neon »)

Neon sait provisionner une base **avant** que vous ayez un compte. Vous la
rattachez au vôtre plus tard. Pratique pour démarrer en trente secondes.

```sh
npm i -g neon
neon claim create --region-id aws-eu-central-1
```

```
Pulled 3 Neon variables into .env.local
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
Project ID            bold-lab-86416333
Region ID             aws-eu-central-1
State                 unclaimed
Project Expires At    2026-11-04T06:12:44.287Z
Granted Capabilities  postgres
```

Choisissez la région la plus proche de vos visiteurs :
`aws-eu-central-1` (Francfort), `aws-us-east-1`, `aws-us-east-2`,
`aws-ap-southeast-1` (Singapour). **La région ne peut pas changer ensuite.**

> ⚠️ **Lisez bien `Project Expires At`.** Une base non réclamée est
> **supprimée au bout de 72 heures**. Allez tout de suite à la
> [section 10](#10-rattacher-la-base-à-votre-compte-neon) pour la rattacher à un
> compte. Ne reportez pas : il n'y a pas de récupération après expiration.

La commande écrit vos identifiants de base dans `.env.local`. Si vous avez déjà
un `.env` qui contient un `DATABASE_URL`, ajoutez `--file autre-fichier.env`
pour ne pas l'écraser.

### Chemin B — avec un compte Neon

1. https://console.neon.tech → **Sign up** → **Continue with Google** (le plus
   rapide : pas de validation par e-mail à attendre).
2. Le projet se crée tout seul. Choisissez la région proche de vous.
3. Sur le tableau de bord, encadré **Connection string** → **Show password** →
   **Copy snippet**.

Vous obtenez deux chaînes, et la différence compte :

```
postgresql://user:mdp@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
                            ^^^^^^^ mutualisée (« pooled »)
postgresql://user:mdp@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
                                       directe (« unpooled »)
```

Pour **charger le schéma** et pour **Hyperdrive**, prenez la chaîne **directe**
(sans `-pooler`) : un script de schéma crée des fonctions et pose des verrous,
ce qui ne traverse pas un mutualiseur. Et Hyperdrive fait déjà la mise en
commun : la doubler n'apporte rien.

### 4.1 Charger le schéma

Le fichier `sql/script_final.sql` contient tout : tables, vues, déclencheurs,
paramétrage, et **un seul compte** `ADMIN` / `itu2026`. Joué seul, il laisse une
base vierge.

```sh
psql "postgresql://user:mdp@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
  -v ON_ERROR_STOP=1 -f sql/script_final.sql
```

Les `NOTICE: la table « avis » n'existe pas, poursuite du traitement` sont
normaux : le script commence par supprimer ce qui pourrait exister.

Vérifiez :

```sh
psql "<votre-chaine>" -c "select count(*) from compte; select count(*) from produit"
```

Vous devez lire **1** compte et **0** produit.

> **Si vous voulez des données de démonstration** (14 articles, 7 commandes,
> 8 comptes), jouez ensuite `sql/jeu_demonstration.sql`. Pour un vrai
> déploiement, ne le faites pas.

### 4.2 Si `psql` ne passe pas

PostgreSQL écoute sur le port **5432**, et beaucoup de réseaux d'entreprise,
d'école ou d'université ne laissent sortir que 80 et 443. Symptôme :

```
psql: erreur : la connexion au serveur ... port 5432 a échoué : Connection timed out
```

Testez :

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://ep-xxx.eu-central-1.aws.neon.tech/sql
```

Si vous obtenez un code (même `400`), le port 443 passe et 5432 est bien bloqué.

**Cela ne concerne que votre poste** : en production, c'est Cloudflare qui se
connecte à Neon, depuis son propre réseau. Il faut juste une autre façon de
charger le schéma. Le pilote « serverless » de Neon tunnelle le protocole
PostgreSQL en WebSocket sur le 443.

Créez un dossier jetable **en dehors du dépôt** :

```sh
mkdir ~/charger-sql && cd ~/charger-sql
npm init -y
npm i @neondatabase/serverless ws
```

Créez `charger.mjs` :

```js
import fs from 'node:fs';
import { Client, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.on('notice', (n) => console.log('  avis :', n.message));

try {
  await client.connect();
  await client.query(fs.readFileSync(process.argv[2], 'utf8'));
  console.log('OK');
} catch (e) {
  console.error('ECHEC :', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

Puis :

```sh
export DATABASE_URL="postgresql://user:mdp@ep-xxx...neon.tech/neondb?sslmode=require"
node charger.mjs /chemin/vers/itu-motor-society/sql/script_final.sql
```

Pour vérifier ensuite, le même outil sert aux requêtes :

```sh
node -e "
import('@neondatabase/serverless').then(async ({Client,neonConfig}) => {
  neonConfig.webSocketConstructor = (await import('ws')).default;
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();
  console.log((await c.query('select count(*) from compte')).rows);
  await c.end();
})"
```

---

## 5. Étape 3 — Hyperdrive (et son cache, à désactiver)

Hyperdrive est le mandataire de Cloudflare devant votre base.

```sh
cd backend
npx wrangler hyperdrive create itu-ms-db \
  --connection-string "postgresql://user:mdp@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

Utilisez la chaîne **directe** (sans `-pooler`), et gardez `?sslmode=require`.

```
✅ Created new Hyperdrive PostgreSQL config: 26cd4ff03c314b68a10d808330173b59
```

**Copiez cet identifiant.** Il va dans `backend/wrangler.jsonc` :

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "26cd4ff03c314b68a10d808330173b59"
  }
],
```

### ⚠️ Désactivez le cache tout de suite

```sh
npx wrangler hyperdrive update 26cd4ff03c314b68a10d808330173b59 --caching-disabled
```

**Ne sautez pas cette commande.** Hyperdrive met les `SELECT` en cache par
défaut, et sur cette application cela casse trois choses d'un coup :

- une fiche de commande relue juste après un encaissement affiche l'**ancien
  reste à payer** — le guichet croit que l'étudiant doit encore de l'argent ;
- une photo supprimée **continue d'être servie** ;
- et le plus grave : un compte mis à la corbeille **garde ses droits**, parce
  que la requête qui relit son profil répond depuis le cache. Toute la sécurité
  du projet repose sur le fait que le profil est relu **en base** à chaque
  appel ; le cache annule cette garantie en silence.

Ces trois symptômes n'apparaissent **jamais** en développement local, où il n'y
a pas d'Hyperdrive. Ils ne se voient qu'en testant le site déployé.

La mise en commun des connexions, elle, reste active — c'est ce qu'on vient
chercher.

---

## 6. Étape 4 — Le secret de signature des sessions

L'API signe ses jetons de session avec une clé secrète. Elle ne doit **jamais**
se trouver dans un fichier versionné.

Fabriquez-en une au hasard :

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Confiez-la à Cloudflare, qui la stocke chiffrée :

```sh
cd backend
npx wrangler secret put JWT_SECRET
```

Collez la valeur quand c'est demandé. Pour un script :

```sh
echo "la-valeur" | npx wrangler secret put JWT_SECRET
```

Si le Worker n'existe pas encore, `wrangler` propose de le créer : acceptez.

> L'API **refuse de démarrer** sans ce secret. C'est voulu : un secret par
> défaut laissé en production permettrait à n'importe qui de fabriquer un jeton
> d'administrateur.

Récapitulatif des variables du Worker de l'API :

| Nom | Où | Valeur |
| --- | --- | --- |
| `JWT_SECRET` | secret (`wrangler secret put`) | la clé au hasard |
| `JWT_DUREE` | `vars` dans `wrangler.jsonc` | `12h` |
| `ORIGINES` | `vars` dans `wrangler.jsonc` | les deux adresses des fronts |
| `HYPERDRIVE` | binding | l'identifiant de l'étape 3 |

---

## 7. Étape 5 — Déclarer les origines autorisées

Ouvrez `backend/wrangler.jsonc` et mettez **vos** adresses :

```jsonc
"vars": {
  "JWT_DUREE": "12h",
  "ORIGINES": "https://itu-ms-boutique.VOTRE-SOUS-DOMAINE.workers.dev,https://itu-ms-console.VOTRE-SOUS-DOMAINE.workers.dev"
}
```

Séparées par une virgule, **sans espace, sans barre oblique finale**. Si une
adresse est fausse, le navigateur refusera toutes les réponses de l'API et vous
verrez « erreur CORS » dans la console du navigateur.

**N'écrivez jamais `*` ici.** Le jeton de session voyage dans un en-tête HTTP ;
avec `*`, n'importe quelle page du web pourrait lire les données de vos
étudiants.

---

## 8. Étape 6 — Déployer les trois applications

### 8.1 L'API

```sh
cd backend
npx wrangler deploy
```

```
Total Upload: 897.31 KiB / gzip: 167.88 KiB
Worker Startup Time: 33 ms
Your Worker has access to the following bindings:
  env.HYPERDRIVE (26cd4ff0...)    Hyperdrive Config
  env.JWT_DUREE ("12h")           Environment Variable
  env.ORIGINES ("https://...")    Environment Variable
Deployed itu-ms-api triggers
  https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev
```

Vérifiez les trois bindings dans cette liste. Si `HYPERDRIVE` manque, l'API
répondra `Erreur interne du serveur` à chaque appel.

Testez :

```sh
curl https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1/sante
```

```json
{"service":"itu-ms","base":"neondb","maintenant":"2026-11-01T06:19:09.270Z"}
```

Si vous lisez `"base":"neondb"`, l'API parle bien à votre base. 🎉

### 8.2 Les deux fronts

**Point crucial :** l'adresse de l'API est inscrite dans le paquet **au moment
du build**. Ce n'est pas une variable lue à l'exécution — la changer ensuite
demande un nouveau build. Si vous oubliez `VITE_API_URL`, les fronts appelleront
`/api/v1` sur leur propre domaine et tout échouera en 404.

```sh
cd ../frontoffice
VITE_API_URL="https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1" npm run build
npx wrangler deploy
```

```sh
cd ../backoffice
VITE_API_URL="https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1" npm run build
npx wrangler deploy
```

> **Sous Windows (PowerShell)** la syntaxe `VAR=valeur commande` n'existe pas :
> ```powershell
> $env:VITE_API_URL = "https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1"
> npm run build
> npx wrangler deploy
> ```

Vérifiez que l'adresse est bien dans le paquet avant de déployer :

```sh
grep -c "itu-ms-api" dist/assets/*.js      # doit répondre 1
```

Notez qu'il n'y a **qu'une** variable à poser : l'adresse des photos d'articles
s'en déduit (`lib/api.js`).

---

## 9. Étape 7 — Vérifier que tout marche

### Les trois adresses répondent

```sh
SOUS=VOTRE-SOUS-DOMAINE
curl -s -o /dev/null -w "%{http_code}\n" https://itu-ms-api.$SOUS.workers.dev/api/v1/sante
curl -s -o /dev/null -w "%{http_code}\n" https://itu-ms-boutique.$SOUS.workers.dev/
curl -s -o /dev/null -w "%{http_code}\n" https://itu-ms-console.$SOUS.workers.dev/
```

Trois fois `200`.

### Les routes profondes aussi

```sh
curl -s -o /dev/null -w "%{http_code}\n" https://itu-ms-boutique.$SOUS.workers.dev/catalogue
curl -s -o /dev/null -w "%{http_code}\n" https://itu-ms-console.$SOUS.workers.dev/commandes
```

`200` également. Un `404` ici signifie que `not_found_handling` manque dans le
`wrangler.jsonc` du front : une application React tient toutes ses pages dans
`index.html`, et sans ce réglage, ouvrir une adresse directement (ou
rafraîchir la page) renvoie une erreur.

### La connexion fonctionne

```sh
curl -s -X POST https://itu-ms-api.$SOUS.workers.dev/api/v1/auth/connexion \
  -H "Content-Type: application/json" \
  -d '{"etu":"ADMIN","motDePasse":"itu2026"}'
```

Vous devez recevoir un `jeton` et le compte. Si vous lisez
`Numéro ETU ou mot de passe incorrect`, le schéma n'a pas été chargé dans la
base que voit Hyperdrive.

### Le CORS est bien fermé

```sh
# origine autorisée : doit renvoyer un en-tête access-control-allow-origin
curl -s -I -X OPTIONS https://itu-ms-api.$SOUS.workers.dev/api/v1/auth/connexion \
  -H "Origin: https://itu-ms-console.$SOUS.workers.dev" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# origine étrangère : ne doit RIEN renvoyer
curl -s -I -X OPTIONS https://itu-ms-api.$SOUS.workers.dev/api/v1/auth/connexion \
  -H "Origin: https://ailleurs.example.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

### Et dans un navigateur

Ouvrez la console, entrez `ADMIN` / `itu2026`, puis :

1. *Paramétrage > Catégories* → créez une catégorie ;
2. *Catalogue > Articles* → créez un article **avec une photo** (c'est le test
   qui prouve que le stockage en base fonctionne) ;
3. ouvrez la boutique : l'article et sa photo doivent s'afficher.

---

## 10. Rattacher la base à votre compte Neon

**À faire seulement si vous avez suivi le chemin A** (base sans compte). Sinon,
sautez cette section.

Rappel : une base non réclamée **est supprimée au bout de 72 heures**.

### 10.1 Obtenir le code

```sh
neon claim accept --no-open
```

```
Project ID          bold-lab-86416333
User Code           XFT9-9VQ5
Verification URL    https://claimable.neon.tech/claim?user_code=XFT9-9VQ5
Expires In Seconds  900
```

Ouvrez l'adresse, connectez-vous à Neon (ou créez le compte), acceptez le
transfert. **Le code n'est valable que 15 minutes** ; s'il expire, relancez la
commande pour en obtenir un autre.

```sh
neon claim status      # suivre l'avancement
```

### 10.2 ⚠️ Reconfigurer Hyperdrive après le rattachement

**C'est l'étape qu'on oublie, et le site tombe.** Le rattachement **change le
mot de passe** de la base. Hyperdrive garde l'ancien : votre API répondra
`Erreur interne du serveur` dès que ce sera fait.

Récupérez la nouvelle chaîne :

```sh
neon auth          # connectez-vous avec le compte qui a réclamé le projet
neon link          # relie le dossier au projet
neon env pull      # écrit le nouveau DATABASE_URL dans .env.local
```

Puis donnez-la à Hyperdrive :

```sh
cd backend
npx wrangler hyperdrive update 26cd4ff03c314b68a10d808330173b59 \
  --connection-string "<la nouvelle chaîne directe, sans -pooler>"
```

Et vérifiez :

```sh
curl https://itu-ms-api.VOTRE-SOUS-DOMAINE.workers.dev/api/v1/sante
```

Inutile de redéployer le Worker : il lit la configuration d'Hyperdrive à chaque
requête.

---

## 11. Les pièges, un par un

Ce qui suit a réellement cassé ce déploiement. Aucun de ces problèmes
n'apparaît en développement local.

### 1. 10 ms de processeur par requête

L'offre gratuite de Workers plafonne le temps **processeur** à 10 ms par
requête. Un `scrypt` ou un `bcrypt` coûte 50 à 100 ms de calcul pur : toute
connexion serait tuée en vol (`Error 1102`).

**Ce que fait ce projet :** le hachage des mots de passe est descendu **en
base**, en bcrypt via l'extension `pgcrypto`. Attendre la base est une
entrée-sortie, et l'attente **n'est pas comptée** dans le temps processeur. Le
mot de passe en clair ne voyage que comme paramètre de requête, et la
comparaison se fait en C, à temps constant, dans la clause `where`.

Si vous reprenez cette pile : ne hachez jamais un mot de passe dans un Worker
gratuit.

### 2. Express ne se construit pas tel quel

Le Worker refusait de démarrer :

```
Uncaught TypeError: require_streams(...) is not a function
  at node_modules/iconv-lite/lib/index.js
```

La chaîne : `express` lit `body-parser` **dès son import**, ce qui tire
`raw-body`, qui tire `iconv-lite`. Or `iconv-lite` déclare
`"./lib/streams": false` dans son champ `browser` ; l'outil de construction le
remplace donc par un objet vide — mais `iconv-lite` l'appelle quand même, parce
qu'il se croit sous Node (`process.versions.node` existe avec `nodejs_compat`).
L'erreur tombe au chargement, avant la première requête.

**Ce que fait ce projet :** l'API lit son corps de requête elle-même
(`src/middlewares/corps.js`, vingt lignes) et `body-parser` est remplacé dans le
paquet du Worker :

```jsonc
"alias": { "body-parser": "./src/vendor/body-parser-absent.js" },
```

Dans la même veine, `multer` (dépôt de fichiers) a été remplacé par
`Request.formData()`, que Node et les Workers savent faire tous les deux ; et
`jsonwebtoken` par `jose`, qui signe avec Web Crypto au lieu de `node:crypto`.

### 3. Pas de système de fichiers

Un Worker n'a pas de disque, et de toute façon aucun hébergeur gratuit ne garde
le sien d'un redémarrage à l'autre. Un `fs.writeFile` pour stocker une photo
marche en local et disparaît en ligne.

**Ce que fait ce projet :** les photos sont stockées en `bytea` dans PostgreSQL
(table `produit_image`) et servies par la route `/images/:nom`.

### 4. Le pool de connexions ne peut pas être partagé

Un Worker **refuse** qu'une socket ouverte pour une requête serve à la suivante :

```
Cannot perform I/O on behalf of a different request
```

Le pool unique pour tout le processus — exactement ce qu'il faut en local — est
donc interdit en ligne.

**Ce que fait ce projet :** `src/db.js` porte les deux durées de vie. Un
`AsyncLocalStorage` tient le pool de la requête en cours et retombe sur le pool
partagé quand il n'y en a pas. `src/index.js` (local) ouvre un pool pour tout le
processus ; `src/worker.js` (en ligne) en fabrique un par requête et le ferme à
la fin de la réponse.

### 5. Le cache d'Hyperdrive

Voir la [section 5](#5-étape-3--hyperdrive-et-son-cache-à-désactiver). C'est le
piège le plus traître : tout fonctionne, mais les données affichées sont parfois
périmées, et un compte supprimé garde ses droits.

### 6. L'ordre des middlewares pour le CORS

Si quelque chose échoue **avant** le middleware `cors`, la réponse d'erreur part
sans en-têtes CORS. Le navigateur annonce alors « erreur CORS » à la place du
message que l'API avait écrit — un faux diagnostic, sur **toutes** les erreurs
serveur.

**Mettez `cors` en tout premier**, avant même l'ouverture de la base. Un prévol
`OPTIONS` n'a aucune raison d'interroger quoi que ce soit.

### 7. Le port 5432 bloqué chez vous

Voir la [section 4.2](#42-si-psql-ne-passe-pas). Cela n'affecte que votre poste.

### 8. L'adresse de l'API est figée au build

Voir la [section 8.2](#82-les-deux-fronts). Changer l'API demande de
reconstruire les fronts.

### 9. Le sous-domaine `workers.dev` à enregistrer

Voir la [section 3.3](#33-choisir-votre-sous-domaine). Sans lui, le premier
déploiement échoue.

---

## 12. Mettre le site à jour ensuite

| Ce que vous avez changé | Ce qu'il faut refaire |
| --- | --- |
| Code du backend | `cd backend && npx wrangler deploy` |
| Code de la boutique | rebuild **avec `VITE_API_URL`**, puis `npx wrangler deploy` |
| Code de la console | idem |
| `ORIGINES` ou `JWT_DUREE` | `cd backend && npx wrangler deploy` |
| `JWT_SECRET` | `npx wrangler secret put JWT_SECRET` (déconnecte tout le monde) |
| Schéma SQL | rejouer `sql/script_final.sql` — **efface toutes les données** |
| Chaîne de connexion | `npx wrangler hyperdrive update <id> --connection-string "..."` |

Pour voir ce que fait l'API en ligne :

```sh
cd backend
npx wrangler tail
```

Les erreurs apparaissent en direct. Pratique pour un `Erreur interne du
serveur` qui ne dit rien de plus.

---

## 13. Ce que ça coûte, et les plafonds

Tout est à zéro, sans carte bancaire. Les limites de l'offre gratuite :

| | Plafond | Ce que ça représente |
| --- | --- | --- |
| Workers (requêtes) | 100 000 / **jour** | très largement au-delà d'un club |
| Workers (processeur) | 10 ms / requête | voir le piège nº 1 |
| Workers (fichiers statiques) | bande passante illimitée | les vidéos passent |
| Hyperdrive | 100 000 requêtes / **jour** | une page = quelques requêtes |
| Neon (stockage) | 1 Go / projet | photos comprises |
| Neon (calcul) | 100 heures-CU / mois | la base s'endort quand personne ne l'utilise |

Ce sont des plafonds **journaliers** pour Cloudflare, mensuels pour Neon. Si
vous les dépassez, le service est bloqué jusqu'au lendemain — rien n'est
facturé sans que vous l'ayez demandé.

---

## 14. Dépannage

| Symptôme | Cause probable | Correction |
| --- | --- | --- |
| `Erreur interne du serveur` sur toutes les routes | binding `HYPERDRIVE` absent, ou mot de passe de base changé | vérifiez la liste des bindings au déploiement ; `wrangler tail` ; `hyperdrive update` |
| `You need to register a workers.dev subdomain` | sous-domaine non choisi | [section 3.3](#33-choisir-votre-sous-domaine) |
| Le Worker ne démarre pas, `require_streams` | `alias` de `body-parser` absent de `wrangler.jsonc` | piège nº 2 |
| « erreur CORS » dans le navigateur | `ORIGINES` faux (barre oblique finale, espace, `http` au lieu de `https`) | corrigez et redéployez l'API |
| `404` en rafraîchissant une page du front | `not_found_handling` absent | `"not_found_handling": "single-page-application"` |
| Les appels partent vers le mauvais domaine | front construit sans `VITE_API_URL` | reconstruisez puis redéployez |
| `Numéro ETU ou mot de passe incorrect` pour `ADMIN` | schéma non chargé, ou chargé dans une autre base | rejouez `sql/script_final.sql` sur la base d'Hyperdrive |
| Données périmées, compte supprimé encore actif | cache d'Hyperdrive actif | `hyperdrive update <id> --caching-disabled` |
| `Connection timed out` sur le port 5432 | votre réseau bloque PostgreSQL | [section 4.2](#42-si-psql-ne-passe-pas) |
| `Error 1102` | 10 ms de processeur dépassés | piège nº 1 |
| La base a disparu | projet Neon non réclamé sous 72 h | aucune récupération — recréez et rechargez le schéma |
| Les photos ont disparu après un redémarrage | stockage sur disque au lieu de la base | piège nº 3 |

---

## 15. Et en local, pendant ce temps

Rien de ce guide ne change le développement sur votre poste : PostgreSQL local,
Express sous Node, et les deux serveurs de développement de Vite.

```sh
createdb -U postgres itu_ms
psql -U postgres -d itu_ms -f sql/script_final.sql
psql -U postgres -d itu_ms -f sql/jeu_demonstration.sql   # facultatif

cd backend && cp .env.example .env    # puis renseignez PGPASSWORD et JWT_SECRET
```

`start.bat` démarre les trois services, `stop.bat` les arrête.

C'est **le même code** qui tourne en local et en ligne : seule la façon de lire
l'environnement, d'ouvrir la base et de se mettre à l'écoute diffère
(`src/index.js` d'un côté, `src/worker.js` de l'autre). Pour éprouver le Worker
sur votre poste, avec le vrai moteur de Cloudflare :

```sh
cd backend
npm run dev:worker
```
