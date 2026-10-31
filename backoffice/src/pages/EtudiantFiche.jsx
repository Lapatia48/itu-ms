import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { formatAriary, formatDate, formatDateHeure } from '../lib/format';
import { LIBELLE_PROFIL } from '../lib/roles';
import {
  AsyncBoundary, Badge, Button, Card, DefinitionList, EmptyState, PageHeader, Stat,
} from '../components/ui';

export default function EtudiantFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const compte = useResource(() => api.get(`/administration/comptes/${id}`), [id]);

  return (
    <AsyncBoundary loading={compte.loading} error={compte.error}>
      {() => {
        const c = compte.data;
        const commandes = c.commandes || [];
        const total = commandes.reduce((somme, x) => somme + Number(x.total), 0);
        const reste = commandes.reduce((somme, x) => somme + Number(x.reste_a_payer), 0);

        return (
          <>
            <PageHeader
              title={`${c.prenom} ${c.nom}`}
              description={`${c.etu} · ${c.promotion}`}
              actions={<Button icon="flecheGauche" onClick={() => navigate('/etudiants')}>Étudiants</Button>}
            />

            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <Stat label="Commandes" value={commandes.length} />
              <Stat label="Total commandé" value={formatAriary(total)} />
              <Stat label="Reste à payer" value={formatAriary(reste)} />
            </div>

            <div className="grid-aside">
              <Card title="Commandes" flush>
                {commandes.length === 0 ? (
                  <EmptyState icon="liste" title="Aucune commande" />
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 150 }}>Référence</th>
                          <th style={{ width: 150 }}>Statut</th>
                          <th className="num">Total</th>
                          <th className="num">Payé</th>
                          <th className="num">Reste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commandes.map((commande) => (
                          <tr key={commande.id_commande}>
                            <td>
                              <Link to={`/commandes/${commande.id_commande}`} className="table__lien">
                                {commande.reference}
                              </Link>
                              <span className="table__sub">{formatDate(commande.cree_le)}</span>
                            </td>
                            <td><Badge tone={commande.statut_ton}>{commande.statut_libelle}</Badge></td>
                            <td className="num">{formatAriary(commande.total)}</td>
                            <td className="num">{formatAriary(commande.paye)}</td>
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
                )}
              </Card>

              <Card title="Compte">
                <DefinitionList
                  items={[
                    { label: 'Numéro ETU', value: c.etu },
                    { label: 'Promotion', value: c.promotion },
                    { label: 'Téléphone', value: c.telephone },
                    { label: 'Profil', value: LIBELLE_PROFIL[c.profil] },
                    { label: 'Inscrit le', value: formatDateHeure(c.cree_le) },
                  ]}
                />
              </Card>
            </div>
          </>
        );
      }}
    </AsyncBoundary>
  );
}
