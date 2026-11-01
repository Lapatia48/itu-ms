import { Router } from 'express';
import * as modele from './modele.js';
import * as catalogue from '../catalogue/modele.js';
import * as commandes from '../commandes/modele.js';
import { ligne } from '../../db.js';
import { authentifier, exigerProfil } from '../../middlewares/auth.js';
import { ErreurMetier, routeAsync } from '../../utils/erreurs.js';

const routes = Router();
routes.use(authentifier);

const interne = exigerProfil('GESTIONNAIRE', 'ADMIN');
const admin = exigerProfil('ADMIN');

/* ---------------- Comptes ---------------- */

routes.get('/comptes', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.lister(requete.compte));
}));

routes.get('/comptes/:id', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.detail(Number(requete.params.id), requete.compte));
}));

routes.post('/comptes', interne, routeAsync(async (requete, reponse) => {
  reponse.status(201).json(await modele.creer(requete.body, requete.compte));
}));

routes.patch('/comptes/:id', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.maj(Number(requete.params.id), requete.body, requete.compte));
}));

routes.post('/comptes/:id/mot-de-passe', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.reinitialiserMotDePasse(Number(requete.params.id), requete.compte));
}));

routes.delete('/comptes/:id', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.supprimer(Number(requete.params.id), requete.compte));
}));

/* ---------------- Corbeille ---------------- */

const RESTAURATIONS = {
  produit: (id) => catalogue.restaurerProduit(id),
  categorie: (id) => catalogue.restaurerCategorie(id),
  compte: (id) => modele.restaurer(id),
  commande: (id) => commandes.restaurerCommande(id),
  // Le declencheur fn_chk_paiement se rejoue a la remise en service : un
  // encaissement qui depasserait desormais le total reste a la corbeille.
  paiement: (id) => ligne(
    'update paiement set etat = 1, supprime_le = null, supprime_par = null where id_paiement = $1 and etat = 0',
    [id]
  ),
  avis: (id) => ligne(
    'update avis set etat = 1, supprime_le = null, supprime_par = null where id_avis = $1 and etat = 0',
    [id]
  ),
};

routes.get('/corbeille', admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.corbeille());
}));

routes.post('/corbeille/:type/:id/restaurer', admin, routeAsync(async (requete, reponse) => {
  const restaurer = RESTAURATIONS[requete.params.type];
  if (!restaurer) throw new ErreurMetier('Type inconnu.', 400);
  await restaurer(Number(requete.params.id));
  reponse.json({ restaure: true });
}));

/* ---------------- Remise a zero ---------------- */

// Reservee a l'administrateur, et la base le reverifie elle-meme
// (fn_reinitialiser refuse tout autre profil) : l'ecran n'est pas le seul
// garde-fou d'une operation irreversible.
routes.post('/reinitialiser', admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.reinitialiser(requete.compte, requete.body));
}));

/* ---------------- Parametres ---------------- */

routes.get('/parametres', interne, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.parametres());
}));

routes.patch('/parametres/:cle', admin, routeAsync(async (requete, reponse) => {
  reponse.json(await modele.majParametre(requete.params.cle, requete.body.valeur));
}));

export default routes;
