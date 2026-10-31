import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useForm, useResource } from '../lib/useResource';
import { formatAriary, formatDate, formatDateHeure } from '../lib/format';
import { useAuth } from '../auth/session';
import {
  Alert, AsyncBoundary, Badge, Button, Card, ConfirmDialog, DefinitionList, Field,
  FormModal, InputMontant, Input, PageHeader, Select, Stat, Textarea,
} from '../components/ui';

// Ce qui empeche un passage, dit AVANT le clic. La base tient les memes
// gardes (fn_chk_transition) : ici on les annonce, la-bas on les applique.
function motifBlocage(commande, transition, acompteMinimum) {
  if (!transition.autorise) return 'Réservé à un autre profil';
  const total = Number(commande.total);
  const paye = Number(commande.paye);
  if (transition.code_vers === 'CONFIRMEE') {
    const attendu = (total * acompteMinimum) / 100;
    if (paye < attendu) return `Acompte de ${formatAriary(attendu)} attendu, ${formatAriary(paye)} versés`;
  }
  if (transition.code_vers === 'LIVREE' && Number(commande.reste_a_payer) > 0) {
    return `Solde restant : ${formatAriary(commande.reste_a_payer)}`;
  }
  return null;
}

const VERSEMENT_VIDE = { montant: '', codeMode: 'ESPECES', reference: '', datePaiement: '', commentaire: '' };

// Ce que la caisse propose d'encaisser, dans l'ordre. L'acompte est la seule
// somme qui debloque la confirmation : tant qu'il n'est pas atteint, c'est lui
// qu'on met dans le champ ; une fois atteint, c'est le solde. Rien n'est
// impose : le champ reste libre, et la base ne refuse qu'au-dela du reste du
// (fn_chk_paiement). On peut donc toujours verser plus que la proposition.
function propositions(commande, acompteMinimum) {
  const reste = Number(commande.reste_a_payer);
  if (reste <= 0) return [];

  // Arrondi a l'ariary superieur : un versement a un ariary du seuil ferait
  // refuser la confirmation par le declencheur, sans que l'ecran l'explique.
  const attendu = Math.ceil((Number(commande.total) * acompteMinimum) / 100);
  const acompte = Math.min(Math.max(attendu - Number(commande.paye), 0), reste);

  const choix = [];
  if (acompte > 0 && acompte < reste) {
    choix.push({ cle: 'acompte', libelle: `Acompte ${acompteMinimum} %`, montant: acompte });
  }
  choix.push({
    cle: 'solde',
    libelle: choix.length ? 'Solde entier' : 'Tout le reste dû',
    montant: reste,
  });
  return choix;
}

export default function CommandeFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { compte, estAdmin } = useAuth();

  const commande = useResource(() => api.get(`/commandes/${id}`), [id]);
  const modes = useResource(() => api.get('/commandes/modes-paiement'), []);
  const parametres = useResource(() => api.get('/administration/parametres'), []);

  const action = useAction();
  const [encaissement, setEncaissement] = useState(false);
  const [passage, setPassage] = useState(null);
  const [aSupprimer, setASupprimer] = useState(null);

  const formPaiement = useForm(VERSEMENT_VIDE);
  const formPassage = useForm({ commentaire: '' });

  const acompteMinimum = Number(
    parametres.data?.find((p) => p.cle === 'acompte_minimum')?.valeur ?? 50
  );

  const choixMontant = commande.data ? propositions(commande.data, acompteMinimum) : [];

  // Le guichet ouvre la caisse avec la somme attendue deja saisie : c'est le
  // cas courant, et la corriger coute moins qu'avoir a la calculer.
  function ouvrirEncaissement() {
    action.setError(null);
    formPaiement.reset({
      ...VERSEMENT_VIDE,
      montant: choixMontant.length ? String(choixMontant[0].montant) : '',
    });
    setEncaissement(true);
  }

  async function encaisser(evenement) {
    evenement.preventDefault();
    const { ok } = await action.run(() => api.post(`/commandes/${id}/paiements`, formPaiement.values));
    if (ok) {
      setEncaissement(false);
      formPaiement.reset(VERSEMENT_VIDE);
      commande.reload();
    }
  }

  async function franchir(evenement) {
    evenement.preventDefault();
    const { ok } = await action.run(() => api.post(`/commandes/${id}/statuts`, {
      code: passage.code_vers,
      commentaire: formPassage.values.commentaire,
    }));
    if (ok) {
      setPassage(null);
      formPassage.reset({ commentaire: '' });
      commande.reload();
    }
  }

  async function retirerPaiement() {
    const { ok } = await action.run(() => api.del(`/commandes/paiements/${aSupprimer.id_paiement}`));
    setASupprimer(null);
    if (ok) commande.reload();
  }

  return (
    <AsyncBoundary loading={commande.loading} error={commande.error}>
      {() => {
        const c = commande.data;
        return (
          <>
            <PageHeader
              title={c.reference}
              description={`${c.client} · ${c.promotion} · ${c.telephone}`}
              actions={(
                <div className="btn-row">
                  <Button icon="flecheGauche" onClick={() => navigate('/commandes')}>Commandes</Button>
                  {!c.est_final && (
                    <Button icon="billet" variant="primary" onClick={ouvrirEncaissement}>
                      Encaisser
                    </Button>
                  )}
                </div>
              )}
            />

            {action.error && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <Stat label="Statut" value={<Badge tone={c.statut_ton}>{c.statut_libelle}</Badge>} note={formatDateHeure(c.date_statut)} />
              <Stat label="Total" value={formatAriary(c.total)} note={`${c.nb_articles} article${c.nb_articles > 1 ? 's' : ''}`} />
              <Stat label="Payé" value={formatAriary(c.paye)} note={`${c.taux_paiement} % du total`} />
              <Stat
                label="Reste à payer"
                value={formatAriary(c.reste_a_payer)}
                note={Number(c.reste_a_payer) === 0 ? 'Soldée' : `Acompte attendu : ${acompteMinimum} %`}
              />
            </div>

            {c.transitions.length > 0 && (
              <Card title="Faire avancer la commande">
                <div className="btn-row">
                  {c.transitions.map((transition) => {
                    const motif = motifBlocage(c, transition, acompteMinimum);
                    return (
                      <Button
                        key={transition.code_vers}
                        variant={transition.ton === 'danger' ? 'danger' : 'primary'}
                        disabled={Boolean(motif)}
                        title={motif || undefined}
                        onClick={() => { action.setError(null); setPassage(transition); }}
                      >
                        {transition.libelle}
                      </Button>
                    );
                  })}
                </div>
                {c.transitions.some((t) => motifBlocage(c, t, acompteMinimum)) && (
                  <p className="muted" style={{ marginTop: 10, fontSize: 'var(--fs-sm)' }}>
                    {c.transitions
                      .filter((t) => motifBlocage(c, t, acompteMinimum))
                      .map((t) => `${t.libelle} : ${motifBlocage(c, t, acompteMinimum)}`)
                      .join(' · ')}
                  </p>
                )}
              </Card>
            )}

            <div className="grid-2" style={{ marginTop: 16 }}>
              <Card title="Articles" flush>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Article</th>
                        <th style={{ width: 70 }}>Taille</th>
                        <th style={{ width: 50 }} className="num">Qté</th>
                        <th style={{ width: 110 }} className="num">P.U.</th>
                        <th style={{ width: 110 }} className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.lignes.map((ligne) => (
                        <tr key={ligne.id_ligne}>
                          <td>
                            <span className="table__primary">{ligne.produit}</span>
                            <span className="table__sub">{ligne.categorie} · {ligne.produit_reference}</span>
                          </td>
                          <td>{ligne.taille || '—'}</td>
                          <td className="num">{ligne.quantite}</td>
                          <td className="num">{formatAriary(ligne.prix_unitaire)}</td>
                          <td className="num">{formatAriary(ligne.total_ligne)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Étudiant">
                <DefinitionList
                  items={[
                    { label: 'Nom', value: <Link to={`/etudiants/${c.id_compte}`}>{c.client}</Link> },
                    { label: 'Numéro ETU', value: c.etu },
                    { label: 'Promotion', value: c.promotion },
                    { label: 'Téléphone', value: c.telephone },
                    { label: 'Commandée le', value: formatDateHeure(c.cree_le) },
                    { label: 'Remarque', value: c.remarque || '—' },
                  ]}
                />
              </Card>
            </div>

            <Card
              title="Encaissements"
              flush
              actions={!c.est_final && (
                <Button size="sm" icon="plus" onClick={ouvrirEncaissement}>
                  Ajouter
                </Button>
              )}
            >
              {c.paiements.length === 0 ? (
                <p className="muted" style={{ padding: '18px 16px' }}>Aucun versement.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 120 }}>Date</th>
                        <th style={{ width: 140 }}>Mode</th>
                        <th>Référence</th>
                        <th style={{ width: 160 }}>Enregistré par</th>
                        <th style={{ width: 120 }} className="num">Montant</th>
                        <th className="actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {c.paiements.map((paiement) => (
                        <tr key={paiement.id_paiement}>
                          <td className="nowrap">{formatDate(paiement.date_paiement)}</td>
                          <td>{paiement.mode}</td>
                          <td className="muted">{paiement.reference || paiement.commentaire || '—'}</td>
                          <td className="muted">{paiement.auteur || '—'}</td>
                          <td className="num">{formatAriary(paiement.montant)}</td>
                          <td className="actions">
                            {!c.est_final && (
                              <Button size="sm" variant="ghost" icon="corbeille" onClick={() => setASupprimer(paiement)}>
                                Retirer
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Historique">
              <ul className="timeline">
                {c.statuts.map((etape, index) => (
                  <li key={etape.id_commande_statut} className={index === 0 ? 'is-current' : ''}>
                    <div className="timeline__head">
                      <Badge tone={etape.ton}>{etape.libelle}</Badge>
                    </div>
                    <div className="timeline__meta">
                      {formatDateHeure(etape.date_statut)}
                      {etape.auteur ? ` · ${etape.auteur}` : ''}
                    </div>
                    {etape.commentaire && <p className="timeline__comment">{etape.commentaire}</p>}
                  </li>
                ))}
              </ul>
            </Card>

            {estAdmin && Number(c.paye) === 0 && (
              <Card title="Supprimer la commande">
                <div className="btn-row">
                  <Button
                    variant="danger"
                    icon="corbeille"
                    onClick={async () => {
                      const { ok } = await action.run(() => api.del(`/commandes/${id}`));
                      if (ok) navigate('/commandes');
                    }}
                  >
                    Mettre à la corbeille
                  </Button>
                </div>
              </Card>
            )}

            <FormModal
              open={encaissement}
              title="Enregistrer un versement"
              description={`${c.reference} · reste ${formatAriary(c.reste_a_payer)}`}
              error={action.error}
              busy={action.busy}
              submitLabel="Enregistrer"
              onSubmit={encaisser}
              onClose={() => setEncaissement(false)}
            >
              <div className="form-grid">
                <Field
                  label="Montant"
                  required
                  span={2}
                  hint={`Acompte de ${acompteMinimum} % : ${formatAriary((Number(c.total) * acompteMinimum) / 100)} · déjà versé ${formatAriary(c.paye)}. Un versement plus élevé est accepté, jusqu’au reste dû.`}
                >
                  <InputMontant
                    {...formPaiement.bind('montant')}
                    min={1}
                    max={Number(c.reste_a_payer)}
                    required
                  />
                  {/* Le champ arrive rempli ; ces deux montants disent de quoi
                      il est fait et permettent de passer de l'un a l'autre
                      sans retaper. */}
                  {choixMontant.length > 0 && (
                    <div className="montant-choix">
                      {choixMontant.map((choix) => (
                        <button
                          key={choix.cle}
                          type="button"
                          className={`montant-choix__option ${
                            Number(formPaiement.values.montant) === choix.montant ? 'is-choisi' : ''
                          }`}
                          onClick={() => formPaiement.setField('montant', String(choix.montant))}
                        >
                          <strong>{formatAriary(choix.montant)}</strong>
                          <span>{choix.libelle}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
                <Field label="Mode" required>
                  <Select
                    {...formPaiement.bind('codeMode')}
                    options={(modes.data || []).map((m) => ({ value: m.code, label: m.libelle }))}
                    required
                  />
                </Field>
                <Field label="Date" hint="Vide : aujourd’hui">
                  <Input type="date" {...formPaiement.bind('datePaiement')} />
                </Field>
                <Field label="Référence" span={2} hint="Numéro de transaction mobile money, s’il y en a un">
                  <Input {...formPaiement.bind('reference')} placeholder="0341234567" />
                </Field>
                <Field label="Commentaire" span={2}>
                  <Textarea rows={2} {...formPaiement.bind('commentaire')} />
                </Field>
              </div>
            </FormModal>

            <FormModal
              open={Boolean(passage)}
              title={passage?.libelle || ''}
              description={`${c.reference} · ${c.statut_libelle} → ${passage?.statut_libelle || ''}`}
              error={action.error}
              busy={action.busy}
              submitLabel={passage?.libelle || 'Valider'}
              onSubmit={franchir}
              onClose={() => setPassage(null)}
            >
              <Field label="Commentaire" hint="Visible par l’étudiant dans son suivi">
                <Textarea rows={3} {...formPassage.bind('commentaire')} />
              </Field>
            </FormModal>

            <ConfirmDialog
              open={Boolean(aSupprimer)}
              title="Retirer ce versement"
              message={aSupprimer
                ? `${formatAriary(aSupprimer.montant)} du ${formatDate(aSupprimer.date_paiement)} ira dans la corbeille.`
                : ''}
              confirmLabel="Retirer"
              busy={action.busy}
              onConfirm={retirerPaiement}
              onClose={() => setASupprimer(null)}
            />
          </>
        );
      }}
    </AsyncBoundary>
  );
}
