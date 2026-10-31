import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { useAuth } from '../auth/session';
import { usePanier } from '../lib/panier';
import { initiales } from '../lib/format';

const ENTREES = [
  { to: '/', label: 'Accueil', exact: true },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/mes-commandes', label: 'Mes commandes', compte: true },
  { to: '/mes-avis', label: 'Mes avis', compte: true },
];

function MenuCompte() {
  const { compte, deconnecter } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ouvert) return undefined;
    const surClic = (e) => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false); };
    const surEchap = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surEchap);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surEchap);
    };
  }, [ouvert]);

  if (!compte) {
    return <Link to="/connexion" className="btn btn--primary btn--sm">Se connecter</Link>;
  }

  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="compte-lien" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span className="avatar">{initiales(compte.nom, compte.prenom)}</span>
        <span className="compte-lien__nom">{compte.prenom}</span>
        <Icon name="chevronBas" size={14} />
      </button>

      {ouvert && (
        <div className="usermenu__panel" role="menu">
          <div className="usermenu__head">
            <span className="usermenu__name">{compte.prenom} {compte.nom}</span>
            <span className="usermenu__role">{compte.etu} · {compte.promotion}</span>
          </div>
          <hr />
          <Link to="/mes-commandes" className="usermenu__item" onClick={() => setOuvert(false)}>
            <Icon name="liste" /> Mes commandes
          </Link>
          <Link to="/mon-compte" className="usermenu__item" onClick={() => setOuvert(false)}>
            <Icon name="utilisateur" /> Mon compte
          </Link>
          <hr />
          <button
            type="button"
            className="usermenu__item"
            onClick={() => { deconnecter(); setOuvert(false); navigate('/'); }}
          >
            <Icon name="deconnexion" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export default function SiteShell() {
  const { compte } = useAuth();
  const panier = usePanier();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);

  const [cheminPrecedent, setCheminPrecedent] = useState(pathname);
  if (pathname !== cheminPrecedent) {
    setCheminPrecedent(pathname);
    setMenu(false);
  }

  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header__inner">
          <button
            type="button"
            className="site-header__burger"
            onClick={() => setMenu((v) => !v)}
            aria-label="Afficher le menu"
            aria-expanded={menu}
          >
            <Icon name="menu" size={18} />
          </button>

          <Link to="/" className="site-header__marque">
            <Logo size={34} />
          </Link>

          <nav className={`site-nav ${menu ? 'is-ouvert' : ''}`} aria-label="Navigation">
            {ENTREES.map((entree) => (
              <NavLink
                key={entree.to}
                to={entree.compte && !compte ? `/connexion?suite=${entree.to}` : entree.to}
                end={entree.exact}
                className={({ isActive }) => `site-nav__lien ${isActive ? 'is-active' : ''}`}
              >
                {entree.label}
                {/* Une entree qui demande une connexion s'affiche quand meme,
                    avec un cadenas, et conserve sa destination. */}
                {entree.compte && !compte && <Icon name="cadenas" size={13} style={{ marginLeft: 6 }} />}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__actions">
            <Link to="/panier" className="panier-lien">
              <Icon name="panier" size={17} />
              Panier
              {panier.nombre > 0 && <span className="panier-lien__compte">{panier.nombre}</span>}
            </Link>
            <MenuCompte />
          </div>
        </div>
      </header>

      <div className="site__corps">
        <Outlet />
      </div>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <Logo size={34} />
            <p style={{ marginTop: 12, color: 'var(--ink-600)', maxWidth: 320 }}>
              Les vêtements du club automobile de l’ITU, commandés en ligne et retirés au local.
            </p>
          </div>
          <div>
            <h3>La boutique</h3>
            <ul>
              <li><Link to="/catalogue">Catalogue</Link></li>
              <li><Link to="/mes-commandes">Suivre ma commande</Link></li>
              <li><Link to="/mes-avis">Noter un article</Link></li>
            </ul>
          </div>
          <div>
            <h3>Le club</h3>
            <ul>
              <li>Campus ITU, Antananarivo</li>
              <li>+261 34 00 000 00</li>
              <li>Retrait au local du club</li>
            </ul>
          </div>
        </div>
        <p className="site-footer__mention">
          ITU Motor Society · Paiement au local, aucun règlement en ligne.
        </p>
      </footer>
    </div>
  );
}
