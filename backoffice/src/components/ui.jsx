import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { fenetrePages, libelleFiltre, normaliser } from '../lib/liste';

/* ---------------- Boutons ---------------- */

// `as` permet de rendre un lien qui a l'apparence d'un bouton : une ligne de
// liste qui mene quelque part doit rester un <a>, pour s'ouvrir dans un nouvel
// onglet et se copier comme n'importe quel lien. Meme signature que le Button
// de l'espace assure.
export function Button({
  as: Composant = 'button',
  variant = 'default',
  size,
  icon,
  loading = false,
  block = false,
  children,
  className = '',
  disabled,
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    !children ? 'btn--icon' : '',
    className,
  ].filter(Boolean).join(' ');

  const proprietesNatives = Composant === 'button'
    ? { type: 'button', disabled: disabled || loading }
    : { 'aria-disabled': disabled || loading || undefined };

  return (
    <Composant className={classes} {...proprietesNatives} {...rest}>
      {loading ? <span className="spinner" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </Composant>
  );
}

/* ---------------- Champs de formulaire ---------------- */

export function Field({ label, hint, error, required, children, className = '', span }) {
  const style = span ? { gridColumn: `span ${span}` } : undefined;
  return (
    <div className={`field ${className}`} style={style}>
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ error, className = '', ...rest }) {
  return <input className={`input ${className}`} aria-invalid={error ? 'true' : undefined} {...rest} />;
}

// Pas d'input type=number pour un montant : son `step` rejette toute valeur
// hors grille (min=1 step=1000 refuse 85000 et propose 84001 ou 85001), et il
// n'affiche aucun separateur de milliers. Ici on affiche « 85 000 » et le
// formulaire recoit « 85000 » (point decimal), comme avec un Input. Sert
// aussi aux taux (« 2,5 % »), poids et puissances via `unite`.
const ESPACE_MILLIERS = '\u00A0';

function grouperMilliers(brut) {
  if (brut === '') return '';
  const [entier, decimales] = brut.split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
  return decimales === undefined ? groupe : `${groupe},${decimales}`;
}

// Seul le dernier séparateur peut être décimal, et seulement s'il est suivi
// d'au plus `decimales` chiffres : « 1.000.000 » tapé à l'habitude du point
// des milliers reste un million, « 12,5 » reste douze et demi.
function montantBrut(texte, decimales) {
  const propre = texte.replace(/[^\d.,]/g, '');
  const dernier = Math.max(propre.lastIndexOf('.'), propre.lastIndexOf(','));
  let entier = propre;
  let fraction = null;
  const chiffresApres = propre.length - dernier - 1;
  if (dernier >= 0 && decimales && chiffresApres <= decimales) {
    entier = propre.slice(0, dernier);
    fraction = propre.slice(dernier + 1);
  } else if (dernier >= 0 && !decimales && chiffresApres !== 3) {
    // Champ entier : une partie décimale tapée est tronquée, pas collée.
    entier = propre.slice(0, dernier);
  }
  entier = entier.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
  return fraction === null ? entier : `${entier || '0'}.${fraction}`;
}

// « 85000.00 » renvoye par la base s'affiche « 85 000 », « 2.5000 » « 2,5 ».
const sansDecimalesNulles = (brut) => (brut.includes('.') ? brut.replace(/0+$/, '').replace(/\.$/, '') : brut);

export function InputNombre({
  value, onChange, name, unite = null, decimales = 2, min, max, error, className = '', ...rest
}) {
  const ref = useRef(null);
  const recu = value === null || value === undefined ? '' : String(value);
  const [texte, setTexte] = useState(() => grouperMilliers(sansDecimalesNulles(recu)));
  const [emis, setEmis] = useState(recu);
  const curseur = useRef(null);

  // Valeur changee par le formulaire lui-meme (reinitialisation, preremplissage).
  if (recu !== emis) {
    setEmis(recu);
    setTexte(grouperMilliers(sansDecimalesNulles(recu)));
  }

  // Les espaces inseres deplacent le curseur : on le replace apres le meme
  // nombre de chiffres qu'avant la frappe.
  useLayoutEffect(() => {
    const champ = ref.current;
    if (curseur.current === null || !champ || document.activeElement !== champ) return;
    let pos = 0;
    let vus = 0;
    while (pos < champ.value.length && vus < curseur.current) {
      if (/[\d,]/.test(champ.value[pos])) vus += 1;
      pos += 1;
    }
    curseur.current = null;
    champ.setSelectionRange(pos, pos);
  });

  useEffect(() => {
    if (!ref.current) return;
    const n = Number(recu);
    let message = '';
    if (recu !== '' && min !== undefined && n < Number(min)) message = `Minimum : ${grouperMilliers(String(min))}`;
    if (recu !== '' && max !== undefined && n > Number(max)) message = `Maximum : ${grouperMilliers(String(max))}`;
    ref.current.setCustomValidity(message);
  }, [recu, min, max]);

  function saisir(e) {
    const { value: frappe, selectionStart } = e.target;
    curseur.current = frappe.slice(0, selectionStart ?? frappe.length).replace(/[^\d.,]/g, '').length;
    const brut = montantBrut(frappe, decimales);
    setTexte(grouperMilliers(brut));
    setEmis(brut);
    onChange?.({ target: { name, value: brut } });
  }

  return (
    <div className={unite ? 'input-unite' : undefined}>
      <input
        ref={ref}
        type="text"
        inputMode={decimales ? 'decimal' : 'numeric'}
        autoComplete="off"
        name={name}
        className={`input input--montant ${className}`}
        aria-invalid={error ? 'true' : undefined}
        style={unite ? { paddingRight: `calc(${unite.length}ch + 18px)` } : undefined}
        value={texte}
        onChange={saisir}
        {...rest}
      />
      {unite && <span className="input-unite__unite" aria-hidden="true">{unite}</span>}
    </div>
  );
}

export function InputMontant(props) {
  return <InputNombre unite="Ar" {...props} />;
}

export function InputMotDePasse({ className = '', ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-mdp">
      <Input {...rest} className={className} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="input-mdp__bascule"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        title={visible ? 'Masquer' : 'Afficher'}
      >
        <Icon name={visible ? 'oeilBarre' : 'oeil'} size={16} />
      </button>
    </div>
  );
}

export function Textarea({ error, className = '', ...rest }) {
  return <textarea className={`textarea ${className}`} aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Select({ error, className = '', options, placeholder, children, ...rest }) {
  return (
    <select className={`select ${className}`} aria-invalid={error ? 'true' : undefined} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
}

// Au-dela de ce nombre d'options, un <select> natif se parcourt mal : il faut
// derouler une liste plus haute que l'ecran et lire chaque ligne pour trouver
// la bonne. SelectRecherche prend le relais et ajoute un champ de recherche.
// En dessous, le select natif reste preferable — il est familier, accessible
// et bien meilleur sur mobile, ou le systeme dessine son propre selecteur.
export const SEUIL_RECHERCHE = 10;

// Liste deroulante cherchable. Meme contrat que <Select> (options, value,
// onChange, placeholder), mais la liste s'ouvre dans un panneau avec un champ
// de recherche en tete.
//
// La recherche passe par normaliser() comme toutes les recherches de
// l'application : casse et accents ignores — taper « vehicule » doit trouver
// « Types de vehicule » comme « Véhicules ».
export function SelectRecherche({
  options = [],
  value,
  onChange,
  placeholder = 'Tous',
  recherchePlaceholder = 'Rechercher',
  error,
}) {
  const [ouvert, setOuvert] = useState(false);
  const [terme, setTerme] = useState('');
  const [survol, setSurvol] = useState(0);
  const boite = useRef(null);
  const champ = useRef(null);
  const idListe = useId();

  const choisie = options.find((o) => String(o.value) === String(value ?? ''));

  // Le placeholder est une option comme une autre : c'est ce qui permet de
  // vider le critere sans quitter le panneau.
  const toutes = [{ value: '', label: placeholder }, ...options];
  const visibles = terme.trim()
    ? toutes.filter((o) => normaliser(o.label).includes(normaliser(terme).trim()))
    : toutes;

  // Fermer au clic exterieur. Le gestionnaire est garde dans une ref pour que
  // l'effet ne depende que de `ouvert` : le rendre dependant de fonctions
  // recreees a chaque frappe le rejouerait a chaque caractere tape.
  useEffect(() => {
    if (!ouvert) return undefined;
    const dehors = (e) => {
      if (boite.current && !boite.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    // Le champ prend le focus a l'ouverture, une seule fois : on ouvre cette
    // liste pour y taper.
    champ.current?.focus();
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  function ouvrir() {
    setTerme('');
    setSurvol(0);
    setOuvert(true);
  }

  function retenir(option) {
    onChange?.(option.value);
    setOuvert(false);
  }

  function auClavier(e) {
    if (e.key === 'Escape') {
      // Sans cela, la modale qui porte le panneau de filtres se fermerait
      // aussi : on ne ferait que refermer la liste, on perdrait l'ecran.
      e.stopPropagation();
      setOuvert(false);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      setSurvol((i) => Math.min(Math.max(i + pas, 0), visibles.length - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (visibles[survol]) retenir(visibles[survol]);
    }
  }

  return (
    <div className="selectr" ref={boite}>
      <button
        type="button"
        className="selectr__bouton"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        aria-invalid={error ? 'true' : undefined}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
      >
        <span className={choisie ? undefined : 'faint'}>{choisie ? choisie.label : placeholder}</span>
        <Icon name="chevronBas" size={14} />
      </button>

      {ouvert && (
        <div className="selectr__panneau" onKeyDown={auClavier}>
          <div className="selectr__recherche">
            <Icon name="recherche" size={14} />
            <input
              ref={champ}
              className="input"
              type="text"
              value={terme}
              onChange={(e) => { setTerme(e.target.value); setSurvol(0); }}
              placeholder={recherchePlaceholder}
              aria-label={recherchePlaceholder}
            />
          </div>

          {visibles.length === 0 ? (
            <p className="selectr__vide">Aucune entrée ne correspond.</p>
          ) : (
            <ul className="selectr__liste" role="listbox" id={idListe}>
              {visibles.map((o, i) => {
                const active = String(o.value) === String(value ?? '');
                return (
                  <li key={o.value || '__vide'}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={[
                        'selectr__option',
                        active ? 'is-active' : '',
                        i === survol ? 'is-survol' : '',
                        o.value === '' ? 'selectr__option--vide' : '',
                      ].filter(Boolean).join(' ')}
                      onMouseEnter={() => setSurvol(i)}
                      onClick={() => retenir(o)}
                    >
                      {o.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Checkbox({ label, hint, ...rest }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

/* Champ texte de recherche avec icone integree. */
export function SearchInput({ value, onChange, placeholder = 'Rechercher' }) {
  return (
    <div className="search">
      <Icon name="recherche" size={15} />
      <input
        className="input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

/* ---------------- Structures de page ---------------- */

/* Le petit « i » : tout ce qui explique une regle metier passe par la, au lieu
   d'occuper la page en permanence. Un pave d'explication affiche en continu
   finit par ne plus etre lu, et pousse vers le bas ce qu'on est venu faire. */
export function InfoBulle({ title, children, label = "Plus d'informations" }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        className="info-trigger"
        onClick={() => setOuvert(true)}
        aria-label={label}
        title={label}
      >
        <Icon name="info" size={13} />
      </button>
      <Modal open={ouvert} title={title} onClose={() => setOuvert(false)}>
        <div className="info-popup">{children}</div>
      </Modal>
    </>
  );
}

export function PageHeader({ title, description, info, actions }) {
  return (
    <header className="page-head">
      <div className="page-head__title">
        <h1>
          {title}
          {info && <InfoBulle title={info.title || title}>{info.content}</InfoBulle>}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, actions, footer, flush = false, children }) {
  const hasHead = title || actions;
  return (
    <section className="card">
      {hasHead && (
        <div className="card__head">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="card__head-actions">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
      {footer && <div className="card__foot">{footer}</div>}
    </section>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={`tab ${value === item.value ? 'is-active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Filtres et pagination ---------------- */

/* Les criteres d'une liste tiennent dans une modale, pas dans une barre posee
   au-dessus du tableau.

   Une liste multicritere aligne cinq a huit champs. Deployes en permanence ils
   occupent la moitie de la hauteur utile, repoussent les donnees sous la ligne
   de flottaison, et sont vides la plupart du temps : on ne filtre pas a chaque
   visite. Le bouton, lui, tient sur une ligne a cote d'« Actualiser », porte le
   compte de ce qui est pose, et n'ouvre le formulaire que quand on le demande.

   Les criteres s'appliquent au fur et a mesure de la saisie : le bouton de pied
   ne valide rien, il referme sur un resultat deja visible. */
export function BoutonFiltres({ filtres, titre = 'Filtrer la liste', description, size }) {
  const [ouvert, setOuvert] = useState(false);
  const poses = filtres.actifs.length;

  return (
    <>
      <Button
        className={poses ? 'btn--filtres is-actif' : 'btn--filtres'}
        size={size}
        icon="filtre"
        onClick={() => setOuvert(true)}
        aria-label={poses ? `Filtres : ${poses} critère${poses > 1 ? 's' : ''}` : 'Filtres'}
      >
        Filtres
        {poses > 0 && <span className="btn__pastille">{poses}</span>}
      </Button>

      <Modal
        open={ouvert}
        title={titre}
        description={description}
        onClose={() => setOuvert(false)}
        footer={
          <>
            <Button onClick={filtres.reset} disabled={poses === 0}>Tout effacer</Button>
            <Button variant="primary" onClick={() => setOuvert(false)}>
              Voir les résultats
            </Button>
          </>
        }
      >
        <ChampsFiltres filtres={filtres} />
      </Modal>
    </>
  );
}

/* Le formulaire du panneau, deduit de la definition des criteres : une seule
   description par ecran sert a la fois a dessiner le champ et a filtrer. */
export function ChampsFiltres({ filtres }) {
  const { criteres, valeurs, set } = filtres;

  return (
    <div className="form-grid">
      {criteres.map((critere) => {
        const valeur = valeurs[critere.cle] ?? '';

        if (critere.type === 'bascule') {
          return (
            <Field key={critere.cle} span={critere.span ?? 2}>
              <Checkbox
                label={critere.libelle}
                hint={critere.aide}
                checked={Boolean(valeur)}
                onChange={(e) => set(critere.cle, e.target.checked ? '1' : '')}
              />
            </Field>
          );
        }

        return (
          <Field
            key={critere.cle}
            label={critere.libelle}
            hint={critere.aide}
            span={critere.span ?? (critere.type === 'texte' ? 2 : undefined)}
          >
            {critere.type === 'texte' ? (
              <SearchInput
                value={valeur}
                onChange={(v) => set(critere.cle, v)}
                placeholder={critere.placeholder || 'Rechercher'}
              />
            ) : critere.type === 'select' ? (
              // Une liste courte reste un <select> natif ; passe le seuil, elle
              // devient cherchable. Le choix se fait sur le nombre d'options
              // reellement presentes, pas sur une propriete a maintenir : un
              // referentiel qui grossit bascule tout seul le jour ou il le faut.
              (critere.options || []).length >= SEUIL_RECHERCHE ? (
                <SelectRecherche
                  placeholder={critere.vide ?? 'Tous'}
                  options={critere.options || []}
                  value={valeur}
                  onChange={(v) => set(critere.cle, v)}
                  recherchePlaceholder={`Rechercher : ${critere.libelle.toLowerCase()}`}
                />
              ) : (
                <Select
                  placeholder={critere.vide ?? 'Tous'}
                  options={critere.options || []}
                  value={valeur}
                  onChange={(e) => set(critere.cle, e.target.value)}
                />
              )
            ) : critere.type === 'nombre' ? (
              <InputNombre
                unite={critere.unite}
                decimales={0}
                placeholder={critere.placeholder}
                value={valeur}
                onChange={(e) => set(critere.cle, e.target.value)}
              />
            ) : (
              <Input
                type="date"
                placeholder={critere.placeholder}
                value={valeur}
                onChange={(e) => set(critere.cle, e.target.value)}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

/* Rappel de ce qui est pose, au-dessus du tableau. Sans lui, une liste courte
   parce qu'elle est filtree se confond avec une liste courte parce qu'il n'y a
   rien : c'est le prix a payer pour avoir range les criteres hors de vue.
   La barre n'existe que quand un critere est pose. */
export function FiltresActifs({ filtres, variante }) {
  if (filtres.actifs.length === 0) return null;

  return (
    <div className={variante ? `filtres-actifs filtres-actifs--${variante}` : 'filtres-actifs'}>
      <span className="filtres-actifs__label">Filtres actifs</span>
      {filtres.actifs.map((critere) => (
        <button
          key={critere.cle}
          type="button"
          className="puce-filtre"
          title="Retirer ce filtre"
          onClick={() => filtres.set(critere.cle, '')}
        >
          {libelleFiltre(critere, filtres.valeurs[critere.cle])}
          <Icon name="croix" size={12} />
        </button>
      ))}
      <button type="button" className="filtres-actifs__tout" onClick={filtres.reset}>
        Tout effacer
      </button>
    </div>
  );
}

/* Barre de pagination, en pied de tableau. Le compte reste affiche meme sur une
   page unique — « 1–3 sur 3 » repond a une question qu'on se pose — mais les
   numeros n'apparaissent que s'il y a quelque chose a parcourir. */
export function Pagination({ etat, libelle = 'éléments', variante }) {
  const { page, pages, total, debut, taille, allerA } = etat;
  if (!total) return null;
  const fin = Math.min(debut + taille, total);

  return (
    <div className={variante ? `pagination pagination--${variante}` : 'pagination'}>
      <span className="pagination__compte">
        {debut + 1}–{fin} sur {total} {libelle}
      </span>

      {pages > 1 && (
        <div className="pagination__pages">
          <button
            type="button"
            className="pagination__fleche"
            onClick={() => allerA(page - 1)}
            disabled={page === 1}
            aria-label="Page précédente"
          >
            <Icon name="chevronGauche" size={14} />
          </button>

          {fenetrePages(page, pages).map((numero, index) =>
            numero === null ? (
              <span className="pagination__ellipse" key={`saut-${index}`} aria-hidden="true">…</span>
            ) : (
              <button
                key={numero}
                type="button"
                className={numero === page ? 'pagination__page is-active' : 'pagination__page'}
                aria-current={numero === page ? 'page' : undefined}
                aria-label={`Page ${numero}`}
                onClick={() => allerA(numero)}
              >
                {numero}
              </button>
            )
          )}

          <button
            type="button"
            className="pagination__fleche"
            onClick={() => allerA(page + 1)}
            disabled={page === pages}
            aria-label="Page suivante"
          >
            <Icon name="chevronDroite" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Indicateurs ---------------- */

export function Badge({ tone = 'neutral', dot = false, children }) {
  const cls = ['badge', tone !== 'neutral' ? `badge--${tone}` : '', dot ? 'badge--dot' : '']
    .filter(Boolean)
    .join(' ');
  return <span className={cls}>{children}</span>;
}

export function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {note && <div className="stat__note">{note}</div>}
    </div>
  );
}

export function DefinitionList({ items }) {
  return (
    <dl className="dl">
      {items.map((item) => (
        <div className="dl__item" key={item.label}>
          <dt className="dl__label">{item.label}</dt>
          <dd className="dl__value">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- Retours utilisateur ---------------- */

const ICONE_ALERTE = { danger: 'erreur', ok: 'succes', warn: 'alerte', info: 'info' };

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={ICONE_ALERTE[tone] || 'info'} size={17} />
      <div className="alert__body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'liste', title, description, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} strokeWidth={1.4} />
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Chargement' }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label}
    </div>
  );
}

/* Rend l'un des trois etats d'une liste : chargement, erreur, vide.

   `children` doit etre une fonction des que le contenu lit les donnees
   chargees : au premier rendu `useResource` n'a encore rien, et un enfant
   ecrit en JSX est construit par le parent avant que ce composant ait pu
   choisir d'afficher le chargement. `rows.map(...)` s'executerait alors sur
   `null` et ferait tomber toute la page, ecran blanc a la cle. La fonction
   n'est appelee que dans la branche ou les donnees sont la. */
export function AsyncBoundary({ loading, error, isEmpty, empty, children }) {
  if (loading) return <Loading />;
  if (error) {
    return (
      <div style={{ padding: 18 }}>
        <Alert tone="danger" title="Chargement impossible">{error}</Alert>
      </div>
    );
  }
  if (isEmpty) return empty;
  return typeof children === 'function' ? children() : children;
}

/* ---------------- Modale ---------------- */

// Pile des modales ouvertes. Une modale peut en ouvrir une autre — lire un
// constat pendant une declaration, par exemple — et les deux ecoutent Echap sur
// `document` : sans cette pile, une seule touche refermait aussi celle du
// dessous, et la saisie en cours partait avec elle.
const modalesOuvertes = [];

export function Modal({ open, title, description, onClose, footer, size, children }) {
  const ref = useRef(null);

  // onClose est presque toujours une fleche ecrite au fil du JSX
  // (`onClose={() => setEdition(null)}`) : elle change d'identite a chaque
  // rendu du parent. La mettre en dependance de l'effet ci-dessous rejouait
  // donc tout l'effet a chaque frappe dans un champ — et `ref.current.focus()`
  // reprenait le focus a l'input, ce qui obligeait a recliquer sur la modale
  // entre chaque caractere.
  //
  // On garde la fonction dans une ref, tenue a jour par son propre effet :
  // l'ecouteur clavier lit toujours la derniere version, sans que l'identite
  // de onClose entre dans les dependances de l'effet d'ouverture.
  const fermer = useRef(onClose);
  useEffect(() => {
    fermer.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const jeton = {};
    modalesOuvertes.push(jeton);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalesOuvertes[modalesOuvertes.length - 1] !== jeton) return;
      fermer.current?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Une seule fois, a l'ouverture : `open` est la seule dependance.
    ref.current?.focus();
    return () => {
      const rang = modalesOuvertes.indexOf(jeton);
      if (rang !== -1) modalesOuvertes.splice(rang, 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  // Rendue dans <body> plutot qu'a l'endroit ou elle est ecrite. Une modale
  // declaree au fil du texte — dans un titre, par exemple, comme le fait
  // InfoBulle — heriterait sinon de la typographie de son hote : le corps du
  // message s'afficherait a la taille du titre. Le portail la sort aussi de
  // tout ancetre transforme, qui casserait son `position: fixed`.
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={size ? `modal modal--${size}` : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal__head">
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" icon="croix" onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* Modale de confirmation pour les actions irreversibles. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', tone = 'danger', busy, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

/* ---------------- Formulaire de modale ---------------- */

/* Enveloppe un formulaire dans une modale : evite de repeter la gestion
   du submit, du message d'erreur et des boutons de pied. */
export function FormModal({ open, title, description, error, busy, submitLabel = 'Enregistrer', onSubmit, onClose, size, children }) {
  const formId = useId();
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      size={size}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" form={formId} variant="primary" loading={busy}>{submitLabel}</Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        className="stack"
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {children}
      </form>
    </Modal>
  );
}
