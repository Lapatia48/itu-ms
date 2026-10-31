import { Router } from 'express';
import * as modele from './modele.js';
import { authentifier, exigerProfil } from '../../middlewares/auth.js';
import { routeAsync } from '../../utils/erreurs.js';

const routes = Router();
routes.use(authentifier);

const interne = exigerProfil('GESTIONNAIRE', 'ADMIN');

routes.get('/', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.lister(requete.compte));
}));

routes.get('/modes-paiement', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.listerModesPaiement());
}));

routes.get('/workflow', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.workflow());
}));

routes.get('/:id', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.detail(Number(requete.params.id), requete.compte));
}));

routes.post('/', exigerProfil('CLIENT'), routeAsync(async (requete, reponse) => {
  reponse.status(201).json(await modele.creer(requete.compte, requete.body));
}));

// Le droit de franchir ce passage se lit dans transition_commande_profil :
// un client annule sa commande tant que rien n'est lance, le guichet fait le
// reste. La base refuse le passage si le profil n'y a pas droit.
routes.post('/:id/statuts', routeAsync(async (requete, reponse) => {
  reponse.json(await modele.changerStatut(Number(requete.params.id), requete.body, requete.compte));
}));

routes.post('/:id/paiements', interne, routeAsync(async (requete, reponse) => {
  reponse.status(201).json(await modele.ajouterPaiement(Number(requete.params.id), requete.body, requete.compte));
}));

routes.delete('/paiements/:id', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimerPaiement(Number(requete.params.id), requete.compte));
}));

routes.delete('/:id', exigerProfil('ADMIN'), routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimerCommande(Number(requete.params.id), requete.compte));
}));

export default routes;
