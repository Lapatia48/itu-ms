import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, onUnauthorized } from '../lib/api';
import { AuthContext } from './session';

// Session de l'etudiant. Le catalogue reste ouvert a tous : seules les pages
// « mes commandes », « mon compte » et la validation du panier demandent une
// connexion.
export function AuthProvider({ children }) {
  const [compte, setCompte] = useState(null);
  const [pret, setPret] = useState(false);

  const deconnecter = useCallback(() => {
    setToken(null);
    setCompte(null);
  }, []);

  useEffect(() => {
    let annule = false;

    async function amorcer() {
      if (!getToken()) {
        if (!annule) setPret(true);
        return;
      }
      try {
        const profil = await api.get('/auth/moi', null, { silent401: true });
        if (!annule) setCompte(profil);
      } catch {
        if (!annule) setToken(null);
      } finally {
        if (!annule) setPret(true);
      }
    }

    amorcer();
    return () => { annule = true; };
  }, []);

  useEffect(() => onUnauthorized(deconnecter), [deconnecter]);

  const connecter = useCallback(async (etu, motDePasse) => {
    const donnees = await api.post('/auth/connexion', { etu, motDePasse }, { silent401: true });
    setToken(donnees.jeton);
    setCompte(donnees.compte);
    return donnees.compte;
  }, []);

  const inscrire = useCallback(async (corps) => {
    const donnees = await api.post('/auth/inscription', corps);
    setToken(donnees.jeton);
    setCompte(donnees.compte);
    return donnees.compte;
  }, []);

  const rafraichir = useCallback(async () => {
    const profil = await api.get('/auth/moi');
    setCompte(profil);
    return profil;
  }, []);

  const valeur = useMemo(
    () => ({ compte, pret, connecter, inscrire, deconnecter, rafraichir }),
    [compte, pret, connecter, inscrire, deconnecter, rafraichir]
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}
