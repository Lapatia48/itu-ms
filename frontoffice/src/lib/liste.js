import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Socle commun de toutes les listes : filtrage multicritere et decoupage en
// pages de dix.
//
// Le serveur renvoie le perimetre complet auquel l'utilisateur a droit ; le
// filtrage et la pagination se font ici. C'est un choix, pas un oubli.
// Au-dessus de la plupart des tableaux il y a des compteurs — « reste a
// encaisser », « alertes a trancher », « sous exclusion » — qui decrivent la
// selection entiere. Les calculer sur les dix lignes de la page courante
// donnerait des chiffres faux ; les demander au serveur en plus de la page
// doublerait chaque appel. Tant qu'un ecran tient dans une reponse, filtrer
// dans le navigateur garde les totaux justes et rend le filtre instantane.

export const TAILLE_PAGE = 10;

/* ---------------- Comparaison de texte ---------------- */

// Casse et accents ignores : « Rakotoarisoa » se trouve en tapant
// « rakotoarisoa », « prejudice » trouve « prejudice » comme « préjudice ».
// Une recherche qui exige les accents ne sert a rien sur un clavier de
// telephone.
export function normaliser(valeur) {
  return String(valeur ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function estRenseigne(valeur) {
  return valeur !== '' && valeur !== null && valeur !== undefined;
}

function valeurDefaut(critere) {
  return critere.defaut ?? '';
}

/* ---------------- Criteres ----------------

   Un critere decrit a la fois le champ affiche dans le panneau de filtres et
   la facon de l'appliquer a une ligne. Un seul objet, pas deux listes a tenir
   synchronisees.

     cle          nom du critere dans l'etat du formulaire
     libelle      etiquette du champ, reprise telle quelle dans la puce
     type         'texte' | 'select' | 'date' | 'nombre' | 'bascule'
     champ        colonne de la ligne comparee (defaut : `cle`)
     champs       pour 'texte' : les colonnes balayees par la recherche
     borne        pour 'date' et 'nombre' : 'min' (defaut) ou 'max'
     unite        pour 'nombre' : 'Ar', 'mois'... affichee dans le champ et la puce
     options      pour 'select' : [{ value, label }]
     vide         pour 'select' : libelle de l'option « tous »
     defaut       valeur au chargement de l'ecran, et valeur de reprise
     test         predicat maison, prioritaire sur tout le reste

   Un critere dont la valeur est vide ne filtre rien : c'est ce qui permet
   d'en declarer huit sans que la liste par defaut soit restreinte.          */

function teste(critere, valeur, ligne) {
  if (critere.test) return critere.test(ligne, valeur);

  const brut = ligne[critere.champ ?? critere.cle];

  if (critere.type === 'texte') {
    const terme = normaliser(valeur).trim();
    if (!terme) return true;
    const champs = critere.champs || [critere.champ ?? critere.cle];
    return champs.some((champ) => normaliser(ligne[champ]).includes(terme));
  }

  if (critere.type === 'date') {
    const jour = String(brut ?? '').slice(0, 10);
    // Une ligne sans date ne peut pas satisfaire une borne de date : elle sort
    // de la selection plutot que d'y rester par defaut.
    if (!jour) return false;
    return critere.borne === 'max' ? jour <= valeur : jour >= valeur;
  }

  if (critere.type === 'nombre') {
    const nombre = Number(brut);
    if (!Number.isFinite(nombre)) return false;
    return critere.borne === 'max' ? nombre <= Number(valeur) : nombre >= Number(valeur);
  }

  if (critere.type === 'bascule') return Boolean(brut);

  return String(brut ?? '') === String(valeur);
}

// Ce que la puce affiche une fois le critere pose. Un select montre le libelle
// de l'option choisie, pas son code : « Statut : En attente d'activation »,
// jamais « statut : EN_ATTENTE ».
export function libelleFiltre(critere, valeur) {
  if (critere.type === 'bascule') return critere.libelle;
  if (critere.type === 'select') {
    const option = (critere.options || []).find((o) => String(o.value) === String(valeur));
    // Les options d'un select arrivent d'un referentiel : le temps qu'elles
    // soient la, on montre la valeur brute plutot qu'un libelle faux.
    if (option) return `${critere.libelle} : ${option.label}`;
    if (estRenseigne(valeur)) return `${critere.libelle} : ${valeur}`;
    return `${critere.libelle} : ${critere.vide || 'tous'}`;
  }
  if (critere.type === 'texte') return `${critere.libelle} : « ${valeur} »`;
  // Une date se lit comme partout ailleurs dans l'application : 01/09/2026,
  // pas 2026-09-01.
  if (critere.type === 'date') return `${critere.libelle} : ${String(valeur).split('-').reverse().join('/')}`;
  if (critere.type === 'nombre') {
    const nombre = Number(valeur).toLocaleString('fr-FR');
    return `${critere.libelle} : ${nombre}${critere.unite ? ` ${critere.unite}` : ''}`;
  }
  return `${critere.libelle} : ${valeur}`;
}

// Valeurs de depart lues dans l'adresse de la page.
//
// Un lien peut decrire une selection : « /catalogue?categorie=3 » ouvre la
// liste deja filtree - c'est ce qui permet a une tuile de l'accueil de mener
// aux articles qu'elle annonce. Des qu'un critere figure dans l'adresse,
// l'adresse decrit la selection ENTIERE : les defauts de l'ecran ne s'y
// ajoutent pas. Sans cette regle, un lien « commandes annulees » s'ouvrirait
// aussi filtre sur « en cours » et n'afficherait rien, en contradiction avec
// le chiffre sur lequel on vient de cliquer.
function valeursAdresse(criteres) {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!criteres.some((critere) => params.has(critere.cle))) return null;
  return Object.fromEntries(criteres.map((critere) => [critere.cle, params.get(critere.cle) ?? '']));
}

/* ---------------- Etat du panneau de filtres ---------------- */

export function useFiltres(criteres) {
  // `defaut` n'est qu'un etat de depart — la vue de travail d'un ecran, comme
  // « commandes en cours » sur le suivi. Il ne survit pas a « Tout
  // effacer » : ce bouton doit rendre la liste entiere, sinon il ment.
  const initiales = useMemo(
    () => Object.fromEntries(criteres.map((c) => [c.cle, valeurDefaut(c)])),
    [criteres]
  );
  const vides = useMemo(
    () => Object.fromEntries(criteres.map((c) => [c.cle, ''])),
    [criteres]
  );

  // Les valeurs de depart sont lues une seule fois : les options d'un select
  // arrivent apres coup (elles viennent d'un referentiel), ce qui recree le
  // tableau `criteres` sans que la saisie en cours doive etre perdue.
  // L'adresse l'emporte sur les defauts quand elle porte un critere.
  const [valeurs, setValeurs] = useState(() => valeursAdresse(criteres) ?? initiales);

  const set = useCallback((cle, valeur) => {
    setValeurs((precedent) => ({ ...precedent, [cle]: valeur }));
  }, []);

  const reset = useCallback(() => setValeurs(vides), [vides]);

  // Est « actif » tout critere qui restreint reellement la liste en ce moment,
  // le defaut d'ouverture compris. C'est la seule definition utile : un ecran
  // qui s'ouvre deja filtre doit le dire, sans quoi sa liste courte se lit
  // comme une liste vide — exactement le risque qu'on prend en rangeant les
  // criteres hors de vue.
  const actifs = criteres.filter((critere) => estRenseigne(valeurs[critere.cle]));

  // Change des qu'un critere bouge. Sert de cle de remise a zero de la
  // pagination : rester en page 4 d'une liste qui vient de tomber a six lignes
  // n'afficherait rien.
  const empreinte = JSON.stringify(valeurs);

  return { criteres, valeurs, set, reset, actifs, empreinte };
}

// Meme contrat que useFiltres, mais l'etat EST l'adresse de la page : chaque
// critere pose s'y inscrit, et la vue se partage ou se retrouve en favori telle
// qu'on la regarde. Reserve aux ecrans d'analyse (le tableau de bord), ou une
// vue filtree est une chose qu'on s'envoie. Une liste de travail garde
// useFiltres : y reecrire l'adresse a chaque frappe n'apporterait rien.
// Pas de `defaut` ici - une adresse sans parametre est la vue non filtree.
export function useFiltresUrl(criteres) {
  const [params, setParams] = useSearchParams();

  const valeurs = Object.fromEntries(criteres.map((c) => [c.cle, params.get(c.cle) ?? '']));

  const set = useCallback((cle, valeur) => {
    setParams((precedent) => {
      const suivant = new URLSearchParams(precedent);
      if (estRenseigne(valeur)) suivant.set(cle, valeur);
      else suivant.delete(cle);
      return suivant;
    }, { replace: true });
  }, [setParams]);

  const reset = useCallback(() => {
    setParams((precedent) => {
      const suivant = new URLSearchParams(precedent);
      criteres.forEach((critere) => suivant.delete(critere.cle));
      return suivant;
    }, { replace: true });
  }, [setParams, criteres]);

  const actifs = criteres.filter((critere) => estRenseigne(valeurs[critere.cle]));
  const empreinte = JSON.stringify(valeurs);

  return { criteres, valeurs, set, reset, actifs, empreinte };
}

// Applique les criteres renseignes. Ceux qui sont vides ne filtrent rien.
export function filtrer(lignes, filtres) {
  const source = lignes || [];
  if (!filtres) return source;
  const poses = filtres.criteres.filter((critere) => estRenseigne(filtres.valeurs[critere.cle]));
  if (poses.length === 0) return source;
  return source.filter((ligne) =>
    poses.every((critere) => teste(critere, filtres.valeurs[critere.cle], ligne))
  );
}

/* ---------------- Pagination ---------------- */

export function usePagination(lignes, { taille = TAILLE_PAGE, cle = '' } = {}) {
  const [page, setPage] = useState(1);

  // Retour en page 1 des que le perimetre change (un filtre pose, un onglet
  // change). Corrige pendant le rendu et non dans un effet : un effet laisserait
  // afficher une page vide le temps d'un rendu avant de se raviser. React
  // abandonne le rendu en cours et recommence aussitot, sans passage a l'ecran.
  const [clePrecedente, setClePrecedente] = useState(cle);
  let demandee = page;
  if (clePrecedente !== cle) {
    setClePrecedente(cle);
    setPage(1);
    demandee = 1;
  }

  const total = lignes?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / taille));
  // La page memorisee peut ne plus exister — derniere ligne supprimee, filtre
  // qui resserre. On la ramene dans les bornes au calcul.
  const courante = Math.min(Math.max(1, demandee), pages);
  const debut = (courante - 1) * taille;

  const tranche = useMemo(
    () => (lignes || []).slice(debut, debut + taille),
    [lignes, debut, taille]
  );

  return { page: courante, pages, total, taille, debut, tranche, allerA: setPage };
}

// Les numeros a montrer autour de la page courante. Au-dela de sept pages, on
// garde les extremites et les voisines immediates, le reste passe en points de
// suspension (representes par `null`).
export function fenetrePages(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const numeros = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => numeros.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => numeros.add(n));

  const tries = [...numeros].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const sortie = [];
  let precedent = 0;
  for (const numero of tries) {
    if (numero - precedent > 1) sortie.push(null);
    sortie.push(numero);
    precedent = numero;
  }
  return sortie;
}
