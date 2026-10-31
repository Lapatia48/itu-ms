import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { formatDateHeure } from '../lib/format';
import {
  Alert, AsyncBoundary, Button, Card, Field, FormModal, Input, InputNombre, PageHeader,
} from '../components/ui';

export default function Parametres() {
  const parametres = useResource(() => api.get('/administration/parametres'), []);
  const action = useAction();
  const [edition, setEdition] = useState(null);
  const [valeur, setValeur] = useState('');

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
    </>
  );
}
