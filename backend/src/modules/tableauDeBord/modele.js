import { ligne, lignes } from '../../db.js';

// Tout agregat se calcule en base : l'ecran recoit des sommes, jamais des
// lignes a additionner. C'est l'exception assumee a la regle des listes
// filtrees dans le navigateur.

const FENETRES = { '7j': 7, '30j': 30, '90j': 90, '12m': 365 };

export function fenetre(periode) {
  return FENETRES[periode] ?? FENETRES['30j'];
}

export async function indicateurs(periode) {
  const jours = fenetre(periode);

  // Les commandes de la fenetre, et la meme fenetre juste avant : une
  // variation se lit contre la periode precedente de meme duree.
  const commandes = await ligne(
    `select
       count(*) filter (where cree_le >= now() - make_interval(days => $1))::int as nombre,
       coalesce(sum(total) filter (where cree_le >= now() - make_interval(days => $1)), 0) as total,
       count(*) filter (where cree_le >= now() - make_interval(days => $1 * 2)
                          and cree_le <  now() - make_interval(days => $1))::int as nombre_avant,
       coalesce(sum(total) filter (where cree_le >= now() - make_interval(days => $1 * 2)
                                     and cree_le <  now() - make_interval(days => $1)), 0) as total_avant
       from v_commande where etat = 1`,
    [jours]
  );

  // Un encaissement compte a sa date de paiement, pas a la date de la
  // commande : c'est la regle de la vue, et le tableau de bord doit y
  // retomber exactement.
  const encaisse = await ligne(
    `select
       coalesce(sum(p.montant) filter (where p.date_paiement >= current_date - $1::int), 0) as montant,
       coalesce(sum(p.montant) filter (where p.date_paiement >= current_date - $1::int * 2
                                         and p.date_paiement <  current_date - $1::int), 0) as montant_avant
       from paiement p
       join commande c on c.id_commande = p.id_commande and c.etat = 1
      where p.etat = 1`,
    [jours]
  );

  // Le reste a encaisser est un stock, pas un flux : il decrit tout le
  // portefeuille ouvert, et ne se borne pas a la fenetre.
  const reste = await ligne(
    `select coalesce(sum(reste_a_payer), 0) as montant,
            count(*) filter (where reste_a_payer > 0)::int as nb_commandes
       from v_commande where etat = 1 and code_statut <> 'ANNULEE'`
  );

  const statuts = await lignes(
    `select s.code, s.libelle, s.ton, s.ordre,
            count(v.id_commande)::int as nb,
            coalesce(sum(v.total), 0) as total
       from statut_commande s
       left join v_commande v on v.code_statut = s.code and v.etat = 1
      group by s.code, s.libelle, s.ton, s.ordre
      order by s.ordre`
  );

  const produits = await lignes(
    `select p.id_produit, p.nom, cat.libelle as categorie,
            sum(l.quantite)::int as quantite,
            sum(l.quantite * l.prix_unitaire) as montant
       from commande_ligne l
       join v_commande c on c.id_commande = l.id_commande and c.etat = 1
       join produit p on p.id_produit = l.id_produit
       join categorie cat on cat.id_categorie = p.id_categorie
      where c.cree_le >= now() - make_interval(days => $1)
        and c.code_statut <> 'ANNULEE'
      group by p.id_produit, p.nom, cat.libelle
      order by quantite desc, montant desc
      limit 6`,
    [jours]
  );

  // La serie porte sur des jours calendaires, jours vides compris : un trou
  // dans l'axe ferait lire une baisse la ou il n'y a pas eu de vente.
  const serie = await lignes(
    `with jours as (
       select generate_series(current_date - ($1::int - 1), current_date, '1 day')::date as jour
     )
     select j.jour::date as jour,
            coalesce(c.nombre, 0)::int as commandes,
            coalesce(c.total, 0)       as commande_montant,
            coalesce(p.montant, 0)     as encaisse
       from jours j
       left join lateral (
            select count(*)::int as nombre, sum(total) as total
              from v_commande v where v.etat = 1 and v.cree_le::date = j.jour
       ) c on true
       left join lateral (
            select sum(pa.montant) as montant
              from paiement pa join commande co on co.id_commande = pa.id_commande and co.etat = 1
             where pa.etat = 1 and pa.date_paiement = j.jour
       ) p on true
      order by j.jour`,
    [Math.min(jours, 60)]
  );

  const dernieres = await lignes(
    `select id_commande, reference, client, promotion, cree_le, code_statut,
            statut_libelle, statut_ton, total, paye, reste_a_payer
       from v_commande where etat = 1 order by cree_le desc limit 6`
  );

  const aRegler = await lignes(
    `select id_commande, reference, client, promotion, cree_le, code_statut,
            statut_libelle, statut_ton, total, paye, reste_a_payer, taux_paiement
       from v_commande
      where etat = 1 and reste_a_payer > 0 and code_statut not in ('ANNULEE')
      order by reste_a_payer desc limit 6`
  );

  return {
    periode: { code: periode in FENETRES ? periode : '30j', jours },
    commandes,
    encaisse,
    reste,
    statuts,
    produits,
    serie,
    dernieres,
    aRegler,
  };
}
