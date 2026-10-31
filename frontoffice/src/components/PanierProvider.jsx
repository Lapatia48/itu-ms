import { useCallback, useMemo, useState } from 'react';
import { PanierContext, cleLigne, ecrirePanier, lirePanier } from '../lib/panier';

export function PanierProvider({ children }) {
  const [lignes, setLignes] = useState(lirePanier);

  const poser = useCallback((suivantes) => {
    setLignes(suivantes);
    ecrirePanier(suivantes);
  }, []);

  const ajouter = useCallback((article, idTaille, quantite = 1) => {
    setLignes((precedentes) => {
      const ligne = {
        idProduit: article.id_produit,
        idTaille: idTaille || null,
        nom: article.nom,
        reference: article.reference,
        prix: Number(article.prix),
        image: article.image,
        taille: article.tailles_libelle || null,
        quantite,
      };
      const cle = cleLigne(ligne);
      const existante = precedentes.find((l) => cleLigne(l) === cle);
      const suivantes = existante
        ? precedentes.map((l) => (cleLigne(l) === cle
          ? { ...l, quantite: Math.min(99, l.quantite + quantite) }
          : l))
        : [...precedentes, ligne];
      ecrirePanier(suivantes);
      return suivantes;
    });
  }, []);

  const changerQuantite = useCallback((cle, quantite) => {
    setLignes((precedentes) => {
      const suivantes = quantite <= 0
        ? precedentes.filter((l) => cleLigne(l) !== cle)
        : precedentes.map((l) => (cleLigne(l) === cle ? { ...l, quantite: Math.min(99, quantite) } : l));
      ecrirePanier(suivantes);
      return suivantes;
    });
  }, []);

  const retirer = useCallback((cle) => changerQuantite(cle, 0), [changerQuantite]);

  const vider = useCallback(() => poser([]), [poser]);

  const valeur = useMemo(() => ({
    lignes,
    ajouter,
    changerQuantite,
    retirer,
    vider,
    nombre: lignes.reduce((somme, l) => somme + l.quantite, 0),
    total: lignes.reduce((somme, l) => somme + l.quantite * l.prix, 0),
  }), [lignes, ajouter, changerQuantite, retirer, vider]);

  return <PanierContext.Provider value={valeur}>{children}</PanierContext.Provider>;
}
