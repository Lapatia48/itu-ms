import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { formatAriary, formatAriaryCompact, formatDate } from '../lib/format';
import Graphique from '../components/Graphique';
import Icon from '../components/Icon';
import { AsyncBoundary, Badge, Card, PageHeader } from '../components/ui';

const PERIODES = [
  { code: '7j', label: '7 jours' },
  { code: '30j', label: '30 jours' },
  { code: '90j', label: '90 jours' },
  { code: '12m', label: 'Année' },
];

// Un ecart se lit contre la periode precedente de meme duree. Pas de
// pourcentage quand la periode precedente est vide : il serait infini.
function Variation({ actuel, precedent, sens = 'haut-bon' }) {
  const a = Number(actuel);
  const b = Number(precedent);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const ecart = ((a - b) / b) * 100;
  if (Math.abs(ecart) < 0.5) return <span className="variation variation--neutre">stable</span>;
  const favorable = sens === 'neutre' ? null : (ecart > 0) === (sens === 'haut-bon');
  const ton = favorable === null ? 'neutre' : (favorable ? 'ok' : 'danger');
  return (
    <span className={`variation variation--${ton}`}>
      <Icon name={ecart > 0 ? 'hausse' : 'baisse'} size={13} />
      {Math.abs(ecart).toFixed(0)} %
    </span>
  );
}

function Tuile({ libelle, valeur, note, variation }) {
  return (
    <div className="tuile">
      <div className="tuile__tete">
        <span className="tuile__libelle">{libelle}</span>
      </div>
      <div className="tuile__valeur">{valeur}</div>
      <div className="tuile__bas">
        {note && <span className="tuile__note">{note}</span>}
        {variation}
      </div>
    </div>
  );
}

export default function TableauDeBord() {
  // La periode tient dans l'adresse : une vue de tableau de bord est une
  // chose qu'on s'envoie ou qu'on met en favori.
  const [params, setParams] = useSearchParams();
  const periode = PERIODES.some((p) => p.code === params.get('periode'))
    ? params.get('periode')
    : '30j';
  const setPeriode = (code) => setParams({ periode: code }, { replace: true });
  const tdb = useResource(() => api.get('/tableau-de-bord', { periode }), [periode]);

  return (
    <div className="tdb">
      <PageHeader
        title="Tableau de bord"
        info={{
          title: 'Ce que couvre la période',
          content: (
            <>
              <p>
                La période cadre les commandes et les encaissements. Le reste à encaisser, lui,
                décrit tout le portefeuille ouvert : c’est un stock, il ne se borne pas à une
                fenêtre.
              </p>
              <p>Un encaissement compte à sa date de versement, pas à la date de la commande.</p>
            </>
          ),
        }}
        actions={(
          <div className="segments" role="group" aria-label="Période">
            {PERIODES.map((p) => (
              <button
                key={p.code}
                type="button"
                className={`segments__bouton ${periode === p.code ? 'is-actif' : ''}`}
                onClick={() => setPeriode(p.code)}
                aria-pressed={periode === p.code}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      />

      <AsyncBoundary loading={tdb.loading && !tdb.data} error={tdb.error}>
        {() => {
          const d = tdb.data;
          return (
            <div className={`tdb__corps ${tdb.loading ? 'is-rechargement' : ''}`}>
              <div className="tdb-tuiles">
                <Tuile
                  libelle="Commandes"
                  valeur={d.commandes.nombre}
                  note={`${formatAriary(d.commandes.total)} commandés`}
                  variation={<Variation actuel={d.commandes.nombre} precedent={d.commandes.nombre_avant} />}
                />
                <Tuile
                  libelle="Encaissé"
                  valeur={formatAriaryCompact(d.encaisse.montant)}
                  note="Versements reçus sur la période"
                  variation={<Variation actuel={d.encaisse.montant} precedent={d.encaisse.montant_avant} />}
                />
                <Tuile
                  libelle="Reste à encaisser"
                  valeur={formatAriaryCompact(d.reste.montant)}
                  note={`${d.reste.nb_commandes} commande${d.reste.nb_commandes > 1 ? 's' : ''} non soldée${d.reste.nb_commandes > 1 ? 's' : ''}`}
                />
                <Tuile
                  libelle="Panier moyen"
                  valeur={formatAriaryCompact(
                    d.commandes.nombre > 0 ? Number(d.commandes.total) / d.commandes.nombre : 0
                  )}
                  note="Sur la période"
                />
              </div>

              <div className="tdb-rangee">
                <Card title="Encaissements par jour" flush>
                  <div className="tdb-carte__graphe">
                    <Graphique serie={d.serie} cle="encaisse" libelle="encaissé" />
                  </div>
                </Card>

                <Card title="Commandes par statut" flush>
                  <ul className="barres">
                    {d.statuts.map((statut) => {
                      const maximum = Math.max(...d.statuts.map((s) => s.nb), 1);
                      return (
                        <li key={statut.code} className={`barres__ligne ${statut.nb === 0 ? 'is-nul' : ''}`}>
                          {/* Le chiffre mene aux lignes qui le composent : la
                              liste reproduit exactement cette selection. */}
                          <Link to={`/commandes?statut=${statut.code}`} className="barres__libelle">
                            {statut.libelle}
                          </Link>
                          <span className="barres__piste">
                            <span
                              className="barres__barre"
                              style={{
                                width: `${(statut.nb / maximum) * 100}%`,
                                background: statut.code === 'ANNULEE' ? 'var(--ink-300)' : 'var(--serie-entrees)',
                              }}
                            />
                          </span>
                          <span className="barres__valeur">{statut.nb}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>

              <div className="tdb-rangee">
                <Card title="Articles les plus commandés" flush>
                  {d.produits.length === 0 ? (
                    <p className="muted" style={{ padding: '16px' }}>Aucune commande sur la période.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th style={{ width: 90 }} className="num">Pièces</th>
                            <th style={{ width: 130 }} className="num">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.produits.map((produit) => (
                            <tr key={produit.id_produit}>
                              <td>
                                <span className="table__primary">{produit.nom}</span>
                                <span className="table__sub">{produit.categorie}</span>
                              </td>
                              <td className="num">{produit.quantite}</td>
                              <td className="num">{formatAriary(produit.montant)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card title="À encaisser" flush>
                  {d.aRegler.length === 0 ? (
                    <p className="muted" style={{ padding: '16px' }}>Tout est soldé.</p>
                  ) : (
                    <ul className="file">
                      {d.aRegler.map((commande) => (
                        <li key={commande.id_commande}>
                          <Link to={`/commandes/${commande.id_commande}`} className="file__ligne">
                            <span className="file__libelle">
                              {commande.reference} · {commande.client}
                              <span className="file__montant">
                                {commande.statut_libelle} · {commande.taux_paiement} % versés
                              </span>
                            </span>
                            <span className="file__nombre">{formatAriaryCompact(commande.reste_a_payer)}</span>
                            <Icon name="chevronDroite" size={15} className="file__fleche" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card title="Dernières commandes" flush>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 150 }}>Référence</th>
                        <th>Étudiant</th>
                        <th style={{ width: 150 }}>Statut</th>
                        <th style={{ width: 130 }} className="num">Total</th>
                        <th style={{ width: 130 }} className="num">Reste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.dernieres.map((commande) => (
                        <tr key={commande.id_commande}>
                          <td>
                            <Link to={`/commandes/${commande.id_commande}`} className="table__lien">
                              {commande.reference}
                            </Link>
                            <span className="table__sub">{formatDate(commande.cree_le)}</span>
                          </td>
                          <td>
                            <span className="table__primary">{commande.client}</span>
                            <span className="table__sub">{commande.promotion}</span>
                          </td>
                          <td><Badge tone={commande.statut_ton}>{commande.statut_libelle}</Badge></td>
                          <td className="num">{formatAriary(commande.total)}</td>
                          <td className="num">
                            {Number(commande.reste_a_payer) > 0
                              ? formatAriary(commande.reste_a_payer)
                              : <span className="muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
