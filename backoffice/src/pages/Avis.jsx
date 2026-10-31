import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/session';
import Note from '../components/Note';
import {
  Alert, AsyncBoundary, BoutonFiltres, Button, Card, ConfirmDialog, EmptyState,
  FiltresActifs, PageHeader, Pagination, Stat,
} from '../components/ui';

export default function Avis() {
  const { estAdmin } = useAuth();
  const avis = useResource(() => api.get('/avis'), []);
  const action = useAction();
  const [aRetirer, setARetirer] = useState(null);

  const lignes = avis.data || [];

  const criteres = useMemo(() => [
    {
      cle: 'recherche',
      type: 'texte',
      libelle: 'Rechercher',
      placeholder: 'Article, étudiant ou commentaire',
      champs: ['produit', 'client', 'commentaire', 'produit_reference'],
    },
    {
      cle: 'note',
      type: 'select',
      libelle: 'Note',
      vide: 'Toutes',
      options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} sur 5` })),
    },
    { cle: 'noteMax', type: 'nombre', libelle: 'Note maximum', champ: 'note', borne: 'max', decimales: 0 },
    { cle: 'depuis', type: 'date', libelle: 'Déposé depuis le', champ: 'cree_le' },
  ], []);

  const filtres = useFiltres(criteres);
  const retenus = filtrer(lignes, filtres);
  const pagination = usePagination(retenus, { cle: filtres.empreinte });

  const moyenne = retenus.length
    ? (retenus.reduce((somme, a) => somme + a.note, 0) / retenus.length).toFixed(1)
    : '—';

  async function retirer() {
    const { ok } = await action.run(() => api.del(`/avis/${aRetirer.id_avis}`));
    setARetirer(null);
    if (ok) avis.reload();
  }

  return (
    <>
      <PageHeader
        title="Avis"
        description="Déposés par les étudiants sur les articles qu’ils ont reçus."
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer les avis" />
            <Button icon="actualiser" onClick={avis.reload}>Actualiser</Button>
          </div>
        )}
      />

      {action.error && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat label="Avis" value={retenus.length} />
        <Stat label="Note moyenne" value={moyenne} />
      </div>

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={avis.loading}
          error={avis.error}
          isEmpty={retenus.length === 0}
          empty={(
            <EmptyState
              icon="etoile"
              title={filtres.actifs.length ? 'Aucun avis ne correspond à ces critères' : 'Aucun avis déposé'}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 220 }}>Article</th>
                      <th style={{ width: 110 }}>Note</th>
                      <th>Commentaire</th>
                      <th style={{ width: 180 }}>Étudiant</th>
                      <th style={{ width: 110 }}>Déposé le</th>
                      {estAdmin && <th className="actions" />}
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((ligne) => (
                      <tr key={ligne.id_avis}>
                        <td>
                          <span className="table__primary">{ligne.produit}</span>
                          <span className="table__sub">{ligne.produit_reference}</span>
                        </td>
                        <td><Note valeur={ligne.note} /></td>
                        <td className="muted">{ligne.commentaire || '—'}</td>
                        <td>
                          <span className="table__primary">{ligne.client}</span>
                          <span className="table__sub">{ligne.promotion}</span>
                        </td>
                        <td className="nowrap muted">{formatDate(ligne.cree_le)}</td>
                        {estAdmin && (
                          <td className="actions">
                            <Button size="sm" variant="ghost" icon="corbeille" onClick={() => setARetirer(ligne)}>
                              Retirer
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="avis" />
            </>
          )}
        </AsyncBoundary>
      </Card>

      <ConfirmDialog
        open={Boolean(aRetirer)}
        title="Retirer cet avis"
        message={aRetirer ? `L’avis de ${aRetirer.client} sur ${aRetirer.produit} ira dans la corbeille.` : ''}
        confirmLabel="Retirer"
        busy={action.busy}
        onConfirm={retirer}
        onClose={() => setARetirer(null)}
      />
    </>
  );
}
