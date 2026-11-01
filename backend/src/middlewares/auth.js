import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
import { ErreurMetier } from '../utils/erreurs.js';
import { compteActif } from '../utils/roles.js';

// jose plutot que jsonwebtoken : jose signe avec Web Crypto, present a
// l'identique sous node et dans un Worker Cloudflare, la ou jsonwebtoken passe
// par node:crypto. Un HMAC-SHA256 ne coute rien en temps processeur — ce qui
// compte sur un hebergement qui le plafonne a 10 ms par requete.
function cle() {
  return new TextEncoder().encode(config.jwt.secret);
}

export function signer(compte) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(compte.id_compte))
    .setIssuedAt()
    .setExpirationTime(config.jwt.duree)
    .sign(cle());
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
    ({ payload: charge } = await jwtVerify(jeton, cle(), { algorithms: ['HS256'] }));
  } catch {
    return null;
  }
  const idCompte = Number(charge.sub);
  if (!Number.isInteger(idCompte)) return null;
  return compteActif(idCompte);
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
