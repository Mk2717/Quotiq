import { useEffect, useState } from 'react';
import { Eye, FileCheck2, X } from 'lucide-react';
import type { Business, Estimate } from '../types';
import { getStored } from '../lib/storage';

const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(value||0);

export default function DocumentLauncher(){
  const[active,setActive]=useState(location.hash.includes('/estimates'));
  const[open,setOpen]=useState(false);
  const[estimates,setEstimates]=useState<Estimate[]>(()=>getStored('q-estimates',[]));
  const business=getStored<Business>('q-business',{name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'});
  useEffect(()=>{const sync=()=>{setActive(location.hash.includes('/estimates'));setEstimates(getStored('q-estimates',[]))};addEventListener('hashchange',sync);addEventListener('storage',sync);const timer=setInterval(()=>active&&setEstimates(getStored('q-estimates',[])),1200);return()=>{removeEventListener('hashchange',sync);removeEventListener('storage',sync);clearInterval(timer)}},[active]);
  if(!active)return null;
  const preview=(estimateId:string)=>{dispatchEvent(new CustomEvent('quotiq-preview-estimate',{detail:{estimateId}}));setOpen(false)};
  return <><button className="documentLauncherButton" onClick={()=>{setEstimates(getStored('q-estimates',[]));setOpen(true)}}><FileCheck2/>Documents</button>{open&&<div className="documentLauncherOverlay" onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}><section className="documentLauncherPanel"><header><div><span>PROFESSIONAL DOCUMENTS</span><h2>Preview an estimate</h2><p>Open the branded A4 document, record approval, save PDF or create an invoice.</p></div><button onClick={()=>setOpen(false)}><X/></button></header><div className="documentLauncherList">{estimates.map(estimate=><button key={estimate.id} onClick={()=>preview(estimate.id)}><i><FileCheck2/></i><div><b>{estimate.id}</b><strong>{estimate.project}</strong><span>{estimate.customer} · {estimate.date}</span></div><div><strong>{money(estimate.amount,business.currency)}</strong><span className={`status ${estimate.status.toLowerCase()}`}>{estimate.status}</span></div><Eye/></button>)}{!estimates.length&&<div className="documentLauncherEmpty"><FileCheck2/><h3>No estimates available</h3><p>Create and save an estimate first, then return here to produce its document.</p></div>}</div></section></div>}</>;
}
