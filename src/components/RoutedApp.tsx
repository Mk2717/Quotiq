import { useLocation } from 'react-router-dom';
import App from '../App';
import { WorkspacePages } from './WorkspacePages';
import QuoteStudio from './QuoteStudio';

export default function RoutedApp(){
 const location=useLocation();
 if(location.pathname.startsWith('/estimates')) return <QuoteStudio/>;
 if(location.pathname.startsWith('/customers')) return <WorkspacePages/>;
 return <App/>;
}
