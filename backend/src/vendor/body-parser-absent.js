// body-parser n'entre pas dans le paquet du Worker, et c'est voulu.
//
// Sa chaine de dependances ne se construit pas pour workerd : raw-body tire
// iconv-lite, qui declare « ./lib/streams: false » dans son champ « browser » —
// le paquet le remplace donc par un objet vide — mais l'appelle quand meme,
// parce qu'il se croit sous node (process.versions.node existe avec
// nodejs_compat). Resultat : « require_streams(...) is not a function », leve
// au CHARGEMENT d'express et non a l'usage, donc avant la premiere requete.
//
// L'API ne s'en sert pas : elle lit son corps de requete elle-meme
// (middlewares/corps.js), en JSON comme en multipart. Mais express lit ces
// quatre entrees au chargement (express/lib/express.js), ce qui suffit a
// declencher la casse. D'ou ce remplacant, raccorde par « alias » dans
// wrangler.jsonc, et qui n'existe que pour le paquet du Worker : sous node,
// c'est le vrai body-parser qui est la, simplement jamais appele.
function absent(nom) {
  return () => {
    throw new Error(
      `express.${nom}() n'est pas embarque dans le Worker : lisez le corps avec corps() (src/middlewares/corps.js).`
    );
  };
}

export const json = absent('json');
export const raw = absent('raw');
export const text = absent('text');
export const urlencoded = absent('urlencoded');

export default { json, raw, text, urlencoded };
