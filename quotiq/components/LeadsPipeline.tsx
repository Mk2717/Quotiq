'use client';

import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronRight, ClipboardCheck, Copy, ExternalLink, FilePlus2, Filter, Inbox, Mail, MapPin, MessageCircle, Phone, Plus, RefreshCw, Save, Search, Settings2, Share2, Sparkles, UserPlus, UsersRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createManualServiceLead, getBookingShareUrl, getOrCreateBookingPage, leadStatusLabels, listServiceLeads, updateBookingPage, updateServiceLead } from '../lib/supabase';
import { getStored, setStored, uid } from '../lib/storage';
import type { BookingPage, Business, Customer, LeadStatus, LeadUrgency, ServiceLead } from '../types';

const stages:LeadStatus[]=['new','contacted','site_visit','quoted','won','lost'];
const stageMeta:Record<LeadStatus,{caption:string,color:string}>={
  new:{caption:'Needs a first response',color:'#2563eb'},contacted:{caption:'Conversation started',color:'#7c3aed'},
  site_visit:{caption:'Inspection planned',color:'#d97706'},quoted:{caption:'Estimate delivered',color:'#0891b2'},
  won:{caption:'Approved work',color:'#059669'},lost:{caption:'Closed without sale',color:'#64748b'},
};
const fallbackBusiness:Business={name:'My Business',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'};
const blankManual={customerName:'',phone:'',email:'',serviceType:'',siteAddress:'',preferredDate:'',preferredTime:'',budgetRange:'',urgency:'normal' as LeadUrgency,details:''};

const dateLabel=(value:string|null,includeTime=false)=>{
  if(!value)return'Not set';
  const date=new Date(includeTime?value:`${value}T12:00:00`);
  return Number.isNaN(date.getTime())?'Not set':new Intl.DateTimeFormat('en-GH',{day:'numeric',month:'short',...(includeTime?{hour:'numeric',minute:'2-digit'}:{})}).format(date);
};
const isDue=(lead:ServiceLead)=>Boolean(lead.follow_up_at&&!['won','lost'].includes(lead.status)&&new Date(lead.follow_up_at).getTime()<=Date.now());

export default function LeadsPipeline(){
  const navigate=useNavigate();
  const[page,setPage]=useState<BookingPage|null>(null),[leads,setLeads]=useState<ServiceLead[]>([]);
  const[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState('');
  const[query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<'all'|LeadStatus>('all');
  const[selected,setSelected]=useState<ServiceLead|null>(null),[settings,setSettings]=useState(false),[manualOpen,setManualOpen]=useState(false);
  const[pageDraft,setPageDraft]=useState<BookingPage|null>(null),[manual,setManual]=useState(blankManual),[saving,setSaving]=useState(false);

  const refresh=async()=>{
    setLoading(true);setError('');
    try{
      const business=getStored<Business>('q-business',fallbackBusiness);
      const bookingPage=await getOrCreateBookingPage(business);
      const records=await listServiceLeads();
      setPage(bookingPage);setPageDraft(bookingPage);setLeads(records);
      setManual(current=>({...current,serviceType:current.serviceType||bookingPage.services[0]||''}));
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not load booking requests.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer)},[]);

  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),2600);return()=>window.clearTimeout(timer)},[toast]);
  useEffect(()=>{
    if(!selected&&!settings&&!manualOpen)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setSelected(null);setSettings(false);setManualOpen(false)}};
    document.body.classList.add('lpModalOpen');window.addEventListener('keydown',close);
    return()=>{document.body.classList.remove('lpModalOpen');window.removeEventListener('keydown',close)};
  },[selected,settings,manualOpen]);

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return leads.filter(lead=>(statusFilter==='all'||lead.status===statusFilter)&&(!term||`${lead.customer_name} ${lead.phone||''} ${lead.email||''} ${lead.service_type} ${lead.site_address}`.toLowerCase().includes(term)));
  },[leads,query,statusFilter]);
  const followUps=useMemo(()=>leads.filter(isDue).sort((a,b)=>String(a.follow_up_at).localeCompare(String(b.follow_up_at))),[leads]);
  const openValue=leads.filter(lead=>!['won','lost'].includes(lead.status)).length;
  const won=leads.filter(lead=>lead.status==='won').length;

  const replaceLead=(updated:ServiceLead)=>{
    setLeads(current=>current.map(lead=>lead.id===updated.id?updated:lead));
    setSelected(current=>current?.id===updated.id?updated:current);
  };
  const changeLead=async(lead:ServiceLead,changes:Parameters<typeof updateServiceLead>[1],message?:string)=>{
    try{const updated=await updateServiceLead(lead.id,changes);replaceLead(updated);if(message)setToast(message)}
    catch(reason){setToast(reason instanceof Error?reason.message:'Could not save that change.')}
  };
  const copyText=async(value:string,message:string)=>{
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
      else{const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();document.execCommand('copy');field.remove()}
      setToast(message);
    }catch{setToast('Copy failed. Select and copy the link manually.')}
  };
  const bookingLink=page?getBookingShareUrl(page.slug):'';
  const scheduleFollowUp=(lead:ServiceLead,days:number)=>{const date=new Date();date.setDate(date.getDate()+days);date.setHours(9,0,0,0);void changeLead(lead,{follow_up_at:date.toISOString()},`Follow-up set for ${dateLabel(date.toISOString(),true)}`)};
  const followUpMessage=(lead:ServiceLead)=>`Hello ${lead.customer_name}, this is ${page?.business_name||'your contractor'} following up about your ${lead.service_type.toLowerCase()} request. Are you available to discuss the next step?`;

  const convertToEstimate=async(lead:ServiceLead)=>{
    const customers=getStored<Customer[]>('q-customers',[]);
    const email=lead.email?.trim().toLowerCase(),phone=lead.phone?.replace(/\s+/g,'');
    let customer=customers.find(item=>(email&&item.email?.trim().toLowerCase()===email)||(phone&&item.phone?.replace(/\s+/g,'')===phone));
    if(!customer){
      customer={id:uid('CUS'),name:lead.customer_name,phone:lead.phone||'',email:lead.email||'',address:lead.site_address,siteAddress:lead.site_address,status:'Active',tags:['Booking lead'],notes:lead.details||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      setStored('q-customers',[customer,...customers]);
    }
    await changeLead(lead,{status:lead.status==='new'?'contacted':lead.status,follow_up_at:new Date(Date.now()+3*24*60*60_000).toISOString()},'Customer ready for an estimate');
    navigate(`/estimates/new?customer=${encodeURIComponent(customer.id)}`);
  };

  const savePage=async()=>{
    if(!pageDraft)return;setSaving(true);
    try{const updated=await updateBookingPage(pageDraft);setPage(updated);setPageDraft(updated);setSettings(false);setToast('Booking page updated')}
    catch(reason){setToast(reason instanceof Error?reason.message:'Could not update the booking page.')}
    finally{setSaving(false)}
  };
  const addManual=async(event:FormEvent)=>{
    event.preventDefault();if(!page)return;
    if(!manual.phone.trim()&&!manual.email.trim()){setToast('Add a phone number or email address.');return}
    setSaving(true);
    try{const created=await createManualServiceLead(page.id,manual);setLeads(current=>[created,...current]);setManual({...blankManual,serviceType:page.services[0]||''});setManualOpen(false);setSelected(created);setToast('Lead added')}
    catch(reason){setToast(reason instanceof Error?reason.message:'Could not add the lead.')}
    finally{setSaving(false)}
  };

  if(loading)return <main className="lpShell"><div className="lpLoading"><RefreshCw/><b>Preparing your booking pipeline…</b><span>Connecting requests, customers and estimates.</span></div></main>;
  if(error&&!page)return <main className="lpShell"><div className="lpError"><Inbox/><h1>Bookings could not load</h1><p>{error}</p><button onClick={()=>void refresh()}><RefreshCw/>Try again</button></div></main>;

  return <main className="lpShell">
    {toast&&<div className="lpToast" role="status"><Check/>{toast}</div>}
    <header className="lpHero">
      <div><span className="lpEyebrow"><Sparkles/>LEADS & BOOKINGS</span><h1>Turn requests into paying jobs.</h1><p>Share one professional booking link, follow every lead and move clients straight into estimates.</p></div>
      <div className="lpHeroActions"><button className="lpButton ghost" onClick={()=>setSettings(true)}><Settings2/>Booking page</button><button className="lpButton primary" onClick={()=>setManualOpen(true)}><Plus/>Add lead</button></div>
    </header>

    <section className="lpShareCard">
      <div className="lpShareIcon"><Share2/></div><div className="lpShareCopy"><small>YOUR PUBLIC BOOKING LINK</small><strong>{page?.active?'Ready to share':'Currently paused'}</strong><p>Customers can request work without creating an account.</p></div>
      <div className="lpShareField"><span>{bookingLink}</span><button onClick={()=>void copyText(bookingLink,'Booking link copied')} aria-label="Copy booking link"><Copy/></button></div>
      <div className="lpShareActions"><button onClick={()=>window.open(bookingLink,'_blank','noopener,noreferrer')}><ExternalLink/>Open page</button><button onClick={()=>void copyText(bookingLink,'Booking link copied')}><Copy/>Copy link</button></div>
    </section>

    <section className="lpStats">
      <article><i><Inbox/></i><div><span>New requests</span><strong>{leads.filter(lead=>lead.status==='new').length}</strong><small>Awaiting first response</small></div></article>
      <article><i><UsersRound/></i><div><span>Open pipeline</span><strong>{openValue}</strong><small>Active opportunities</small></div></article>
      <article className={followUps.length?'attention':''}><i><CalendarClock/></i><div><span>Follow-ups due</span><strong>{followUps.length}</strong><small>{followUps.length?'Needs attention today':'Nothing overdue'}</small></div></article>
      <article><i><ClipboardCheck/></i><div><span>Jobs won</span><strong>{won}</strong><small>{leads.length?`${Math.round(won/leads.length*100)}% of all leads`:'Build your first win'}</small></div></article>
    </section>

    {followUps.length>0&&<section className="lpFollowQueue"><header><div><span>FOLLOW-UP QUEUE</span><h2>Keep the conversation moving</h2></div><small>{followUps.length} overdue or due now</small></header><div className="lpFollowList">{followUps.slice(0,4).map(lead=><button key={lead.id} onClick={()=>setSelected(lead)}><i><CalendarClock/></i><span><b>{lead.customer_name}</b><small>{lead.service_type} · due {dateLabel(lead.follow_up_at,true)}</small></span><ChevronRight/></button>)}</div></section>}

    <section className="lpWorkspace">
      <header className="lpToolbar"><div><span>SALES PIPELINE</span><h2>Every opportunity, clearly staged</h2></div><div className="lpTools"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search leads…"/></label><div className="lpFilter"><Filter/><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|LeadStatus)}><option value="all">All stages</option>{stages.map(stage=><option value={stage} key={stage}>{leadStatusLabels[stage]}</option>)}</select></div></div></header>
      {!leads.length?<div className="lpEmpty"><div><Inbox/></div><h2>Your lead pipeline is ready.</h2><p>Share your booking link or add a phone enquiry. New requests will arrive here automatically.</p><div><button className="lpButton primary" onClick={()=>void copyText(bookingLink,'Booking link copied')}><Copy/>Copy booking link</button><button className="lpButton ghost" onClick={()=>setManualOpen(true)}><Plus/>Add first lead</button></div></div>:
      <div className="lpKanban" aria-label="Lead pipeline">{stages.map(stage=>{const rows=filtered.filter(lead=>lead.status===stage);return <section className="lpColumn" key={stage} style={{'--stage-color':stageMeta[stage].color} as CSSProperties}><header><div><span/><div><b>{leadStatusLabels[stage]}</b><small>{stageMeta[stage].caption}</small></div></div><strong>{rows.length}</strong></header><div className="lpCards">{rows.map(lead=><button className={`lpLeadCard ${isDue(lead)?'due':''}`} key={lead.id} onClick={()=>setSelected(lead)}><div className="lpCardTop"><span className={`urgency ${lead.urgency}`}>{lead.urgency==='normal'?'Flexible':lead.urgency==='soon'?'Soon':'Urgent'}</span><small>{dateLabel(lead.created_at,true)}</small></div><h3>{lead.customer_name}</h3><p>{lead.service_type}</p><div className="lpCardMeta"><span><MapPin/>{lead.site_address}</span>{lead.preferred_date&&<span><CalendarClock/>{dateLabel(lead.preferred_date)}{lead.preferred_time?` · ${lead.preferred_time}`:''}</span>}</div><footer><span>{lead.source==='booking_page'?'Online booking':'Manual lead'}</span>{isDue(lead)&&<b><CalendarClock/>Follow up</b>}</footer></button>)}{!rows.length&&<div className="lpColumnEmpty">No {leadStatusLabels[stage].toLowerCase()} leads</div>}</div></section>})}</div>}
    </section>

    {selected&&<div className="lpModal" role="dialog" aria-modal="true" aria-labelledby="leadDetailTitle"><button className="lpBackdrop" aria-label="Close lead" onClick={()=>setSelected(null)}/><section className="lpDrawer"><header><div><span>LEAD DETAILS</span><h2 id="leadDetailTitle">{selected.customer_name}</h2><p>{selected.service_type}</p></div><button onClick={()=>setSelected(null)} aria-label="Close"><X/></button></header><div className="lpDrawerBody">
      <div className="lpStageControl"><label>Pipeline stage<select value={selected.status} onChange={event=>void changeLead(selected,{status:event.target.value as LeadStatus},`Moved to ${leadStatusLabels[event.target.value as LeadStatus]}`)}>{stages.map(stage=><option value={stage} key={stage}>{leadStatusLabels[stage]}</option>)}</select></label><span style={{background:stageMeta[selected.status].color}}>{leadStatusLabels[selected.status]}</span></div>
      <div className="lpContactGrid">{selected.phone&&<a href={`tel:${selected.phone}`}><Phone/><span><small>PHONE</small><b>{selected.phone}</b></span></a>}{selected.email&&<a href={`mailto:${selected.email}`}><Mail/><span><small>EMAIL</small><b>{selected.email}</b></span></a>}<div><MapPin/><span><small>JOB SITE</small><b>{selected.site_address}</b></span></div>{selected.preferred_date&&<div><CalendarClock/><span><small>PREFERRED</small><b>{dateLabel(selected.preferred_date)}{selected.preferred_time?` · ${selected.preferred_time}`:''}</b></span></div>}</div>
      {selected.details&&<section className="lpDetailBlock"><span>JOB DETAILS</span><p>{selected.details}</p></section>}
      <section className="lpDetailBlock"><span>FOLLOW-UP</span><div className="lpFollowButtons"><button onClick={()=>scheduleFollowUp(selected,1)}>Tomorrow</button><button onClick={()=>scheduleFollowUp(selected,3)}>In 3 days</button><button onClick={()=>scheduleFollowUp(selected,7)}>In 1 week</button></div><small>{selected.follow_up_at?`Current reminder: ${dateLabel(selected.follow_up_at,true)}`:'No reminder set'}</small></section>
      <label className="lpNotes"><span>Internal notes</span><textarea value={selected.internal_notes||''} onChange={event=>setSelected({...selected,internal_notes:event.target.value})} placeholder="Access notes, client preferences or next steps…" maxLength={4000}/><button onClick={()=>void changeLead(selected,{internal_notes:selected.internal_notes||null},'Notes saved')}><Save/>Save notes</button></label>
    </div><footer className="lpDrawerFooter"><button onClick={()=>void copyText(followUpMessage(selected),'Follow-up message copied')}><MessageCircle/>Copy follow-up</button><button className="primary" onClick={()=>void convertToEstimate(selected)}><FilePlus2/>Create estimate</button></footer></section></div>}

    {settings&&pageDraft&&<div className="lpModal" role="dialog" aria-modal="true" aria-labelledby="bookingSettingsTitle"><button className="lpBackdrop" aria-label="Close booking settings" onClick={()=>setSettings(false)}/><section className="lpDrawer settings"><header><div><span>PUBLIC BOOKING PAGE</span><h2 id="bookingSettingsTitle">Brand your request form</h2><p>Changes apply to the link you already share.</p></div><button onClick={()=>setSettings(false)} aria-label="Close"><X/></button></header><div className="lpDrawerBody"><label><span>Business name</span><input value={pageDraft.business_name} onChange={event=>setPageDraft({...pageDraft,business_name:event.target.value})}/></label><div className="lpTwo"><label><span>Phone</span><input value={pageDraft.business_phone||''} onChange={event=>setPageDraft({...pageDraft,business_phone:event.target.value})}/></label><label><span>Email</span><input type="email" value={pageDraft.business_email||''} onChange={event=>setPageDraft({...pageDraft,business_email:event.target.value})}/></label></div><label><span>Service area</span><input value={pageDraft.service_area||''} onChange={event=>setPageDraft({...pageDraft,service_area:event.target.value})} placeholder="Sunyani and surrounding areas"/></label><label><span>Welcome message</span><textarea value={pageDraft.welcome_message} onChange={event=>setPageDraft({...pageDraft,welcome_message:event.target.value})}/></label><label><span>Services · one per line</span><textarea className="services" value={pageDraft.services.join('\n')} onChange={event=>setPageDraft({...pageDraft,services:event.target.value.split('\n')})}/></label><div className="lpTwo"><label><span>Accent colour</span><div className="lpColor"><input type="color" value={pageDraft.accent_color} onChange={event=>setPageDraft({...pageDraft,accent_color:event.target.value})}/><b>{pageDraft.accent_color}</b></div></label><label className="lpSwitch"><span>Accept new requests</span><button type="button" className={pageDraft.active?'on':''} onClick={()=>setPageDraft({...pageDraft,active:!pageDraft.active})}><i/><b>{pageDraft.active?'Live':'Paused'}</b></button></label></div><div className="lpLinkPreview"><small>PUBLIC LINK</small><span>{bookingLink}</span></div></div><footer className="lpDrawerFooter"><button onClick={()=>window.open(bookingLink,'_blank','noopener,noreferrer')}><ExternalLink/>Preview</button><button className="primary" disabled={saving} onClick={()=>void savePage()}><Save/>{saving?'Saving…':'Save page'}</button></footer></section></div>}

    {manualOpen&&page&&<div className="lpModal" role="dialog" aria-modal="true" aria-labelledby="manualLeadTitle"><button className="lpBackdrop" aria-label="Close new lead" onClick={()=>setManualOpen(false)}/><section className="lpDrawer compact"><header><div><span>NEW OPPORTUNITY</span><h2 id="manualLeadTitle">Add a lead</h2><p>Capture a call, referral or walk-in request.</p></div><button onClick={()=>setManualOpen(false)} aria-label="Close"><X/></button></header><form className="lpDrawerBody" onSubmit={addManual}><label><span>Customer name *</span><input required value={manual.customerName} onChange={event=>setManual({...manual,customerName:event.target.value})}/></label><div className="lpTwo"><label><span>Phone</span><input value={manual.phone} onChange={event=>setManual({...manual,phone:event.target.value})}/></label><label><span>Email</span><input type="email" value={manual.email} onChange={event=>setManual({...manual,email:event.target.value})}/></label></div><label><span>Service *</span><select required value={manual.serviceType} onChange={event=>setManual({...manual,serviceType:event.target.value})}>{page.services.map(service=><option key={service}>{service}</option>)}</select></label><label><span>Job / site address *</span><input required value={manual.siteAddress} onChange={event=>setManual({...manual,siteAddress:event.target.value})}/></label><label><span>Job details</span><textarea value={manual.details} onChange={event=>setManual({...manual,details:event.target.value})}/></label><div className="lpManualFooter"><button type="button" onClick={()=>setManualOpen(false)}>Cancel</button><button className="primary" disabled={saving}><UserPlus/>{saving?'Adding…':'Add lead'}</button></div></form></section></div>}
  </main>;
}
