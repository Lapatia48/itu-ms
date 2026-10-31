import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import CarteArticle from '../components/CarteArticle';
import {
  AsyncBoundary, BoutonFiltres, EmptyState, FiltresActifs, Pagination, Select,
} from '../components/ui';

const TRIS = {
  nouveautes: { label: 'Nouveautés', comparer: (a, b) => new Date(b.cree_le) - new Date(a.cree_le) },
  prixCroissant: { label: 'Prix croissant', comparer: (a, b) => a.prix - b.prix },
  prixDecroissant: { label: 'Prix décroissant', comparer: (a, b) => b.prix - a.prix },
  note: { label: 'Mieux notés', comparer: (a, b) => b.note_moyenne - a.note_moyenne },
};

export default function Catalogue() {
  const articles = useResource(() => api.get('/catalogue/produits'), []);
  const categories = useResource(() => api.get('/catalogue/categories'), []);
  const tailles = useResource(() => api.get('/catalogue/tailles'), []);
  const [tri, setTri] = useState('nouveautes');

  const lignes = articles.data || [];

  const criteres = useMemo(() => {
    const couleurs = [...new Set(lignes.map((a) => a.couleur).filter(Boolean))].sort();
    return [
      {
        cle: 'recherche',
        type: 'texte',
        libelle: 'Rechercher',
        placeholder: 'Nom, matière, couleur',
        champs: ['nom', 'description', 'couleur', 'reference', 'categorie'],
      },
      {
        cle: 'categorie',
        type: 'select',
        libelle: 'Catégorie',
        champ: 'id_categorie',
        vide: 'Toutes',
        options: (categories.data || []).map((c) => ({ value: c.id_categorie, label: c.libelle })),
      },
      {
        cle: 'taille',
        type: 'select',
        libelle: 'Taille',
        vide: 'Toutes',
        options: (tailles.data || []).map((t) => ({ value: t.code, label: t.libelle })),
        test: (ligne, valeur) => String(ligne.tailles || '').split(' ').includes(valeur),
      },
      {
        cle: 'couleur',
        type: 'select',
        libelle: 'Couleur',
        vide: 'Toutes',
        options: couleurs.map((c) => ({ value: c, label: c })),
      },
      { cle: 'prixMin', type: 'nombre', libelle: 'Prix minimum', champ: 'prix', unite: 'Ar' },
      { cle: 'prixMax', type: 'nombre', libelle: 'Prix maximum', champ: 'prix', unite: 'Ar', borne: 'max' },
      {
        cle: 'note',
        type: 'select',
        libelle: 'Note',
        vide: 'Toutes',
        options: [
          { value: '4', label: '4 étoiles et plus' },
          { value: '3', label: '3 étoiles et plus' },
        ],
        test: (ligne, valeur) => Number(ligne.note_moyenne) >= Number(valeur),
      },
    ];
  }, [categories.data, tailles.data, lignes]);

  const filtres = useFiltres(criteres);
  const retenus = [...filtrer(lignes, filtres)].sort(TRIS[tri].comparer);
  const pagination = usePagination(retenus, { cle: `${filtres.empreinte}-${tri}` });

  return (
    <div className="page">
      <div className="page__tete page__tete-barre">
        <div>
          <h1>Catalogue</h1>
          <p>{retenus.length} article{retenus.length > 1 ? 's' : ''} disponible{retenus.length > 1 ? 's' : ''}</p>
        </div>
        <div className="row">
          <Select
            value={tri}
            onChange={(e) => setTri(e.target.value)}
            aria-label="Trier"
            options={Object.entries(TRIS).map(([value, { label }]) => ({ value, label }))}
          />
          <BoutonFiltres filtres={filtres} titre="Filtrer le catalogue" />
        </div>
      </div>

      <FiltresActifs filtres={filtres} variante="nue" />

      <AsyncBoundary
        loading={articles.loading}
        error={articles.error}
        isEmpty={retenus.length === 0}
        empty={(
          <EmptyState
            icon="vetement"
            title={filtres.actifs.length
              ? 'Aucun article ne correspond à ces critères'
              : 'Le catalogue est vide'}
          />
        )}
      >
        {() => (
          <>
            <div className="articles">
              {pagination.tranche.map((article) => (
                <CarteArticle key={article.id_produit} article={article} />
              ))}
            </div>
            <Pagination etat={pagination} libelle="articles" />
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
