import { useLocation } from 'react-router-dom';
import App from '../App';
import { WorkspacePages } from './WorkspacePages';
import EstimatesV2 from './EstimatesV2';
import InvoicesV2 from './InvoicesV2';
import InventoryV2 from './InventoryV2';
import ProjectsV2 from './ProjectsV2';
import ReportsV2 from './ReportsV2';
import AutomationV2 from './AutomationV2';

export default function RoutedApp(){
 const location=useLocation();
 if(location.pathname.startsWith('/estimates')) return <EstimatesV2/>;
 if(location.pathname.startsWith('/invoices')) return <InvoicesV2/>;
 if(location.pathname.startsWith('/inventory')) return <InventoryV2/>;
 if(location.pathname.startsWith('/projects')) return <ProjectsV2/>;
 if(location.pathname.startsWith('/reports')) return <ReportsV2/>;
 if(location.pathname.startsWith('/automation')) return <AutomationV2/>;
 if(location.pathname.startsWith('/customers')) return <WorkspacePages/>;
 return <App/>;
}
