import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts: no CDN requests at runtime.
import '@fontsource/fraunces/600.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import './index.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
