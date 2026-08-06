import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import DashboardExperience from './components/DashboardExperience';
import CustomerCRM from './components/CustomerCRM';
import EstimateBuilder from './components/EstimateBuilder';
import './styles.css';
import './vercel-overrides.css';
import './auth-v2.css';
import './crm.css';
import './estimate-builder.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DashboardExperience />
      <CustomerCRM />
      <EstimateBuilder />
      <App />
    </HashRouter>
  </React.StrictMode>,
);
