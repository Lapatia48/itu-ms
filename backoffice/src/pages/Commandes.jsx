import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatAriary, formatDate } from '../lib/format';
import {
  AsyncBoundary, Badge, BoutonFiltres, Button, Card, EmptyState, FiltresActifs,
  PageHeader, Pagination, Stat,
} from '../components/ui';

export default function Commandes() {
  const navigate = useNavigate();
  const commandes = useResource(() => api.get('/commandes'), []);
  const workflow = useResource(() => api.get('/commandes/workflow'), []);

  const lignes = commandes.data || [];

  const criteres = useMemo(() => {
    const statuts = workflow.data?.statuts || [];
    const promotions = [...new Set(lignes.map((c) => c.promotion).filter(Boolean))].sort();
    return [
      {
        cle: 'recherche',
        type: 'texte',
        libelle: 'Rechercher',
        placeholder: 'Référence, étudiant, numéro ETU, article',
        champs: ['reference', 'client', 'etu', 'articles'],
      },
      {
        cle: 'statut',
        type: 'select',
        libelle: 'Statut',
        champ: 'code_statut',
        vide: 'Tous',
        options: statuts.map((s) => ({ value: s.code, label: s.libelle })),
      },
      {
        cle: 'promotion',
        type: 'select',
        libelle: 'Promotion',
        vide: 'Toutes',
        options: promotions.map((p) => ({ value: p, label: p })),
      },
      {
        cle: 'paiement',
        type: 'select',
        libelle: 'Paiement',
        vide: 'Tous',
        options: [
          { value: 'solde', label: 'Soldée' },
          { value: 'acompte', label: 'Acompte versé' },
          { value: 'aucun', label: 'Rien versé' },
        ],
        test: (ligne, valeur) => {
          const paye = Number(ligne.paye);
          const reste = Number(ligne.reste_a_payer);
          if (valeur === 'solde') return reste === 0 && paye > 0;
          if (valeur === 'acompte') return paye > 0 && reste > 0;
          return paye === 0;
        },
      },
      {
        cle: 'minimum',
        type: 'nombre',
        libelle: 'Total minimum',
        champ: 'total',
        unite: 'Ar',
      },
      { cle: 'depuis', type: 'date', libelle: 'Commandée depuis le', champ: 'cree_le' },
      { cle: 'jusquau', type: 'date', libelle: 'Commandée jusqu’au', champ: 'cree_le', borne: 'max' },
    ];
  }, [workflow.data, lignes]);

  const filtres = useFiltres(criteres);
  const retenues = filtrer(lignes, filtres);
  const pagination = usePagination(retenues, { cle: filtres.empreinte });

  // Les compteurs decrivent la selection entiere, jamais la page affichee :
  // calcules sur dix lignes, ils donneraient des chiffres faux.
  const total = retenues.reduce((somme, c) => somme + Number(c.total), 0);
  const reste = retenues.reduce((somme, c) => somme + Number(c.reste_a_payer), 0);

  return (
    <>
      <PageHeader
        title="Commandes"
        info={{
          title: 'Ce que disent les compteurs',
          content: (
            <>
              <p>Les trois compteurs portent sur la sélection filtrée, pas sur la page affichée.</p>
              <p>Une commande annulée ne doit plus rien : elle sort du reste à encaisser.</p>
            </>
          ),
        }}
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer les commandes" />
            <Button icon="actualiser" onClick={commandes.reload}>Actualiser</Button>
          </div>
        )}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <Stat label="Commandes" value={retenues.length} />
        <Stat label="Total commandé" value={formatAriary(total)} />
        <Stat label="Reste à encaisser" value={formatAriary(reste)} />
      </div>

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={commandes.loading}
          error={commandes.error}
          isEmpty={retenues.length === 0}
          empty={(
            <EmptyState
              icon="liste"
              title={filtres.actifs.length
                ? 'Aucune commande ne correspond à ces critères'
                : 'Aucune commande enregistrée'}
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
                      <th>Étudiant</th>
                      <th style={{ width: 150 }}>Statut</th>
                      <th style={{ width: 120 }} className="num">Total</th>
                      <th style={{ width: 120 }} className="num">Payé</th>
                      <th style={{ width: 120 }} className="num">Reste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((commande) => (
                      <tr
                        key={commande.id_commande}
                        onClick={() => navigate(`/commandes/${commande.id_commande}`)}
                      >
                        <td>
                          <Link to={`/commandes/${commande.id_commande}`} className="table__lien">
                            {commande.reference}
                          </Link>
                          <span className="table__sub">{formatDate(commande.cree_le)}</span>
                        </td>
                        <td>
                          <span className="table__primary">{commande.client}</span>
                          <span className="table__sub">
                            {commande.promotion} · {commande.articles}
                          </span>
                        </td>
                        <td>
                          <Badge tone={commande.statut_ton}>{commande.statut_libelle}</Badge>
                        </td>
                        <td className="num">{formatAriary(commande.total)}</td>
                        <td className="num">
                          {formatAriary(commande.paye)}
                          <span className="table__sub">{commande.taux_paiement} %</span>
                        </td>
                        <td className="num">
                          {Number(commande.reste_a_payer) > 0
                            ? <strong style={{ color: 'var(--danger)' }}>{formatAriary(commande.reste_a_payer)}</strong>
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="commandes" />
            </>
          )}
        </AsyncBoundary>
      </Card>
    </>
  );
}
