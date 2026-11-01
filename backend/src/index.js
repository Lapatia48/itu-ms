import 'dotenv/config';
import pg from 'pg';
import { config, configurer } from './config.js';
import { configurerBase } from './db.js';
import { creerApp } from './app.js';

// Point d'entree LOCAL. Il lit .env, ouvre un pool unique pour tout le
// processus et se met a l'ecoute. Son pendant en ligne est src/worker.js.
configurer(process.env);

configurerBase(new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'itu_ms',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  max: 10,
}));

const serveur = creerApp().listen(config.port, () => {
  console.log(`API ITU Motor Society : http://localhost:${config.port}/api/v1`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => serveur.close(() => process.exit(0)));
}
