import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatAriary, formatDate } from '../lib/format';
import Icon from '../components/Icon';
import {
  AsyncBoundary, Badge, BoutonFiltres, Card, EmptyState, FiltresActifs, Pagination,
} from '../components/ui';

export default function MesCommandes() {
  const navigate = useNavigate();
  const commandes = useResource(() => api.get('/commandes'), []);
  const workflow = useResource(() => api.get('/commandes/workflow'), []);

  const lignes = commandes.data || [];

  // Le rang de l'etape courante sur le chemin normal : une commande annulee
  // n'est nulle part sur ce chemin et n'affiche donc pas de rang.
  const etapes = (workflow.data?.statuts || []).filter((statut) => statut.code !== 'ANNULEE');
  const rang = (code) => etapes.findIndex((statut) => statut.code === code) + 1;

  // Les onglets de statut sont un filtre affiche en permanence : ils rejoignent
  // le panneau, comme les autres criteres.
  const criteres = useMemo(() => [
    {
      cle: 'recherche',
      type: 'texte',
      libelle: 'Rechercher',
      placeholder: 'Référence ou article',
      champs: ['reference', 'articles'],
    },
    {
      cle: 'statut',
      type: 'select',
      libelle: 'Statut',
      champ: 'code_statut',
      vide: 'Tous',
      options: (workflow.data?.statuts || []).map((s) => ({ value: s.code, label: s.libelle })),
    },
    {
      cle: 'paiement',
      type: 'select',
      libelle: 'Paiement',
      vide: 'Tous',
      options: [
        { value: 'solde', label: 'Soldée' },
        { value: 'reste', label: 'Reste à payer' },
      ],
      test: (ligne, valeur) => (valeur === 'solde'
        ? Number(ligne.reste_a_payer) === 0
        : Number(ligne.reste_a_payer) > 0),
    },
    { cle: 'depuis', type: 'date', libelle: 'Commandée depuis le', champ: 'cree_le' },
  ], [workflow.data]);

  const filtres = useFiltres(criteres);
  const retenues = filtrer(lignes, filtres);
  const pagination = usePagination(retenues, { cle: filtres.empreinte });

  const reste = retenues.reduce((somme, c) => somme + Number(c.reste_a_payer), 0);

  return (
    <div className="page">
      <div className="page__tete page__tete-barre">
        <div>
          <h1>Mes commandes</h1>
          <p>
            {retenues.length} commande{retenues.length > 1 ? 's' : ''}
            {reste > 0 ? ` · ${formatAriary(reste)} à payer` : ''}
            {' · '}
            <span className="muted">ouvrez une commande pour son détail et son avancement</span>
          </p>
        </div>
        <BoutonFiltres filtres={filtres} titre="Filtrer mes commandes" />
      </div>

      <FiltresActifs filtres={filtres} variante="nue" />

      <Card flush>
        <AsyncBoundary
          loading={commandes.loading}
          error={commandes.error}
          isEmpty={retenues.length === 0}
          empty={(
            <EmptyState
              icon="paquet"
              title={filtres.actifs.length
                ? 'Aucune commande ne correspond à ces critères'
                : 'Vous n’avez pas encore commandé'}
              action={<Link to="/catalogue" className="btn btn--primary">Voir le catalogue</Link>}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table table--clickable">
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>Référence</th>
                      <th>Articles</th>
                      <th style={{ width: 160 }}>Statut</th>
                      <th style={{ width: 130 }} className="num">Total</th>
                      <th style={{ width: 130 }} className="num">Reste</th>
                      <th style={{ width: 130 }} className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((commande) => {
                      const etape = rang(commande.code_statut);
                      return (
                        <tr
                          key={commande.id_commande}
                          onClick={() => navigate(`/mes-commandes/${commande.id_commande}`)}
                        >
                          <td>
                            <Link to={`/mes-commandes/${commande.id_commande}`} className="table__lien">
                              {commande.reference}
                            </Link>
                            <span className="table__sub">{formatDate(commande.cree_le)}</span>
                          </td>
                          <td className="muted">{commande.articles}</td>
                          <td>
                            <Badge tone={commande.statut_ton}>{commande.statut_libelle}</Badge>
                            {etape > 0 && (
                              <span className="table__sub">Étape {etape} sur {etapes.length}</span>
                            )}
                          </td>
                          <td className="num">{formatAriary(commande.total)}</td>
                          <td className="num">
                            {Number(commande.reste_a_payer) > 0
                              ? formatAriary(commande.reste_a_payer)
                              : <span className="muted">—</span>}
                          </td>
                          {/* Le raccourci du clic ne se devine pas : la ligne
                              le dit. Le lien du clavier reste sur la
                              reference, celui-ci ne fait que le montrer. */}
                          <td className="actions">
                            <span className="table__ouvrir" aria-hidden="true">
                              Voir le détail
                              <Icon name="chevronDroite" size={14} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="commandes" />
            </>
          )}
        </AsyncBoundary>
      </Card>
    </div>
  );
}
