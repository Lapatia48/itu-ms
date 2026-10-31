import { useEffect, useRef, useState } from 'react';

// La vitrine de l'accueil : trois films du club en fond, un seul a la fois.
//
// Les trois n'ont ni la meme lumiere ni la meme temperature : un tee marine
// filme en lumiere froide, une voiture noire sur fond creme surexpose, un
// lettrage creme et chaud. On ne les reencode pas, on les etalonne. Chacun
// porte la correction d'exposition qui l'amene au niveau des deux autres
// (`grade`, lue par site.css), puis deux calques communs posent par-dessus la
// teinte du logo. Trois sources, une seule image.
const FILMS = [
  { fichier: '/videos/impression.mp4', grade: 'froid', titre: 'Le motif imprime' },
  { fichier: '/videos/voiture.mp4', grade: 'clair', titre: 'Le coupe du club' },
  { fichier: '/videos/lettrage.mp4', grade: 'chaud', titre: 'Le lettrage ITU Motor Society' },
];

const DUREE = 6200; // un plan ne tient pas l'attention plus longtemps
const FONDU = 1100; // doit valoir la transition d'opacite de site.css

// Une animation de fond n'a pas a s'imposer : le visiteur qui demande moins de
// mouvement garde le panneau marine, sans video ni defilement.
function useSobre() {
  const [sobre, setSobre] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const requete = window.matchMedia('(prefers-reduced-motion: reduce)');
    const surChangement = () => setSobre(requete.matches);
    requete.addEventListener('change', surChangement);
    return () => requete.removeEventListener('change', surChangement);
  }, []);
  return sobre;
}

export default function Vitrine({ children }) {
  const sobre = useSobre();
  const [actif, setActif] = useState(0);
  const films = useRef([]);

  // Le defilement s'arrete tant que l'onglet est en arriere-plan : sinon on
  // revient sur une vitrine qui a tourne dans le vide.
  useEffect(() => {
    if (sobre) return undefined;
    let minuteur = null;
    const lancer = () => {
      if (minuteur) return;
      minuteur = setInterval(() => setActif((i) => (i + 1) % FILMS.length), DUREE);
    };
    const arreter = () => {
      if (minuteur) clearInterval(minuteur);
      minuteur = null;
    };
    const surVisibilite = () => (document.hidden ? arreter() : lancer());

    lancer();
    document.addEventListener('visibilitychange', surVisibilite);
    return () => {
      arreter();
      document.removeEventListener('visibilitychange', surVisibilite);
    };
  }, [sobre]);

  useEffect(() => {
    if (sobre) return undefined;

    const courant = films.current[actif];
    if (courant) {
      // React ne pose pas toujours l'attribut `muted` : sans lui, le navigateur
      // refuse la lecture automatique et le plan reste noir.
      courant.muted = true;
      courant.currentTime = 0;
      const lecture = courant.play();
      // Lecture refusee (economie d'energie, reglage du navigateur) : le voile
      // marine tient la page seul, rien a rattraper.
      if (lecture) lecture.catch(() => {});
    }

    // Le film suivant se charge pendant que celui-ci joue : pas de noir au
    // moment du fondu.
    const suivant = films.current[(actif + 1) % FILMS.length];
    if (suivant && suivant.preload !== 'auto') {
      suivant.preload = 'auto';
      suivant.load();
    }

    // Les sortants continuent de tourner le temps du fondu : une image figee
    // pendant qu'elle s'efface se voit.
    const fin = setTimeout(() => {
      films.current.forEach((film, index) => {
        if (film && index !== actif) {
          film.pause();
          film.currentTime = 0;
        }
      });
    }, FONDU);
    return () => clearTimeout(fin);
  }, [actif, sobre]);

  return (
    <section className="vitrine">
      {!sobre && (
        <div className="vitrine__films" aria-hidden="true">
          {FILMS.map((film, index) => (
            <video
              key={film.fichier}
              ref={(element) => { films.current[index] = element; }}
              className={`vitrine__film vitrine__film--${film.grade} ${index === actif ? 'is-actif' : ''}`}
              src={film.fichier}
              muted
              loop
              playsInline
              tabIndex={-1}
              preload={index === 0 ? 'auto' : 'metadata'}
            />
          ))}
        </div>
      )}

      {/* Trois calques : la teinte du logo prise sur la couleur seule (la
          lumiere de chaque plan est conservee), la lueur des hautes lumieres,
          puis le voile qui garantit le texte quel que soit le film dessous. */}
      <div className="vitrine__teinte" aria-hidden="true" />
      <div className="vitrine__lueur" aria-hidden="true" />
      <div className="vitrine__voile" aria-hidden="true" />

      <div className="vitrine__contenu">{children}</div>

      {!sobre && (
        <div className="vitrine__puces">
          {FILMS.map((film, index) => (
            <button
              key={film.fichier}
              type="button"
              className={`vitrine__puce ${index === actif ? 'is-actif' : ''}`}
              aria-label={film.titre}
              aria-current={index === actif}
              onClick={() => setActif(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
