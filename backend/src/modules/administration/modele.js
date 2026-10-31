import { ligne, lignes } from '../../db.js';
import { ErreurMetier } from '../../utils/erreurs.js';
import { empreinte, motDePasseProvisoire } from '../../utils/motDePasse.js';
import * as valider from '../../utils/valider.js';

const CHAMPS = `c.id_compte, c.etu, c.nom, c.prenom, c.promotion, c.telephone, c.profil,
                c.etat, c.cree_le, c.supprime_le`;

/* ---------------- Comptes ---------------- */

// Le gestionnaire tient le guichet : il voit les etudiants. L'administrateur
// tient aussi les comptes du bureau.
export function lister(compte, { tout = false } = {}) {
  const interneVisible = compte.profil === 'ADMIN';
  return lignes(
    `select ${CHAMPS},
            co.nb_commandes, co.total_commande, co.reste_a_payer, co.derniere_commande
       from compte c
       left join lateral (
            select count(*)::int as nb_commandes,
                   coalesce(sum(v.total), 0) as total_commande,
                   coalesce(sum(v.reste_a_payer), 0) as reste_a_payer,
                   max(v.cree_le) as derniere_commande
              from v_commande v where v.id_compte = c.id_compte and v.etat = 1
       ) co on true
      where ($2 or c.etat = 1)
        and ($1 or c.profil = 'CLIENT')
      order by c.profil, c.nom, c.prenom`,
    [interneVisible, tout]
  );
}

export async function detail(idCompte, compte) {
  const fiche = await ligne(
    `select ${CHAMPS} from compte c where c.id_compte = $1`,
    [idCompte]
  );
  if (!fiche) throw new ErreurMetier('Compte introuvable.', 404);
  if (fiche.profil !== 'CLIENT' && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Compte introuvable.', 404);
  }
  fiche.commandes = await lignes(
    `select id_commande, reference, cree_le, code_statut, statut_libelle, statut_ton,
            total, paye, reste_a_payer
       from v_commande where id_compte = $1 and etat = 1 order by cree_le desc`,
    [idCompte]
  );
  return fiche;
}

// Un compte ouvert au guichet recoit un mot de passe provisoire rendu UNE
// fois, dans cette reponse : il n'est ecrit nulle part ailleurs.
export async function creer(corps, compte) {
  const profil = valider.codeReference(corps.profil, { champ: 'Profil', max: 20 });
  if (!['CLIENT', 'GESTIONNAIRE', 'ADMIN'].includes(profil)) {
    throw new ErreurMetier('Profil inconnu.');
  }
  if (profil !== 'CLIENT' && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Seul un administrateur ouvre un compte interne.', 403);
  }

  const provisoire = motDePasseProvisoire();
  const cree = await ligne(
    `insert into compte (etu, nom, prenom, promotion, telephone, mot_de_passe, profil)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id_compte, etu, nom, prenom, promotion, telephone, profil, cree_le`,
    [
      valider.codeReference(corps.etu, { champ: 'Numéro ETU', max: 20 }),
      valider.texte(corps.nom, { champ: 'Nom', requis: true, max: 60 }),
      valider.texte(corps.prenom, { champ: 'Prénom', requis: true, max: 60 }),
      valider.texte(corps.promotion, { champ: 'Promotion', requis: true, max: 60 }),
      valider.telephone(corps.telephone),
      empreinte(provisoire),
      profil,
    ]
  );
  return { ...cree, motDePasseProvisoire: provisoire };
}

export async function maj(idCompte, corps, compte) {
  const cible = await ligne('select id_compte, profil from compte where id_compte = $1 and etat = 1', [idCompte]);
  if (!cible) throw new ErreurMetier('Compte introuvable.', 404);
  if (cible.profil !== 'CLIENT' && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Compte introuvable.', 404);
  }

  let profil = cible.profil;
  if (valider.presente(corps, 'profil') && corps.profil !== cible.profil) {
    if (compte.profil !== 'ADMIN') throw new ErreurMetier('Seul un administrateur change un profil.', 403);
    if (idCompte === compte.id_compte) throw new ErreurMetier('On ne change pas son propre profil.', 409);
    profil = valider.codeReference(corps.profil, { champ: 'Profil', max: 20 });
  }

  return ligne(
    `update compte set nom = $2, prenom = $3, promotion = $4, telephone = $5, profil = $6
      where id_compte = $1 and etat = 1
      returning id_compte, etu, nom, prenom, promotion, telephone, profil, cree_le`,
    [
      idCompte,
      valider.texte(corps.nom, { champ: 'Nom', requis: true, max: 60 }),
      valider.texte(corps.prenom, { champ: 'Prénom', requis: true, max: 60 }),
      valider.texte(corps.promotion, { champ: 'Promotion', requis: true, max: 60 }),
      valider.telephone(corps.telephone),
      profil,
    ]
  );
}

export async function reinitialiserMotDePasse(idCompte, compte) {
  const cible = await ligne('select profil from compte where id_compte = $1 and etat = 1', [idCompte]);
  if (!cible) throw new ErreurMetier('Compte introuvable.', 404);
  if (cible.profil !== 'CLIENT' && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Compte introuvable.', 404);
  }
  const provisoire = motDePasseProvisoire();
  await ligne('update compte set mot_de_passe = $2 where id_compte = $1', [idCompte, empreinte(provisoire)]);
  return { motDePasseProvisoire: provisoire };
}

export async function supprimer(idCompte, compte) {
  if (idCompte === compte.id_compte) throw new ErreurMetier('On ne supprime pas son propre compte.', 409);
  const cible = await ligne('select profil from compte where id_compte = $1 and etat = 1', [idCompte]);
  if (!cible) throw new ErreurMetier('Compte introuvable.', 404);
  if (cible.profil !== 'CLIENT' && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Compte introuvable.', 404);
  }
  await ligne(
    'update compte set etat = 0, supprime_le = now(), supprime_par = $2 where id_compte = $1',
    [idCompte, compte.id_compte]
  );
  return { supprime: true };
}

export async function restaurer(idCompte) {
  const repris = await ligne(
    `select 1 from compte vivant
      where vivant.etat = 1
        and upper(vivant.etu) = (select upper(etu) from compte where id_compte = $1)`,
    [idCompte]
  );
  if (repris) throw new ErreurMetier('Ce numéro ETU a été repris par un autre compte.', 409);
  await ligne(
    `update compte set etat = 1, supprime_le = null, supprime_par = null
      where id_compte = $1 and etat = 0`,
    [idCompte]
  );
  return { restaure: true };
}

/* ---------------- Corbeille ---------------- */

export function corbeille() {
  return lignes(
    `select c.*, a.prenom || ' ' || a.nom as auteur
       from v_corbeille c
       left join compte a on a.id_compte = c.supprime_par
      order by c.supprime_le desc nulls last`
  );
}

/* ---------------- Parametres ---------------- */

export function parametres() {
  return lignes('select cle, valeur, libelle, maj_le from parametre order by cle');
}

export async function majParametre(cle, valeur) {
  const propre = valider.texte(valeur, { champ: 'Valeur', requis: true, max: 100 });
  if (cle === 'acompte_minimum') {
    const part = Number(propre);
    if (!Number.isFinite(part) || part < 0 || part > 100) {
      throw new ErreurMetier('Acompte minimum : de 0 à 100 %.');
    }
  }
  const sortie = await ligne(
    'update parametre set valeur = $2, maj_le = now() where cle = $1 returning cle, valeur, libelle, maj_le',
    [cle, propre]
  );
  if (!sortie) throw new ErreurMetier('Paramètre introuvable.', 404);
  return sortie;
}
