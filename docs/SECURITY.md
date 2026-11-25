# SÉCURITÉ — HÉRITAGE : RISE OF AFRICA

## Principes directeurs

1. **Zéro secret côté client** : aucune clé privée ni logique de récompense définitive n'est confiée au navigateur pour les modes en ligne.
2. **Validation systématique par Zod** : dès la v0.1, les données de configuration et de sauvegarde locale sont validées via `shared/validation/schemas.ts` afin d'éviter l'injection de valeurs aberrantes ou la corruption.
3. **Échappement HTML strict** dans le HUD (Kill Feed, Tableau des scores) contre les attaques XSS via pseudonymes.
4. **Autorité serveur (v0.2+)** : détection des vitesses impossibles, vérification serveur de la cadence de tir, des munitions, de la ligne de vue et limitation de débit (rate limiting) sur Socket.IO.
5. **Transport sécurisé** : HTTPS et WSS obligatoires en production.
