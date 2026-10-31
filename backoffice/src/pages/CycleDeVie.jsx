import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { LIBELLE_PROFIL } from '../lib/roles';
import { AsyncBoundary, Badge, Card, PageHeader } from '../components/ui';

const PROFILS = ['CLIENT', 'GESTIONNAIRE', 'ADMIN'];
const COURT = { CLIENT: 'ÉTU', GESTIONNAIRE: 'GEST', ADMIN: 'ADM' };

// Une matrice ne se filtre pas : son interet est la lecture d'ensemble, et
// trouee par un critere elle mentirait sur ce qu'elle decrit.
export default function CycleDeVie() {
  const workflow = useResource(() => api.get('/commandes/workflow'), []);

  return (
    <>
      <PageHeader
        title="Cycle de vie"
        description="Les passages déclarés en base, et le profil qui peut les franchir."
        info={{
          title: 'Lecture de la matrice',
          content: (
            <>
              <p>Une ligne est le statut de départ, une colonne le statut d’arrivée.</p>
              <p>
                Une case vide est un passage qui n’existe pas. Une case sans profil allumé existe
                mais n’est franchissable par personne.
              </p>
              <p>
                La confirmation exige l’acompte minimum, la livraison exige le solde : ces deux
                gardes sont tenues par la base, en plus des profils.
              </p>
            </>
          ),
        }}
      />

      <AsyncBoundary loading={workflow.loading} error={workflow.error}>
        {() => {
          const statuts = workflow.data.statuts;
          const transitions = workflow.data.transitions;
          const trouver = (depuis, vers) => transitions
            .find((t) => t.code_depuis === depuis && t.code_vers === vers);

          return (
            <>
              <Card title="Statuts">
                <div className="row">
                  {statuts.map((statut) => (
                    <Badge key={statut.code} tone={statut.ton}>
                      {statut.ordre}. {statut.libelle}
                      {statut.est_initial ? ' · départ' : ''}
                      {statut.est_final ? ' · terminal' : ''}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card title="Passages" flush>
                <div className="table-wrap">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th>Depuis \ Vers</th>
                        {statuts.map((statut) => <th key={statut.code}>{statut.libelle}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {statuts.map((depuis) => (
                        <tr key={depuis.code}>
                          <th>{depuis.libelle}</th>
                          {statuts.map((vers) => {
                            if (depuis.code === vers.code) return <td key={vers.code} className="is-self" />;
                            const transition = trouver(depuis.code, vers.code);
                            if (!transition) return <td key={vers.code} className="is-off">—</td>;
                            return (
                              <td key={vers.code}>
                                <div className="cell-roles">
                                  {PROFILS.map((profil) => (
                                    <span
                                      key={profil}
                                      className={`cell-btn ${transition.profils.includes(profil) ? 'is-on' : ''}`}
                                      title={LIBELLE_PROFIL[profil]}
                                    >
                                      {COURT[profil]}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </>
  );
}
