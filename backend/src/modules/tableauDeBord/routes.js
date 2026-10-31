import { Router } from 'express';
import * as modele from './modele.js';
import { authentifier, exigerProfil } from '../../middlewares/auth.js';
import { routeAsync } from '../../utils/erreurs.js';

const routes = Router();

routes.get('/', authentifier, exigerProfil('GESTIONNAIRE', 'ADMIN'),
  routeAsync(async (requete, reponse) => {
    reponse.json(await modele.indicateurs(requete.query.periode));
  }));

export default routes;
