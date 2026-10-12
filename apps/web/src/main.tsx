import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Keep design fixtures out of production and avoid initializing Firebase in the design lab.
const entry = import.meta.env.DEV && window.location.pathname === '/design'
  ? import('./design/DesignLab')
  : import('./App');
void entry.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});
