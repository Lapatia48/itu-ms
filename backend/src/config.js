import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT || 4000),
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'itu_ms',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'itu-motor-society-dev',
    duree: process.env.JWT_DUREE || '12h',
  },
  origines: (process.env.ORIGINES || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  dossierImages: path.join(racine, 'uploads'),
};
