import { createContext, useContext } from 'react';

// Le panier vit dans le navigateur jusqu'a la validation : il n'y a ni stock
// ni paiement en ligne, rien n'est reserve tant que la commande n'est pas
// enregistree. Il survit a un rechargement de page, pas a un changement de
// poste.
export const CLE = 'itu.panier';

export const PanierContext = createContext(null);

export function usePanier() {
  const contexte = useContext(PanierContext);
  if (!contexte) throw new Error('usePanier doit etre utilise dans un PanierProvider');
  return contexte;
}

export function lirePanier() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || '[]');
    return Array.isArray(brut) ? brut : [];
  } catch {
    return [];
  }
}

export function ecrirePanier(lignes) {
  localStorage.setItem(CLE, JSON.stringify(lignes));
}

// Une meme reference dans une autre taille est une autre ligne : c'est ce que
// l'etudiant voit dans son panier, et ce que le guichet prepare.
export function cleLigne(ligne) {
  return `${ligne.idProduit}-${ligne.idTaille ?? 'tu'}`;
}
