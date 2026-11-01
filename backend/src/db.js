import { AsyncLocalStorage } from 'node:async_hooks';

// NUMERIC arrive en chaine : c'est voulu, un montant ne passe pas par un
// double. Les ecrans le formatent, les comparaisons se font en base.
//
// Le pool n'est pas construit ici, et il n'a pas la meme duree de vie selon le
// moteur :
//
//   . en local, un seul pool sert tout le processus — c'est ce qu'il faut, les
//     connexions se reutilisent d'une requete a l'autre ;
//   . en ligne, l'API est un Worker Cloudflare, qui REFUSE qu'une socket
//     ouverte pour une requete serve a la suivante (« Cannot perform I/O on
//     behalf of a different request »). Le pool y vit donc le temps d'une
//     requete, et c'est Hyperdrive qui garde les connexions chaudes de son
//     cote.
//
// Les modeles ne connaissent ni l'un ni l'autre : ils appellent ligne(),
// lignes() et transaction(), et c'est le contexte de la requete en cours qui
// dit sur quel pool.
const contexte = new AsyncLocalStorage();
let partage = null;

export function configurerBase(instance) {
  partage = instance;
  return instance;
}

// Pose un pool pour la duree d'une requete. Le contexte suit les `await` de
// toute la chaine Express ouverte depuis `travail`.
export function avecBase(instance, travail) {
  return contexte.run(instance, travail);
}

function base() {
  const pool = contexte.getStore() || partage;
  if (!pool) throw new Error('Base non configuree : appelez configurerBase() au demarrage.');
  return pool;
}

export function query(texte, valeurs) {
  return base().query(texte, valeurs);
}

export async function lignes(texte, valeurs) {
  const { rows } = await base().query(texte, valeurs);
  return rows;
}

export async function ligne(texte, valeurs) {
  const { rows } = await base().query(texte, valeurs);
  return rows[0] || null;
}

// Tout ce qui ecrit plusieurs tables passe par la : une commande sans ses
// lignes est a moitie saisie, elle ne doit pas exister.
export async function transaction(travail) {
  const client = await base().connect();
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
  const { rows } = await base().query('select current_database() as base, now() as maintenant');
  return rows[0];
}
