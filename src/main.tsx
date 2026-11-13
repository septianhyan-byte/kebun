import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const updateSW = registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('melonflow:sw-offline-ready'));
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('melonflow:sw-need-refresh'));
  },
});

(window as unknown as { __melonflowUpdateSW?: (reload?: boolean) => Promise<void> }).__melonflowUpdateSW = updateSW;

createRoot(document.getElementById('root')!).render(<App />);
