import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts';
import App from './App';
import { installChangeTracking } from './store/changes';
import './index.css';

installChangeTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
