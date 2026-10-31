// Arborescence de la barre laterale. Une entree sans `roles` est visible par
// les deux profils internes ; un groupe dont plus aucune entree n'est visible
// disparait avec elles.
export const navigation = [
  {
    section: 'Suivi',
    items: [
      { to: '/commandes', label: 'Commandes', icon: 'liste' },
      { to: '/tableau-de-bord', label: 'Tableau de bord', icon: 'tableau' },
      { to: '/etudiants', label: 'Étudiants', icon: 'utilisateurs' },
    ],
  },
  {
    section: 'Boutique',
    items: [
      { to: '/articles', label: 'Articles', icon: 'couches', roles: ['ADMIN'] },
      { to: '/categories', label: 'Catégories', icon: 'reglages', roles: ['ADMIN'] },
      { to: '/avis', label: 'Avis', icon: 'etoile' },
    ],
  },
  {
    section: 'Paramétrage',
    items: [
      { to: '/cycle-de-vie', label: 'Cycle de vie', icon: 'workflow', roles: ['ADMIN'] },
      { to: '/parametres', label: 'Paramètres', icon: 'engrenage', roles: ['ADMIN'] },
      { to: '/corbeille', label: 'Corbeille', icon: 'corbeille', roles: ['ADMIN'] },
    ],
  },
];
