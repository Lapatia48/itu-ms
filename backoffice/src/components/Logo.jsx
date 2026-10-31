// Le logo ITU Motor Society tel quel (public/logoitu.png), suivi du nom :
// jamais redessine, recolore ni imite en SVG. Le fichier est un disque blanc
// a fond transparent : il se pose aussi bien sur une carte blanche que sur un
// panneau marine, sans plaque ni filtre.

const SOURCE = '/logoitu.png';

// size : diametre de l'image en pixels ; le nom se cale dessus.
export default function Logo({ size = 40, tone = 'light' }) {
  const surMarine = tone === 'dark';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.26) }}>
      {/* alt vide : le nom ecrit a cote dit deja qui on est. */}
      <img src={SOURCE} alt="" width={size} height={size} style={{ display: 'block' }} />
      <span
        style={{
          fontSize: Math.round(size * 0.4),
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          color: surMarine ? '#ffffff' : 'var(--ink-900)',
        }}
      >
        ITU{' '}
        <span style={{ fontWeight: 500, color: surMarine ? 'var(--vif-texte-2)' : 'var(--brand)' }}>
          Motor Society
        </span>
      </span>
    </span>
  );
}
