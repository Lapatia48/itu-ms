import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/session';
import { useForm } from '../lib/useResource';
import Icon from '../components/Icon';
import { Alert, Button, Field, Input, InputMotDePasse } from '../components/ui';

export default function Inscription() {
  const { inscrire, compte, pret } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const suite = params.get('suite') || '/catalogue';

  const form = useForm({
    etu: '', nom: '', prenom: '', promotion: '', telephone: '', motDePasse: '', confirmation: '',
  });
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (pret && compte) navigate(suite, { replace: true });
  }, [pret, compte, navigate, suite]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    if (form.values.motDePasse !== form.values.confirmation) {
      setErreur('Les deux saisies du mot de passe diffèrent.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await inscrire({
        etu: form.values.etu.trim(),
        nom: form.values.nom,
        prenom: form.values.prenom,
        promotion: form.values.promotion,
        telephone: form.values.telephone,
        motDePasse: form.values.motDePasse,
      });
      navigate(suite, { replace: true });
    } catch (err) {
      setErreur(err.message || 'Inscription impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="connexion">
      <div className="connexion__carte">
        <h1>Créer un compte</h1>
        <p>Votre numéro ETU vous servira d’identifiant.</p>

        {erreur && <Alert tone="danger">{erreur}</Alert>}

        <form className="connexion__formulaire" onSubmit={soumettre}>
          <div className="form-grid">
            <Field label="Prénom" required>
              <Input {...form.bind('prenom')} maxLength={60} autoComplete="given-name" required />
            </Field>
            <Field label="Nom" required>
              <Input {...form.bind('nom')} maxLength={60} autoComplete="family-name" required />
            </Field>
            <Field label="Numéro ETU" required>
              <Input {...form.bind('etu')} maxLength={20} placeholder="ETU1234" required />
            </Field>
            <Field label="Promotion" required>
              <Input {...form.bind('promotion')} maxLength={60} placeholder="L3 IG" required />
            </Field>
            <Field label="Téléphone" required span={2}>
              <Input
                {...form.bind('telephone')}
                maxLength={30}
                placeholder="+261 34 00 000 00"
                autoComplete="tel"
                required
              />
            </Field>
            <Field label="Mot de passe" required hint="6 caractères au minimum">
              <InputMotDePasse {...form.bind('motDePasse')} minLength={6} autoComplete="new-password" required />
            </Field>
            <Field label="Confirmation" required>
              <InputMotDePasse {...form.bind('confirmation')} minLength={6} autoComplete="new-password" required />
            </Field>
          </div>
          <Button type="submit" variant="primary" block loading={envoi}>Créer mon compte</Button>
        </form>

        <p className="connexion__pied">
          Déjà inscrit ? <Link to={`/connexion?suite=${encodeURIComponent(suite)}`}>Se connecter</Link>.
        </p>
      </div>

      <aside className="vif connexion__aparte">
        <h2>Un compte pour commander et suivre</h2>
        <ul>
          <li><Icon name="panier" size={17} /> Commander les vêtements du club</li>
          <li><Icon name="paquet" size={17} /> Suivre l’avancement et les acomptes versés</li>
          <li><Icon name="etoile" size={17} /> Noter les articles reçus</li>
        </ul>
      </aside>
    </div>
  );
}
