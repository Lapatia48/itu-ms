import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import pg from 'pg';
import { configurer } from './config.js';
import { creerApp } from './app.js';

// Point d'entree EN LIGNE (Cloudflare Workers). Son pendant local est
// src/index.js ; l'application elle-meme est la meme, construite par
// src/app.js.
//
// Trois differences avec le local, et c'est tout :
//
//   1. l'environnement arrive des bindings du Worker, pas de .env — d'ou
//      « import { env } from 'cloudflare:workers' », seule facon de le lire
//      avant la premiere requete ;
//   2. le pool est reconstruit a CHAQUE requete : le Worker refuse qu'une
//      socket ouverte pour une requete serve a la suivante. C'est Hyperdrive,
//      devant la base, qui garde les connexions chaudes — sans lui, chaque
//      requete repaierait l'ouverture d'une connexion PostgreSQL ;
//   3. l'ecoute est interne. Le port ci-dessous ne s'ouvre sur rien : il ne
//      sert qu'a raccorder le serveur HTTP de node au Worker.
const PORT_INTERNE = 8787;

configurer(env);

function poolParRequete() {
  const chaine = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!chaine) throw new Error('Ni HYPERDRIVE ni DATABASE_URL : la base est injoignable.');
  return new pg.Pool({
    connectionString: chaine,
    // Une requete HTTP ne mene jamais plus de deux interrogations en
    // parallele, et le vrai pool est derriere Hyperdrive.
    max: 2,
  });
}

creerApp({ poolParRequete }).listen(PORT_INTERNE);

export default httpServerHandler({ port: PORT_INTERNE });
