# PERFORMANCE — HÉRITAGE : RISE OF AFRICA

## Profils graphiques (`PerformanceManager`)

| Profil | Pixel Ratio max | Ombres | Shadow Map | Particules poussière | Antialiasing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Faible** | 1.0 | Désactivées | 512 | 25% | Désactivé |
| **Moyen** | 1.25 | Activées | 1024 | 55% | Activé |
| **Élevé** | 1.75 | Activées | 2048 | 100% | Activé |
| **Ultra** | 2.0 | Activées | 2048 | 135% | Activé |
| **Auto** | Adaptatif selon FPS mesuré (< 34 FPS -> Faible, < 50 FPS -> Moyen) | | | | |

## Optimisations implémentées en v0.1

- **Géométrie voxel partagée** (`unitBoxGeometry`, `particleGeometry`) réutilisée pour tous les blocs de carte et particules.
- **Cache de matériaux et textures procédurales** (`TextureGenerator`) évitant la duplication mémoire GPU.
- **Raycasting analytique** (`CollisionManager`) sur AABB et sphères sans traverser le graphe de scène complet.
- **Libération stricte des ressources** (`dispose()` sur géométries, matériaux, textures, traceurs et modèles lors du déchargement).
- **Outil de diagnostic intégré** dans le HUD (FPS, temps de trame en ms, nombre de draw calls).
