import { Router } from 'express';
import * as modele from './modele.js';
import { authentifier, exigerProfil } from '../../middlewares/auth.js';
import { routeAsync } from '../../utils/erreurs.js';

const routes = Router();

// La liste complete sert la console ; la boutique lit les avis d'un article
// par sa fiche (GET /catalogue/produits/:id).
routes.get('/', authentifier, exigerProfil('GESTIONNAIRE', 'ADMIN'), routeAsync(async (requete, reponse) => {
  reponse.json(await modele.lister());
}));

routes.get('/notables', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.articlesNotables(requete.compte.id_compte));
}));

routes.get('/miens', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.mesAvis(requete.compte.id_compte));
}));

routes.post('/', authentifier, exigerProfil('CLIENT'), routeAsync(async (requete, reponse) => {
  reponse.status(201).json(await modele.creer(requete.compte.id_compte, requete.body));
}));

routes.patch('/:id', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.maj(Number(requete.params.id), requete.compte, requete.body));
}));

routes.delete('/:id', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimer(Number(requete.params.id), requete.compte));
}));

export default routes;
