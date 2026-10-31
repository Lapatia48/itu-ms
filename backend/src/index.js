import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { verifierConnexion } from './db.js';
import { gestionnaireErreurs } from './utils/erreurs.js';

import auth from './modules/auth/routes.js';
import catalogue from './modules/catalogue/routes.js';
import commandes from './modules/commandes/routes.js';
import avis from './modules/avis/routes.js';
import administration from './modules/administration/routes.js';
import tableauDeBord from './modules/tableauDeBord/routes.js';

const app = express();

app.use(cors({ origin: config.origines }));
app.use(express.json({ limit: '1mb' }));
app.use('/images', express.static(config.dossierImages, { maxAge: '7d' }));

app.get('/api/v1/sante', async (requete, reponse) => {
  reponse.json({ service: 'itu-ms', ...(await verifierConnexion()) });
});

app.use('/api/v1/auth', auth);
app.use('/api/v1/catalogue', catalogue);
app.use('/api/v1/commandes', commandes);
app.use('/api/v1/avis', avis);
app.use('/api/v1/administration', administration);
app.use('/api/v1/tableau-de-bord', tableauDeBord);

app.use((requete, reponse) => reponse.status(404).json({ message: 'Route inconnue.' }));
app.use(gestionnaireErreurs);

const serveur = app.listen(config.port, () => {
  console.log(`API ITU Motor Society : http://localhost:${config.port}/api/v1`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => serveur.close(() => process.exit(0)));
}
