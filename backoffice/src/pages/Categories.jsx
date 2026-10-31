import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useForm, useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import {
  Alert, AsyncBoundary, BoutonFiltres, Button, Card, ConfirmDialog, EmptyState, Field,
  FiltresActifs, FormModal, Input, InputNombre, PageHeader, Pagination,
} from '../components/ui';

const VIDE = { code: '', libelle: '', ordre: '0' };

export default function Categories() {
  const categories = useResource(() => api.get('/catalogue/categories'), []);
  const action = useAction();
  const [edition, setEdition] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const form = useForm(VIDE);

  const lignes = categories.data || [];

  const criteres = useMemo(() => [
    {
      cle: 'recherche',
      type: 'texte',
      libelle: 'Rechercher',
      placeholder: 'Code ou libellé',
      champs: ['code', 'libelle'],
    },
    {
      cle: 'occupee',
      type: 'select',
      libelle: 'Articles',
      vide: 'Toutes',
      options: [
        { value: 'oui', label: 'Avec articles' },
        { value: 'non', label: 'Sans article' },
      ],
      test: (ligne, valeur) => (valeur === 'oui' ? Number(ligne.nb_produits) > 0 : Number(ligne.nb_produits) === 0),
    },
  ], []);

  const filtres = useFiltres(criteres);
  const retenues = filtrer(lignes, filtres);
  const pagination = usePagination(retenues, { cle: filtres.empreinte });

  function ouvrir(categorie) {
    action.setError(null);
    form.reset(categorie
      ? { code: categorie.code, libelle: categorie.libelle, ordre: String(categorie.ordre) }
      : VIDE);
    setEdition(categorie || {});
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const { ok } = await action.run(() => (edition.id_categorie
      ? api.patch(`/catalogue/categories/${edition.id_categorie}`, form.values)
      : api.post('/catalogue/categories', form.values)));
    if (ok) {
      setEdition(null);
      categories.reload();
    }
  }

  // La boite se referme dans tous les cas : un refus (« catégorie utilisée par
  // 3 articles ») se lit sur la page, pas derriere une modale restee ouverte.
  async function supprimer() {
    const { ok } = await action.run(() => api.del(`/catalogue/categories/${aSupprimer.id_categorie}`));
    setASupprimer(null);
    if (ok) categories.reload();
  }

  return (
    <>
      <PageHeader
        title="Catégories"
        info={{
          title: 'Code et libellé',
          content: (
            <>
              <p>Le code identifie la catégorie dans la base ; le libellé est ce que lit l’étudiant.</p>
              <p>L’ordre règle la place de la catégorie dans le menu de la boutique.</p>
            </>
          ),
        }}
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer les catégories" />
            <Button icon="actualiser" onClick={categories.reload}>Actualiser</Button>
            <Button icon="plus" variant="primary" onClick={() => ouvrir(null)}>Ajouter une catégorie</Button>
          </div>
        )}
      />

      {action.error && !edition && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={categories.loading}
          error={categories.error}
          isEmpty={retenues.length === 0}
          empty={(
            <EmptyState
              icon="reglages"
              title={filtres.actifs.length ? 'Aucune catégorie ne correspond à ces critères' : 'Aucune catégorie'}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 160 }}>Code</th>
                      <th>Libellé</th>
                      <th style={{ width: 90 }} className="num">Ordre</th>
                      <th style={{ width: 110 }} className="num">Articles</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((categorie) => (
                      <tr key={categorie.id_categorie}>
                        <td className="mono">{categorie.code}</td>
                        <td className="table__primary">{categorie.libelle}</td>
                        <td className="num">{categorie.ordre}</td>
                        <td className="num">{categorie.nb_produits}</td>
                        <td className="actions">
                          <Button size="sm" icon="crayon" onClick={() => ouvrir(categorie)}>Modifier</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="corbeille"
                            onClick={() => { action.setError(null); setASupprimer(categorie); }}
                          >
                            Supprimer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="catégories" />
            </>
          )}
        </AsyncBoundary>
      </Card>

      <FormModal
        open={Boolean(edition)}
        title={edition?.id_categorie ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
        error={action.error}
        busy={action.busy}
        onSubmit={enregistrer}
        onClose={() => setEdition(null)}
      >
        <div className="form-grid">
          <Field label="Code" required>
            <Input {...form.bind('code')} maxLength={30} placeholder="SWEAT" required />
          </Field>
          <Field label="Ordre">
            <InputNombre {...form.bind('ordre')} decimales={0} min={0} max={99} />
          </Field>
          <Field label="Libellé" required span={2}>
            <Input {...form.bind('libelle')} maxLength={80} placeholder="Sweats" required />
          </Field>
        </div>
      </FormModal>

      <ConfirmDialog
        open={Boolean(aSupprimer)}
        title="Supprimer cette catégorie"
        message={aSupprimer ? `${aSupprimer.libelle} ira dans la corbeille.` : ''}
        confirmLabel="Supprimer"
        busy={action.busy}
        onConfirm={supprimer}
        onClose={() => setASupprimer(null)}
      />
    </>
  );
}
