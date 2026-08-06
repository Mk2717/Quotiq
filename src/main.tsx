import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './lib/bootstrapWorkspace';
import RoutedApp from './components/RoutedApp';
import './styles.css';
import './vercel-overrides.css';
import './auth-v2.css';
import './workspace-pages.css';
import './estimates-v2.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <RoutedApp />
    </HashRouter>
  </React.StrictMode>,
);
