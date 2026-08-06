import { useLocation } from 'react-router-dom';
import App from '../App';
import { WorkspacePages } from './WorkspacePages';

export default function RoutedApp(){
 const location=useLocation();
 const isWorkspaceRoute=location.pathname.startsWith('/customers')||location.pathname.startsWith('/estimates');
 return isWorkspaceRoute?<WorkspacePages/>:<App/>;
}
