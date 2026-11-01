import { ligne, lignes, transaction } from '../../db.js';
import { ErreurMetier } from '../../utils/erreurs.js';
import * as valider from '../../utils/valider.js';

// Le perimetre complet est renvoye d'un coup : le filtrage multicritere et la
// pagination se font dans le navigateur (lib/liste.js), et les compteurs
// poses au-dessus des listes decrivent la selection entiere.

export function listerProduits({ tout = false } = {}) {
  return lignes(
    `select * from v_produit
      where ($1 or etat = 1)
      order by categorie_code, nom`,
    [tout]
  );
}

export async function produit(idProduit) {
  const fiche = await ligne('select * from v_produit where id_produit = $1', [idProduit]);
  if (!fiche) throw new ErreurMetier('Article introuvable.', 404);
  fiche.tailles = await lignes(
    `select t.id_taille, t.code, t.libelle
       from produit_taille pt join taille t on t.id_taille = pt.id_taille
      where pt.id_produit = $1 and t.etat = 1
      order by t.ordre`,
    [idProduit]
  );
  fiche.avis = await lignes(
    `select id_avis, note, commentaire, cree_le, client, promotion
       from v_avis where id_produit = $1 and etat = 1
      order by cree_le desc`,
    [idProduit]
  );
  return fiche;
}

function champsProduit(corps) {
  return {
    nom: valider.texte(corps.nom, { champ: 'Nom', requis: true, max: 120 }),
    description: valider.texte(corps.description, { champ: 'Description', max: 2000 }),
    prix: valider.montant(corps.prix, { champ: 'Prix', requis: true }),
    couleur: valider.texte(corps.couleur, { champ: 'Couleur', max: 40 }),
    idCategorie: valider.entier(corps.idCategorie, { champ: 'Catégorie', requis: true, min: 1 }),
    tailles: Array.isArray(corps.tailles) ? corps.tailles.map(Number).filter(Number.isInteger) : [],
  };
}

export async function creerProduit(corps, image) {
  const donnees = champsProduit(corps);
  if (!donnees.tailles.length) throw new ErreurMetier('Choisissez au moins une taille.');

  // La fiche est relue APRES le commit : lue dans la transaction, elle
  // passerait par une autre connexion et ne verrait rien.
  const identifiant = await transaction(async (client) => {
    const { rows } = await client.query(
      `insert into produit (id_categorie, nom, description, prix, couleur, image)
       values ($1, $2, $3, $4, $5, $6) returning id_produit`,
      [donnees.idCategorie, donnees.nom, donnees.description, donnees.prix, donnees.couleur,
        image?.nom ?? null]
    );
    const idProduit = rows[0].id_produit;
    if (image) await poserImage(client, idProduit, image);
    await client.query(
      `insert into produit_taille (id_produit, id_taille)
       select $1, unnest($2::int[])`,
      [idProduit, donnees.tailles]
    );
    return idProduit;
  });

  return produit(identifiant);
}

/* ---------------- Photos ---------------- */

// Les photos vivent en base (produit_image) et non sur le disque du serveur :
// l'API tourne en ligne sans systeme de fichiers persistant, et un hebergement
// gratuit efface son disque a chaque redemarrage. Ce qu'on y gagne au passage :
// la photo et la fiche qu'elle illustre sont ecrites dans la MEME transaction,
// donc jamais l'une sans l'autre.
function poserImage(client, idProduit, image) {
  return client.query(
    `insert into produit_image (nom, id_produit, type_mime, octets)
     values ($1, $2, $3, $4)`,
    [image.nom, idProduit, image.typeMime, image.octets]
  );
}

// Lue par la route ouverte /images/:nom.
export function imageParNom(nom) {
  return ligne('select type_mime, octets from produit_image where nom = $1', [nom]);
}

export async function majProduit(idProduit, corps, image) {
  const donnees = champsProduit(corps);
  const ancienne = await ligne('select image from produit where id_produit = $1', [idProduit]);
  if (!ancienne) throw new ErreurMetier('Article introuvable.', 404);
  if (!donnees.tailles.length) throw new ErreurMetier('Choisissez au moins une taille.');

  await transaction(async (client) => {
    await client.query(
      `update produit set id_categorie = $2, nom = $3, description = $4, prix = $5,
              couleur = $6, image = coalesce($7, image)
        where id_produit = $1 and etat = 1`,
      [idProduit, donnees.idCategorie, donnees.nom, donnees.description, donnees.prix,
        donnees.couleur, image?.nom ?? null]
    );
    // L'echange de photo tient dans la transaction : l'ancienne ne part qu'avec
    // la nouvelle arrivee, et un echec les laisse toutes deux comme elles
    // etaient.
    if (image) {
      await poserImage(client, idProduit, image);
      if (ancienne.image) {
        await client.query('delete from produit_image where nom = $1', [ancienne.image]);
      }
    }
    await client.query('delete from produit_taille where id_produit = $1', [idProduit]);
    await client.query(
      'insert into produit_taille (id_produit, id_taille) select $1, unnest($2::int[])',
      [idProduit, donnees.tailles]
    );
  });

  return produit(idProduit);
}

// Suppression logique : l'article part a la corbeille, les commandes qui le
// citent gardent leur ligne et leur prix.
export async function supprimerProduit(idProduit, idCompte) {
  const sortie = await ligne(
    `update produit set etat = 0, supprime_le = now(), supprime_par = $2
      where id_produit = $1 and etat = 1 returning id_produit`,
    [idProduit, idCompte]
  );
  if (!sortie) throw new ErreurMetier('Article introuvable.', 404);
  return { supprime: true };
}

export async function restaurerProduit(idProduit) {
  const sortie = await ligne(
    `update produit p set etat = 1, supprime_le = null, supprime_par = null
      where p.id_produit = $1 and p.etat = 0
        and exists (select 1 from categorie c where c.id_categorie = p.id_categorie and c.etat = 1)
      returning p.id_produit`,
    [idProduit]
  );
  if (!sortie) {
    throw new ErreurMetier('Article non restaurable : sa catégorie est elle-même à la corbeille.', 409);
  }
  return { restaure: true };
}

/* ---------------- Categories ---------------- */

export function listerCategories({ tout = false } = {}) {
  return lignes(
    `select c.id_categorie, c.code, c.libelle, c.ordre, c.etat, c.cree_le, c.supprime_le,
            (select count(*) from produit p where p.id_categorie = c.id_categorie and p.etat = 1)
              as nb_produits
       from categorie c
      where ($1 or c.etat = 1)
      order by c.ordre, c.libelle`,
    [tout]
  );
}

export function creerCategorie(corps) {
  return ligne(
    `insert into categorie (code, libelle, ordre) values ($1, $2, $3)
     returning id_categorie, code, libelle, ordre, etat`,
    [
      valider.codeReference(corps.code, { champ: 'Code', max: 30 }),
      valider.texte(corps.libelle, { champ: 'Libellé', requis: true, max: 80 }),
      valider.entier(corps.ordre, { champ: 'Ordre', min: 0, max: 99, defaut: 0 }),
    ]
  );
}

export async function majCategorie(idCategorie, corps) {
  const sortie = await ligne(
    `update categorie set code = $2, libelle = $3, ordre = $4
      where id_categorie = $1 and etat = 1
      returning id_categorie, code, libelle, ordre, etat`,
    [
      idCategorie,
      valider.codeReference(corps.code, { champ: 'Code', max: 30 }),
      valider.texte(corps.libelle, { champ: 'Libellé', requis: true, max: 80 }),
      valider.entier(corps.ordre, { champ: 'Ordre', min: 0, max: 99, defaut: 0 }),
    ]
  );
  if (!sortie) throw new ErreurMetier('Catégorie introuvable.', 404);
  return sortie;
}

// Une categorie qui porte encore des articles ne part pas seule : sinon ses
// articles resteraient au catalogue sous une categorie invisible.
export async function supprimerCategorie(idCategorie, idCompte) {
  const occupee = await ligne(
    'select count(*)::int as nb from produit where id_categorie = $1 and etat = 1',
    [idCategorie]
  );
  if (occupee.nb > 0) {
    throw new ErreurMetier(
      `Catégorie utilisée par ${occupee.nb} article${occupee.nb > 1 ? 's' : ''}.`,
      409
    );
  }
  const sortie = await ligne(
    `update categorie set etat = 0, supprime_le = now(), supprime_par = $2
      where id_categorie = $1 and etat = 1 returning id_categorie`,
    [idCategorie, idCompte]
  );
  if (!sortie) throw new ErreurMetier('Catégorie introuvable.', 404);
  return { supprime: true };
}

export async function restaurerCategorie(idCategorie) {
  await ligne(
    `update categorie set etat = 1, supprime_le = null, supprime_par = null
      where id_categorie = $1 and etat = 0`,
    [idCategorie]
  );
  return { restaure: true };
}

/* ---------------- Tailles ---------------- */

export function listerTailles() {
  return lignes('select id_taille, code, libelle, ordre from taille where etat = 1 order by ordre');
}
