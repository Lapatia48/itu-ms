import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useForm, useResource } from '../lib/useResource';
import { filtrer, useFiltres, usePagination } from '../lib/liste';
import { formatAriary } from '../lib/format';
import { useAuth } from '../auth/session';
import { LIBELLE_PROFIL } from '../lib/roles';
import {
  Alert, AsyncBoundary, Badge, BoutonFiltres, Button, Card, ConfirmDialog, EmptyState, Field,
  FiltresActifs, FormModal, Input, Modal, PageHeader, Pagination, Select,
} from '../components/ui';

const VIDE = { etu: '', nom: '', prenom: '', promotion: '', telephone: '', profil: 'CLIENT' };

export default function Etudiants() {
  const { estAdmin } = useAuth();
  const comptes = useResource(() => api.get('/administration/comptes'), []);
  const action = useAction();

  const [edition, setEdition] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);
  const [provisoire, setProvisoire] = useState(null);
  const form = useForm(VIDE);

  const lignes = comptes.data || [];

  const criteres = useMemo(() => {
    const promotions = [...new Set(lignes.map((c) => c.promotion).filter(Boolean))].sort();
    return [
      {
        cle: 'recherche',
        type: 'texte',
        libelle: 'Rechercher',
        placeholder: 'Nom, prénom, numéro ETU ou téléphone',
        champs: ['nom', 'prenom', 'etu', 'telephone'],
      },
      {
        cle: 'promotion',
        type: 'select',
        libelle: 'Promotion',
        vide: 'Toutes',
        options: promotions.map((p) => ({ value: p, label: p })),
      },
      {
        cle: 'profil',
        type: 'select',
        libelle: 'Profil',
        vide: 'Tous',
        options: Object.entries(LIBELLE_PROFIL).map(([value, label]) => ({ value, label })),
      },
      {
        cle: 'activite',
        type: 'select',
        libelle: 'Commandes',
        vide: 'Tous',
        options: [
          { value: 'oui', label: 'A commandé' },
          { value: 'non', label: 'Jamais commandé' },
        ],
        test: (ligne, valeur) => (valeur === 'oui'
          ? Number(ligne.nb_commandes) > 0
          : Number(ligne.nb_commandes) === 0),
      },
      { cle: 'resteMin', type: 'nombre', libelle: 'Reste à payer minimum', champ: 'reste_a_payer', unite: 'Ar' },
    ];
  }, [lignes]);

  const filtres = useFiltres(criteres);
  const retenus = filtrer(lignes, filtres);
  const pagination = usePagination(retenus, { cle: filtres.empreinte });

  function ouvrir(compte) {
    action.setError(null);
    form.reset(compte
      ? {
        etu: compte.etu,
        nom: compte.nom,
        prenom: compte.prenom,
        promotion: compte.promotion,
        telephone: compte.telephone,
        profil: compte.profil,
      }
      : VIDE);
    setEdition(compte || {});
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const { ok, result } = await action.run(() => (edition.id_compte
      ? api.patch(`/administration/comptes/${edition.id_compte}`, form.values)
      : api.post('/administration/comptes', form.values)));
    if (ok) {
      setEdition(null);
      comptes.reload();
      if (result?.motDePasseProvisoire) {
        setProvisoire({ compte: result, motDePasse: result.motDePasseProvisoire });
      }
    }
  }

  async function reinitialiser(compte) {
    const { ok, result } = await action.run(() => api.post(`/administration/comptes/${compte.id_compte}/mot-de-passe`));
    if (ok) setProvisoire({ compte, motDePasse: result.motDePasseProvisoire });
  }

  async function supprimer() {
    const { ok } = await action.run(() => api.del(`/administration/comptes/${aSupprimer.id_compte}`));
    setASupprimer(null);
    if (ok) comptes.reload();
  }

  return (
    <>
      <PageHeader
        title="Étudiants"
        info={{
          title: 'Comptes',
          content: (
            <>
              <p>Un compte ouvert ici reçoit un mot de passe provisoire affiché une seule fois.</p>
              <p>Un compte supprimé part à la corbeille : ses commandes restent au suivi.</p>
            </>
          ),
        }}
        actions={(
          <div className="btn-row">
            <BoutonFiltres filtres={filtres} titre="Filtrer les comptes" />
            <Button icon="actualiser" onClick={comptes.reload}>Actualiser</Button>
            <Button icon="plus" variant="primary" onClick={() => ouvrir(null)}>Ouvrir un compte</Button>
          </div>
        )}
      />

      {action.error && !edition && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

      <Card flush>
        <FiltresActifs filtres={filtres} />

        <AsyncBoundary
          loading={comptes.loading}
          error={comptes.error}
          isEmpty={retenus.length === 0}
          empty={(
            <EmptyState
              icon="utilisateurs"
              title={filtres.actifs.length ? 'Aucun compte ne correspond à ces critères' : 'Aucun compte'}
            />
          )}
        >
          {() => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Étudiant</th>
                      <th style={{ width: 120 }}>Promotion</th>
                      <th style={{ width: 160 }}>Téléphone</th>
                      <th style={{ width: 130 }}>Profil</th>
                      <th style={{ width: 100 }} className="num">Commandes</th>
                      <th style={{ width: 120 }} className="num">Reste</th>
                      <th className="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.tranche.map((compte) => (
                      <tr key={compte.id_compte}>
                        <td>
                          <Link to={`/etudiants/${compte.id_compte}`} className="table__lien">
                            {compte.prenom} {compte.nom}
                          </Link>
                          <span className="table__sub">{compte.etu}</span>
                        </td>
                        <td>{compte.promotion}</td>
                        <td className="muted nowrap">{compte.telephone}</td>
                        <td>
                          {compte.profil === 'CLIENT'
                            ? <span className="muted">Étudiant</span>
                            : <Badge tone="info">{LIBELLE_PROFIL[compte.profil]}</Badge>}
                        </td>
                        <td className="num">{compte.nb_commandes}</td>
                        <td className="num">
                          {Number(compte.reste_a_payer) > 0
                            ? formatAriary(compte.reste_a_payer)
                            : <span className="muted">—</span>}
                        </td>
                        <td className="actions">
                          <Button size="sm" icon="crayon" onClick={() => ouvrir(compte)}>Modifier</Button>
                          <Button size="sm" variant="ghost" icon="cle" onClick={() => reinitialiser(compte)}>
                            Mot de passe
                          </Button>
                          {estAdmin && (
                            <Button size="sm" variant="ghost" icon="corbeille" onClick={() => setASupprimer(compte)}>
                              Supprimer
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination etat={pagination} libelle="comptes" />
            </>
          )}
        </AsyncBoundary>
      </Card>

      <FormModal
        open={Boolean(edition)}
        title={edition?.id_compte ? 'Modifier le compte' : 'Ouvrir un compte'}
        error={action.error}
        busy={action.busy}
        onSubmit={enregistrer}
        onClose={() => setEdition(null)}
      >
        <div className="form-grid">
          <Field label="Numéro ETU" required>
            <Input
              {...form.bind('etu')}
              maxLength={20}
              placeholder="ETU1234"
              disabled={Boolean(edition?.id_compte)}
              required
            />
          </Field>
          <Field label="Promotion" required>
            <Input {...form.bind('promotion')} maxLength={60} placeholder="L3 IG" required />
          </Field>
          <Field label="Prénom" required>
            <Input {...form.bind('prenom')} maxLength={60} required />
          </Field>
          <Field label="Nom" required>
            <Input {...form.bind('nom')} maxLength={60} required />
          </Field>
          <Field label="Téléphone" required>
            <Input {...form.bind('telephone')} maxLength={30} placeholder="+261 34 00 000 00" required />
          </Field>
          {estAdmin && (
            <Field label="Profil" required>
              <Select
                {...form.bind('profil')}
                options={Object.entries(LIBELLE_PROFIL).map(([value, label]) => ({ value, label }))}
                required
              />
            </Field>
          )}
        </div>
      </FormModal>

      <Modal
        open={Boolean(provisoire)}
        title="Mot de passe provisoire, affiché une seule fois"
        onClose={() => { setProvisoire(null); comptes.reload(); }}
        footer={<Button variant="primary" onClick={() => { setProvisoire(null); comptes.reload(); }}>J’ai noté</Button>}
      >
        {provisoire && (
          <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 600 }} className="mono">
            {provisoire.compte.etu} · {provisoire.motDePasse}
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(aSupprimer)}
        title="Supprimer ce compte"
        message={aSupprimer ? `${aSupprimer.prenom} ${aSupprimer.nom} ira dans la corbeille et ne pourra plus se connecter.` : ''}
        confirmLabel="Supprimer"
        busy={action.busy}
        onConfirm={supprimer}
        onClose={() => setASupprimer(null)}
      />
    </>
  );
}
