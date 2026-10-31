import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Icon from './Icon';
import { Button } from './ui';
import { useAuth } from '../auth/session';
import { initiales } from '../lib/format';
import { LIBELLE_PROFIL } from '../lib/roles';

// Fil d'Ariane deduit de la navigation : la section et la page courantes se
// retrouvent dans la structure qui alimente deja la barre laterale.
function filDAriane(navigation, pathname) {
  const couvre = (to, exact) => pathname === to || (!exact && pathname.startsWith(`${to}/`));
  const chemin = (entrees) => {
    for (const entree of entrees) {
      if (entree.to && couvre(entree.to, entree.exact)) return [entree.label];
      const suite = entree.children && chemin(entree.children);
      if (suite) return [entree.label, ...suite];
    }
    return null;
  };
  for (const section of navigation) {
    const suite = chemin(section.items);
    if (suite) return [section.section, ...suite];
  }
  return [];
}

function MenuCompte() {
  const { compte, deconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ouvert) return undefined;
    const surClic = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOuvert(false);
    };
    const surEchap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surEchap);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surEchap);
    };
  }, [ouvert]);

  const nom = [compte.prenom, compte.nom].filter(Boolean).join(' ');

  return (
    <div className="usermenu" ref={ref}>
      <button
        type="button"
        className="usermenu__trigger"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
      >
        <span className="avatar">{initiales(compte.nom, compte.prenom)}</span>
        <span className="usermenu__meta">
          <span className="usermenu__name">{nom}</span>
          <span className="usermenu__role">{LIBELLE_PROFIL[compte.profil]}</span>
        </span>
        <Icon name="chevronBas" size={14} />
      </button>

      {ouvert && (
        <div className="usermenu__panel" role="menu">
          <div className="usermenu__head">
            <span className="usermenu__name">{nom}</span>
            <span className="usermenu__role">{compte.etu}</span>
          </div>
          <hr />
          <Link to="/compte" className="usermenu__item" role="menuitem" onClick={() => setOuvert(false)}>
            <Icon name="utilisateur" /> Mon compte
          </Link>
          <hr />
          <button
            type="button"
            className="usermenu__item"
            role="menuitem"
            onClick={() => {
              deconnecter();
              navigate('/connexion', { replace: true });
            }}
          >
            <Icon name="deconnexion" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ navigation }) {
  const { compte } = useAuth();
  const { pathname } = useLocation();
  const [menuMobile, setMenuMobile] = useState(false);
  const contenuRef = useRef(null);

  const fil = filDAriane(navigation, pathname);

  // Changer de page referme le tiroir mobile. L'ajustement se fait pendant le
  // rendu : un effet provoquerait un rendu de plus, menu encore ouvert.
  const [cheminPrecedent, setCheminPrecedent] = useState(pathname);
  if (pathname !== cheminPrecedent) {
    setCheminPrecedent(pathname);
    setMenuMobile(false);
  }

  useEffect(() => { contenuRef.current?.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div className={`shell ${menuMobile ? 'is-open' : ''}`}>
      <Sidebar
        navigation={navigation}
        role={compte.profil}
        onNavigate={() => setMenuMobile(false)}
      />

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__burger"
            onClick={() => setMenuMobile((v) => !v)}
            aria-label="Afficher le menu"
          >
            <Icon name="menu" size={18} />
          </button>

          <nav className="topbar__crumbs" aria-label="Fil d'Ariane">
            {fil.map((etape, index) => (
              <span key={`${index}-${etape}`} style={{ display: 'contents' }}>
                {index > 0 && <span className="topbar__sep">/</span>}
                {index === fil.length - 1 ? <strong>{etape}</strong> : <span>{etape}</span>}
              </span>
            ))}
          </nav>

          <MenuCompte />
        </header>

        <main className="content" ref={contenuRef}>
          <div className="content__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

// Barriere d'acces : renvoie a la connexion sans session, et dit le profil
// attendu quand la page ne lui est pas ouverte.
export function Protege({ profils, children }) {
  const { compte, pret } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pret && !compte) navigate('/connexion', { replace: true, state: { suite: pathname } });
  }, [pret, compte, navigate, pathname]);

  if (!pret) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <span className="spinner" />
        Ouverture de la session
      </div>
    );
  }

  if (!compte) return null;

  if (profils && !profils.includes(compte.profil)) {
    return (
      <div className="content">
        <div className="content__inner" style={{ maxWidth: 620, paddingTop: 40 }}>
          <div className="empty">
            <Icon name="cadenas" size={30} strokeWidth={1.4} />
            <strong>
              Page réservée au profil {profils.map((p) => LIBELLE_PROFIL[p]).join(', ')}
            </strong>
            <Button icon="flecheGauche" onClick={() => window.history.back()}>Retour</Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
