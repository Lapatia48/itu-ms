import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useForm } from '../lib/useResource';
import { useAuth } from '../auth/session';
import { LIBELLE_PROFIL } from '../lib/roles';
import { formatDateHeure } from '../lib/format';
import {
  Alert, Button, Card, DefinitionList, Field, InputMotDePasse, PageHeader,
} from '../components/ui';

export default function MonCompte() {
  const { compte } = useAuth();
  const action = useAction();
  const [change, setChange] = useState(false);
  const form = useForm({ ancien: '', nouveau: '', confirmation: '' });

  async function changer(evenement) {
    evenement.preventDefault();
    if (form.values.nouveau !== form.values.confirmation) {
      action.setError('Les deux saisies du nouveau mot de passe diffèrent.');
      return;
    }
    const { ok } = await action.run(() => api.post('/auth/mot-de-passe', {
      ancien: form.values.ancien,
      nouveau: form.values.nouveau,
    }));
    if (ok) {
      form.reset({ ancien: '', nouveau: '', confirmation: '' });
      setChange(true);
    }
  }

  return (
    <>
      <PageHeader title="Mon compte" />

      <div className="grid-2">
        <Card title="Identité">
          <DefinitionList
            items={[
              { label: 'Nom', value: `${compte.prenom} ${compte.nom}` },
              { label: 'Numéro ETU', value: compte.etu },
              { label: 'Promotion', value: compte.promotion },
              { label: 'Téléphone', value: compte.telephone },
              { label: 'Profil', value: LIBELLE_PROFIL[compte.profil] },
              { label: 'Compte ouvert le', value: formatDateHeure(compte.cree_le) },
            ]}
          />
        </Card>

        <Card title="Mot de passe">
          {action.error && <Alert tone="danger">{action.error}</Alert>}
          {change && <p className="message-ok">Mot de passe changé.</p>}

          <form onSubmit={changer} style={{ display: 'grid', gap: 14, marginTop: 12 }}>
            <Field label="Mot de passe actuel" required>
              <InputMotDePasse {...form.bind('ancien')} autoComplete="current-password" required />
            </Field>
            <Field label="Nouveau mot de passe" required hint="6 caractères au minimum">
              <InputMotDePasse {...form.bind('nouveau')} autoComplete="new-password" minLength={6} required />
            </Field>
            <Field label="Confirmation" required>
              <InputMotDePasse {...form.bind('confirmation')} autoComplete="new-password" minLength={6} required />
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={action.busy}>Changer</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
