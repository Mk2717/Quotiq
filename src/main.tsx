import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './lib/bootstrapWorkspace';
import App from './App';
import RouteModules from './components/RouteModules';
import DocumentLauncher from './components/DocumentLauncher';
import DocumentWorkspace from './components/DocumentWorkspace';
import EstimatePanelControls from './components/EstimatePanelControls';
import './styles.css';
import './vercel-overrides.css';
import './auth-v2.css';
import './crm.css';
import './estimate-builder.css';
import './document-workspace.css';
import './estimate-panel-controls.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <RouteModules />
      <DocumentLauncher />
      <DocumentWorkspace />
      <EstimatePanelControls />
    </HashRouter>
  </React.StrictMode>,
);
