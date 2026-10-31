import { useMemo } from 'react';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatDateHeure } from '../lib/format';
import {
  Alert, AsyncBoundary, BoutonFiltres, Button, Card, EmptyState, FiltresActifs,
  PageHeader, Pagination,
} from '../components/ui';

// Une liste groupee ne se pagine pas a travers ses groupes : la corbeille est
// mise a plat, le type devient une colonne et un critere.
export default function Corbeille() {
  const corbeille = useResource(() => api.get('/administration/corbeille'), []);
  const reprise = useAction();

  const lignes = corbeille.data || [];

  const criteres = useMemo(() => {
    const types = [...new Map(lignes.map((l) => [l.type, l.type_libelle])).entries()];
    return [
      {
        cle: 'recherche',
        type: 'texte',
        libelle: 'Rechercher',
        placeholder: 'Libellé ou code de l’élément supprimé',
        champs: ['libelle', 'code'],
      },
      {
        cle: 'type',
        type: 'select',
        libelle: 'Type',
        vide: 'Tous',
        options: types.map(([value, label]) => ({ value, label })),
      },
      { cle: 'depuis', type: 'date', libelle: 'Supprimé depuis le', champ: 'supprime_le' },
    ];
  }, [lignes]);

  const filtres = useFiltres(criteres);
  const retenues = filtrer(lignes, filtres);
  const pagination = usePagination(retenues, { cle: filtres.empreinte });

  async function restaurer(element) {
    const { ok } = await reprise.run(() => api.post(`/administration/corbeille/${element.type}/${element.id}/restaurer`));
    if (ok) corbeille.reload();
  }

  return (
    <>
      <PageHeader
        title="Corbeille"
        info={{
          title: 'Ce que restaurer veut dire',
          content: (
            <>
              <p>Rien n’est effacé de la base : un élément supprimé change d’état et sort des listes.</p>
              <p>
                Une restauration peut être refusée si la place a été reprise : un numéro ETU
                réattribué, une catégorie elle-même supprimée, un encaissement devenu supérieur au
                reste dû.
              </p>
            </>
          ),
        }}
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer la corbeille" />
            <Button icon="actualiser" onClick={corbeille.reload}>Actualiser</Button>
          </div>
        )}
      />

      {reprise.error && <Alert tone="danger" title="Restauration impossible">{reprise.error}</Alert>}

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={corbeille.loading}
          error={corbeille.error}
          isEmpty={retenues.length === 0}
          empty={(
            <EmptyState
              icon="corbeille"
              title={filtres.actifs.length ? 'Aucun élément ne correspond à ces critères' : 'Corbeille vide'}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Élément</th>
                      <th style={{ width: 140 }}>Type</th>
                      <th style={{ width: 180 }}>Supprimé le</th>
                      <th style={{ width: 170 }}>Par</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((element) => (
                      <tr key={`${element.type}-${element.id}`}>
                        <td>
                          <span className="table__primary">{element.libelle}</span>
                          <span className="table__sub mono">{element.code}</span>
                        </td>
                        <td>{element.type_libelle}</td>
                        <td className="muted nowrap">{formatDateHeure(element.supprime_le)}</td>
                        <td className="muted">{element.auteur || '—'}</td>
                        <td className="actions">
                          <Button
                            size="sm"
                            icon="actualiser"
                            loading={reprise.busy}
                            onClick={() => { reprise.setError(null); restaurer(element); }}
                          >
                            Restaurer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="éléments supprimés" />
            </>
          )}
        </AsyncBoundary>
      </Card>
    </>
  );
}
