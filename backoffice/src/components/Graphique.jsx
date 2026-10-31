import { useEffect, useRef, useState } from 'react';
import { formatAriaryCompact } from '../lib/format';

// Colonnes verticales, dessinees a la largeur MESUREE du conteneur : un
// viewBox etire deformerait le texte des axes. Chaque barre se survole, se
// parcourt au clavier, et la serie entiere se relit en tableau.

const MARGE = { haut: 10, droite: 4, bas: 22, gauche: 48 };
const LARGEUR_MAX = 24;

function useLargeur(ref) {
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observateur = new ResizeObserver(([entree]) => setLargeur(entree.contentRect.width));
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [ref]);
  return largeur;
}

// Un axe qui s'arrete sur un chiffre rond se lit ; un axe cale sur le maximum
// exact donne des graduations impossibles a comparer.
function echelle(maximum) {
  if (maximum <= 0) return { haut: 1, pas: 1 };
  const puissance = 10 ** Math.floor(Math.log10(maximum));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => maximum / p <= 4) || puissance * 10;
  return { haut: Math.ceil(maximum / pas) * pas, pas };
}

export default function Graphique({ serie, cle, libelle, couleur = 'var(--serie-entrees)', hauteur = 190 }) {
  const conteneur = useRef(null);
  const largeur = useLargeur(conteneur);
  const [survol, setSurvol] = useState(null);
  const [tableau, setTableau] = useState(false);

  const valeurs = serie.map((point) => Number(point[cle]) || 0);
  const { haut, pas } = echelle(Math.max(...valeurs, 0));

  const aireL = Math.max(0, largeur - MARGE.gauche - MARGE.droite);
  const aireH = hauteur - MARGE.haut - MARGE.bas;
  const pasX = serie.length ? aireL / serie.length : 0;
  const largeurBarre = Math.min(LARGEUR_MAX, Math.max(2, pasX * 0.62));

  const graduations = [];
  for (let valeur = 0; valeur <= haut + 0.001; valeur += pas) graduations.push(valeur);

  const y = (valeur) => MARGE.haut + aireH - (valeur / haut) * aireH;

  return (
    <div className="graphe" ref={conteneur}>
      <div className="graphe__barre-outils">
        <button
          type="button"
          className="graphe__bascule"
          onClick={() => setTableau((v) => !v)}
          aria-pressed={tableau}
        >
          {tableau ? 'Voir le graphique' : 'Voir le tableau'}
        </button>
      </div>

      {tableau ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jour</th>
                <th className="num">{libelle}</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((point) => (
                <tr key={point.jour}>
                  <td>{new Date(point.jour).toLocaleDateString('fr-FR')}</td>
                  <td className="num">{formatAriaryCompact(point[cle])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : largeur > 0 && (
        <svg
          className="graphe__svg"
          width={largeur}
          height={hauteur}
          role="img"
          aria-label={`${libelle}, ${serie.length} jours`}
        >
          {graduations.map((valeur) => (
            <g key={valeur}>
              <line
                className="graphe__grille"
                x1={MARGE.gauche}
                x2={largeur - MARGE.droite}
                y1={y(valeur)}
                y2={y(valeur)}
              />
              <text className="graphe__axe" x={MARGE.gauche - 8} y={y(valeur) + 4} textAnchor="end">
                {formatAriaryCompact(valeur, '0')}
              </text>
            </g>
          ))}

          {serie.map((point, index) => {
            const valeur = Number(point[cle]) || 0;
            const centre = MARGE.gauche + pasX * index + pasX / 2;
            const hauteurBarre = Math.max(valeur > 0 ? 2 : 0, (valeur / haut) * aireH);
            return (
              <g key={point.jour}>
                <rect
                  x={centre - largeurBarre / 2}
                  y={MARGE.haut + aireH - hauteurBarre}
                  width={largeurBarre}
                  height={hauteurBarre}
                  rx={Math.min(4, largeurBarre / 2)}
                  fill={couleur}
                />
                {/* Pied carre : le rayon du haut ne doit pas detacher la barre
                    de sa ligne de base. */}
                <rect
                  x={centre - largeurBarre / 2}
                  y={MARGE.haut + aireH - Math.min(hauteurBarre, 4)}
                  width={largeurBarre}
                  height={Math.min(hauteurBarre, 4)}
                  fill={couleur}
                />
                <rect
                  x={MARGE.gauche + pasX * index}
                  y={MARGE.haut}
                  width={pasX}
                  height={aireH}
                  fill="transparent"
                  tabIndex={0}
                  onMouseEnter={() => setSurvol({ point, x: centre, valeur })}
                  onMouseLeave={() => setSurvol(null)}
                  onFocus={() => setSurvol({ point, x: centre, valeur })}
                  onBlur={() => setSurvol(null)}
                />
              </g>
            );
          })}

          <line
            className="graphe__zero"
            x1={MARGE.gauche}
            x2={largeur - MARGE.droite}
            y1={MARGE.haut + aireH}
            y2={MARGE.haut + aireH}
          />
        </svg>
      )}

      {survol && !tableau && (
        <div
          className="bulle"
          style={{
            left: Math.min(Math.max(survol.x - 70, 0), Math.max(0, largeur - 140)),
            top: 0,
            '--cle': couleur,
          }}
        >
          <div className="bulle__titre">
            {new Date(survol.point.jour).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </div>
          <div className="bulle__ligne">
            <span className="bulle__cle" />
            <span className="bulle__valeur">{formatAriaryCompact(survol.valeur)}</span>
            <span className="bulle__libelle">{libelle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
