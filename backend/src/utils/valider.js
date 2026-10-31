import { ErreurMetier } from './erreurs.js';

// Les longueurs sont verifiees ici, avant d'ecrire : une valeur trop longue
// refusee par la colonne remonte en 500 « erreur interne », et celui qui a
// colle trois lignes dans un champ « nom » ne sait ni lequel ni combien.

export function texte(valeur, { champ, requis = false, max = 255, min = 0 } = {}) {
  const propre = valeur === null || valeur === undefined ? '' : String(valeur).trim();
  if (!propre) {
    if (requis) throw new ErreurMetier(`${champ} : valeur obligatoire.`);
    return null;
  }
  if (propre.length < min) throw new ErreurMetier(`${champ} : ${min} caractères au minimum.`);
  if (propre.length > max) throw new ErreurMetier(`${champ} : ${max} caractères au maximum.`);
  return propre;
}

export function entier(valeur, { champ, requis = false, min = null, max = null, defaut = null } = {}) {
  if (valeur === null || valeur === undefined || valeur === '') {
    if (requis) throw new ErreurMetier(`${champ} : valeur obligatoire.`);
    return defaut;
  }
  const nombre = Number(valeur);
  if (!Number.isInteger(nombre)) throw new ErreurMetier(`${champ} : nombre entier attendu.`);
  if (min !== null && nombre < min) throw new ErreurMetier(`${champ} : minimum ${min}.`);
  if (max !== null && nombre > max) throw new ErreurMetier(`${champ} : maximum ${max}.`);
  return nombre;
}

export function montant(valeur, { champ, requis = false, min = 0 } = {}) {
  if (valeur === null || valeur === undefined || valeur === '') {
    if (requis) throw new ErreurMetier(`${champ} : valeur obligatoire.`);
    return null;
  }
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) throw new ErreurMetier(`${champ} : montant attendu.`);
  if (nombre <= min) throw new ErreurMetier(`${champ} : montant supérieur à ${min} attendu.`);
  if (nombre > 99999999) throw new ErreurMetier(`${champ} : montant trop élevé.`);
  return Math.round(nombre * 100) / 100;
}

export function codeReference(valeur, { champ, requis = true, max = 30 } = {}) {
  const propre = texte(valeur, { champ, requis, max });
  if (propre && !/^[A-Za-z0-9_-]+$/.test(propre)) {
    throw new ErreurMetier(`${champ} : lettres, chiffres, tiret et souligné seulement.`);
  }
  return propre ? propre.toUpperCase() : propre;
}

export function telephone(valeur, { requis = true } = {}) {
  const propre = texte(valeur, { champ: 'Téléphone', requis, max: 30 });
  if (propre && !/^[+0-9 ().-]{8,30}$/.test(propre)) {
    throw new ErreurMetier('Téléphone : chiffres, espaces et + seulement.');
  }
  return propre;
}

export function motDePasse(valeur, { champ = 'Mot de passe' } = {}) {
  const propre = String(valeur ?? '');
  if (propre.length < 6) throw new ErreurMetier(`${champ} : 6 caractères au minimum.`);
  if (propre.length > 72) throw new ErreurMetier(`${champ} : 72 caractères au maximum.`);
  return propre;
}

// Un PATCH est partiel : un champ absent ne touche a rien, une chaine vide
// efface. Sans le second, une valeur mal saisie serait ineffacable.
export function presente(corps, champ) {
  return Object.prototype.hasOwnProperty.call(corps, champ);
}
