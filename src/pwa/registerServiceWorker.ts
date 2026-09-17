import { registerSW } from 'virtual:pwa-register';

export function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('Mise à jour disponible pour l\'application académique ISMNM.');
      },
      onOfflineReady() {
        console.log('Mise en cache PWA terminée : Emplois du temps et listes d\'étudiants disponibles hors-ligne.');
      },
      onRegisterError(error: any) {
        console.warn('Erreur lors de l\'enregistrement du Service Worker:', error);
      },
    });
  }
}
