// Une erreur metier porte son message tel qu'il sera lu a l'ecran : c'est la
// seule facon qu'un refus soit corrigeable par celui qui le lit.
export class ErreurMetier extends Error {
  constructor(message, statut = 400, details = undefined) {
    super(message);
    this.name = 'ErreurMetier';
    this.statut = statut;
    this.details = details;
  }
}

// Contraintes nommees de la base : leur message natif (« violates check
// constraint chk_ligne_quantite ») ne dit rien a personne.
const CONTRAINTES = {
  uq_compte_etu: 'Ce numéro ETU a déjà un compte.',
  uq_categorie_code: 'Ce code de catégorie existe déjà.',
  uq_taille_code: 'Ce code de taille existe déjà.',
  uq_avis_produit_compte: 'Vous avez déjà noté cet article.',
  produit_reference_key: 'Cette référence d’article existe déjà.',
  commande_reference_key: 'Cette référence de commande existe déjà.',
  chk_compte_profil: 'Profil inconnu.',
  chk_produit_prix: 'Le prix doit être supérieur à zéro.',
  chk_ligne_quantite: 'La quantité doit être comprise entre 1 et 99.',
  chk_paiement_montant: 'Le montant doit être supérieur à zéro.',
  chk_avis_note: 'La note va de 1 à 5.',
};

// Les declencheurs de la base levent des messages deja ecrits pour l'ecran
// (« Solde restant : 155 000 Ar. »). On les laisse passer tels quels.
export function erreurPostgres(erreur) {
  const { code, constraint, message } = erreur;

  if (constraint && CONTRAINTES[constraint]) {
    return new ErreurMetier(CONTRAINTES[constraint], code === '23505' ? 409 : 400);
  }

  switch (code) {
    case '23505':
      return new ErreurMetier('Cet enregistrement existe déjà.', 409);
    case '23503':
      return new ErreurMetier('Cet élément est utilisé ailleurs.', 409);
    case '22001':
      return new ErreurMetier('Une valeur dépasse la longueur admise.', 400);
    case '42501':
      return new ErreurMetier(message, 403);
    case '23514':
    case 'P0001':
      return new ErreurMetier(message, 400);
    default:
      return null;
  }
}

export function gestionnaireErreurs(erreur, requete, reponse, suite) { // eslint-disable-line no-unused-vars
  const traduite = erreur instanceof ErreurMetier ? erreur : erreurPostgres(erreur);

  if (traduite) {
    return reponse.status(traduite.statut).json({
      message: traduite.message,
      details: traduite.details,
    });
  }

  console.error('[erreur]', erreur);
  return reponse.status(500).json({ message: 'Erreur interne du serveur.' });
}

// Enveloppe les routes asynchrones : sans elle, une promesse rejetee ne
// remonte pas au gestionnaire d'erreurs d'Express 4.
export function routeAsync(gestion) {
  return (requete, reponse, suite) => Promise.resolve(gestion(requete, reponse, suite)).catch(suite);
}
