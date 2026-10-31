import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppShell, { Protege } from './components/AppShell';
import { AuthProvider } from './auth/AuthContext';
import { navigation } from './navigation';

import Connexion from './pages/Connexion';
import TableauDeBord from './pages/TableauDeBord';
import Commandes from './pages/Commandes';
import CommandeFiche from './pages/CommandeFiche';
import Articles from './pages/Articles';
import Categories from './pages/Categories';
import Etudiants from './pages/Etudiants';
import EtudiantFiche from './pages/EtudiantFiche';
import Avis from './pages/Avis';
import CycleDeVie from './pages/CycleDeVie';
import Parametres from './pages/Parametres';
import Corbeille from './pages/Corbeille';
import MonCompte from './pages/MonCompte';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/connexion" element={<Connexion />} />

          <Route
            element={(
              <Protege>
                <AppShell navigation={navigation} />
              </Protege>
            )}
          >
            {/* Le bureau ouvre la console pour traiter des commandes, pas
                pour lire des agregats : la racine mene au guichet, le tableau
                de bord a son adresse propre. */}
            <Route index element={<Navigate to="/commandes" replace />} />
            <Route path="tableau-de-bord" element={<TableauDeBord />} />
            <Route path="commandes" element={<Commandes />} />
            <Route path="commandes/:id" element={<CommandeFiche />} />
            <Route path="etudiants" element={<Etudiants />} />
            <Route path="etudiants/:id" element={<EtudiantFiche />} />
            <Route path="avis" element={<Avis />} />
            <Route path="compte" element={<MonCompte />} />

            <Route path="articles" element={<Protege profils={['ADMIN']}><Articles /></Protege>} />
            <Route path="categories" element={<Protege profils={['ADMIN']}><Categories /></Protege>} />
            <Route path="cycle-de-vie" element={<Protege profils={['ADMIN']}><CycleDeVie /></Protege>} />
            <Route path="parametres" element={<Protege profils={['ADMIN']}><Parametres /></Protege>} />
            <Route path="corbeille" element={<Protege profils={['ADMIN']}><Corbeille /></Protege>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
