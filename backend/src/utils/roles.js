import { ErreurMetier } from './erreurs.js';
import { ligne, lignes } from '../db.js';

export const PROFILS = ['CLIENT', 'GESTIONNAIRE', 'ADMIN'];

// Qui fait quoi (12/10/2026). Celui qui tient la caisse ne tient pas le
// catalogue, et personne ne peut tout faire :
//   . CLIENT       commande, suit ses commandes, note ce qu'il a recu ;
//   . GESTIONNAIRE le guichet et la caisse : commandes, encaissements,
//                  passages de statut, comptes etudiants ;
//   . ADMIN        le catalogue, les categories, les comptes internes, la
//                  corbeille, le tableau de bord et les parametres.
// Les droits de passage d'un statut a l'autre ne sont pas ici : ils vivent
// dans transition_commande_profil, relus en base a chaque appel.
const DROITS = {
  CLIENT: ['commander', 'noter'],
  GESTIONNAIRE: ['commandes', 'encaisser', 'clients', 'tableauDeBord'],
  ADMIN: ['commandes', 'clients', 'catalogue', 'comptes', 'corbeille', 'parametres', 'tableauDeBord'],
};

export function peut(profil, droit) {
  return (DROITS[profil] || []).includes(droit);
}

// Relu dans le modele et pas seulement dans la route : les scripts et les
// taches appellent les modeles directement.
export function exiger(compte, droit) {
  if (!compte) throw new ErreurMetier('Connexion requise.', 401);
  if (!peut(compte.profil, droit)) {
    throw new ErreurMetier('Votre profil ne permet pas cette action.', 403);
  }
}

export function estInterne(compte) {
  return compte?.profil === 'GESTIONNAIRE' || compte?.profil === 'ADMIN';
}

// Les passages possibles depuis un statut, et pour chacun si le profil y a
// droit. Un passage interdit reste affiche grise avec son motif : jamais un
// bouton qui echoue au clic.
export function transitionsPossibles(codeDepuis, profil) {
  return lignes(
    `select t.code_vers, t.libelle, s.libelle as statut_libelle, s.ton,
            exists (select 1 from transition_commande_profil p
                     where p.code_depuis = t.code_depuis
                       and p.code_vers = t.code_vers
                       and p.profil = $2) as autorise
       from transition_commande t
       join statut_commande s on s.code = t.code_vers
      where t.code_depuis = $1
      order by s.ordre`,
    [codeDepuis, profil]
  );
}

export function compteActif(idCompte) {
  return ligne(
    `select id_compte, etu, nom, prenom, promotion, telephone, profil, etat, cree_le
       from compte where id_compte = $1 and etat = 1`,
    [idCompte]
  );
}
