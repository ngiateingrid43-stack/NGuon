import './styles/main.css';
import { GameEngine } from '@client/engine/GameEngine';

const rootEl = document.getElementById('app');
if (!rootEl) {
  throw new Error('Conteneur #app introuvable dans index.html');
}
const rootContainer: HTMLElement = rootEl;

function showFatalStartupError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (rootContainer.querySelector('#fatal-boot-error')) return;
  const box = document.createElement('div');
  box.id = 'fatal-boot-error';
  box.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:#1a1008;color:#f8fafc;font-family:system-ui,sans-serif;';
  box.innerHTML = `
    <div style="max-width:520px;background:#24170c;border:1px solid #eab308;border-radius:10px;padding:20px;">
      <h2 style="margin:0 0 8px;color:#eab308;font-size:1.1rem;">Impossible de démarrer HÉRITAGE 3D</h2>
      <p style="margin:0 0 12px;color:#cbd5e1;font-size:0.9rem;line-height:1.45;">
        Vérifiez que WebGL (accélération matérielle) est activé dans votre navigateur et que tout le dossier du jeu (<code>index.html</code> + <code>assets/</code>) a bien été déployé.
      </p>
      <pre style="margin:0;padding:10px;background:#120b05;border-radius:6px;color:#fca5a5;font-size:0.78rem;white-space:pre-wrap;word-break:break-word;">${message.replace(/</g, '&lt;')}</pre>
    </div>
  `;
  rootContainer.appendChild(box);
}

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ignore en environnement restreint
    });
  });
}

try {
  const engine = new GameEngine(rootContainer);
  engine.start();

  window.addEventListener('beforeunload', () => {
    engine.dispose();
  });
} catch (err) {
  console.error('Erreur critique au démarrage :', err);
  showFatalStartupError(err);
}
