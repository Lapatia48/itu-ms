import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAction, useForm, useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatAriary } from '../lib/format';
import {
  Alert, AsyncBoundary, BoutonFiltres, Button, Card, Checkbox, ConfirmDialog, EmptyState,
  Field, FiltresActifs, FormModal, Input, InputMontant, PageHeader, Pagination, Select, Textarea,
} from '../components/ui';

const VIDE = { nom: '', idCategorie: '', prix: '', couleur: '', description: '' };

export default function Articles() {
  const articles = useResource(() => api.get('/catalogue/produits'), []);
  const categories = useResource(() => api.get('/catalogue/categories'), []);
  const tailles = useResource(() => api.get('/catalogue/tailles'), []);

  const action = useAction();
  const [edition, setEdition] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [taillesChoisies, setTaillesChoisies] = useState([]);
  const [fichier, setFichier] = useState(null);
  const form = useForm(VIDE);

  const lignes = articles.data || [];

  const criteres = useMemo(() => [
    {
      cle: 'recherche',
      type: 'texte',
      libelle: 'Rechercher',
      placeholder: 'Nom, référence ou couleur',
      champs: ['nom', 'reference', 'couleur', 'description'],
    },
    {
      cle: 'categorie',
      type: 'select',
      libelle: 'Catégorie',
      champ: 'id_categorie',
      vide: 'Toutes',
      options: (categories.data || []).map((c) => ({ value: c.id_categorie, label: c.libelle })),
    },
    { cle: 'prixMin', type: 'nombre', libelle: 'Prix minimum', champ: 'prix', unite: 'Ar' },
    { cle: 'prixMax', type: 'nombre', libelle: 'Prix maximum', champ: 'prix', unite: 'Ar', borne: 'max' },
    {
      cle: 'taille',
      type: 'select',
      libelle: 'Taille proposée',
      vide: 'Toutes',
      options: (tailles.data || []).map((t) => ({ value: t.code, label: t.libelle })),
      test: (ligne, valeur) => String(ligne.tailles || '').split(' ').includes(valeur),
    },
    { cle: 'noteMin', type: 'nombre', libelle: 'Note minimum', champ: 'note_moyenne', decimales: 1 },
  ], [categories.data, tailles.data]);

  const filtres = useFiltres(criteres);
  const retenus = filtrer(lignes, filtres);
  const pagination = usePagination(retenus, { cle: filtres.empreinte });

  function ouvrir(article) {
    action.setError(null);
    setFichier(null);
    if (article) {
      form.reset({
        nom: article.nom,
        idCategorie: String(article.id_categorie),
        prix: String(article.prix),
        couleur: article.couleur || '',
        description: article.description || '',
      });
      const codes = String(article.tailles || '').split(' ').filter(Boolean);
      setTaillesChoisies(
        (tailles.data || []).filter((t) => codes.includes(t.code)).map((t) => t.id_taille)
      );
    } else {
      form.reset(VIDE);
      setTaillesChoisies([]);
    }
    setEdition(article || {});
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const corps = new FormData();
    Object.entries(form.values).forEach(([cle, valeur]) => corps.append(cle, valeur));
    corps.append('tailles', JSON.stringify(taillesChoisies));
    if (fichier) corps.append('image', fichier);

    const { ok } = await action.run(() => (edition.id_produit
      ? api.patch(`/catalogue/produits/${edition.id_produit}`, corps)
      : api.post('/catalogue/produits', corps)));
    if (ok) {
      setEdition(null);
      articles.reload();
    }
  }

  async function supprimer() {
    const { ok } = await action.run(() => api.del(`/catalogue/produits/${aSupprimer.id_produit}`));
    setASupprimer(null);
    if (ok) articles.reload();
  }

  return (
    <>
      <PageHeader
        title="Articles"
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer le catalogue" />
            <Button icon="actualiser" onClick={articles.reload}>Actualiser</Button>
            <Button icon="plus" variant="primary" onClick={() => ouvrir(null)}>Ajouter un article</Button>
          </div>
        )}
      />

      {action.error && !edition && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={articles.loading}
          error={articles.error}
          isEmpty={retenus.length === 0}
          empty={(
            <EmptyState
              icon="couches"
              title={filtres.actifs.length ? 'Aucun article ne correspond à ces critères' : 'Catalogue vide'}
              action={<Button icon="plus" variant="primary" onClick={() => ouvrir(null)}>Ajouter un article</Button>}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }} />
                      <th>Article</th>
                      <th style={{ width: 150 }}>Catégorie</th>
                      <th style={{ width: 150 }}>Tailles</th>
                      <th style={{ width: 110 }} className="num">Prix</th>
                      <th style={{ width: 90 }} className="num">Vendus</th>
                      <th style={{ width: 90 }} className="num">Note</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((article) => (
                      <tr key={article.id_produit}>
                        <td>
                          <span className="vignette">
                            {article.image
                              ? <img src={`/images/${article.image}`} alt="" />
                              : <span className="vignette__vide" />}
                          </span>
                        </td>
                        <td>
                          <span className="table__primary">{article.nom}</span>
                          <span className="table__sub">{article.reference} · {article.couleur || 'sans couleur'}</span>
                        </td>
                        <td>{article.categorie}</td>
                        <td className="muted">{article.tailles || '—'}</td>
                        <td className="num">{formatAriary(article.prix)}</td>
                        <td className="num">{article.nb_vendus}</td>
                        <td className="num">
                          {Number(article.nb_avis) > 0
                            ? `${article.note_moyenne}/5`
                            : <span className="muted">—</span>}
                        </td>
                        <td className="actions">
                          <Button size="sm" icon="crayon" onClick={() => ouvrir(article)}>Modifier</Button>
                          <Button size="sm" variant="ghost" icon="corbeille" onClick={() => setASupprimer(article)}>
                            Supprimer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="articles" />
            </>
          )}
        </AsyncBoundary>
      </Card>

      <FormModal
        open={Boolean(edition)}
        title={edition?.id_produit ? 'Modifier l’article' : 'Ajouter un article'}
        error={action.error}
        busy={action.busy}
        onSubmit={enregistrer}
        onClose={() => setEdition(null)}
        size="lg"
      >
        <div className="form-grid">
          <Field label="Nom" required span={2}>
            <Input {...form.bind('nom')} maxLength={120} required />
          </Field>
          <Field label="Catégorie" required>
            <Select
              {...form.bind('idCategorie')}
              placeholder="Choisir"
              options={(categories.data || []).map((c) => ({ value: c.id_categorie, label: c.libelle }))}
              required
            />
          </Field>
          <Field label="Prix" required>
            <InputMontant {...form.bind('prix')} min={1} required />
          </Field>
          <Field label="Couleur">
            <Input {...form.bind('couleur')} maxLength={40} placeholder="Marine" />
          </Field>
          <Field label="Photo" hint={edition?.image ? 'Vide : la photo actuelle est conservée' : 'JPEG, PNG ou WebP'}>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFichier(e.target.files?.[0] || null)}
            />
          </Field>
          <Field label="Description" span={2}>
            <Textarea rows={3} {...form.bind('description')} maxLength={2000} />
          </Field>
          <Field label="Tailles proposées" required span={2}>
            <div className="row">
              {(tailles.data || []).map((taille) => (
                <Checkbox
                  key={taille.id_taille}
                  label={taille.libelle}
                  checked={taillesChoisies.includes(taille.id_taille)}
                  onChange={(e) => setTaillesChoisies((precedent) => (e.target.checked
                    ? [...precedent, taille.id_taille]
                    : precedent.filter((id) => id !== taille.id_taille)))}
                />
              ))}
            </div>
          </Field>
        </div>
      </FormModal>

      <ConfirmDialog
        open={Boolean(aSupprimer)}
        title="Supprimer cet article"
        message={aSupprimer ? `${aSupprimer.nom} ira dans la corbeille et quittera la boutique. Les commandes qui le citent gardent leur ligne.` : ''}
        confirmLabel="Supprimer"
        busy={action.busy}
        onConfirm={supprimer}
        onClose={() => setASupprimer(null)}
      />
    </>
  );
}
