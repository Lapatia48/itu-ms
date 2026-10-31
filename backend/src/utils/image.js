import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { ErreurMetier } from './erreurs.js';

// Le format se lit dans le CONTENU du fichier, jamais dans son nom ni dans le
// type annonce par le navigateur : les deux s'ecrivent librement. Le fichier
// est tenu en memoire tant qu'il n'est pas reconnu — un fichier refuse ne
// laisse rien derriere lui.
const SIGNATURES = [
  { extension: '.jpg', test: (o) => o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff },
  { extension: '.png', test: (o) => o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47 },
  {
    extension: '.webp',
    test: (o) => o.subarray(0, 4).toString('latin1') === 'RIFF'
      && o.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export function formatImage(octets) {
  if (!octets || octets.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(octets))?.extension || null;
}

export async function enregistrerImage(fichier) {
  if (!fichier) return null;
  const extension = formatImage(fichier.buffer);
  if (!extension) {
    throw new ErreurMetier('Image non reconnue : enregistrez-la au format JPEG, PNG ou WebP.');
  }
  const nom = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  await fs.mkdir(config.dossierImages, { recursive: true });
  await fs.writeFile(path.join(config.dossierImages, nom), fichier.buffer);
  return nom;
}

// Appelee quand la base refuse apres l'ecriture du fichier : le fichier ne
// doit pas survivre a la ligne qu'il illustrait.
export async function retirerImage(nom) {
  if (!nom) return;
  await fs.rm(path.join(config.dossierImages, path.basename(nom)), { force: true });
}
