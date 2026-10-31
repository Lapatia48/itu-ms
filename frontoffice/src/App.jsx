import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SiteShell from './components/SiteShell';
import { AuthProvider } from './auth/AuthContext';
import { PanierProvider } from './components/PanierProvider';
import { useAuth } from './auth/session';

import Accueil from './pages/Accueil';
import Catalogue from './pages/Catalogue';
import Article from './pages/Article';
import Panier from './pages/Panier';
import Connexion from './pages/Connexion';
import Inscription from './pages/Inscription';
import MesCommandes from './pages/MesCommandes';
import CommandeSuivi from './pages/CommandeSuivi';
import MesAvis from './pages/MesAvis';
import MonCompte from './pages/MonCompte';

// Le compte n'est exige qu'au moment de consulter ses propres donnees. La
// destination est conservee : on y atterrit directement apres la connexion.
function Protege({ children }) {
  const { compte, pret } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pret && !compte) navigate(`/connexion?suite=${encodeURIComponent(pathname)}`, { replace: true });
  }, [pret, compte, navigate, pathname]);

  if (!pret) return <div className="loading" style={{ minHeight: 320 }}><span className="spinner" />Chargement</div>;
  return compte ? children : null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PanierProvider>
          <Routes>
            <Route element={<SiteShell />}>
              <Route index element={<Accueil />} />
              <Route path="catalogue" element={<Catalogue />} />
              <Route path="article/:id" element={<Article />} />
              <Route path="panier" element={<Panier />} />
              <Route path="connexion" element={<Connexion />} />
              <Route path="inscription" element={<Inscription />} />
              <Route path="mes-commandes" element={<Protege><MesCommandes /></Protege>} />
              <Route path="mes-commandes/:id" element={<Protege><CommandeSuivi /></Protege>} />
              <Route path="mes-avis" element={<Protege><MesAvis /></Protege>} />
              <Route path="mon-compte" element={<Protege><MonCompte /></Protege>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PanierProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
