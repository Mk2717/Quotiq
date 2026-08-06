import { useLocation } from 'react-router-dom';
import CustomerCRM from './CustomerCRM';
import EstimateBuilder from './EstimateBuilder';

export default function RouteModules(){
 const location=useLocation();
 if(location.pathname==='/customers')return <CustomerCRM key="customers"/>;
 if(location.pathname==='/estimates')return <EstimateBuilder key="estimates"/>;
 return null;
}
