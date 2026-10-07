let deferredPrompt = null;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function dismissPwaBanner(){ document.getElementById('pwa-install-banner')?.classList.add('hidden'); }
function dismissIosBanner(){ document.getElementById('ios-install-banner')?.classList.add('hidden'); }
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  document.getElementById('pwa-install-banner')?.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; dismissPwaBanner(); });
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    dismissPwaBanner();
  });
  if (isIos() && !isInStandaloneMode()) document.getElementById('ios-install-banner')?.classList.remove('hidden');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/ZUMBA_Angelo/sw.js', {scope:'/ZUMBA_Angelo/'}).catch(console.error));
  }
});