/* global console, Buffer, process */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outPcDir = path.resolve(rootDir, 'dist/pc');
const outMobileDir = path.resolve(rootDir, 'dist/mobile');
const tmpDir = path.resolve(rootDir, 'dist/pc-tmp');

async function buildStandalone() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(outPcDir, { recursive: true, force: true });
  fs.rmSync(outMobileDir, { recursive: true, force: true });
  fs.mkdirSync(outPcDir, { recursive: true });
  fs.mkdirSync(outMobileDir, { recursive: true });

  await build({
    configFile: false,
    root: path.resolve(rootDir, 'client'),
    resolve: {
      alias: {
        '@shared': path.resolve(rootDir, 'shared'),
        '@client': path.resolve(rootDir, 'client/src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: tmpDir,
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: false,
      target: 'es2020',
      lib: {
        entry: path.resolve(rootDir, 'client/src/main.ts'),
        name: 'HeritageRiseOfAfrica',
        formats: ['iife'],
        fileName: () => 'game.iife.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: 'style.[ext]',
        },
      },
    },
  });

  const jsCode = fs.readFileSync(path.join(tmpDir, 'game.iife.js'), 'utf-8');
  const cssFile = fs.readdirSync(tmpDir).find((f) => f.endsWith('.css'));
  const cssCode = cssFile ? fs.readFileSync(path.join(tmpDir, cssFile), 'utf-8') : '';

  const faviconPath = path.resolve(rootDir, 'client/public/icons/favicon.svg');
  const faviconB64 = fs.existsSync(faviconPath)
    ? fs.readFileSync(faviconPath).toString('base64')
    : '';
  const safeJs = jsCode.replace(/<\/script>/gi, '<\\/script>');

  // ==================== 1. ÉDITION PC ====================
  const pcHtml = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>HÉRITAGE – RISE OF AFRICA (Édition PC v2.4)</title>
    ${faviconB64 ? `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${faviconB64}" />` : ''}
    <style>
${cssCode}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${safeJs}
    </script>
  </body>
</html>
`;

  const pcHtmlPath = path.join(outPcDir, 'HERITAGE-RISE-OF-AFRICA-JOUER.html');
  fs.writeFileSync(pcHtmlPath, pcHtml, 'utf-8');
  fs.writeFileSync(
    path.join(outPcDir, 'Lancer-Heritage-Windows.bat'),
    `@echo off\r\nstart "" "%~dp0HERITAGE-RISE-OF-AFRICA-JOUER.html"\r\n`,
    'utf-8'
  );

  const installerWin = `@echo off\r\nsetlocal\r\nset "INSTALL_DIR=%LOCALAPPDATA%\\HeritageRiseOfAfrica"\r\nif not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"\r\ncopy /Y "%~dp0HERITAGE-RISE-OF-AFRICA-JOUER.html" "%INSTALL_DIR%\\HERITAGE-RISE-OF-AFRICA-JOUER.html" >nul\r\npowershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\Heritage Rise of Africa.lnk'); $s.TargetPath = '%INSTALL_DIR%\\HERITAGE-RISE-OF-AFRICA-JOUER.html'; $s.Description = 'Heritage - Rise of Africa v2.4'; $s.Save()"\r\necho Installation terminee ! Raccourci cree sur le Bureau.\r\nstart "" "%INSTALL_DIR%\\HERITAGE-RISE-OF-AFRICA-JOUER.html"\r\n`;
  fs.writeFileSync(path.join(outPcDir, 'Installer-Heritage-Windows.bat'), installerWin, 'utf-8');

  const installerUnix = `#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/.local/share/heritage-rise-of-africa"
mkdir -p "$APP_DIR"
cp "$DIR/HERITAGE-RISE-OF-AFRICA-JOUER.html" "$APP_DIR/HERITAGE-RISE-OF-AFRICA-JOUER.html"
if [ -d "$HOME/.local/share/applications" ]; then
  cat > "$HOME/.local/share/applications/heritage-rise-of-africa.desktop" <<EOF
[Desktop Entry]
Name=HÉRITAGE - Rise of Africa
Comment=Jeu 3D en Monde Ouvert Africain
Exec=xdg-open "$APP_DIR/HERITAGE-RISE-OF-AFRICA-JOUER.html"
Terminal=false
Type=Application
Categories=Game;ActionGame;
EOF
fi
echo "Installé dans $APP_DIR"
if command -v open >/dev/null 2>&1; then
  open "$APP_DIR/HERITAGE-RISE-OF-AFRICA-JOUER.html"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_DIR/HERITAGE-RISE-OF-AFRICA-JOUER.html"
fi
`;
  fs.writeFileSync(path.join(outPcDir, 'Install-Heritage-Mac-Linux.sh'), installerUnix, {
    encoding: 'utf-8',
    mode: 0o755,
  });

  const pcReadme = `HÉRITAGE – RISE OF AFRICA (v2.4 — Édition PC Windows / Mac / Linux)
====================================================================

1) JOUER IMMÉDIATEMENT SUR PC :
   Double-cliquez sur HERITAGE-RISE-OF-AFRICA-JOUER.html
   (ou sur Lancer-Heritage-Windows.bat sous Windows).

2) INSTALLER SUR VOTRE ORDINATEUR (RACCOURCI BUREAU) :
   - Windows : Double-cliquez sur Installer-Heritage-Windows.bat
   - Mac / Linux : Lancez ./Install-Heritage-Mac-Linux.sh

3) MULTIJOUEUR STYLE BLUR (HÔTE INSTANTANÉ SANS SERVEUR) :
   - Ouvrez Multijoueur -> cliquez "Héberger en P2P / LAN".
   - Votre PC devient immédiatement le Serveur Hôte !
   - Partagez le code d'invitation HRA-OFFER à vos amis (ou jouez en LAN / multi-fenêtres)
     et cliquez "Lancer la partie (Serveur Hôte)" à tout moment avec ou sans bots.
`;
  fs.writeFileSync(path.join(outPcDir, 'LISEZ-MOI-PC.txt'), pcReadme, 'utf-8');

  // ==================== 2. ÉDITION MOBILE (ANDROID / iOS) ====================
  const mobileHtml = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
    <meta name="theme-color" content="#e5a912" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Héritage" />
    <title>HÉRITAGE – RISE OF AFRICA (Édition Mobile)</title>
    ${faviconB64 ? `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${faviconB64}" />` : ''}
    <style>
      html, body { overscroll-behavior: none; touch-action: manipulation; }
      canvas { touch-action: none; }
${cssCode}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__HERITAGE_MOBILE_EDITION__ = true;
${safeJs}
    </script>
  </body>
</html>
`;
  const mobileHtmlPath = path.join(outMobileDir, 'HERITAGE-RISE-OF-AFRICA-MOBILE.html');
  fs.writeFileSync(mobileHtmlPath, mobileHtml, 'utf-8');

  // Copier les assets PWA & icônes dans dist/mobile/pwa/
  const pwaDir = path.join(outMobileDir, 'pwa');
  const distClientDir = path.resolve(rootDir, 'dist/client');
  if (fs.existsSync(distClientDir)) {
    fs.cpSync(distClientDir, pwaDir, { recursive: true });
  }

  // Config Capacitor prête pour compiler un APK Android / iOS natif
  const capacitorConfig = {
    appId: 'com.heritage.riseofafrica',
    appName: 'Héritage - Rise of Africa',
    webDir: 'pwa',
    bundledWebRuntime: false,
    server: {
      androidScheme: 'https',
    },
  };
  fs.writeFileSync(
    path.join(outMobileDir, 'capacitor.config.json'),
    JSON.stringify(capacitorConfig, null, 2),
    'utf-8'
  );

  const mobileGuide = `HÉRITAGE – RISE OF AFRICA (v2.4 — Édition Mobile Android & iOS)
================================================================

OPTION 1 — JOUER HORS-LIGNE SUR TÉLÉPHONE (ZERO INSTALLATION) :
1. Copiez HERITAGE-RISE-OF-AFRICA-MOBILE.html sur votre téléphone Android ou iPhone.
2. Ouvrez-le avec Chrome (Android) ou Fichiers/Safari (iOS).
3. Les contrôles tactiles FPS complets (Joystick avec sprint auto, Viser, Tirer,
   Sauter, Accroupir, Changer d'arme, Pouvoir Q, Grenade G, Interagir E, Pause)
   s'activent automatiquement !

OPTION 2 — INSTALLER EN APPLICATION MOBILE (PWA SUR ÉCRAN D'ACCUEIL) :
1. Ouvrez l'URL du jeu dans Chrome (Android) ou Safari (iPhone).
2. Appuyez sur "INSTALLER APP" en haut du menu (ou "Ajouter à l'écran d'accueil").
3. Le jeu s'installe comme une vraie application plein écran avec icône dédiée.

OPTION 3 — COMPILER UN APK ANDROID NATIF (CAPACITOR) :
Depuis ce dossier :
  npm init -y
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap add android
  npx cap sync android
  npx cap open android   (puis Build > Build APK dans Android Studio)
`;
  fs.writeFileSync(path.join(outMobileDir, 'GUIDE-MOBILE-ANDROID-IOS.txt'), mobileGuide, 'utf-8');

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(
    `Build PC autonome généré : ${pcHtmlPath} (${(Buffer.byteLength(pcHtml) / 1024).toFixed(1)} Ko)`
  );
  console.log(
    `Build Mobile autonome généré : ${mobileHtmlPath} (${(Buffer.byteLength(mobileHtml) / 1024).toFixed(1)} Ko)`
  );
}

buildStandalone().catch((err) => {
  console.error(err);
  process.exit(1);
});
