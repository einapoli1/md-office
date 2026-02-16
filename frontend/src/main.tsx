import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './google-docs-styles.css'
import './responsive.css'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            showUpdateToast(newWorker);
          }
        });
      });
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

function showUpdateToast(worker: ServiceWorker) {
  const banner = document.createElement('div');
  banner.textContent = 'Update available — click to refresh';
  Object.assign(banner.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '10001',
    background: '#1a73e8', color: '#fff', padding: '12px 20px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  });
  banner.addEventListener('click', () => {
    worker.postMessage('skipWaiting');
    window.location.reload();
  });
  document.body.appendChild(banner);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
