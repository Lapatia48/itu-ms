import { Link } from 'react-router-dom';
import Icon from './Icon';
import Note from './Note';
import { urlImage } from '../lib/api';
import { formatAriary } from '../lib/format';

export default function CarteArticle({ article }) {
  return (
    <Link to={`/article/${article.id_produit}`} className="article-carte">
      <div className="article-carte__image">
        {article.image
          ? <img src={urlImage(article.image)} alt={article.nom} loading="lazy" />
          : <span className="article-carte__sans-image"><Icon name="vetement" size={44} strokeWidth={1.2} /></span>}
      </div>
      <div className="article-carte__corps">
        <span className="article-carte__categorie">{article.categorie}</span>
        <span className="article-carte__nom">{article.nom}</span>
        {Number(article.nb_avis) > 0 && (
          <Note valeur={article.note_moyenne} taille={13}>
            <span className="note__valeur">{article.note_moyenne} · {article.nb_avis} avis</span>
          </Note>
        )}
        <div className="article-carte__pied">
          <span className="article-carte__prix">{formatAriary(article.prix)}</span>
          <span className="article-carte__tailles">{article.tailles}</span>
        </div>
      </div>
    </Link>
  );
}
