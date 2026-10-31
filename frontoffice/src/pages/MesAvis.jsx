import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAction, useResource } from '../lib/useResource';
import { formatDate } from '../lib/format';
import Note from '../components/Note';
import {
  Alert, AsyncBoundary, Button, Card, ConfirmDialog, EmptyState, Field, FormModal, Textarea,
} from '../components/ui';

// La note se pose a la souris comme au clavier : cinq boutons, pas un curseur.
function ChoixNote({ valeur, onChange }) {
  return (
    <div className="row" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((rang) => (
        <button
          key={rang}
          type="button"
          className={`taille-choix ${valeur === rang ? 'is-choisie' : ''}`}
          onClick={() => onChange(rang)}
          role="radio"
          aria-checked={valeur === rang}
        >
          {rang}
        </button>
      ))}
    </div>
  );
}

export default function MesAvis() {
  const notables = useResource(() => api.get('/avis/notables'), []);
  const miens = useResource(() => api.get('/avis/miens'), []);
  const action = useAction();

  const [edition, setEdition] = useState(null);
  const [note, setNote] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [aRetirer, setARetirer] = useState(null);

  function ouvrir(cible) {
    action.setError(null);
    setNote(cible.note || 5);
    setCommentaire(cible.commentaire || '');
    setEdition(cible);
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    const { ok } = await action.run(() => (edition.id_avis
      ? api.patch(`/avis/${edition.id_avis}`, { note, commentaire })
      : api.post('/avis', { idProduit: edition.id_produit, note, commentaire })));
    if (ok) {
      setEdition(null);
      notables.reload();
      miens.reload();
    }
  }

  async function retirer() {
    const { ok } = await action.run(() => api.del(`/avis/${aRetirer.id_avis}`));
    setARetirer(null);
    if (ok) {
      notables.reload();
      miens.reload();
    }
  }

  return (
    <div className="page page--etroite">
      <div className="page__tete">
        <h1>Mes avis</h1>
        <p>Vous notez les articles que vous avez reçus.</p>
      </div>

      {action.error && <Alert tone="danger" title="Action refusée">{action.error}</Alert>}

      <Card title="À noter">
        <AsyncBoundary
          loading={notables.loading}
          error={notables.error}
          isEmpty={(notables.data || []).length === 0}
          empty={<EmptyState icon="paquet" title="Rien à noter pour le moment" />}
        >
          {() => (
            <div className="avis-liste">
              {notables.data.map((article) => (
                <div className="avis-ligne" key={article.id_produit}>
                  <div className="avis-ligne__tete">
                    <span>
                      <Link to={`/article/${article.id_produit}`} className="avis-ligne__auteur">
                        {article.produit}
                      </Link>
                      <span className="avis-ligne__date">
                        {' '}· {article.commande} · reçu le {formatDate(article.livree_le)}
                      </span>
                    </span>
                    <Button size="sm" icon="etoile" onClick={() => ouvrir(article)}>Noter</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </Card>

      <Card title="Avis déposés">
        <AsyncBoundary
          loading={miens.loading}
          error={miens.error}
          isEmpty={(miens.data || []).length === 0}
          empty={<EmptyState icon="etoile" title="Vous n’avez pas encore déposé d’avis" />}
        >
          {() => (
            <div className="avis-liste">
              {miens.data.map((avis) => (
                <article className="avis-ligne" key={avis.id_avis}>
                  <div className="avis-ligne__tete">
                    <Link to={`/article/${avis.id_produit}`} className="avis-ligne__auteur">
                      {avis.produit}
                    </Link>
                    <Note valeur={avis.note} taille={13} />
                  </div>
                  {avis.commentaire && <p>{avis.commentaire}</p>}
                  <div className="avis-ligne__tete">
                    <span className="avis-ligne__date">{formatDate(avis.cree_le)}</span>
                    <span className="row">
                      <Button size="sm" variant="ghost" icon="crayon" onClick={() => ouvrir(avis)}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="ghost" icon="corbeille" onClick={() => setARetirer(avis)}>
                        Retirer
                      </Button>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </Card>

      <FormModal
        open={Boolean(edition)}
        title={edition?.id_avis ? 'Modifier mon avis' : 'Noter cet article'}
        description={edition?.produit}
        error={action.error}
        busy={action.busy}
        onSubmit={enregistrer}
        onClose={() => setEdition(null)}
      >
        <Field label="Note" required>
          <ChoixNote valeur={note} onChange={setNote} />
        </Field>
        <Field label="Commentaire">
          <Textarea
            rows={4}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            maxLength={1000}
            placeholder="Taille, tenue au lavage, qualité du marquage"
          />
        </Field>
      </FormModal>

      <ConfirmDialog
        open={Boolean(aRetirer)}
        title="Retirer cet avis"
        message={aRetirer ? `Votre avis sur ${aRetirer.produit} ne sera plus affiché.` : ''}
        confirmLabel="Retirer"
        busy={action.busy}
        onConfirm={retirer}
        onClose={() => setARetirer(null)}
      />
    </div>
  );
}
