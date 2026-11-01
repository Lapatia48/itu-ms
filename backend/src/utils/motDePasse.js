// Les mots de passe sont haches PAR LA BASE, en bcrypt (pgcrypto), et non ici.
// Deux raisons :
//
//   . l'API tourne en ligne sur un Worker Cloudflare, qui plafonne le temps
//     processeur a 10 ms par requete. Un scrypt ou un bcrypt calcule dans le
//     Worker serait tue en vol, alors qu'attendre la base ne consomme aucun
//     processeur — l'attente d'une entree-sortie n'est pas comptee ;
//   . la comparaison se fait dans la clause where, en C, a temps constant :
//     aucune empreinte ne remonte dans le code applicatif.
//
// Le mot de passe en clair ne voyage que comme parametre de requete, jamais
// concatene dans le texte SQL.
const COUT = 10;

// A inserer dans un INSERT ou un UPDATE, a la place de la valeur.
export function hacher(parametre) {
  return `crypt(${parametre}, gen_salt('bf', ${COUT}))`;
}

// A inserer dans un WHERE. Le sel et le cout voyagent avec l'empreinte : la
// repasser en second argument de crypt suffit a la rejouer.
export function verifie(colonne, parametre) {
  return `${colonne} = crypt(${parametre}, ${colonne})`;
}

// Mot de passe provisoire d'un compte ouvert par le bureau : rendu UNE fois
// dans la reponse, ecrit nulle part ailleurs. Pas de I, l, O, 0, 1 : il est
// recopie a la main depuis l'ecran.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function motDePasseProvisoire(longueur = 10) {
  // Web Crypto et non node:crypto : c'est le seul tirage aleatoire disponible
  // a l'identique sous node et dans un Worker.
  const octets = crypto.getRandomValues(new Uint8Array(longueur));
  let sortie = '';
  for (let index = 0; index < longueur; index += 1) {
    sortie += ALPHABET[octets[index] % ALPHABET.length];
  }
  return sortie;
}
