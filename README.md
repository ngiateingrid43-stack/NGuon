# HÉRITAGE – RISE OF AFRICA

Jeu de tir à la première personne (FPS) tactique 3D stylisé en voxels, inspiré des civilisations africaines historiques et mythologiques.

## Fonctionnalités complètes (v1.0)

- **6 Héros jouables** : *Sundiata* (Mali), *Amina* (Zazzau), *Shaka* (Zoulou), *Nzinga* (Ndongo), *Makeda* (Saba) et *Ogun* (Forge Yoruba), chacun avec passif, pouvoir actif `[Q]`, coiffe et tenue Kente/Bogolan tissées.
- **Arsenal complet (9 armes + objets + boucliers)** :
  - Armes à feu : Mousquet *Silex de Gao*, *Carabine du Mali*, *Canon de Forge*.
  - Distance à projectiles physiques : *Arc de Guerre*, *Arbalète du Nil*, *Fronde Explosive*.
  - Corps à corps : *Machette d'Ébène*, *Lance d'Iklwa*, *Épée courte d'Oran*.
  - Consommables `[G]` (*Grenade à fragmentation*, *Potion incendiaire*), boucliers (*Bois*, *Forgé*) et 4 raretés (*Commun*, *Rare*, *Épique*, *Légendaire*).
- **4 Cartes africaines & Cycle Jour/Crépuscule/Nuit** :
  - *Tombouctou (Sahel)*, *Grand Zimbabwe (Citadelle)*, *Alexandrie Antique*, *Forêt du Kongo*.
- **4 Modes de jeu** : *Mêlée générale*, *Équipe 5v5*, *Survie Battle Royale* (zone rétrécissante 3D + mini-carte), *Entraînement*.
- **Multijoueur autoritatif (Node.js + Socket.IO)** : Salons par code, chat lobby, prédiction/réconciliation client, validation Zod, anti-triche.
- **Aide à la visée (Aim Assist)**, changement dynamique de couleur du réticule sur ennemi/allié, **Armurerie gratuite (Cauris & skins)**, **Manette (Gamepad API)**, **Contrôles tactiles mobiles** et **Audio Web Audio spatialisé**.

## Démarrage rapide (Développement)

```bash
npm install
npm run dev:all
```

- Client FPS : `http://localhost:5173`
- Serveur Multijoueur : `http://localhost:3001`

## Build & Déploiement Production

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run build:server
NODE_ENV=production node dist/server/server/src/server.js
```

En mode `NODE_ENV=production`, le serveur Node.js sert automatiquement le client compilé (`dist/client/`) ainsi que Socket.IO et `/api/health` sur le port `3001` (configurable via `PORT`).
