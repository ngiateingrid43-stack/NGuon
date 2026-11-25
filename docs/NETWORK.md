# ARCHITECTURE RÉSEAU — HÉRITAGE : RISE OF AFRICA

## État en Version 0.1

- En Version 0.1, le gameplay FPS s'exécute localement (joueur vs bots IA) pour valider la physique, le rendu, les armes et la boucle de partie.
- Le fichier `server/src/server.ts` met en place le serveur HTTP + Socket.IO avec endpoint `/api/health` et mesure de latence `ping:check` / `pong:check`.

## Plan d'implémentation Version 0.2 (Multijoueur autoritaire)

1. **Tick serveur 20–30 Hz** (`server/src/game-loop/`).
2. **Validation Zod** de chaque paquet d'entrée client (`move`, `shoot`, `reload`, `chat`).
3. **Simulation autoritaire** : le serveur calcule les déplacements critiques, les raycasts de tir, les dégâts, les munitions, les morts et les respawns.
4. **Prédiction locale & réconciliation** côté client avec numéros de séquence.
5. **Interpolation des entités distantes** via snapshots horodatés.
6. **Gestion des salons** : création, code de salon, équilibrage d'équipes, reconnexion et fermeture automatique.
