import { ligne, lignes } from '../../db.js';
import { ErreurMetier } from '../../utils/erreurs.js';
import * as valider from '../../utils/valider.js';

export function lister({ tout = false } = {}) {
  return lignes(
    `select * from v_avis where ($1 or etat = 1) order by cree_le desc`,
    [tout]
  );
}

export function mesAvis(idCompte) {
  return lignes(
    `select a.*, p.image
       from v_avis a join produit p on p.id_produit = a.id_produit
      where a.id_compte = $1 and a.etat = 1
      order by a.cree_le desc`,
    [idCompte]
  );
}

// Ce que l'etudiant peut noter : ce qu'il a recu et qu'il n'a pas encore note.
// La meme condition que le declencheur fn_chk_avis, dite a l'ecran avant le
// refus plutot qu'apres.
export function articlesNotables(idCompte) {
  return lignes(
    `select distinct p.id_produit, p.nom as produit, p.reference, p.image, p.prix,
            c.reference as commande, c.date_statut as livree_le
       from commande_ligne l
       join v_commande c on c.id_commande = l.id_commande
       join produit p on p.id_produit = l.id_produit
      where c.id_compte = $1
        and c.etat = 1
        and c.code_statut = 'LIVREE'
        and not exists (select 1 from avis a
                         where a.id_produit = l.id_produit
                           and a.id_compte = $1 and a.etat = 1)
      order by c.date_statut desc`,
    [idCompte]
  );
}

export async function creer(idCompte, corps) {
  const idProduit = valider.entier(corps.idProduit, { champ: 'Article', requis: true, min: 1 });
  const note = valider.entier(corps.note, { champ: 'Note', requis: true, min: 1, max: 5 });
  const commentaire = valider.texte(corps.commentaire, { champ: 'Commentaire', max: 1000 });

  return ligne(
    `insert into avis (id_produit, id_compte, note, commentaire)
     values ($1, $2, $3, $4) returning id_avis, id_produit, note, commentaire, cree_le`,
    [idProduit, idCompte, note, commentaire]
  );
}

export async function maj(idAvis, compte, corps) {
  const avis = await ligne('select id_compte from avis where id_avis = $1 and etat = 1', [idAvis]);
  if (!avis) throw new ErreurMetier('Avis introuvable.', 404);
  if (avis.id_compte !== compte.id_compte) throw new ErreurMetier('Avis introuvable.', 404);

  return ligne(
    `update avis set note = $2, commentaire = $3 where id_avis = $1
     returning id_avis, id_produit, note, commentaire, cree_le, maj_le`,
    [
      idAvis,
      valider.entier(corps.note, { champ: 'Note', requis: true, min: 1, max: 5 }),
      valider.texte(corps.commentaire, { champ: 'Commentaire', max: 1000 }),
    ]
  );
}

// L'auteur retire son avis, l'administrateur retire un avis deplace : dans
// les deux cas il part a la corbeille, il ne s'efface pas.
export async function supprimer(idAvis, compte) {
  const avis = await ligne('select id_compte from avis where id_avis = $1 and etat = 1', [idAvis]);
  if (!avis) throw new ErreurMetier('Avis introuvable.', 404);
  if (avis.id_compte !== compte.id_compte && compte.profil !== 'ADMIN') {
    throw new ErreurMetier('Avis introuvable.', 404);
  }
  await ligne(
    'update avis set etat = 0, supprime_le = now(), supprime_par = $2 where id_avis = $1',
    [idAvis, compte.id_compte]
  );
  return { supprime: true };
}
