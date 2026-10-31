import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/session';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { Alert, Button, Field, Input, InputMotDePasse } from '../components/ui';

export default function Connexion() {
  const { connecter, compte, pret } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Comptes du jeu de demonstration (sql/script_final.sql), prerempli pour
  // entrer d'un clic pendant une demo : ADMIN et GEST01, mot de passe
  // « itu2026 ». A vider avant toute mise en service.
  const [etu, setEtu] = useState('ADMIN');
  const [motDePasse, setMotDePasse] = useState('itu2026');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (pret && compte) navigate(location.state?.suite || '/', { replace: true });
  }, [pret, compte, navigate, location.state]);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await connecter(etu.trim(), motDePasse);
      navigate(location.state?.suite || '/', { replace: true });
    } catch (err) {
      setErreur(err.message || 'Connexion impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-shell__aside">
        <Logo size={44} tone="dark" />
        <div className="auth-shell__pitch">
          <h2>La console de gestion</h2>
          <p>Commandes, encaissements et catalogue.</p>
          <ul className="auth-shell__list">
            <li><Icon name="liste" size={17} /> Suivre une commande de sa création à sa livraison</li>
            <li><Icon name="billet" size={17} /> Enregistrer les acomptes et le solde</li>
            <li><Icon name="couches" size={17} /> Tenir le catalogue et les catégories</li>
          </ul>
        </div>
        <span className="auth-shell__legal">ITU Motor Society · Campus ITU, Antananarivo</span>
      </aside>

      <main className="auth-shell__panel">
        <div className="auth-card">
          <div className="auth-card__head">
            <h1>Connexion</h1>
            <p>Réservée aux membres du bureau.</p>
          </div>

          {erreur && <Alert tone="danger">{erreur}</Alert>}

          <form onSubmit={soumettre} style={{ display: 'grid', gap: 14, marginTop: erreur ? 14 : 0 }}>
            <Field label="Numéro ETU" required>
              <Input
                value={etu}
                onChange={(e) => setEtu(e.target.value)}
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

          <p className="auth-card__foot">
            Vous êtes étudiant ? La boutique est sur <a href="http://localhost:5173">localhost:5173</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
