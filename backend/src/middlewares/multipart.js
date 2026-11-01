import { ErreurMetier } from '../utils/erreurs.js';

// Le formulaire de depot d'une photo arrive en multipart. Il n'est pas decode
// par une bibliotheque : node (depuis la 18) et le Worker Cloudflare exposent
// tous deux Request.formData(), donc c'est la plateforme elle-meme qui
// l'analyse. Multer, qui tenait ce role, repose sur node:stream — absent du
// Worker — et pour une seule route de l'API, il ne se justifiait que du temps
// ou l'API ne tournait que sous node.
//
// Le corps brut vient du middleware corps() : il est lu une fois pour toutes,
// en tete de chaine.
export function multipart(nomChamp) {
  return async (requete, reponse, suite) => {
    try {
      if (!requete.corpsBrut?.length) {
        throw new ErreurMetier('Formulaire attendu au format multipart/form-data.', 415);
      }

      let formulaire;
      try {
        formulaire = await new Request('http://formulaire.local/', {
          method: 'POST',
          headers: { 'content-type': requete.headers['content-type'] },
          body: requete.corpsBrut,
        }).formData();
      } catch {
        throw new ErreurMetier('Formulaire illisible : multipart/form-data attendu.', 415);
      }

      // Un formulaire multipart ne transporte que du texte et des fichiers :
      // les champs reviennent en chaines, a charge du modele de les valider.
      const champs = {};
      let fichier = null;
      for (const [cle, valeur] of formulaire.entries()) {
        if (typeof valeur === 'string') champs[cle] = valeur;
        else if (cle === nomChamp) {
          fichier = { octets: new Uint8Array(await valeur.arrayBuffer()) };
        }
      }

      requete.body = champs;
      requete.fichier = fichier;
      return suite();
    } catch (erreur) {
      return suite(erreur);
    }
  };
}
