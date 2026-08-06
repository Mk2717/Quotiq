import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import DashboardExperience from './components/DashboardExperience';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DashboardExperience />
      <App />
    </HashRouter>
  </React.StrictMode>,
);
