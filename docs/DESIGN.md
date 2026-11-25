# DESIGN — HÉRITAGE : RISE OF AFRICA

## 1. Vision et Identité

**HÉRITAGE – RISE OF AFRICA** est un FPS voxel compétitif célébrant l'ingéniosité, l'architecture, le courage et le patrimoine des civilisations africaines.

## 2. Héros (Configuration centralisée `shared/heroes/heroesConfig.ts`)

| Héros | Rôle | Passif | Actif | Statut |
| :--- | :--- | :--- | :--- | :--- |
| **Sundiata** | Soutien offensif | Régénération près des alliés | Cri de ralliement (+20% vitesse 5s) | Jouable v0.1 |
| **Amina** | Défense | Réduction dégâts accroupi | Égide de Zazzau (bouclier) | Prévu v0.3 (palette bots v0.1) |
| **Shaka** | Assaut | Vitesse de base +8% | Ruée du buffle (dash + zone) | Prévu v0.3 (palette bots v0.1) |
| **Nzinga** | Reconnaissance | Portée radar +25% | Signal tactique (révélation) | Prévu v0.3 (palette bots v0.1) |
| **Makeda** | Soutien & soin | Bonus loot +20% | Source solaire (soin de zone) | Prévu v0.3 (palette bots v0.1) |
| **Ogun** | Contrôle de zone | Rechargement +12% | Piège de lames | Prévu v0.3 (palette bots v0.1) |

## 3. Arsenal (v0.1 et catalogue partagé)

- **Silex de Gao (Mousquet)** — `Rare` : 34 dégâts, multiplicateur tête x1.85, grande précision.
- **Carabine du Mali** — `Épique` : 24 dégâts, cadence 5.5 tirs/s, polyvalente.
- **Canon de Forge** — `Légendaire` : 6 projectiles x14 dégâts à courte portée.
- Catalogue étendu déjà typé et prêt dans `WEAPONS_CONFIG` (arcs, arbalète, fronde, lames) pour la v0.3.

## 4. Carte v0.1 : Tombouctou (`shared/maps/tombouctou.ts`)

- **Mosquée stylisée de Djinguereber** au Nord avec minaret doré, poutres toron, parapet et escalier d'accès au toit.
- **Grand Marché** au centre avec étals colorés servant de couverture tactique.
- **Quartiers Est & Ouest** en banco avec terrasses accessibles par escaliers voxel.
- **Oasis des Palmiers** au Sud-Est avec eau animée et **Puits des Caravanes** au Sud-Ouest.
- **8 points de spawn** espacés et **6 points de ravitaillement** (munitions, santé, armure).
