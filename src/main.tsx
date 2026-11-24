import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const hadInitialController =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? Boolean(navigator.serviceWorker.controller)
    : false;

const updateSW = registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('melonflow:sw-offline-ready'));
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('melonflow:sw-need-refresh'));
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const triggerCheck = () => {
      if (navigator.onLine) {
        void registration.update().catch(() => {
          // ignore transient update check errors
        });
      }
    };
    window.setInterval(triggerCheck, 5 * 60 * 1000);
    window.addEventListener('online', triggerCheck);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerCheck();
      }
    });
  },
});

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadInitialController) {
      window.dispatchEvent(new CustomEvent('melonflow:sw-need-refresh'));
    }
  });
}

(window as unknown as { __melonflowUpdateSW?: (reload?: boolean) => Promise<void> }).__melonflowUpdateSW = updateSW;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
