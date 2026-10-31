import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ErreurMetier } from '../utils/erreurs.js';
import { compteActif } from '../utils/roles.js';

export function signer(compte) {
  return jwt.sign({ sub: compte.id_compte }, config.jwt.secret, { expiresIn: config.jwt.duree });
}

function jetonDe(requete) {
  const entete = requete.headers.authorization || '';
  return entete.startsWith('Bearer ') ? entete.slice(7) : null;
}

// Le profil est relu EN BASE a chaque appel, jamais pris dans le jeton : un
// compte retrograde ou parti a la corbeille perd ses droits sans attendre
// l'expiration de son jeton.
async function lire(requete) {
  const jeton = jetonDe(requete);
  if (!jeton) return null;
  let charge;
  try {
    charge = jwt.verify(jeton, config.jwt.secret);
  } catch {
    return null;
  }
  return compteActif(charge.sub);
}

export async function authentifier(requete, reponse, suite) {
  try {
    const compte = await lire(requete);
    if (!compte) throw new ErreurMetier('Session expirée, reconnectez-vous.', 401);
    requete.compte = compte;
    suite();
  } catch (erreur) {
    suite(erreur);
  }
}

// Pour les routes ouvertes a tous dont la reponse change quand on est connecte
// (le catalogue dit alors ce qu'on peut noter).
export async function authentifierSiPossible(requete, reponse, suite) {
  try {
    requete.compte = await lire(requete);
    suite();
  } catch (erreur) {
    suite(erreur);
  }
}

export function exigerProfil(...profils) {
  return (requete, reponse, suite) => {
    if (!requete.compte) return suite(new ErreurMetier('Connexion requise.', 401));
    if (!profils.includes(requete.compte.profil)) {
      return suite(new ErreurMetier('Votre profil ne permet pas cette action.', 403));
    }
    return suite();
  };
}
