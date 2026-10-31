import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { usePanier } from '../lib/panier';
import { formatAriary, formatDate } from '../lib/format';
import Icon from '../components/Icon';
import Note from '../components/Note';
import { Alert, AsyncBoundary, Button } from '../components/ui';

export default function Article() {
  const { id } = useParams();
  const navigate = useNavigate();
  const panier = usePanier();
  const article = useResource(() => api.get(`/catalogue/produits/${id}`), [id]);

  const [taille, setTaille] = useState(null);
  const [quantite, setQuantite] = useState(1);
  const [manque, setManque] = useState(false);
  const [ajoute, setAjoute] = useState(false);

  function ajouter() {
    const fiche = article.data;
    const tailles = fiche.tailles || [];
    if (tailles.length > 0 && !taille) {
      setManque(true);
      return;
    }
    panier.ajouter(
      { ...fiche, tailles_libelle: tailles.find((t) => t.id_taille === taille)?.code || null },
      taille,
      quantite
    );
    setAjoute(true);
  }

  return (
    <div className="page page--etroite">
      <AsyncBoundary loading={article.loading} error={article.error}>
        {() => {
          const fiche = article.data;
          const tailles = fiche.tailles || [];
          const avis = fiche.avis || [];

          return (
            <>
              <p style={{ marginBottom: 18 }}>
                <Link to="/catalogue">
                  <Icon name="flecheGauche" size={14} /> Catalogue
                </Link>
              </p>

              <div className="fiche">
                <div className="fiche__image">
                  {fiche.image
                    ? <img src={`/images/${fiche.image}`} alt={fiche.nom} />
                    : <span className="fiche__image-vide"><Icon name="vetement" size={72} strokeWidth={1} /></span>}
                </div>

                <div>
                  <h1 className="fiche__titre">{fiche.nom}</h1>
                  <div className="fiche__meta">
                    <span className="muted">{fiche.categorie}</span>
                    {fiche.couleur && <span className="muted">· {fiche.couleur}</span>}
                    {Number(fiche.nb_avis) > 0 && (
                      <Note valeur={fiche.note_moyenne}>
                        <span className="note__valeur">{fiche.note_moyenne} sur 5 · {fiche.nb_avis} avis</span>
                      </Note>
                    )}
                  </div>

                  <p className="fiche__prix">{formatAriary(fiche.prix)}</p>
                  {fiche.description && <p className="fiche__description">{fiche.description}</p>}

                  <div className="fiche__achat">
                    {tailles.length > 0 && (
                      <div>
                        <label className="field__label" htmlFor="tailles">Taille</label>
                        <div className="fiche__tailles" id="tailles">
                          {tailles.map((t) => (
                            <button
                              key={t.id_taille}
                              type="button"
                              className={`taille-choix ${taille === t.id_taille ? 'is-choisie' : ''}`}
                              onClick={() => { setTaille(t.id_taille); setManque(false); }}
                            >
                              {t.code}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {manque && <Alert tone="warn">Choisissez une taille.</Alert>}

                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div className="quantite">
                        <button
                          type="button"
                          className="quantite__bouton"
                          onClick={() => setQuantite((q) => Math.max(1, q - 1))}
                          disabled={quantite <= 1}
                          aria-label="Retirer un article"
                        >
                          <Icon name="moins" size={15} />
                        </button>
                        <span className="quantite__valeur">{quantite}</span>
                        <button
                          type="button"
                          className="quantite__bouton"
                          onClick={() => setQuantite((q) => Math.min(99, q + 1))}
                          aria-label="Ajouter un article"
                        >
                          <Icon name="plus" size={15} />
                        </button>
                      </div>

                      <Button variant="primary" icon="panier" onClick={ajouter}>
                        Ajouter au panier
                      </Button>
                    </div>

                    {ajoute && (
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="muted">Ajouté au panier.</span>
                        <Button size="sm" onClick={() => navigate('/panier')}>Voir le panier</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <section className="section">
                <div className="section__tete">
                  <h2>Avis</h2>
                  {avis.length > 0 && <Link to="/mes-avis">Noter un article reçu</Link>}
                </div>

                {avis.length === 0 ? (
                  <p className="muted">
                    Pas encore d’avis. Les avis sont déposés par les étudiants qui ont reçu l’article.
                  </p>
                ) : (
                  <div className="avis-liste">
                    {avis.map((ligne) => (
                      <article className="avis-ligne" key={ligne.id_avis}>
                        <div className="avis-ligne__tete">
                          <span className="avis-ligne__auteur">
                            {ligne.client} <span className="muted">· {ligne.promotion}</span>
                          </span>
                          <Note valeur={ligne.note} taille={13} />
                        </div>
                        {ligne.commentaire && <p>{ligne.commentaire}</p>}
                        <span className="avis-ligne__date">{formatDate(ligne.cree_le)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
