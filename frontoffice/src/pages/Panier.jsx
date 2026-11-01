import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, urlImage } from '../lib/api';
import { useAction } from '../lib/useResource';
import { usePanier, cleLigne } from '../lib/panier';
import { useAuth } from '../auth/session';
import { formatAriary } from '../lib/format';
import Icon from '../components/Icon';
import { Alert, Button, EmptyState, Field, Textarea } from '../components/ui';

export default function Panier() {
  const panier = usePanier();
  const { compte } = useAuth();
  const navigate = useNavigate();
  const action = useAction();
  const [remarque, setRemarque] = useState('');

  async function valider() {
    if (!compte) {
      navigate('/connexion?suite=/panier');
      return;
    }
    const { ok, result } = await action.run(() => api.post('/commandes', {
      remarque,
      lignes: panier.lignes.map((l) => ({
        idProduit: l.idProduit,
        idTaille: l.idTaille,
        quantite: l.quantite,
      })),
    }));
    if (ok) {
      panier.vider();
      navigate(`/mes-commandes/${result.id_commande}`);
    }
  }

  if (panier.lignes.length === 0) {
    return (
      <div className="page page--etroite">
        <div className="page__tete"><h1>Panier</h1></div>
        <EmptyState
          icon="panier"
          title="Votre panier est vide"
          action={<Link to="/catalogue" className="btn btn--primary">Voir le catalogue</Link>}
        />
      </div>
    );
  }

  return (
    <div className="page page--etroite">
      <div className="page__tete">
        <h1>Panier</h1>
        <p>{panier.nombre} article{panier.nombre > 1 ? 's' : ''}</p>
      </div>

      {action.error && <Alert tone="danger" title="Commande refusée">{action.error}</Alert>}

      <div className="panier">
        <div>
          {panier.lignes.map((ligne) => {
            const cle = cleLigne(ligne);
            return (
              <div className="panier-ligne" key={cle}>
                <Link to={`/article/${ligne.idProduit}`} className="panier-ligne__image">
                  {ligne.image
                    ? <img src={urlImage(ligne.image)} alt="" />
                    : <span className="article-carte__sans-image"><Icon name="vetement" size={28} /></span>}
                </Link>

                <div>
                  <Link to={`/article/${ligne.idProduit}`} className="panier-ligne__nom">{ligne.nom}</Link>
                  <div className="panier-ligne__meta">
                    {ligne.taille ? `Taille ${ligne.taille} · ` : ''}{formatAriary(ligne.prix)} l’unité
                  </div>
                </div>

                <div className="panier-ligne__actions">
                  <div className="quantite">
                    <button
                      type="button"
                      className="quantite__bouton"
                      onClick={() => panier.changerQuantite(cle, ligne.quantite - 1)}
                      aria-label="Retirer un article"
                    >
                      <Icon name="moins" size={15} />
                    </button>
                    <span className="quantite__valeur">{ligne.quantite}</span>
                    <button
                      type="button"
                      className="quantite__bouton"
                      onClick={() => panier.changerQuantite(cle, ligne.quantite + 1)}
                      aria-label="Ajouter un article"
                    >
                      <Icon name="plus" size={15} />
                    </button>
                  </div>
                  <span className="panier-ligne__total">{formatAriary(ligne.quantite * ligne.prix)}</span>
                  <Button size="sm" variant="ghost" icon="croix" onClick={() => panier.retirer(cle)}>
                    Retirer
                  </Button>
                </div>
              </div>
            );
          })}

          <Field label="Remarque pour le bureau">
            <Textarea
              rows={2}
              value={remarque}
              onChange={(e) => setRemarque(e.target.value)}
              maxLength={500}
              placeholder="Jour de passage au local, précision sur la taille"
            />
          </Field>
        </div>

        <aside className="vif">
          <div className="recap">
            <div className="recap__ligne">
              <span>Articles</span>
              <strong>{panier.nombre}</strong>
            </div>
            <div className="recap__ligne recap__total">
              <span>Total</span>
              <strong>{formatAriary(panier.total)}</strong>
            </div>

            <Button variant="accent" block loading={action.busy} onClick={valider}>
              {compte ? 'Valider la commande' : 'Se connecter pour commander'}
            </Button>

            {!compte && (
              <p style={{ fontSize: 'var(--fs-sm)' }}>
                Votre panier est conservé pendant la connexion.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
