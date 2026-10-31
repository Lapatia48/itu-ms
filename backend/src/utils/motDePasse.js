import crypto from 'node:crypto';

// scrypt de la bibliotheque standard : pas de dependance native a compiler,
// et un cout de calcul parametre. Le sel est tire par mot de passe et voyage
// avec l'empreinte.
const PARAMS = { N: 16384, r: 8, p: 1 };
const LONGUEUR = 32;

export function empreinte(motDePasse) {
  const sel = crypto.randomBytes(16);
  const cle = crypto.scryptSync(motDePasse, sel, LONGUEUR, PARAMS);
  return `scrypt$${sel.toString('hex')}$${cle.toString('hex')}`;
}

export function verifier(motDePasse, stocke) {
  if (!stocke) return false;
  const [schema, selHex, cleHex] = String(stocke).split('$');
  if (schema !== 'scrypt' || !selHex || !cleHex) return false;
  const attendue = Buffer.from(cleHex, 'hex');
  const calculee = crypto.scryptSync(motDePasse, Buffer.from(selHex, 'hex'), attendue.length, PARAMS);
  // Comparaison a temps constant : une comparaison ordinaire revele la
  // longueur du prefixe correct.
  return crypto.timingSafeEqual(attendue, calculee);
}

// Mot de passe provisoire d'un compte ouvert par le bureau : rendu UNE fois
// dans la reponse, ecrit nulle part ailleurs. Pas de I, l, O, 0, 1 : il est
// recopie a la main depuis l'ecran.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function motDePasseProvisoire(longueur = 10) {
  const octets = crypto.randomBytes(longueur);
  let sortie = '';
  for (let index = 0; index < longueur; index += 1) {
    sortie += ALPHABET[octets[index] % ALPHABET.length];
  }
  return sortie;
}
