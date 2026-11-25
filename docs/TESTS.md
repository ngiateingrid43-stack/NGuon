# TESTS ET QUALITÉ — HÉRITAGE : RISE OF AFRICA

## Tests automatisés (Vitest)

Exécution :
```bash
npm run test
```

Couverture actuelle (v0.1) :
- `tests/unit/weapons.test.ts` : consommation de munitions, cadence de tir, rechargement depuis la réserve, calcul de dispersion ADS/accroupissement.
- `tests/unit/combat.test.ts` : absorption d'armure à 50 %, multiplicateur tir à la tête, élimination et émission du kill feed.
- `tests/unit/map.test.ts` : intégrité structurelle de `TOMBOUCTOU_MAP`, absence de chevauchement des points de spawn avec les obstacles.
- `tests/unit/storage.test.ts` : validation Zod des préférences utilisateur, résistance au JSON corrompu, calcul XP/niveau.
- `tests/gameplay/bot.test.ts` : machine à états IA (`combat`, `seek_cover`), détection de ligne de vue et tir effectif des bots.

## Liste de contrôle manuelle (v0.1)

- [ ] `npm run typecheck` passe sans erreur TypeScript.
- [ ] `npm run build` génère le bundle de production dans `dist/client`.
- [ ] Le menu principal s'affiche au-dessus de la vue 3D orbitale de Tombouctou.
- [ ] Déplacement fluide (WASD/ZQSD, saut, sprint, accroupissement, glissade) et montée des escaliers de la mosquée et des maisons.
- [ ] Tir, hitmarkers, rechargement, ramassage des caisses, élimination de bots et écran de fin de partie fonctionnels.
