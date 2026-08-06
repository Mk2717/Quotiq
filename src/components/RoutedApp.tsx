import { useLocation } from 'react-router-dom';
import App from '../App';
import { WorkspacePages } from './WorkspacePages';
import EstimatesV2 from './EstimatesV2';

export default function RoutedApp(){
 const location=useLocation();
 if(location.pathname.startsWith('/estimates')) return <EstimatesV2/>;
 if(location.pathname.startsWith('/customers')) return <WorkspacePages/>;
 return <App/>;
}
