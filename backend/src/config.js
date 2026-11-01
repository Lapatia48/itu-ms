// Les valeurs de service ne sont PAS lues ici. L'API tourne sur deux
// moteurs — node en local, un Worker Cloudflare en ligne — et aucun des deux
// ne lit son environnement comme l'autre : dotenv a besoin du disque, et les
// bindings d'un Worker arrivent par « import { env } from 'cloudflare:workers' ».
// Le point d'entree lit donc l'environnement et le passe ici, une fois, avant
// que l'application ne soit construite.
export const config = {
  port: 4000,
  jwt: { secret: '', duree: '12h' },
  origines: [],
};

export function configurer(source = {}) {
  config.port = Number(source.PORT || 4000);
  config.jwt.secret = source.JWT_SECRET || '';
  config.jwt.duree = source.JWT_DUREE || '12h';
  // Les origines autorisees sont declarees : le jeton de session voyage en
  // en-tete, un « * » le rendrait lisible depuis n'importe quelle page.
  config.origines = String(source.ORIGINES || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origine) => origine.trim())
    .filter(Boolean);

  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET manquant : sans lui, n’importe qui signe un jeton.');
  }
  return config;
}
