import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';

// Barre laterale en arbre : des entrees parentes qui deroulent leurs entrees
// filles, lesquelles peuvent a leur tour en derouler (« Parametrages »
// regroupe les referentiels et les regles). Le groupe contenant la page
// courante s'ouvre tout seul, a chaque niveau, et les groupes ouverts
// manuellement le restent.

function estActif(pathname, to, exact) {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function contientPage(entree, pathname) {
  if (entree.to) return estActif(pathname, entree.to, entree.exact);
  return (entree.children || []).some((enfant) => contientPage(enfant, pathname));
}

// Une entree sans `roles` est visible par tous les profils connectes ; un
// groupe dont plus aucun enfant n'est visible disparait avec eux.
function visibles(entrees, role) {
  return entrees
    .filter((entree) => !entree.roles || entree.roles.includes(role))
    .map((entree) => (entree.children ? { ...entree, children: visibles(entree.children, role) } : entree))
    .filter((entree) => !entree.children || entree.children.length > 0);
}

function NavGroup({ groupe, pathname, onNavigate, niveau = 0 }) {
  const actif = contientPage(groupe, pathname);
  const [ouvert, setOuvert] = useState(actif);

  // Naviguer vers une page de ce groupe l'ouvre, meme s'il avait ete replie a
  // la main. L'ajustement se fait pendant le rendu plutot que dans un effet :
  // le menu est alors correct des la premiere peinture, sans rendu en cascade.
  const [actifPrecedent, setActifPrecedent] = useState(actif);
  if (actif !== actifPrecedent) {
    setActifPrecedent(actif);
    if (actif) setOuvert(true);
  }

  const classe = niveau === 0 ? 'nav-item' : 'nav-child nav-child--groupe';

  return (
    <li className={niveau === 0 ? 'nav-group' : 'nav-group nav-group--sous'}>
      <button
        type="button"
        className={`${classe} ${ouvert ? 'is-open' : ''} ${actif && !ouvert ? 'is-active' : ''}`}
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
      >
        {groupe.icon && <Icon name={groupe.icon} size={niveau === 0 ? 16 : 15} className="nav-item__icon" />}
        <span className="nav-item__label">{groupe.label}</span>
        <Icon name="chevronDroite" size={niveau === 0 ? 14 : 13} className="nav-item__chevron" />
      </button>

      <div className={`nav-group__children ${ouvert ? 'is-open' : ''}`}>
        <div>
          <ul>
            {groupe.children.map((enfant) =>
              enfant.children ? (
                <NavGroup
                  key={enfant.label}
                  groupe={enfant}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  niveau={niveau + 1}
                />
              ) : (
                <li key={enfant.to}>
                  <NavLink
                    to={enfant.to}
                    end={enfant.exact}
                    className={({ isActive }) => `nav-child ${isActive ? 'is-active' : ''}`}
                    onClick={onNavigate}
                  >
                    {enfant.label}
                  </NavLink>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </li>
  );
}

export default function Sidebar({ navigation, role, pied, onNavigate }) {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Logo size={40} tone="light" />
      </div>

      <nav className="sidebar__nav" aria-label="Navigation principale">
        {navigation.map((section) => {
          const entrees = visibles(section.items, role);
          if (entrees.length === 0) return null;

          return (
            <div key={section.section}>
              <div className="sidebar__section">{section.section}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entrees.map((entree) =>
                  entree.children ? (
                    <NavGroup key={entree.label} groupe={entree} pathname={pathname} onNavigate={onNavigate} />
                  ) : (
                    <li key={entree.to}>
                      <NavLink
                        to={entree.to}
                        end={entree.exact}
                        className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                        onClick={onNavigate}
                      >
                        <Icon name={entree.icon} className="nav-item__icon" />
                        <span className="nav-item__label">{entree.label}</span>
                      </NavLink>
                    </li>
                  )
                )}
              </ul>
            </div>
          );
        })}
      </nav>

      {pied && <div className="sidebar__footer">{pied}</div>}
    </aside>
  );
}
