import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/session';
import Icon from '../components/Icon';
import { Alert, Button, Field, Input, InputMotDePasse } from '../components/ui';

export default function Connexion() {
  const { connecter, compte, pret } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const suite = params.get('suite') || '/mes-commandes';

  const [etu, setEtu] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (pret && compte) navigate(suite, { replace: true });
  }, [pret, compte, navigate, suite]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await connecter(etu.trim(), motDePasse);
      navigate(suite, { replace: true });
    } catch (err) {
      setErreur(err.message || 'Connexion impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="connexion">
      <div className="connexion__carte">
        <h1>Connexion</h1>
        <p>Avec votre numéro ETU.</p>

        {erreur && <Alert tone="danger">{erreur}</Alert>}

        <form className="connexion__formulaire" onSubmit={soumettre}>
          <Field label="Numéro ETU" required>
            <Input
              value={etu}
              onChange={(e) => setEtu(e.target.value)}
              placeholder="ETU1234"
              autoComplete="username"
              autoFocus
              required
            />
          </Field>
          <Field label="Mot de passe" required>
            <InputMotDePasse
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" variant="primary" block loading={envoi}>Se connecter</Button>
        </form>

        <p className="connexion__pied">
          Pas encore de compte ? <Link to={`/inscription?suite=${encodeURIComponent(suite)}`}>En créer un</Link>.
        </p>
      </div>

      <aside className="vif connexion__aparte">
        <h2>Votre commande, suivie du local au retrait</h2>
        <ul>
          <li><Icon name="paquet" size={17} /> L’avancement de chaque commande, étape par étape</li>
          <li><Icon name="billet" size={17} /> Vos acomptes et ce qu’il reste à payer</li>
          <li><Icon name="etoile" size={17} /> Vos avis sur les articles que vous avez reçus</li>
        </ul>
      </aside>
    </div>
  );
}
