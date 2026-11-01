import { ligne } from '../../db.js';
import { ErreurMetier } from '../../utils/erreurs.js';
import { hacher, verifie } from '../../utils/motDePasse.js';
import * as valider from '../../utils/valider.js';

const CHAMPS = 'id_compte, etu, nom, prenom, promotion, telephone, profil, cree_le';

// L'empreinte est verifiee EN BASE, dans le where : elle ne remonte jamais
// dans le code, et la comparaison se fait a temps constant du cote de
// PostgreSQL. Voir utils/motDePasse.js pour le pourquoi.
export async function connexion(etu, motDePasse) {
  const identifiant = valider.texte(etu, { champ: 'Numéro ETU', requis: true, max: 20 });
  const compte = await ligne(
    `select ${CHAMPS} from compte
      where upper(etu) = upper($1) and etat = 1 and ${verifie('mot_de_passe', '$2')}`,
    [identifiant, String(motDePasse ?? '')]
  );
  // Un seul message pour les deux cas : dire « ce compte existe » renseigne
  // qui cherche des numeros valides.
  if (!compte) throw new ErreurMetier('Numéro ETU ou mot de passe incorrect.', 401);
  return compte;
}

export async function inscription(corps) {
  const donnees = {
    etu: valider.codeReference(corps.etu, { champ: 'Numéro ETU', max: 20 }),
    nom: valider.texte(corps.nom, { champ: 'Nom', requis: true, max: 60 }),
    prenom: valider.texte(corps.prenom, { champ: 'Prénom', requis: true, max: 60 }),
    promotion: valider.texte(corps.promotion, { champ: 'Promotion', requis: true, max: 60 }),
    telephone: valider.telephone(corps.telephone),
    motDePasse: valider.motDePasse(corps.motDePasse),
  };

  return ligne(
    `insert into compte (etu, nom, prenom, promotion, telephone, mot_de_passe, profil)
     values ($1, $2, $3, $4, $5, ${hacher('$6')}, 'CLIENT')
     returning ${CHAMPS}`,
    [donnees.etu, donnees.nom, donnees.prenom, donnees.promotion, donnees.telephone,
      donnees.motDePasse]
  );
}

export async function majProfil(idCompte, corps) {
  const champs = [];
  const valeurs = [];
  const poser = (colonne, valeur) => {
    valeurs.push(valeur);
    champs.push(`${colonne} = $${valeurs.length}`);
  };

  if (valider.presente(corps, 'nom')) poser('nom', valider.texte(corps.nom, { champ: 'Nom', requis: true, max: 60 }));
  if (valider.presente(corps, 'prenom')) poser('prenom', valider.texte(corps.prenom, { champ: 'Prénom', requis: true, max: 60 }));
  if (valider.presente(corps, 'promotion')) poser('promotion', valider.texte(corps.promotion, { champ: 'Promotion', requis: true, max: 60 }));
  if (valider.presente(corps, 'telephone')) poser('telephone', valider.telephone(corps.telephone));

  if (!champs.length) throw new ErreurMetier('Aucune modification.');
  valeurs.push(idCompte);
  return ligne(
    `update compte set ${champs.join(', ')} where id_compte = $${valeurs.length} and etat = 1
     returning ${CHAMPS}`,
    valeurs
  );
}

export async function changerMotDePasse(idCompte, ancien, nouveau) {
  const compte = await ligne(
    `select id_compte from compte
      where id_compte = $1 and etat = 1 and ${verifie('mot_de_passe', '$2')}`,
    [idCompte, String(ancien ?? '')]
  );
  if (!compte) throw new ErreurMetier('Mot de passe actuel incorrect.', 401);

  const propre = valider.motDePasse(nouveau, { champ: 'Nouveau mot de passe' });
  await ligne(
    `update compte set mot_de_passe = ${hacher('$1')} where id_compte = $2`,
    [propre, idCompte]
  );
  return { change: true };
}
