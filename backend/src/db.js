import pg from 'pg';
import { config } from './config.js';

// NUMERIC arrive en chaine : c'est voulu, un montant ne passe pas par un
// double. Les ecrans le formatent, les comparaisons se font en base.
const pool = new pg.Pool({
  host: config.pg.host,
  port: config.pg.port,
  database: config.pg.database,
  user: config.pg.user,
  password: config.pg.password,
  max: 10,
});

export function query(texte, valeurs) {
  return pool.query(texte, valeurs);
}

export async function lignes(texte, valeurs) {
  const { rows } = await pool.query(texte, valeurs);
  return rows;
}

export async function ligne(texte, valeurs) {
  const { rows } = await pool.query(texte, valeurs);
  return rows[0] || null;
}

// Tout ce qui ecrit plusieurs tables passe par la : une commande sans ses
// lignes est a moitie saisie, elle ne doit pas exister.
export async function transaction(travail) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const resultat = await travail(client);
    await client.query('commit');
    return resultat;
  } catch (erreur) {
    await client.query('rollback');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function verifierConnexion() {
  const { rows } = await pool.query('select current_database() as base, now() as maintenant');
  return rows[0];
}

export default pool;
