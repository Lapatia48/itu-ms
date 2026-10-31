import { createContext, useContext } from 'react';

// Contexte separe du composant AuthProvider : un fichier qui exporte a la fois
// un composant et un hook casse le rafraichissement a chaud de Vite.
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans un AuthProvider');
  return ctx;
}
