import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { avecBase, verifierConnexion } from './db.js';
import { corps } from './middlewares/corps.js';
import { gestionnaireErreurs, routeAsync } from './utils/erreurs.js';
import { imageParNom } from './modules/catalogue/modele.js';

import auth from './modules/auth/routes.js';
import catalogue from './modules/catalogue/routes.js';
import commandes from './modules/commandes/routes.js';
import avis from './modules/avis/routes.js';
import administration from './modules/administration/routes.js';
import tableauDeBord from './modules/tableauDeBord/routes.js';

// L'application est construite ici et nulle part ailleurs : les deux points
// d'entree (src/index.js sous node, src/worker.js sur Cloudflare) ne diffe-
// rent que par la facon de lire l'environnement, d'ouvrir la base et de se
// mettre a l'ecoute. Les routes, elles, sont les memes — sans quoi « ca marche
// en local » ne voudrait rien dire.
export function creerApp({ poolParRequete } = {}) {
  const app = express();

  // CORS en tout premier, avant meme l'ouverture de la base. Un prevol OPTIONS
  // n'a aucune raison d'interroger quoi que ce soit ; et surtout, une reponse
  // d'erreur doit porter ses en-tetes CORS — sinon le navigateur annonce « erreur
  // CORS » a la place du message que l'API a pris la peine d'ecrire.
  app.use(cors({ origin: config.origines }));

  // Sur le Worker, le pool vit le temps d'une requete (voir db.js). Tout ce qui
  // interroge la base vient apres.
  if (poolParRequete) {
    app.use((requete, reponse, suite) => {
      const pool = poolParRequete();
      reponse.once('close', () => { Promise.resolve(pool.end()).catch(() => {}); });
      avecBase(pool, suite);
    });
  }

  app.use(corps());

  // Les photos d'articles sortent de la base (table produit_image) et non du
  // disque : l'API tourne sans systeme de fichiers persistant. Route ouverte,
  // comme le catalogue qu'elle illustre. Le nom est tire au depot et ne se
  // reutilise pas, donc la reponse est cachable sans fin.
  app.get('/images/:nom', routeAsync(async (requete, reponse) => {
    const image = await imageParNom(requete.params.nom);
    if (!image) return reponse.status(404).json({ message: 'Image introuvable.' });
    reponse.set('Content-Type', image.type_mime);
    reponse.set('Cache-Control', 'public, max-age=31536000, immutable');
    return reponse.send(image.octets);
  }));

  app.get('/api/v1/sante', routeAsync(async (requete, reponse) => {
    reponse.json({ service: 'itu-ms', ...(await verifierConnexion()) });
  }));

  app.use('/api/v1/auth', auth);
  app.use('/api/v1/catalogue', catalogue);
  app.use('/api/v1/commandes', commandes);
  app.use('/api/v1/avis', avis);
  app.use('/api/v1/administration', administration);
  app.use('/api/v1/tableau-de-bord', tableauDeBord);

  app.use((requete, reponse) => reponse.status(404).json({ message: 'Route inconnue.' }));
  app.use(gestionnaireErreurs);

  return app;
}
