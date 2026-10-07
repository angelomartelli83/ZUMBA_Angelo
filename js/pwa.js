const INSTALL_DISMISSED_KEY = 'zumba-pwa-install-dismissed-v1';
let deferredPrompt = null;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isInstallDismissed = () => localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
const markInstallDismissed = () => localStorage.setItem(INSTALL_DISMISSED_KEY, '1');

const pwaBanner = () => document.getElementById('pwa-install-banner');
const iosBanner = () => document.getElementById('ios-install-banner');
const loginInstallBtn = () => document.getElementById('pwa-login-install-btn');

function hideInstallUi() {
  pwaBanner()?.classList.add('hidden');
  iosBanner()?.classList.add('hidden');
  loginInstallBtn()?.classList.add('hidden');
}

function showInstallUi() {
  if (isInStandaloneMode() || isInstallDismissed()) return;
  loginInstallBtn()?.classList.remove('hidden');

  if (deferredPrompt) {
    pwaBanner()?.classList.remove('hidden');
  } else if (isIos()) {
    iosBanner()?.classList.remove('hidden');
  }
}

function dismissPwaBanner() {
  markInstallDismissed();
  hideInstallUi();
}

function dismissIosBanner() {
  markInstallDismissed();
  hideInstallUi();
}

async function installApp() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  if (outcome === 'accepted') {
    hideInstallUi();
  } else {
    // Il rifiuto del prompt nativo non equivale a "chiudi": l'utente
    // potrà riprovare finché il browser rende nuovamente disponibile l'evento.
    pwaBanner()?.classList.add('hidden');
    loginInstallBtn()?.classList.remove('hidden');
  }
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  showInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallUi();
});

document.addEventListener('DOMContentLoaded', () => {
  const installButton = loginInstallBtn();
  installButton?.addEventListener('click', async () => {
    if (deferredPrompt) {
      await installApp();
    } else if (isIos() && !isInStandaloneMode()) {
      iosBanner()?.classList.remove('hidden');
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () =>
      navigator.serviceWorker
        .register('/ZUMBA_Angelo/sw.js', { scope: '/ZUMBA_Angelo/' })
        .catch(console.error)
    );
  }

  // Mostra l'UI solo se il browser segnala un'installazione disponibile
  // oppure se siamo su iOS/iPadOS non ancora installato.
  if (deferredPrompt || (isIos() && !isInStandaloneMode())) {
    showInstallUi();
  }
});
