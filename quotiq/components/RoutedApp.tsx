import { lazy,Suspense,type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import App from '../App';
import type { Session } from '@supabase/supabase-js';

const WorkspacePages=lazy(()=>import('./WorkspacePages').then(module=>({default:module.WorkspacePages})));
const EstimatesV2=lazy(()=>import('./EstimatesV2'));
const InvoicesV2=lazy(()=>import('./InvoicesV2'));
const InventoryV2=lazy(()=>import('./InventoryV2'));
const ProjectsV2=lazy(()=>import('./ProjectsV2'));
const ReportsV2=lazy(()=>import('./ReportsV2'));
const AutomationV2=lazy(()=>import('./AutomationV2'));
const SecurityCentre=lazy(()=>import('./SecurityCentre'));
const ScheduleV2=lazy(()=>import('./ScheduleV2'));
const LeadsPipeline=lazy(()=>import('./LeadsPipeline'));
const ClientHub=lazy(()=>import('./ClientHub'));
const TeamOperations=lazy(()=>import('./TeamOperations'));
const PurchaseOrders=lazy(()=>import('./PurchaseOrders'));
const FieldTools=lazy(()=>import('./FieldTools'));
const ServicePlans=lazy(()=>import('./ServicePlans'));

function ModuleBoundary({children}:{children:ReactNode}){
 return <Suspense fallback={<main className="workspaceBoot"><img src="/quotiq-mark.svg" alt=""/><b>Opening your panel</b><span>Loading only the tools you need…</span><i/></main>}>{children}</Suspense>;
}

export default function RoutedApp({session}:{session:Session|null}){
 const location=useLocation();
 if(location.pathname.startsWith('/estimates')) return <ModuleBoundary><EstimatesV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/invoices')) return <ModuleBoundary><InvoicesV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/inventory')) return <ModuleBoundary><InventoryV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/purchasing')) return <ModuleBoundary><PurchaseOrders session={session}/></ModuleBoundary>;
 if(location.pathname.startsWith('/field-tools')) return <ModuleBoundary><FieldTools session={session}/></ModuleBoundary>;
 if(location.pathname.startsWith('/service-plans')) return <ModuleBoundary><ServicePlans session={session}/></ModuleBoundary>;
 if(location.pathname.startsWith('/projects')) return <ModuleBoundary><ProjectsV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/reports')) return <ModuleBoundary><ReportsV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/automation')) return <ModuleBoundary><AutomationV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/security')) return <ModuleBoundary><SecurityCentre/></ModuleBoundary>;
 if(location.pathname.startsWith('/schedule')) return <ModuleBoundary><ScheduleV2/></ModuleBoundary>;
 if(location.pathname.startsWith('/leads')) return <ModuleBoundary><LeadsPipeline/></ModuleBoundary>;
 if(location.pathname.startsWith('/clienthub')) return <ModuleBoundary><ClientHub session={session}/></ModuleBoundary>;
 if(location.pathname.startsWith('/team')) return <ModuleBoundary><TeamOperations session={session}/></ModuleBoundary>;
 if(location.pathname.startsWith('/customers')) return <ModuleBoundary><WorkspacePages/></ModuleBoundary>;
 return <App session={session}/>;
}
