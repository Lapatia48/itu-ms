import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, onUnauthorized } from '../lib/api';
import { AuthContext } from './session';

// Etat de session partage par toute la console. Le jeton vit dans
// localStorage ; au demarrage on le revalide par /auth/moi pour ne jamais
// afficher une session expiree comme si elle etait ouverte.
const INTERNES = ['GESTIONNAIRE', 'ADMIN'];

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
        if (!annule) setCompte(INTERNES.includes(profil.profil) ? profil : null);
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
    if (!INTERNES.includes(donnees.compte.profil)) {
      throw new Error('Compte étudiant : connectez-vous sur la boutique.');
    }
    setToken(donnees.jeton);
    setCompte(donnees.compte);
    return donnees.compte;
  }, []);

  const valeur = useMemo(
    () => ({
      compte,
      pret,
      connecter,
      deconnecter,
      estAdmin: compte?.profil === 'ADMIN',
      aProfil: (...profils) => profils.includes(compte?.profil),
    }),
    [compte, pret, connecter, deconnecter]
  );

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}
