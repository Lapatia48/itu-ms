import Icon from './Icon';

// Cinq etoiles, pleines jusqu'a la note. Le rouge du logo est ici un
// graphisme, pas un etat : il ne dit ni erreur ni alerte.
export default function Note({ valeur, taille = 14, children }) {
  const note = Number(valeur) || 0;
  return (
    <span className="note">
      <span className="note__etoiles" aria-label={`${note} sur 5`}>
        {[1, 2, 3, 4, 5].map((rang) => (
          <Icon
            key={rang}
            name="etoile"
            size={taille}
            plein={rang <= Math.round(note)}
            className={rang <= Math.round(note) ? 'note__pleine' : 'note__vide'}
          />
        ))}
      </span>
      {children}
    </span>
  );
}
