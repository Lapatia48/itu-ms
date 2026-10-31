// Mises en forme communes a la boutique et a la console. Locale fr, devise
// ariary.

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateLongFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const jourLongFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const numberFmt = new Intl.NumberFormat('fr-FR');

// Les colonnes DATE de Postgres arrivent en "AAAA-MM-JJ", sans heure ni fuseau.
// new Date("2026-09-07") les interprete a minuit UTC : dans un fuseau a l'ouest
// de Greenwich, l'affichage reculerait d'un jour. On les construit donc en
// heure locale. Les colonnes TIMESTAMP, elles, gardent leur fuseau.
const DATE_SEULE = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && DATE_SEULE.test(value)) {
    const [annee, mois, jour] = value.split('-').map(Number);
    return new Date(annee, mois - 1, jour);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, fallback = '—') {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

export function formatDateLongue(value, fallback = '—') {
  const d = toDate(value);
  return d ? dateLongFmt.format(d) : fallback;
}

export function formatDateHeure(value, fallback = '—') {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
}

// Les montants arrivent en NUMERIC Postgres, donc sous forme de chaine.
export function formatAriary(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return `${numberFmt.format(Math.round(n))} Ar`;
}

// Montant abrege, pour un axe de graphique ou une tuile d'indicateur :
// « 1,45 M Ar », « 175 k Ar ». Il sert a comparer d'un coup d'oeil ; le
// montant exact reste dans l'infobulle et dans le detail.
export function formatAriaryCompact(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const abs = Math.abs(n);
  // Le vrai signe moins (U+2212) : le trait d'union, plus court, se detache
  // du chiffre en grand corps et se lit comme un tiret.
  const signe = n < 0 ? '−' : '';
  if (abs >= 1e9) return `${signe}${formatDecimal(abs / 1e9, abs >= 1e10 ? 1 : 2)} Md Ar`;
  if (abs >= 1e6) return `${signe}${formatDecimal(abs / 1e6, abs >= 1e7 ? 1 : 2)} M Ar`;
  if (abs >= 1e4) return `${signe}${formatDecimal(abs / 1e3, 0)} k Ar`;
  return `${signe}${formatDecimal(abs, 0)} Ar`;
}

export function formatNombre(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : numberFmt.format(n);
}

export function formatDecimal(value, decimales = 2, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

export function formatPourcentage(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : `${formatDecimal(n, 2)} %`;
}

// Valeur d'un <input type="date"> : format AAAA-MM-JJ en heure locale.
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

export function aujourdhui() {
  return toInputDate(new Date());
}

export function initiales(nom, prenom) {
  const a = (prenom || '').trim().charAt(0);
  const b = (nom || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

export function nomComplet(personne) {
  if (!personne) return '—';
  return [personne.prenom, personne.nom].filter(Boolean).join(' ') || '—';
}

// Vocabulaire metier : les codes de statut viennent de la base en MAJUSCULES
// avec des underscores. On les rend lisibles quand aucun libelle n'accompagne.
export function humaniserCode(code) {
  if (!code) return '—';
  const mot = String(code).replace(/_/g, ' ').toLowerCase();
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

// Couleur de badge par statut : la base la porte deja (statut_ton), ceci est
// le recours quand une ligne arrive sans elle.
const TON_STATUT = {
  NOUVELLE: 'info',
  CONFIRMEE: 'info',
  EN_PREPARATION: 'warn',
  PRETE: 'warn',
  LIVREE: 'ok',
  ANNULEE: 'danger',
};

export function tonStatut(code) {
  return TON_STATUT[code] || 'neutral';
}
