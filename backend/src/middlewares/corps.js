import { ErreurMetier } from '../utils/erreurs.js';

// Lecture du corps de requete SANS body-parser (donc sans express.json ni
// express.raw). Ce n'est pas un gout : body-parser tire raw-body, qui tire
// iconv-lite, qui ne se construit pas pour le moteur Workers — le paquet
// s'arrete au demarrage sur « require_streams(...) is not a function ».
// Lire le flux nous-memes tient en vingt lignes et evite d'avoir deux
// comportements selon le moteur.
//
// Le corps est bufferise une seule fois, ici, et sert ensuite au JSON comme au
// multipart : un flux deja consomme ne se relit pas.
const MEGA = 1024 * 1024;

// Un formulaire de depot porte une photo (3 Mo admis) plus son enveloppe et
// ses champs texte ; tout le reste du trafic est du JSON de quelques kilos.
const LIMITES = { 'multipart/form-data': 4 * MEGA, defaut: MEGA };

export function corps() {
  return async (requete, reponse, suite) => {
    try {
      if (requete.method === 'GET' || requete.method === 'HEAD') {
        requete.body = {};
        return suite();
      }

      const type = String(requete.headers['content-type'] || '')
        .split(';')[0].trim().toLowerCase();
      const octets = await lireFlux(requete, LIMITES[type] ?? LIMITES.defaut);
      requete.corpsBrut = octets;
      requete.body = {};

      if (octets.length && type === 'application/json') {
        try {
          requete.body = JSON.parse(octets.toString('utf8'));
        } catch {
          throw new ErreurMetier('Corps de requête illisible : du JSON était attendu.', 400);
        }
      }
      return suite();
    } catch (erreur) {
      return suite(erreur);
    }
  };
}

function lireFlux(requete, limite) {
  return new Promise((resoudre, rejeter) => {
    const morceaux = [];
    let total = 0;
    let fini = false;

    requete.on('data', (morceau) => {
      if (fini) return;
      total += morceau.length;
      // Refuse des le depassement plutot qu'apres avoir tout recu : sinon la
      // limite ne protege plus de rien.
      if (total > limite) {
        fini = true;
        requete.destroy();
        rejeter(new ErreurMetier('Contenu trop lourd : 3 Mo au maximum pour une photo.', 413));
        return;
      }
      morceaux.push(morceau);
    });
    requete.on('end', () => { if (!fini) { fini = true; resoudre(Buffer.concat(morceaux)); } });
    requete.on('error', (erreur) => { if (!fini) { fini = true; rejeter(erreur); } });
  });
}
