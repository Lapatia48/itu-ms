import { Router } from 'express';
import * as modele from './modele.js';
import { authentifier, signer } from '../../middlewares/auth.js';
import { routeAsync } from '../../utils/erreurs.js';

const routes = Router();

routes.post('/connexion', routeAsync(async (requete, reponse) => {
  const compte = await modele.connexion(requete.body.etu, requete.body.motDePasse);
  reponse.json({ jeton: await signer(compte), compte });
}));

routes.post('/inscription', routeAsync(async (requete, reponse) => {
  const compte = await modele.inscription(requete.body);
  reponse.status(201).json({ jeton: await signer(compte), compte });
}));

routes.get('/moi', authentifier, (requete, reponse) => {
  reponse.json(requete.compte);
});

routes.patch('/moi', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.majProfil(requete.compte.id_compte, requete.body));
}));

routes.post('/mot-de-passe', authentifier, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.changerMotDePasse(
    requete.compte.id_compte,
    requete.body.ancien,
    requete.body.nouveau
  ));
}));

export default routes;
