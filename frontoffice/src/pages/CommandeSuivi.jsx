import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { formatAriary, formatDate, formatDateHeure } from '../lib/format';
import Icon from '../components/Icon';
import {
  Alert, AsyncBoundary, Badge, Button, Card, ConfirmDialog,
} from '../components/ui';

export default function CommandeSuivi() {
  const { id } = useParams();
  const commande = useResource(() => api.get(`/commandes/${id}`), [id]);
  const workflow = useResource(() => api.get('/commandes/workflow'), []);
  const action = useAction();
  const [annulation, setAnnulation] = useState(false);

  async function annuler() {
    const { ok } = await action.run(() => api.post(`/commandes/${id}/statuts`, { code: 'ANNULEE' }));
    setAnnulation(false);
    if (ok) commande.reload();
  }

  return (
    <div className="page page--etroite">
      <AsyncBoundary loading={commande.loading} error={commande.error}>
        {() => {
          const c = commande.data;
          const annulee = c.code_statut === 'ANNULEE';
          const franchis = new Map(c.statuts.map((etape) => [etape.code_statut, etape]));

          // Tant que la commande suit son cours, on montre le chemin entier,
          // etapes a venir comprises. Une fois annulee, on ne montre que ce
          // qui a eu lieu : afficher la suite ferait lire un chemin qui
          // n'existe plus.
          const statuts = workflow.data?.statuts || [];
          const parcours = annulee
            ? [...c.statuts].reverse().map((etape) => statuts.find((s) => s.code === etape.code_statut) || {
              code: etape.code_statut, libelle: etape.libelle,
            })
            : statuts.filter((statut) => statut.code !== 'ANNULEE');

          const peutAnnuler = c.transitions.some((t) => t.code_vers === 'ANNULEE' && t.autorise);

          // `c.statuts` arrive du plus recent au plus ancien : la tete, c'est
          // le passage en cours.
          const derniere = c.statuts[0];
          const franchies = parcours.filter((statut) => franchis.has(statut.code)).length;
          // Le chemin vient du workflow, charge a part : tant qu'il n'est pas
          // la, on ne compte pas d'etapes plutot que d'en annoncer zero.
          const chemin = parcours.length > 0;
          const avancement = chemin ? Math.round((franchies / parcours.length) * 100) : 0;

          return (
            <>
              <p style={{ marginBottom: 18 }}>
                <Link to="/mes-commandes"><Icon name="flecheGauche" size={14} /> Mes commandes</Link>
              </p>

              <div className="page__tete page__tete-barre">
                <div>
                  <h1>{c.reference}</h1>
                  <p>Commandée le {formatDateHeure(c.cree_le)}</p>
                </div>
                <Badge tone={c.statut_ton}>{c.statut_libelle}</Badge>
              </div>

              {action.error && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

              {Number(c.reste_a_payer) > 0 && !annulee && (
                <Alert tone="warn" title={`${formatAriary(c.reste_a_payer)} à régler au local du club`} />
              )}

              <div className="suivi">
                <div>
                  <Card
                    title="Suivi"
                    description={annulee
                      ? `Annulée le ${formatDateHeure(derniere?.date_statut)}`
                      : `${chemin ? `Étape ${franchies} sur ${parcours.length} · ` : ''}${c.statut_libelle} depuis le ${formatDateHeure(derniere?.date_statut)}`}
                  >
                    {!annulee && chemin && (
                      <div
                        className="suivi-jauge"
                        role="progressbar"
                        aria-label="Avancement de la commande"
                        aria-valuenow={avancement}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${avancement}%` }} />
                      </div>
                    )}
                    <ol className="suivi-etapes">
                      {parcours.map((statut) => {
                        const etape = franchis.get(statut.code);
                        const courant = statut.code === c.code_statut;
                        const classe = etape
                          ? (courant ? 'is-courante' : 'is-faite')
                          : 'is-attente';
                        return (
                          <li key={statut.code} className={`suivi-etape ${classe}`}>
                            <span className="suivi-etape__pastille">
                              {etape && <Icon name="check" size={13} strokeWidth={2.4} />}
                            </span>
                            <div>
                              <div className="suivi-etape__libelle">{statut.libelle}</div>
                              <div className="suivi-etape__date">
                                {etape ? formatDateHeure(etape.date_statut) : 'À venir'}
                              </div>
                              {etape?.commentaire && (
                                <p className="suivi-etape__mot">{etape.commentaire}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </Card>

                  <Card title="Articles" flush>
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th style={{ width: 70 }}>Taille</th>
                            <th style={{ width: 50 }} className="num">Qté</th>
                            <th style={{ width: 120 }} className="num">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lignes.map((ligne) => (
                            <tr key={ligne.id_ligne}>
                              <td>
                                <Link to={`/article/${ligne.id_produit}`} className="table__lien">
                                  {ligne.produit}
                                </Link>
                                <span className="table__sub">{ligne.categorie}</span>
                              </td>
                              <td>{ligne.taille || '—'}</td>
                              <td className="num">{ligne.quantite}</td>
                              <td className="num">{formatAriary(ligne.total_ligne)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {c.paiements.length > 0 && (
                    <Card title="Versements" flush>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th style={{ width: 130 }}>Date</th>
                              <th>Mode</th>
                              <th style={{ width: 130 }} className="num">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.paiements.map((paiement) => (
                              <tr key={paiement.id_paiement}>
                                <td className="nowrap">{formatDate(paiement.date_paiement)}</td>
                                <td>{paiement.mode}</td>
                                <td className="num">{formatAriary(paiement.montant)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>

                <aside className="vif">
                  <div className="recap">
                    <div className="recap__ligne">
                      <span>Articles</span>
                      <strong>{c.nb_articles}</strong>
                    </div>
                    <div className="recap__ligne">
                      <span>Versé</span>
                      <strong>{formatAriary(c.paye)}</strong>
                    </div>
                    <div className="recap__ligne recap__total">
                      <span>{annulee ? 'Commande annulée' : 'Reste à payer'}</span>
                      <strong>{formatAriary(c.reste_a_payer)}</strong>
                    </div>

                    {peutAnnuler && (
                      <Button variant="accent" block onClick={() => setAnnulation(true)}>
                        Annuler ma commande
                      </Button>
                    )}
                  </div>
                </aside>
              </div>

              <ConfirmDialog
                open={annulation}
                title="Annuler cette commande"
                message={`${c.reference} passera en Annulée. Vous devrez la repasser pour revenir dessus.`}
                confirmLabel="Annuler la commande"
                cancelLabel="Revenir"
                busy={action.busy}
                onConfirm={annuler}
                onClose={() => setAnnulation(false)}
              />
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
