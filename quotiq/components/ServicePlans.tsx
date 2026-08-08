'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,ArrowLeft,CalendarCheck2,Check,CheckCircle2,ChevronRight,ClipboardCheck,
  Cloud,Copy,FileDown,FilePlus2,Gauge,History,PackageCheck,Plus,RefreshCcw,Search,
  ShieldCheck,Sparkles,Trash2,Users,Wrench,X,
} from 'lucide-react';
import { getStored,setStored,uuid } from '../lib/storage';
import {
  deleteServiceAgreement,listServiceAgreements,listServiceAssets,listServiceVisits,
  upsertServiceAgreement,upsertServiceAsset,upsertServiceVisit,
} from '../lib/supabase';
import type {
  Business,Customer,Invoice,ServiceAgreement,ServiceAgreementStatus,ServiceAsset,
  ServiceBillingCycle,ServiceVisit,TeamMember,
} from '../types';

type View='agreements'|'visits'|'assets';
type PlanTemplate={trade:string;name:string;assetType:string;intervalDays:number;visits:number;scope:string[]};

const today=()=>new Date().toISOString().slice(0,10);
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10)};
const money=(amount:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(amount||0);
const planTemplates:PlanTemplate[]=[
  {trade:'Security / CCTV',name:'CCTV Preventive Care',assetType:'CCTV system',intervalDays:90,visits:4,scope:['Clean cameras and housings','Check recording and storage health','Test power backup and network','Verify remote viewing and time settings','Issue system health report']},
  {trade:'Solar',name:'Solar Performance Plan',assetType:'Solar installation',intervalDays:180,visits:2,scope:['Inspect panels, mounting and cabling','Clean panels and check shading','Test inverter and battery health','Record generation and fault history','Tighten and thermally inspect connections']},
  {trade:'HVAC',name:'Comfort Care Quarterly',assetType:'HVAC unit',intervalDays:90,visits:4,scope:['Clean filters, coils and drains','Check refrigerant and temperatures','Inspect electrical connections','Test controls and airflow','Record maintenance readings']},
  {trade:'Plumbing',name:'Plumbing Protection Plan',assetType:'Plumbing system',intervalDays:180,visits:2,scope:['Inspect visible pipes and fittings','Check pressure and active leaks','Test valves, pumps and drainage','Inspect water heaters and tanks','Provide repair recommendations']},
  {trade:'Electrical',name:'Electrical Safety Plan',assetType:'Electrical installation',intervalDays:180,visits:2,scope:['Inspect distribution boards','Test protection and earthing','Tighten accessible terminations','Check visible wiring and accessories','Issue safety findings']},
  {trade:'Starlink / Networking',name:'Connectivity Care',assetType:'Network installation',intervalDays:90,visits:4,scope:['Check dish alignment and obstruction','Test speed, latency and uptime','Inspect router, Wi-Fi and cabling','Update labels and configuration notes','Provide network health report']},
];

const blankAsset=(customer?:Customer):ServiceAsset=>({
  id:uuid(),customer_id:customer?.id||'',customer_name:customer?.name||'',name:'',type:'Equipment',manufacturer:null,
  model:null,serial_number:null,site_address:customer?.siteAddress||customer?.address||null,installed_on:null,
  warranty_until:null,status:'Active',notes:null,sync_state:'local',
});

function blankAgreement(customer?:Customer,template=planTemplates[0]):ServiceAgreement{
  const start=today();
  return{id:uuid(),agreement_number:`SA-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,customer_id:customer?.id||'',customer_name:customer?.name||'',
    asset_ids:[],plan_name:template.name,trade:template.trade,status:'Active',start_date:start,end_date:addDays(start,365),
    next_visit_date:addDays(start,template.intervalDays),renewal_date:addDays(start,335),interval_days:template.intervalDays,
    billing_cycle:'Per visit',price:0,auto_invoice:false,assigned_member_id:null,assigned_member_name:null,scope:[...template.scope],
    completed_visits:0,included_visits:template.visits,notes:null,sync_state:'local'};
}

export default function ServicePlans({session}:{session:Session|null}){
  const[agreements,setAgreements]=useState<ServiceAgreement[]>(()=>getStored('q-service-agreements',[]));
  const[assets,setAssets]=useState<ServiceAsset[]>(()=>getStored('q-service-assets',[]));
  const[visits,setVisits]=useState<ServiceVisit[]>(()=>getStored('q-service-visits',[]));
  const customers=getStored<Customer[]>('q-customers',[]),team=getStored<TeamMember[]>('q-team',[]);
  const business=getStored<Business>('q-business',{name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'});
  const[view,setView]=useState<View>('agreements'),[query,setQuery]=useState(''),[status,setStatus]=useState<'All'|ServiceAgreementStatus>('All');
  const[selectedId,setSelectedId]=useState<string|null>(()=>getStored<ServiceAgreement[]>('q-service-agreements',[])[0]?.id||null);
  const[composer,setComposer]=useState(false),[draft,setDraft]=useState<ServiceAgreement>(()=>blankAgreement(customers[0]));
  const[assetDraft,setAssetDraft]=useState<ServiceAsset>(()=>blankAsset(customers[0]));
  const[templateIndex,setTemplateIndex]=useState(0),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');

  const store=(nextAgreements=agreements,nextAssets=assets,nextVisits=visits)=>{
    setAgreements(nextAgreements);setAssets(nextAssets);setVisits(nextVisits);
    setStored('q-service-agreements',nextAgreements);setStored('q-service-assets',nextAssets);setStored('q-service-visits',nextVisits);
  };

  useEffect(()=>{
    if(!session)return;
    let active=true;setMessage('Syncing service records…');
    Promise.all([listServiceAgreements(),listServiceAssets(),listServiceVisits()]).then(([cloudAgreements,cloudAssets,cloudVisits])=>{
      if(!active)return;
      store(cloudAgreements,cloudAssets,cloudVisits);setSelectedId(value=>value&&cloudAgreements.some(item=>item.id===value)?value:cloudAgreements[0]?.id||null);
      setMessage('Service records are cloud synced.');
    }).catch(()=>active&&setMessage('Working from the protected device copy.')).finally(()=>window.setTimeout(()=>active&&setMessage(''),2200));
    return()=>{active=false};
  },[session?.user.id]);

  const filtered=useMemo(()=>agreements.filter(item=>{
    const term=query.trim().toLowerCase();
    return(status==='All'||item.status===status)&&(!term||`${item.agreement_number} ${item.customer_name} ${item.plan_name} ${item.trade}`.toLowerCase().includes(term));
  }).sort((a,b)=>(a.next_visit_date||'9999').localeCompare(b.next_visit_date||'9999')),[agreements,query,status]);
  const selected=agreements.find(item=>item.id===selectedId)||filtered[0];
  const selectedAssets=selected?assets.filter(item=>selected.asset_ids.includes(item.id)):[];
  const selectedVisits=selected?visits.filter(item=>item.agreement_id===selected.id).sort((a,b)=>a.scheduled_for.localeCompare(b.scheduled_for)):[];
  const upcoming=visits.filter(item=>item.status==='Scheduled').sort((a,b)=>a.scheduled_for.localeCompare(b.scheduled_for));
  const active=agreements.filter(item=>item.status==='Active');
  const dueSoon=active.filter(item=>item.next_visit_date&&item.next_visit_date<=addDays(today(),30));
  const renewals=active.filter(item=>item.renewal_date&&item.renewal_date<=addDays(today(),45));
  const monthlyRecurring=active.reduce((sum,item)=>sum+(item.billing_cycle==='Monthly'?item.price:item.billing_cycle==='Quarterly'?item.price/3:item.billing_cycle==='Yearly'?item.price/12:0),0);

  const openComposer=(template=planTemplates[0])=>{
    const customer=customers[0];setTemplateIndex(Math.max(0,planTemplates.indexOf(template)));
    setDraft(blankAgreement(customer,template));setAssetDraft({...blankAsset(customer),type:template.assetType,name:template.assetType});
    setError('');setComposer(true);
  };
  const chooseTemplate=(index:number)=>{
    const template=planTemplates[index];setTemplateIndex(index);
    setDraft(value=>({...value,plan_name:template.name,trade:template.trade,interval_days:template.intervalDays,included_visits:template.visits,scope:[...template.scope],next_visit_date:addDays(value.start_date,template.intervalDays)}));
    setAssetDraft(value=>({...value,type:template.assetType,name:value.name||template.assetType}));
  };
  const chooseCustomer=(id:string)=>{
    const customer=customers.find(item=>item.id===id);
    setDraft(value=>({...value,customer_id:id,customer_name:customer?.name||''}));
    setAssetDraft(value=>({...value,customer_id:id,customer_name:customer?.name||'',site_address:customer?.siteAddress||customer?.address||value.site_address}));
  };

  const savePlan=async()=>{
    setError('');
    if(!draft.customer_id)return setError('Choose a customer for this service plan.');
    if(draft.plan_name.trim().length<3)return setError('Add a clear plan name.');
    if(assetDraft.name.trim().length<2)return setError('Add the equipment or system being maintained.');
    if(draft.price<0)return setError('The service price cannot be negative.');
    setSaving(true);
    const localAsset={...assetDraft,name:assetDraft.name.trim(),type:assetDraft.type.trim(),sync_state:session?'pending':'local'} as ServiceAsset;
    const localAgreement={...draft,asset_ids:[localAsset.id],scope:draft.scope.map(item=>item.trim()).filter(Boolean),sync_state:session?'pending':'local'} as ServiceAgreement;
    const firstVisit:ServiceVisit={id:uuid(),agreement_id:localAgreement.id,scheduled_for:localAgreement.next_visit_date||addDays(localAgreement.start_date,localAgreement.interval_days),status:'Scheduled',completed_at:null,
      technician_name:localAgreement.assigned_member_name,checklist:localAgreement.scope.map((label,index)=>({id:`check-${index+1}`,label,completed:false})),notes:null,invoice_id:null,sync_state:session?'pending':'local'};
    const nextAgreements=[localAgreement,...agreements],nextAssets=[localAsset,...assets],nextVisits=[firstVisit,...visits];
    store(nextAgreements,nextAssets,nextVisits);setSelectedId(localAgreement.id);setComposer(false);
    try{
      if(session){const savedAsset=await upsertServiceAsset(localAsset);const savedAgreement=await upsertServiceAgreement(localAgreement);const savedVisit=await upsertServiceVisit(firstVisit);
        store(nextAgreements.map(item=>item.id===savedAgreement.id?savedAgreement:item),nextAssets.map(item=>item.id===savedAsset.id?savedAsset:item),nextVisits.map(item=>item.id===savedVisit.id?savedVisit:item));}
      setMessage(session?'Service plan saved and synced.':'Service plan saved offline.');
    }catch{setMessage('Saved on this device. Cloud sync will be retried.')}finally{setSaving(false);window.setTimeout(()=>setMessage(''),2400)}
  };

  const syncAgreement=async(next:ServiceAgreement,nextVisits=visits)=>{
    const nextAgreements=agreements.map(item=>item.id===next.id?next:item);store(nextAgreements,assets,nextVisits);
    if(session){try{const saved=await upsertServiceAgreement(next);store(nextAgreements.map(item=>item.id===saved.id?saved:item),assets,nextVisits)}catch{setMessage('Change saved locally. Sync will retry.')}}
  };

  const createInvoice=(agreement:ServiceAgreement,visitId?:string)=>{
    const current=getStored<Invoice[]>('q-invoices',[]),number=`${business.invoicePrefix||'INV'}-${new Date().getFullYear()}-${String(current.length+1).padStart(4,'0')}`;
    const invoice:Invoice={id:number,customerId:agreement.customer_id,customer:agreement.customer_name,project:agreement.plan_name,amount:agreement.price,paid:0,status:'Unpaid',date:today(),dueDate:addDays(today(),14),items:[{id:`${number}-1`,description:`${agreement.plan_name} service visit`,qty:1,unit:'service',rate:agreement.price}],tax:0,discount:0,payments:[]};
    setStored('q-invoices',[invoice,...current]);
    if(visitId){const next=visits.map(item=>item.id===visitId?{...item,invoice_id:number}:item);store(agreements,assets,next)}
    setMessage(`${number} created in Invoices.`);window.setTimeout(()=>setMessage(''),2600);return number;
  };

  const completeVisit=async(visit:ServiceVisit)=>{
    if(!selected)return;
    const completed:{[K in keyof ServiceVisit]:ServiceVisit[K]}={...visit,status:'Completed',completed_at:new Date().toISOString(),checklist:visit.checklist.map(item=>({...item,completed:true})),sync_state:session?'pending':'local'};
    if(selected.auto_invoice&&!completed.invoice_id)completed.invoice_id=createInvoice(selected);
    const nextDate=addDays(visit.scheduled_for,selected.interval_days);
    const nextVisit:ServiceVisit={id:uuid(),agreement_id:selected.id,scheduled_for:nextDate,status:'Scheduled',completed_at:null,technician_name:selected.assigned_member_name,
      checklist:selected.scope.map((label,index)=>({id:`check-${index+1}`,label,completed:false})),notes:null,invoice_id:null,sync_state:session?'pending':'local'};
    const nextVisits=[...visits.filter(item=>item.id!==visit.id),completed,nextVisit];
    const nextAgreement={...selected,completed_visits:selected.completed_visits+1,next_visit_date:nextDate,sync_state:session?'pending':'local'} as ServiceAgreement;
    store(agreements.map(item=>item.id===selected.id?nextAgreement:item),assets,nextVisits);
    try{if(session){await Promise.all([upsertServiceVisit(completed),upsertServiceVisit(nextVisit),upsertServiceAgreement(nextAgreement)])}setMessage(`Visit completed. Next service: ${nextDate}.`)}catch{setMessage('Visit completed offline. Sync will retry.')}
    window.setTimeout(()=>setMessage(''),2800);
  };

  const renew=()=>{if(!selected)return;const base=selected.end_date||today();const next={...selected,status:'Active' as const,end_date:addDays(base,365),renewal_date:addDays(base,335),sync_state:session?'pending':'local' as const};void syncAgreement(next);setMessage('Agreement renewed for another year.')};
  const pause=()=>{if(!selected)return;void syncAgreement({...selected,status:selected.status==='Paused'?'Active':'Paused',sync_state:session?'pending':'local'});};
  const remove=async()=>{if(!selected||!window.confirm(`Delete ${selected.agreement_number}? This cannot be undone.`))return;const nextAgreements=agreements.filter(item=>item.id!==selected.id),nextVisits=visits.filter(item=>item.agreement_id!==selected.id);store(nextAgreements,assets,nextVisits);setSelectedId(nextAgreements[0]?.id||null);if(session)try{await deleteServiceAgreement(selected.id)}catch{setMessage('Removed from this device. Cloud deletion needs a retry.')}};
  const printAgreement=()=>{document.body.classList.add('printingServicePlan');window.print();window.setTimeout(()=>document.body.classList.remove('printingServicePlan'),500)};
  const copyReminder=async()=>{if(!selected)return;const text=`Hello ${selected.customer_name}, your ${selected.plan_name} service visit is scheduled for ${selected.next_visit_date}. Please reply to confirm access to the site.`;await navigator.clipboard.writeText(text);setMessage('Client reminder copied.')};

  return <main className="spPage">
    <section className="spHero noPrint">
      <div><button onClick={()=>history.back()}><ArrowLeft/> Dashboard</button><small>RECURRING REVENUE & CUSTOMER CARE</small><h1>Service plans</h1><p>Protect client equipment, schedule repeat visits and turn one-time jobs into dependable recurring income.</p></div>
      <div className="spHeroActions"><button onClick={()=>setView('visits')}><CalendarCheck2/> Visit board</button><button className="spPrimary" onClick={()=>openComposer()}><Plus/> New plan</button></div>
    </section>

    <section className="spStats noPrint">
      <article><i><ShieldCheck/></i><span><small>Active agreements</small><strong>{active.length}</strong><em>{agreements.length} total plans</em></span></article>
      <article><i><CalendarCheck2/></i><span><small>Due in 30 days</small><strong>{dueSoon.length}</strong><em>{upcoming.length} visits scheduled</em></span></article>
      <article><i><RefreshCcw/></i><span><small>Renewals due</small><strong>{renewals.length}</strong><em>Next 45 days</em></span></article>
      <article><i><Gauge/></i><span><small>Monthly recurring</small><strong>{money(monthlyRecurring,business.currency)}</strong><em>From subscription cycles</em></span></article>
    </section>

    {message&&<div className="spToast noPrint"><CheckCircle2/>{message}</div>}

    <section className="spTools noPrint">
      <div className="spTabs"><button className={view==='agreements'?'active':''} onClick={()=>setView('agreements')}><ShieldCheck/> Agreements</button><button className={view==='visits'?'active':''} onClick={()=>setView('visits')}><CalendarCheck2/> Visits <b>{upcoming.length}</b></button><button className={view==='assets'?'active':''} onClick={()=>setView('assets')}><PackageCheck/> Equipment <b>{assets.length}</b></button></div>
      <div className="spSearch"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search customer, plan or number…"/>{query&&<button onClick={()=>setQuery('')}><X/></button>}</div>
    </section>

    {view==='agreements'&&<section className="spWorkspace">
      <aside className="spListPane noPrint">
        <div className="spListFilter"><select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option>All</option>{(['Active','Draft','Paused','Expired','Cancelled'] as ServiceAgreementStatus[]).map(value=><option key={value}>{value}</option>)}</select><span>{filtered.length} plans</span></div>
        <div className="spAgreementList">{filtered.map(item=><button key={item.id} className={selected?.id===item.id?'active':''} onClick={()=>setSelectedId(item.id)}><i><RefreshCcw/></i><span><small>{item.agreement_number}</small><b>{item.customer_name}</b><em>{item.plan_name}</em></span><strong>{money(item.price,business.currency)}<small className={`spStatus status-${item.status.toLowerCase()}`}>{item.status}</small></strong><ChevronRight/></button>)}
          {!filtered.length&&<div className="spEmpty"><ShieldCheck/><b>No service plans found</b><span>Create a recurring plan from a finished job.</span><button onClick={()=>openComposer()}><Plus/> New plan</button></div>}
        </div>
      </aside>

      <article className="spDetailPane">
        {selected?<>
          <div className="spDetailActions noPrint"><div><button className="spPrimary" onClick={()=>createInvoice(selected)}><FilePlus2/> Create invoice</button><button onClick={copyReminder}><Copy/> Reminder</button><button onClick={printAgreement}><FileDown/> Print</button></div><div><button onClick={pause}>{selected.status==='Paused'?'Resume':'Pause'}</button><button onClick={renew}><RefreshCcw/> Renew</button><button className="spDanger" onClick={remove}><Trash2/></button></div></div>
          <section className="spPrintSheet">
            <header className="spDocumentHeader"><div className="spDocumentBrand">{business.logo?<img src={business.logo} alt=""/>:<i>{business.name.slice(0,1).toUpperCase()}</i>}<span><b>{business.name}</b><small>{business.address}</small><small>{business.phone} · {business.email}</small></span></div><div><span>SERVICE AGREEMENT</span><h2>{selected.agreement_number}</h2><small>{selected.status} · {selected.trade}</small></div></header>
            <div className="spAccent"/>
            <section className="spDocumentSummary"><div><span>CLIENT</span><h3>{selected.customer_name}</h3><p>{customers.find(item=>item.id===selected.customer_id)?.siteAddress||customers.find(item=>item.id===selected.customer_id)?.address||'Service location on file'}</p></div><div><span>PLAN</span><h3>{selected.plan_name}</h3><p>{selected.start_date} to {selected.end_date||'Ongoing'}</p></div><em className={`spStatus status-${selected.status.toLowerCase()}`}>{selected.status}</em></section>
            <section className="spDetailGrid"><article><span>NEXT VISIT</span><strong>{selected.next_visit_date||'Not scheduled'}</strong><small>Every {selected.interval_days} days</small></article><article><span>PLAN VALUE</span><strong>{money(selected.price,business.currency)}</strong><small>{selected.billing_cycle}</small></article><article><span>VISITS</span><strong>{selected.completed_visits} / {selected.included_visits}</strong><small>Completed / included</small></article><article><span>TECHNICIAN</span><strong>{selected.assigned_member_name||'Unassigned'}</strong><small>Service owner</small></article></section>
            <div className="spDocumentBody"><section><div className="spSectionTitle"><ClipboardCheck/><div><span>SCOPE OF COVER</span><h3>What is included</h3></div></div><div className="spScope">{selected.scope.map((item,index)=><p key={`${item}-${index}`}><Check/>{item}</p>)}</div></section><aside><div className="spSectionTitle"><PackageCheck/><div><span>COVERED ASSETS</span><h3>Client equipment</h3></div></div>{selectedAssets.length?selectedAssets.map(asset=><article className="spAssetCard" key={asset.id}><i><Wrench/></i><span><b>{asset.name}</b><small>{asset.type}</small><em>{[asset.manufacturer,asset.model,asset.serial_number].filter(Boolean).join(' · ')||'Details on file'}</em></span></article>):<p className="spMuted">No equipment linked.</p>}</aside></div>
            <section className="spVisitTimeline"><div className="spSectionTitle"><History/><div><span>SERVICE HISTORY</span><h3>Visits and next actions</h3></div></div>{selectedVisits.map(visit=><article key={visit.id}><i className={visit.status==='Completed'?'done':''}>{visit.status==='Completed'?<Check/>:<CalendarCheck2/>}</i><span><b>{visit.scheduled_for}</b><small>{visit.status}{visit.technician_name?` · ${visit.technician_name}`:''}</small></span>{visit.invoice_id&&<em>{visit.invoice_id}</em>}{visit.status==='Scheduled'&&<button className="noPrint" onClick={()=>completeVisit(visit)}>Complete visit</button>}</article>)}</section>
            <footer className="spDocumentFooter"><div><b>Terms</b><p>{selected.notes||'Services outside this scope, replacement parts and corrective repairs will be quoted separately. Client access is required at the agreed visit time.'}</p></div><div>{business.signature?<img src={business.signature} alt="Authorized signature"/>:<span className="spSignatureText">{business.authorizedName||business.name}</span>}<b>{business.authorizedName||'Authorized representative'}</b><small>{business.authorizedTitle||'Service provider'}</small></div></footer>
          </section>
        </>:<div className="spEmpty spDetailEmpty"><RefreshCcw/><h2>Start recurring service</h2><p>Select a plan or create one from a ready-made contractor template.</p><button onClick={()=>openComposer()}><Plus/> Create service plan</button></div>}
      </article>
    </section>}

    {view==='visits'&&<section className="spBoard noPrint"><header><div><small>FIELD SERVICE BOARD</small><h2>Upcoming maintenance visits</h2><p>Complete a visit to prepare the next date automatically.</p></div><button className="spPrimary" onClick={()=>openComposer()}><Plus/> New plan</button></header><div>{upcoming.map(visit=>{const agreement=agreements.find(item=>item.id===visit.agreement_id);return <article key={visit.id}><span className="spDate"><b>{new Date(`${visit.scheduled_for}T12:00:00`).toLocaleDateString('en-GH',{day:'2-digit'})}</b><small>{new Date(`${visit.scheduled_for}T12:00:00`).toLocaleDateString('en-GH',{month:'short'})}</small></span><div><small>{agreement?.agreement_number}</small><h3>{agreement?.customer_name}</h3><p>{agreement?.plan_name}</p></div><span><Users/>{visit.technician_name||'Unassigned'}</span><strong>{agreement?money(agreement.price,business.currency):''}</strong><button onClick={()=>{setSelectedId(visit.agreement_id);setView('agreements')}}>Open <ChevronRight/></button></article>})}{!upcoming.length&&<div className="spEmpty"><CalendarCheck2/><b>No visits scheduled</b><span>New plans create their first visit automatically.</span></div>}</div></section>}

    {view==='assets'&&<section className="spAssetLibrary noPrint"><header><div><small>CLIENT EQUIPMENT REGISTER</small><h2>Installed assets</h2><p>Warranty, service condition and agreement coverage in one register.</p></div><button className="spPrimary" onClick={()=>openComposer()}><Plus/> Add with a plan</button></header><div className="spAssetGrid">{assets.map(asset=>{const linked=agreements.filter(item=>item.asset_ids.includes(asset.id));return <article key={asset.id}><i><Wrench/></i><span className={`spStatus status-${asset.status.toLowerCase().replaceAll(' ','-')}`}>{asset.status}</span><h3>{asset.name}</h3><p>{asset.customer_name}</p><dl><div><dt>Type</dt><dd>{asset.type}</dd></div><div><dt>Serial</dt><dd>{asset.serial_number||'—'}</dd></div><div><dt>Warranty</dt><dd>{asset.warranty_until||'Not recorded'}</dd></div><div><dt>Coverage</dt><dd>{linked.length?`${linked.length} plan${linked.length===1?'':'s'}`:'None'}</dd></div></dl>{linked[0]&&<button onClick={()=>{setSelectedId(linked[0].id);setView('agreements')}}>Open agreement <ChevronRight/></button>}</article>})}{!assets.length&&<div className="spEmpty"><PackageCheck/><b>No equipment registered</b><span>Create a service plan to add the first client asset.</span></div>}</div></section>}

    {composer&&<div className="spOverlay noPrint" role="dialog" aria-modal="true" aria-label="Create service plan"><button className="spBackdrop" onClick={()=>setComposer(false)} aria-label="Close"/><section className="spComposer"><header><div><small>NEW RECURRING SERVICE</small><h2>Build a maintenance plan</h2><p>Start from a trade template, then tailor the equipment, price and visit cycle.</p></div><button onClick={()=>setComposer(false)}><X/></button></header><div className="spComposerBody">
      <section className="spTemplates"><div className="spSectionTitle"><Sparkles/><div><span>01 · STARTER PLAN</span><h3>Choose a trade template</h3></div></div><div>{planTemplates.map((template,index)=><button key={template.name} className={index===templateIndex?'active':''} onClick={()=>chooseTemplate(index)}><Wrench/><span><b>{template.name}</b><small>{template.trade} · Every {template.intervalDays} days</small></span>{index===templateIndex&&<CheckCircle2/>}</button>)}</div></section>
      <section className="spFormSection"><div className="spSectionTitle"><Users/><div><span>02 · CLIENT & EQUIPMENT</span><h3>Who and what is covered</h3></div></div><div className="spFormGrid"><label>Customer<select value={draft.customer_id} onChange={event=>chooseCustomer(event.target.value)}><option value="">Choose customer</option>{customers.map(customer=><option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label>Equipment / system name<input value={assetDraft.name} onChange={event=>setAssetDraft(value=>({...value,name:event.target.value}))}/></label><label>Equipment type<input value={assetDraft.type} onChange={event=>setAssetDraft(value=>({...value,type:event.target.value}))}/></label><label>Site address<input value={assetDraft.site_address||''} onChange={event=>setAssetDraft(value=>({...value,site_address:event.target.value||null}))}/></label><label>Manufacturer<input value={assetDraft.manufacturer||''} onChange={event=>setAssetDraft(value=>({...value,manufacturer:event.target.value||null}))}/></label><label>Model<input value={assetDraft.model||''} onChange={event=>setAssetDraft(value=>({...value,model:event.target.value||null}))}/></label><label>Serial number<input value={assetDraft.serial_number||''} onChange={event=>setAssetDraft(value=>({...value,serial_number:event.target.value||null}))}/></label><label>Warranty until<input type="date" value={assetDraft.warranty_until||''} onChange={event=>setAssetDraft(value=>({...value,warranty_until:event.target.value||null}))}/></label></div></section>
      <section className="spFormSection"><div className="spSectionTitle"><RefreshCcw/><div><span>03 · AGREEMENT</span><h3>Visit and billing rules</h3></div></div><div className="spFormGrid"><label>Plan name<input value={draft.plan_name} onChange={event=>setDraft(value=>({...value,plan_name:event.target.value}))}/></label><label>Trade<input value={draft.trade} onChange={event=>setDraft(value=>({...value,trade:event.target.value}))}/></label><label>Start date<input type="date" value={draft.start_date} onChange={event=>setDraft(value=>({...value,start_date:event.target.value,next_visit_date:addDays(event.target.value,value.interval_days)}))}/></label><label>Service interval<select value={draft.interval_days} onChange={event=>{const days=Number(event.target.value);setDraft(value=>({...value,interval_days:days,next_visit_date:addDays(value.start_date,days)}))}}><option value={30}>Monthly</option><option value={60}>Every 2 months</option><option value={90}>Quarterly</option><option value={180}>Every 6 months</option><option value={365}>Yearly</option></select></label><label>Included visits<input type="number" min="1" max="24" value={draft.included_visits} onChange={event=>setDraft(value=>({...value,included_visits:Number(event.target.value)}))}/></label><label>Price ({business.currency})<input type="number" min="0" step="0.01" value={draft.price} onChange={event=>setDraft(value=>({...value,price:Number(event.target.value)}))}/></label><label>Billing cycle<select value={draft.billing_cycle} onChange={event=>setDraft(value=>({...value,billing_cycle:event.target.value as ServiceBillingCycle}))}>{(['Per visit','Monthly','Quarterly','Yearly'] as ServiceBillingCycle[]).map(value=><option key={value}>{value}</option>)}</select></label><label>Assigned technician<select value={draft.assigned_member_id||''} onChange={event=>{const member=team.find(item=>item.id===event.target.value);setDraft(value=>({...value,assigned_member_id:member?.id||null,assigned_member_name:member?.name||null}))}}><option value="">Unassigned</option>{team.filter(item=>item.status==='Active').map(member=><option value={member.id} key={member.id}>{member.name}</option>)}</select></label><label className="spToggle full"><input type="checkbox" checked={draft.auto_invoice} onChange={event=>setDraft(value=>({...value,auto_invoice:event.target.checked}))}/><span><b>Automatic visit invoicing</b><small>Create an invoice when each visit is completed.</small></span></label></div></section>
      <section className="spFormSection"><div className="spSectionTitle"><ClipboardCheck/><div><span>04 · SCOPE</span><h3>Client-ready service checklist</h3></div><button onClick={()=>setDraft(value=>({...value,scope:[...value.scope,'New service task']}))}><Plus/> Add task</button></div><div className="spScopeEditor">{draft.scope.map((item,index)=><label key={index}><b>{String(index+1).padStart(2,'0')}</b><input value={item} onChange={event=>setDraft(value=>({...value,scope:value.scope.map((entry,itemIndex)=>itemIndex===index?event.target.value:entry)}))}/><button onClick={()=>setDraft(value=>({...value,scope:value.scope.filter((_,itemIndex)=>itemIndex!==index)}))}><Trash2/></button></label>)}</div><label className="spNotes">Agreement notes<textarea rows={3} value={draft.notes||''} onChange={event=>setDraft(value=>({...value,notes:event.target.value||null}))} placeholder="Parts exclusions, response times, access requirements…"/></label></section>
      {error&&<p className="spFormError"><AlertTriangle/>{error}</p>}
    </div><footer><button onClick={()=>setComposer(false)}>Cancel</button><button className="spPrimary" disabled={saving} onClick={savePlan}>{saving?'Saving…':'Create service plan'}</button></footer></section></div>}
  </main>;
}
