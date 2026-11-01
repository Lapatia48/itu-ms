import { Router } from 'express';
import * as modele from './modele.js';
import { authentifier, exigerProfil } from '../../middlewares/auth.js';
import { multipart } from '../../middlewares/multipart.js';
import { routeAsync } from '../../utils/erreurs.js';
import { preparerImage } from '../../utils/image.js';

const routes = Router();

// Le fichier reste en memoire tant que son format n'est pas reconnu, et il
// n'est ecrit qu'avec la ligne qu'il illustre : un fichier refuse ne laisse
// rien derriere lui.
const depotPhoto = multipart('image');

const admin = [authentifier, exigerProfil('ADMIN')];

routes.get('/produits', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.listerProduits());
}));

routes.get('/produits/:id', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.produit(Number(requete.params.id)));
}));

routes.post('/produits', ...admin, depotPhoto, routeAsync(async (requete, reponse) => {
  const image = preparerImage(requete.fichier);
  reponse.status(201).json(await modele.creerProduit(lireCorps(requete), image));
}));

routes.patch('/produits/:id', ...admin, depotPhoto, routeAsync(async (requete, reponse) => {
  const image = preparerImage(requete.fichier);
  reponse.json(await modele.majProduit(Number(requete.params.id), lireCorps(requete), image));
}));

routes.delete('/produits/:id', ...admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimerProduit(Number(requete.params.id), requete.compte.id_compte));
}));

routes.post('/produits/:id/restaurer', ...admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.restaurerProduit(Number(requete.params.id)));
}));

routes.get('/categories', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.listerCategories());
}));

routes.post('/categories', ...admin, routeAsync(async (requete, reponse) => {
  reponse.status(201).json(await modele.creerCategorie(requete.body));
}));

routes.patch('/categories/:id', ...admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.majCategorie(Number(requete.params.id), requete.body));
}));

routes.delete('/categories/:id', ...admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimerCategorie(Number(requete.params.id), requete.compte.id_compte));
}));

routes.get('/tailles', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.listerTailles());
}));

// Un formulaire multipart ne transporte que du texte : les tailles arrivent
// en JSON dans un champ, le reste en chaines.
function lireCorps(requete) {
  const corps = { ...requete.body };
  if (typeof corps.tailles === 'string') {
    try {
      corps.tailles = JSON.parse(corps.tailles);
    } catch {
      corps.tailles = corps.tailles.split(',').filter(Boolean);
    }
  }
  return corps;
}

export default routes;
