import { useState } from 'react';
import { api } from '../lib/api';
import { useAction, useForm } from '../lib/useResource';
import { useAuth } from '../auth/session';
import { formatDate } from '../lib/format';
import {
  Alert, Button, Card, Field, Input, InputMotDePasse,
} from '../components/ui';

export default function MonCompte() {
  const { compte, rafraichir } = useAuth();
  const profil = useAction();
  const motDePasse = useAction();
  const [enregistre, setEnregistre] = useState(false);
  const [change, setChange] = useState(false);

  const formProfil = useForm({
    prenom: compte.prenom,
    nom: compte.nom,
    promotion: compte.promotion,
    telephone: compte.telephone,
  });
  const formMotDePasse = useForm({ ancien: '', nouveau: '', confirmation: '' });

  async function enregistrer(evenement) {
    evenement.preventDefault();
    setEnregistre(false);
    const { ok } = await profil.run(() => api.patch('/auth/moi', formProfil.values));
    if (ok) {
      await rafraichir();
      setEnregistre(true);
    }
  }

  async function changer(evenement) {
    evenement.preventDefault();
    setChange(false);
    if (formMotDePasse.values.nouveau !== formMotDePasse.values.confirmation) {
      motDePasse.setError('Les deux saisies du nouveau mot de passe diffèrent.');
      return;
    }
    const { ok } = await motDePasse.run(() => api.post('/auth/mot-de-passe', {
      ancien: formMotDePasse.values.ancien,
      nouveau: formMotDePasse.values.nouveau,
    }));
    if (ok) {
      formMotDePasse.reset({ ancien: '', nouveau: '', confirmation: '' });
      setChange(true);
    }
  }

  return (
    <div className="page page--etroite">
      <div className="page__tete">
        <h1>Mon compte</h1>
        <p>{compte.etu} · inscrit le {formatDate(compte.cree_le)}</p>
      </div>

      <Card title="Mes informations">
        {profil.error && <Alert tone="danger">{profil.error}</Alert>}
        {enregistre && <p className="message-ok">Informations enregistrées.</p>}

        <form onSubmit={enregistrer} style={{ marginTop: 12 }}>
          <div className="form-grid">
            <Field label="Prénom" required>
              <Input {...formProfil.bind('prenom')} maxLength={60} required />
            </Field>
            <Field label="Nom" required>
              <Input {...formProfil.bind('nom')} maxLength={60} required />
            </Field>
            <Field label="Promotion" required>
              <Input {...formProfil.bind('promotion')} maxLength={60} required />
            </Field>
            <Field label="Téléphone" required>
              <Input {...formProfil.bind('telephone')} maxLength={30} required />
            </Field>
            <Field label="Numéro ETU" span={2} hint="Il ne change pas : c’est votre identifiant">
              <Input value={compte.etu} disabled />
            </Field>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button type="submit" variant="primary" loading={profil.busy}>Enregistrer</Button>
          </div>
        </form>
      </Card>

      <Card title="Mot de passe">
        {motDePasse.error && <Alert tone="danger">{motDePasse.error}</Alert>}
        {change && <p className="message-ok">Mot de passe changé.</p>}

        <form onSubmit={changer} style={{ marginTop: 12 }}>
          <div className="form-grid">
            <Field label="Mot de passe actuel" required span={2}>
              <InputMotDePasse {...formMotDePasse.bind('ancien')} autoComplete="current-password" required />
            </Field>
            <Field label="Nouveau mot de passe" required hint="6 caractères au minimum">
              <InputMotDePasse {...formMotDePasse.bind('nouveau')} minLength={6} autoComplete="new-password" required />
            </Field>
            <Field label="Confirmation" required>
              <InputMotDePasse {...formMotDePasse.bind('confirmation')} minLength={6} autoComplete="new-password" required />
            </Field>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button type="submit" variant="primary" loading={motDePasse.busy}>Changer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
