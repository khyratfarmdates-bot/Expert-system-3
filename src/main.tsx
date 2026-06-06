import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
