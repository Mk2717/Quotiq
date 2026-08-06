import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import DashboardExperience from './components/DashboardExperience';
import CustomerCRM from './components/CustomerCRM';
import EstimateBuilder from './components/EstimateBuilder';
import DocumentLauncher from './components/DocumentLauncher';
import DocumentWorkspace from './components/DocumentWorkspace';
import './styles.css';
import './vercel-overrides.css';
import './auth-v2.css';
import './crm.css';
import './estimate-builder.css';
import './document-workspace.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DashboardExperience />
      <CustomerCRM />
      <EstimateBuilder />
      <DocumentLauncher />
      <DocumentWorkspace />
      <App />
    </HashRouter>
  </React.StrictMode>,
);
