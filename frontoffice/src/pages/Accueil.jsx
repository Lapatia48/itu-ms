import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useResource } from '../lib/useResource';
import { useAuth } from '../auth/session';
import CarteArticle from '../components/CarteArticle';
import Vitrine from '../components/Vitrine';
import Icon from '../components/Icon';
import { AsyncBoundary } from '../components/ui';

// Les trois temps d'une commande, dits une fois pour toutes sous la vitrine :
// c'est la premiere question d'un visiteur qui ne connait pas le club.
const REPERES = [
  {
    icon: 'panier',
    titre: 'Vous commandez ici',
    texte: 'Le catalogue est ouvert à tous. Le compte n’est demandé qu’au moment de valider le panier.',
  },
  {
    icon: 'billet',
    titre: 'Vous versez 50 %',
    texte: 'La moitié à la commande lance la préparation ; le solde se règle au retrait.',
  },
  {
    icon: 'paquet',
    titre: 'Vous retirez au local',
    texte: 'Aucun paiement en ligne : vous payez et vous récupérez vos articles au local du club.',
  },
];

export default function Accueil() {
  const { compte } = useAuth();
  const articles = useResource(() => api.get('/catalogue/produits'), []);
  const categories = useResource(() => api.get('/catalogue/categories'), []);

  const lignes = articles.data || [];
  const rayons = categories.data || [];
  // Les plus notes d'abord, puis les plus vendus : la vitrine montre ce qui a
  // deja convaincu, pas ce qui vient d'arriver.
  const vedettes = [...lignes]
    .sort((a, b) => (Number(b.note_moyenne) - Number(a.note_moyenne))
      || (Number(b.nb_vendus) - Number(a.nb_vendus)))
    .slice(0, 8);

  const descendre = () => {
    document.getElementById('boutique')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Vitrine>
        <span className="vitrine__surtitre">
          <span className="vitrine__pastille" aria-hidden="true" />
          ITU Motor Society
        </span>

        <h1>Portez les couleurs du club.</h1>

        <p className="vitrine__accroche">
          T-shirts, polos, sweats et accessoires floqués ITU Motor Society.
          Commandés en ligne, payés et retirés au local.
        </p>

        <div className="vitrine__actions">
          <Link to="/catalogue" className="btn-geant">
            Voir le catalogue
            {/* Le rouge du logo reste un graphisme : c'est la pastille qui le
                porte, pas le bouton, qui est blanc. */}
            <span className="btn-geant__fleche" aria-hidden="true">
              <Icon name="fleche" size={18} strokeWidth={2.2} />
            </span>
          </Link>
          {!compte && (
            <Link to="/inscription" className="btn btn--fantome btn--lg">Créer un compte</Link>
          )}
        </div>

        <button type="button" className="vitrine__defiler" onClick={descendre}>
          <Icon name="chevronBas" size={15} />
          {lignes.length > 0
            ? `${lignes.length} articles, ${rayons.length} catégories`
            : 'Découvrir la boutique'}
        </button>
      </Vitrine>

      <div className="bandeau" id="boutique">
        <div className="reperes">
          {REPERES.map((repere) => (
            <div key={repere.titre} className="repere">
              <span className="repere__icone"><Icon name={repere.icon} size={19} /></span>
              <div>
                <strong>{repere.titre}</strong>
                <p>{repere.texte}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page">
        <section className="section">
          <div className="section__tete">
            <h2>Les rayons</h2>
            <Link to="/catalogue">Tout le catalogue</Link>
          </div>
          <div className="categories">
            {rayons.map((categorie) => (
              <Link
                key={categorie.id_categorie}
                to={`/catalogue?categorie=${categorie.id_categorie}`}
                className="categorie-tuile"
              >
                <strong>{categorie.libelle}</strong>
                <span>
                  {lignes.filter((a) => a.id_categorie === categorie.id_categorie).length} articles
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section__tete">
            <h2>À la une</h2>
            <Link to="/catalogue">Tout voir</Link>
          </div>
          <AsyncBoundary loading={articles.loading} error={articles.error}>
            {() => (
              <div className="articles">
                {vedettes.map((article) => (
                  <CarteArticle key={article.id_produit} article={article} />
                ))}
              </div>
            )}
          </AsyncBoundary>
        </section>

        <section className="section">
          <div className="rappel">
            <div>
              <h2>Le catalogue vous attend</h2>
              <p>
                {lignes.length} articles aux couleurs du club, du t-shirt au sweat.
                {compte ? '' : ' Le compte ne sert qu’à valider le panier.'}
              </p>
            </div>
            <Link to="/catalogue" className="btn-geant btn-geant--sombre">
              Voir le catalogue
              <span className="btn-geant__fleche" aria-hidden="true">
                <Icon name="fleche" size={18} strokeWidth={2.2} />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
