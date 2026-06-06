import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { toast } from 'sonner';

// Programmatically clear all cache storage on startup to force-update all assets and sound effects
if (typeof window !== 'undefined') {
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).then(() => {
          console.log(`Cleared browser cache storage: ${key}`);
        });
      });
    }).catch((err) => console.log('Cache clearing error:', err));
  }
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().then((success) => {
          if (success) {
            console.log('Successfully unregistered active service worker');
          }
        });
      });
    }).catch((err) => console.log('Service worker unregister error:', err));
  }
}

// Programmatically intercept all sonner toast calls to play the premium notification sound
const originalSuccess = toast.success;
const originalError = toast.error;
const originalWarning = toast.warning;
const originalInfo = toast.info;
const originalCustom = toast.custom;

const playPremiumToastSound = (() => {
  let lastPlayTime = 0;
  return () => {
    const now = Date.now();
    if (now - lastPlayTime < 500) return;
    lastPlayTime = now;
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.55; // Balanced for toast notifications
      audio.play().catch(e => console.log('Audio autoplay blocked by browser:', e));
    } catch (err) {
      console.log('Audio play error:', err);
    }
  };
})();

toast.success = (message: any, data?: any) => {
  playPremiumToastSound();
  return originalSuccess(message, data);
};

toast.error = (message: any, data?: any) => {
  playPremiumToastSound();
  return originalError(message, data);
};

toast.warning = (message: any, data?: any) => {
  playPremiumToastSound();
  return originalWarning(message, data);
};

toast.info = (message: any, data?: any) => {
  playPremiumToastSound();
  return originalInfo(message, data);
};

toast.custom = (jsx: any, data?: any) => {
  playPremiumToastSound();
  return originalCustom(jsx, data);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
