import type { UserSettings } from '@shared/validation/schemas';

/**
 * Applique les réglages d'accessibilité sur le document HTML (contraste, taille de texte, etc.).
 */
export class AccessibilityManager {
  public apply(settings: UserSettings): void {
    const root = document.documentElement;
    root.classList.toggle('a11y-high-contrast', settings.highContrast);
    root.classList.toggle('a11y-large-text', settings.largeText);
    root.dataset.colorblind = settings.colorblindMode;
  }
}
