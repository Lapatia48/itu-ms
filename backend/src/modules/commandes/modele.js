import { ligne, lignes, transaction } from '../../db.js';
import { ErreurMetier } from '../../utils/erreurs.js';
import { estInterne, transitionsPossibles } from '../../utils/roles.js';
import * as valider from '../../utils/valider.js';

// Le perimetre est impose par le serveur : un profil CLIENT ne voit que ses
// commandes, et retirer un parametre cote navigateur n'elargit rien.
export function lister(compte) {
  const clientSeul = !estInterne(compte);
  return lignes(
    `select c.*,
            (select string_agg(p.nom, ' · ' order by l.id_ligne)
               from commande_ligne l join produit p on p.id_produit = l.id_produit
              where l.id_commande = c.id_commande) as articles
       from v_commande c
      where c.etat = 1
        and ($2::boolean is not true or c.id_compte = $1)
      order by c.cree_le desc`,
    [compte.id_compte, clientSeul]
  );
}

export async function detail(idCommande, compte) {
  const commande = await ligne('select * from v_commande where id_commande = $1', [idCommande]);
  if (!commande) throw new ErreurMetier('Commande introuvable.', 404);
  if (!estInterne(compte) && commande.id_compte !== compte.id_compte) {
    throw new ErreurMetier('Commande introuvable.', 404);
  }

  commande.lignes = await lignes(
    `select l.id_ligne, l.quantite, l.prix_unitaire,
            (l.quantite * l.prix_unitaire) as total_ligne,
            p.id_produit, p.nom as produit, p.reference as produit_reference, p.image,
            t.code as taille, cat.libelle as categorie
       from commande_ligne l
       join produit p on p.id_produit = l.id_produit
       join categorie cat on cat.id_categorie = p.id_categorie
       left join taille t on t.id_taille = l.id_taille
      where l.id_commande = $1
      order by l.id_ligne`,
    [idCommande]
  );

  commande.statuts = await lignes(
    `select cs.id_commande_statut, cs.code_statut, s.libelle, s.ton, cs.date_statut,
            cs.commentaire, c.prenom || ' ' || c.nom as auteur, c.profil as auteur_profil
       from commande_statut cs
       join statut_commande s on s.code = cs.code_statut
       left join compte c on c.id_compte = cs.id_compte
      where cs.id_commande = $1
      order by cs.date_statut desc, cs.id_commande_statut desc`,
    [idCommande]
  );

  commande.paiements = await lignes(
    `select p.id_paiement, p.montant, p.code_mode, m.libelle as mode, p.reference,
            p.date_paiement, p.commentaire, p.cree_le,
            c.prenom || ' ' || c.nom as auteur
       from paiement p
       join mode_paiement m on m.code = p.code_mode
       left join compte c on c.id_compte = p.id_compte
      where p.id_commande = $1 and p.etat = 1
      order by p.date_paiement desc, p.id_paiement desc`,
    [idCommande]
  );

  commande.transitions = await transitionsPossibles(commande.code_statut, compte.profil);
  return commande;
}

/* ---------------- Creation ---------------- */

// Les lignes partent dans la MEME transaction que la commande : une commande
// sans ses articles est a moitie saisie. Le prix est lu en base, jamais pris
// dans la requete.
export async function creer(compte, corps) {
  const remarque = valider.texte(corps.remarque, { champ: 'Remarque', max: 500 });
  const demandees = Array.isArray(corps.lignes) ? corps.lignes : [];
  if (!demandees.length) throw new ErreurMetier('Votre panier est vide.');
  if (demandees.length > 50) throw new ErreurMetier('50 lignes au maximum par commande.');

  const preparees = demandees.map((brute) => ({
    idProduit: valider.entier(brute.idProduit, { champ: 'Article', requis: true, min: 1 }),
    idTaille: valider.entier(brute.idTaille, { champ: 'Taille', min: 1 }),
    quantite: valider.entier(brute.quantite, { champ: 'Quantité', requis: true, min: 1, max: 99 }),
  }));

  // La fiche est relue APRES le commit : lue dans la transaction, elle
  // passerait par une autre connexion et ne verrait rien.
  const idCommande = await transaction(async (client) => {
    const { rows: entete } = await client.query(
      'insert into commande (id_compte, remarque) values ($1, $2) returning id_commande',
      [compte.id_compte, remarque]
    );
    const identifiant = entete[0].id_commande;

    for (const article of preparees) {
      const { rows } = await client.query(
        `select p.id_produit, p.nom, p.prix,
                (select count(*) from produit_taille pt where pt.id_produit = p.id_produit) as nb_tailles,
                exists (select 1 from produit_taille pt
                         where pt.id_produit = p.id_produit and pt.id_taille = $2) as taille_ok
           from produit p where p.id_produit = $1 and p.etat = 1`,
        [article.idProduit, article.idTaille]
      );
      const fiche = rows[0];
      if (!fiche) throw new ErreurMetier('Un article du panier n’est plus au catalogue.', 409);
      if (Number(fiche.nb_tailles) > 0 && !fiche.taille_ok) {
        throw new ErreurMetier(`${fiche.nom} : choisissez une taille proposée.`);
      }
      await client.query(
        `insert into commande_ligne (id_commande, id_produit, id_taille, quantite, prix_unitaire)
         values ($1, $2, $3, $4, $5)`,
        [identifiant, article.idProduit, article.idTaille, article.quantite, fiche.prix]
      );
    }

    return identifiant;
  });

  return detail(idCommande, compte);
}

/* ---------------- Cycle de vie ---------------- */

// Le droit de passage et les gardes d'argent sont tenus par la base
// (fn_chk_transition) : on y ajoute seulement le perimetre du demandeur.
export async function changerStatut(idCommande, corps, compte) {
  const commande = await ligne('select id_compte, etat from commande where id_commande = $1', [idCommande]);
  if (!commande || commande.etat === 0) throw new ErreurMetier('Commande introuvable.', 404);
  if (!estInterne(compte) && commande.id_compte !== compte.id_compte) {
    throw new ErreurMetier('Commande introuvable.', 404);
  }

  await ligne(
    `insert into commande_statut (id_commande, code_statut, id_compte, commentaire)
     values ($1, $2, $3, $4) returning id_commande_statut`,
    [
      idCommande,
      valider.codeReference(corps.code, { champ: 'Statut', max: 20 }),
      compte.id_compte,
      valider.texte(corps.commentaire, { champ: 'Commentaire', max: 500 }),
    ]
  );
  return detail(idCommande, compte);
}

/* ---------------- Encaissements ---------------- */

export async function ajouterPaiement(idCommande, corps, compte) {
  const existe = await ligne('select id_commande from commande where id_commande = $1 and etat = 1', [idCommande]);
  if (!existe) throw new ErreurMetier('Commande introuvable.', 404);

  await ligne(
    `insert into paiement (id_commande, montant, code_mode, reference, date_paiement, commentaire, id_compte)
     values ($1, $2, $3, $4, coalesce($5, current_date), $6, $7) returning id_paiement`,
    [
      idCommande,
      valider.montant(corps.montant, { champ: 'Montant', requis: true }),
      valider.codeReference(corps.codeMode, { champ: 'Mode', max: 20 }),
      valider.texte(corps.reference, { champ: 'Référence', max: 60 }),
      corps.datePaiement || null,
      valider.texte(corps.commentaire, { champ: 'Commentaire', max: 500 }),
      compte.id_compte,
    ]
  );
  return detail(idCommande, compte);
}

// Un encaissement mal saisi part a la corbeille, il ne s'efface pas. Une
// commande conclue ne se recompose plus : la decision prise reposait sur ce
// qui y figurait.
export async function supprimerPaiement(idPaiement, compte) {
  const paiement = await ligne(
    `select p.id_paiement, p.id_commande, v.est_final, v.statut_libelle
       from paiement p join v_commande v on v.id_commande = p.id_commande
      where p.id_paiement = $1 and p.etat = 1`,
    [idPaiement]
  );
  if (!paiement) throw new ErreurMetier('Encaissement introuvable.', 404);
  if (paiement.est_final) {
    throw new ErreurMetier(`Commande ${paiement.statut_libelle.toLowerCase()} : ses encaissements ne changent plus.`, 409);
  }
  await ligne(
    'update paiement set etat = 0, supprime_le = now(), supprime_par = $2 where id_paiement = $1',
    [idPaiement, compte.id_compte]
  );
  return detail(paiement.id_commande, compte);
}

/* ---------------- Corbeille ---------------- */

export async function supprimerCommande(idCommande, compte) {
  const commande = await ligne('select paye, est_final from v_commande where id_commande = $1 and etat = 1', [idCommande]);
  if (!commande) throw new ErreurMetier('Commande introuvable.', 404);
  if (Number(commande.paye) > 0) {
    throw new ErreurMetier('Commande encaissée : annulez-la plutôt que de la supprimer.', 409);
  }
  await ligne(
    'update commande set etat = 0, supprime_le = now(), supprime_par = $2 where id_commande = $1',
    [idCommande, compte.id_compte]
  );
  return { supprime: true };
}

export async function restaurerCommande(idCommande) {
  await ligne(
    `update commande set etat = 1, supprime_le = null, supprime_par = null
      where id_commande = $1 and etat = 0`,
    [idCommande]
  );
  return { restaure: true };
}

export function listerModesPaiement() {
  return lignes('select code, libelle from mode_paiement where etat = 1 order by ordre');
}

export async function workflow() {
  return {
    statuts: await lignes('select code, libelle, ordre, est_initial, est_final, ton from statut_commande order by ordre'),
    transitions: await lignes(
      `select t.code_depuis, t.code_vers, t.libelle,
              coalesce(array_agg(p.profil order by p.profil)
                       filter (where p.profil is not null), '{}') as profils
         from transition_commande t
         left join transition_commande_profil p
                on p.code_depuis = t.code_depuis and p.code_vers = t.code_vers
        group by t.code_depuis, t.code_vers, t.libelle`
    ),
  };
}
