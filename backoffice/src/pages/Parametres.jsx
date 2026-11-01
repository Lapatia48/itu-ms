import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { formatDateHeure } from '../lib/format';
import {
  Alert, AsyncBoundary, Button, Card, Field, FormModal, Input, InputNombre, Modal, PageHeader,
} from '../components/ui';

// Mot a recopier pour la remise a zero. Le meme que celui qu'attend l'API :
// ici il evite un clic malheureux, la-bas il est la condition reelle, et la
// base revérifie encore le profil de son cote.
const MOT_DE_PASSAGE = 'REINITIALISER';

function pluriel(nombre, singulier, plurielForme = `${singulier}s`) {
  return `${nombre} ${nombre === 1 ? singulier : plurielForme}`;
}

export default function Parametres() {
  const parametres = useResource(() => api.get('/administration/parametres'), []);
  const action = useAction();
  const [edition, setEdition] = useState(null);
  const [valeur, setValeur] = useState('');

  const remise = useAction();
  const [remiseOuverte, setRemiseOuverte] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [efface, setEfface] = useState(null);

  const motJuste = saisie.trim().toUpperCase() === MOT_DE_PASSAGE;

  function ouvrir(parametre) {
    action.setError(null);
    setValeur(parametre.valeur);
    setEdition(parametre);
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const { ok } = await action.run(() => api.patch(`/administration/parametres/${edition.cle}`, { valeur }));
    if (ok) {
      setEdition(null);
      parametres.reload();
    }
  }

  function ouvrirRemise() {
    remise.setError(null);
    setSaisie('');
    setEfface(null);
    setRemiseOuverte(true);
  }

  async function reinitialiser() {
    if (!motJuste) return;
    const { ok, result } = await remise.run(
      () => api.post('/administration/reinitialiser', { confirmation: saisie })
    );
    if (ok) {
      setRemiseOuverte(false);
      setEfface(result.efface);
      parametres.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Paramètres"
        info={{
          title: 'Acompte minimum',
          content: (
            <p>
              Part du total à verser pour qu’une commande passe en Confirmée. La base applique
              cette valeur au moment du passage, pas au moment de la commande.
            </p>
          ),
        }}
        actions={<Button icon="actualiser" onClick={parametres.reload}>Actualiser</Button>}
      />

      {action.error && <Alert tone="danger" title="Modification refusée">{action.error}</Alert>}

      {efface && (
        <Alert tone="ok" title="Base réinitialisée">
          <p>
            Effacés : {pluriel(efface.categories, 'catégorie')}, {pluriel(efface.articles, 'article')},{' '}
            {pluriel(efface.commandes, 'commande')}, {pluriel(efface.encaissements, 'encaissement')},{' '}
            {pluriel(efface.avis, 'avis', 'avis')} et {pluriel(efface.comptes, 'compte')}. Votre
            compte, vos paramètres et le cycle de vie sont restés en place.
          </p>
        </Alert>
      )}

      <Card flush>
        <AsyncBoundary loading={parametres.loading} error={parametres.error}>
          {() => (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Paramètre</th>
                    <th style={{ width: 240 }}>Valeur</th>
                    <th style={{ width: 170 }}>Modifié le</th>
                    <th className="actions" />
                  </tr>
                </thead>
                <tbody>
                  {parametres.data.map((parametre) => (
                    <tr key={parametre.cle}>
                      <td>
                        <span className="table__primary">{parametre.libelle}</span>
                        <span className="table__sub mono">{parametre.cle}</span>
                      </td>
                      <td className="table__primary">
                        {parametre.cle === 'acompte_minimum' ? `${parametre.valeur} %` : parametre.valeur}
                      </td>
                      <td className="muted nowrap">{formatDateHeure(parametre.maj_le)}</td>
                      <td className="actions">
                        <Button size="sm" icon="crayon" onClick={() => ouvrir(parametre)}>Modifier</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
      </Card>

      {/* Seule commande de la console qui efface vraiment : partout ailleurs la
          suppression est logique et la corbeille rattrape. Elle est donc posee
          a part, en bas de page, et pas dans la barre d'actions de l'en-tete ou
          elle voisinerait avec « Actualiser ». */}
      <Card
        title="Repartir sur une base vierge"
        description="À l’ouverture du club, ou après une saison de démonstration."
      >
        <div className="stack">
          <p>
            Vide la base de tout ce qui a été saisi — catalogue, commandes, caisse, avis et
            comptes — et ne garde que le vôtre. L’application se retrouve dans l’état de son
            installation : un seul administrateur, et tout à rouvrir depuis la console.
          </p>
          <div>
            <Button variant="danger" icon="corbeille" onClick={ouvrirRemise}>
              Réinitialiser la base
            </Button>
          </div>
        </div>
      </Card>

      <FormModal
        open={Boolean(edition)}
        title={edition?.libelle || ''}
        error={action.error}
        busy={action.busy}
        onSubmit={enregistrer}
        onClose={() => setEdition(null)}
      >
        <Field label="Valeur" required>
          {edition?.cle === 'acompte_minimum' ? (
            <InputNombre
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              unite="%"
              decimales={0}
              min={0}
              max={100}
            />
          ) : (
            <Input value={valeur} onChange={(e) => setValeur(e.target.value)} maxLength={100} required />
          )}
        </Field>
      </FormModal>

      {/* Modale ecrite a la main plutot que ConfirmDialog : il faut un mot a
          recopier, et un bouton de confirmation qui reste inerte tant qu'il ne
          l'est pas. */}
      <Modal
        open={remiseOuverte}
        title="Réinitialiser la base"
        description="Cette suppression ne passe pas par la corbeille."
        onClose={() => setRemiseOuverte(false)}
        footer={
          <>
            <Button onClick={() => setRemiseOuverte(false)} disabled={remise.busy}>Annuler</Button>
            <Button
              variant="danger"
              icon="corbeille"
              loading={remise.busy}
              disabled={!motJuste}
              onClick={reinitialiser}
            >
              Tout effacer
            </Button>
          </>
        }
      >
        <div className="stack">
          {remise.error && <Alert tone="danger">{remise.error}</Alert>}

          <Alert tone="danger" title="Rien ne sera récupérable">
            <p>
              Les catégories, les articles et leurs photos, toutes les commandes avec leurs
              encaissements et leur historique de statuts, les avis, et <strong>tous les comptes
              sauf le vôtre</strong> sont effacés pour de bon. La corbeille est vidée aussi : il
              n’y aura rien à restaurer après.
            </p>
          </Alert>

          <p className="muted">
            Restent en place : vos paramètres, les tailles, les modes de paiement et le cycle de
            vie des commandes — ce n’est pas de la saisie, c’est le mode d’emploi de la base. Les
            références repartiront de CMD-26-0001 et ART-0001.
          </p>

          <Field label={`Tapez ${MOT_DE_PASSAGE} pour confirmer`} required>
            <Input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  reinitialiser();
                }
              }}
              placeholder={MOT_DE_PASSAGE}
              autoComplete="off"
              spellCheck="false"
              maxLength={20}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
