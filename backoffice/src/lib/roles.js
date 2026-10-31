// Miroir d'affichage de backend/src/utils/roles.js. Ce qui est cache ici
// reste refuse la-bas : un bouton absent n'est pas une protection, c'est du
// confort de lecture.
export const LIBELLE_PROFIL = {
  CLIENT: 'Étudiant',
  GESTIONNAIRE: 'Gestionnaire',
  ADMIN: 'Administrateur',
};

const DROITS = {
  GESTIONNAIRE: ['commandes', 'encaisser', 'clients', 'tableauDeBord'],
  ADMIN: ['commandes', 'clients', 'catalogue', 'comptes', 'corbeille', 'parametres', 'tableauDeBord'],
};

export function peut(profil, droit) {
  return (DROITS[profil] || []).includes(droit);
}
