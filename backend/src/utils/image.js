import { ErreurMetier } from './erreurs.js';

// Le format se lit dans le CONTENU du fichier, jamais dans son nom ni dans le
// type annonce par le navigateur : les deux s'ecrivent librement. Un fichier
// refuse ne laisse rien derriere lui — il n'est jamais ecrit nulle part.
const SIGNATURES = [
  {
    extension: '.jpg',
    typeMime: 'image/jpeg',
    test: (o) => o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff,
  },
  {
    extension: '.png',
    typeMime: 'image/png',
    test: (o) => o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47,
  },
  {
    extension: '.webp',
    typeMime: 'image/webp',
    test: (o) => latin1(o, 0, 4) === 'RIFF' && latin1(o, 8, 12) === 'WEBP',
  },
];

function latin1(octets, debut, fin) {
  return String.fromCharCode(...octets.subarray(debut, fin));
}

export function formatImage(octets) {
  if (!octets || octets.length < 12) return null;
  return SIGNATURES.find((signature) => signature.test(octets)) || null;
}

export const TAILLE_MAX = 3 * 1024 * 1024;

// Prepare ce qui sera ecrit dans produit_image. Rien n'est stocke ici : c'est
// le modele qui l'ecrit, DANS la transaction de l'article — une photo sans son
// article n'a pas de raison d'exister, et l'inverse non plus.
export function preparerImage(fichier) {
  if (!fichier || !fichier.octets?.length) return null;

  if (fichier.octets.length > TAILLE_MAX) {
    throw new ErreurMetier('Photo trop lourde : 3 Mo au maximum.', 413);
  }
  const format = formatImage(fichier.octets);
  if (!format) {
    throw new ErreurMetier('Image non reconnue : enregistrez-la au format JPEG, PNG ou WebP.');
  }

  // Le nom est tire au depot et ne se reutilise pas : l'URL d'une photo
  // designe donc toujours le meme octet, ce qui la rend cachable sans fin et
  // evite qu'un navigateur garde l'ancienne apres un remplacement.
  const alea = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('');

  return {
    nom: `${Date.now()}-${alea}${format.extension}`,
    typeMime: format.typeMime,
    octets: Buffer.from(fichier.octets),
  };
}
