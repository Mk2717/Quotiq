'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, CalendarClock, Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardCopy, FileText, FolderKanban, Inbox, Mail, MapPin, MessageCircle, MessageSquareText, Phone, Plus, RefreshCw, Search, Send, Sparkles, Users, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listClientCommunications, listClientMessageTemplates, updateClientCommunication, upsertClientCommunication, upsertClientMessageTemplate } from '../lib/supabase';
import { getStored, setStored } from '../lib/storage';
import type { Business, ClientCommunication, ClientMessageTemplate, CommunicationChannel, CommunicationStatus, Customer, Estimate, Invoice, Project } from '../types';

const communicationCacheKey='q-client-communications';
const templateCacheKey='q-client-message-templates';
const pageOpenedAt=Date.now();
const fallbackBusiness:Business={name:'My Business',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'};
const builtinTemplates:ClientMessageTemplate[]=[
  {id:'builtin-booking',name:'New enquiry reply',channel:'whatsapp',subject:'Your service request',body:'Hello {name}, thank you for contacting {business}. We received your request and would like to confirm a few details before the next step.',active:true,builtin:true},
  {id:'builtin-estimate',name:'Estimate follow-up',channel:'whatsapp',subject:'Your estimate from {business}',body:'Hello {name}, I am following up on the estimate we prepared for you. Please let me know if you have any questions or would like us to schedule the work.',active:true,builtin:true},
  {id:'builtin-invoice',name:'Payment reminder',channel:'whatsapp',subject:'Friendly payment reminder',body:'Hello {name}, this is a friendly reminder from {business} that your current outstanding balance is {outstanding}. Please let us know when payment has been made. Thank you.',active:true,builtin:true},
  {id:'builtin-visit',name:'Site visit reminder',channel:'whatsapp',subject:'Upcoming site visit',body:'Hello {name}, this is a reminder about your upcoming site visit with {business}. Please confirm that the site will be accessible at the agreed time.',active:true,builtin:true},
  {id:'builtin-thanks',name:'Job completion thank-you',channel:'whatsapp',subject:'Thank you for choosing {business}',body:'Hello {name}, thank you for choosing {business}. We appreciate the opportunity to complete your project. Please contact us if you need any support.',active:true,builtin:true},
];
const channels:{id:CommunicationChannel;label:string}[]=[
  {id:'whatsapp',label:'WhatsApp'},{id:'email',label:'Email'},{id:'sms',label:'SMS'},{id:'phone',label:'Phone call'},{id:'note',label:'Internal note'},
];
const statusLabels:Record<CommunicationStatus,string>={opened:'Opened app',sent:'Sent',replied:'Replied',no_answer:'No answer',logged:'Logged'};

const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(value||0);
const dateTime=(value:string)=>new Intl.DateTimeFormat('en-GH',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const mergeById=<T extends{id:string}>(primary:T[],secondary:T[])=>Array.from(new Map([...secondary,...primary].map(item=>[item.id,item])).values());
const normaliseWhatsApp=(phone:string)=>{
  const digits=phone.replace(/\D/g,'');
  if(digits.startsWith('0')&&digits.length>=9)return`233${digits.slice(1)}`;
  return digits;
};
const createLocalId=()=>{
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const value=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return`${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
};
const recordDate=(value:string|undefined,fallback:string)=>value&&/^\d{4}-\d{2}-\d{2}/.test(value)?new Date(`${value.slice(0,10)}T12:00:00`).toISOString():fallback;

type TimelineItem={id:string;date:string;kind:'communication'|'estimate'|'invoice'|'project';title:string;detail:string;amount?:number;record?:ClientCommunication};

export default function ClientHub({session}:{session:Session|null}){
  const navigate=useNavigate(),location=useLocation();
  const[customers,setCustomers]=useState<Customer[]>(()=>getStored('q-customers',[]));
  const[records,setRecords]=useState<ClientCommunication[]>(()=>getStored(communicationCacheKey,[]));
  const[customTemplates,setCustomTemplates]=useState<ClientMessageTemplate[]>(()=>getStored(templateCacheKey,[]));
  const[selectedId,setSelectedId]=useState(()=>new URLSearchParams(location.search).get('customer')||customers[0]?.id||'');
  const[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'due'|'balance'>('all');
  const[channel,setChannel]=useState<CommunicationChannel>('whatsapp'),[subject,setSubject]=useState(''),[body,setBody]=useState('');
  const[followUp,setFollowUp]=useState(''),[related,setRelated]=useState('general:');
  const[loading,setLoading]=useState(Boolean(session)),[online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine);
  const[toast,setToast]=useState(''),[templateOpen,setTemplateOpen]=useState(false),[savingTemplate,setSavingTemplate]=useState(false);
  const[templateDraft,setTemplateDraft]=useState({name:'',channel:'whatsapp' as 'whatsapp'|'email'|'sms',subject:'',body:''});
  const[business,setBusiness]=useState<Business>(()=>getStored('q-business',fallbackBusiness));
  const[estimates,setEstimates]=useState<Estimate[]>(()=>getStored('q-estimates',[]));
  const[invoices,setInvoices]=useState<Invoice[]>(()=>getStored('q-invoices',[]));
  const[projects,setProjects]=useState<Project[]>(()=>getStored('q-projects',[]));
  const[now,setNow]=useState(pageOpenedAt);

  const replaceRecord=useCallback((record:ClientCommunication)=>{
    setRecords(current=>{
      const next=current.map(item=>item.id===record.id?record:item).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
      setStored(communicationCacheKey,next);return next;
    });
  },[]);
  const syncRecord=useCallback(async(record:ClientCommunication)=>{
    if(!session||!navigator.onLine)return;
    try{
      const synced=await upsertClientCommunication(record);
      setRecords(current=>{
        const next=current.map(item=>item.id===record.id?{...synced,sync_state:'synced' as const}:item);
        setStored(communicationCacheKey,next);return next;
      });
    }catch{setToast('Saved offline — Quotiq will sync it when connected.')}
  },[session]);

  useEffect(()=>{
    const storage=(event:Event)=>{
      const key=(event as CustomEvent<{key?:string}>).detail?.key;
      if(!key||key==='q-customers')setCustomers(getStored('q-customers',[]));
      if(!key||key==='q-business')setBusiness(getStored('q-business',fallbackBusiness));
      if(!key||key==='q-estimates')setEstimates(getStored('q-estimates',[]));
      if(!key||key==='q-invoices')setInvoices(getStored('q-invoices',[]));
      if(!key||key==='q-projects')setProjects(getStored('q-projects',[]));
    };
    window.addEventListener('quotiq:storage',storage);return()=>window.removeEventListener('quotiq:storage',storage);
  },[]);
  useEffect(()=>{
    const connected=()=>setOnline(true),disconnected=()=>setOnline(false);
    window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
    return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected)};
  },[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),2600);return()=>window.clearTimeout(timer)},[toast]);
  useEffect(()=>{
    if(!session)return;
    let active=true;
    Promise.all([listClientCommunications(),listClientMessageTemplates()]).then(([cloudRecords,cloudTemplates])=>{
      if(!active)return;
      const pending=getStored<ClientCommunication[]>(communicationCacheKey,[]).filter(item=>item.sync_state==='pending');
      const merged=mergeById(pending,cloudRecords.map(item=>({...item,sync_state:'synced' as const}))).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
      setRecords(merged);setStored(communicationCacheKey,merged);
      const templates=mergeById(cloudTemplates,getStored<ClientMessageTemplate[]>(templateCacheKey,[]));
      setCustomTemplates(templates);setStored(templateCacheKey,templates);
      pending.forEach(item=>void syncRecord(item));
    }).catch(()=>setToast('Using the saved offline ClientHub copy.')).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[session,syncRecord]);
  useEffect(()=>{
    if(!session||!online)return;
    const pending=records.filter(item=>item.sync_state==='pending');
    pending.forEach(item=>void syncRecord(item));
  },[online,records,session,syncRecord]);

  const customerMetrics=useCallback((customer:Customer)=>{
    const customerInvoices=invoices.filter(item=>item.customerId===customer.id||item.customer===customer.name);
    const outstanding=customerInvoices.reduce((sum,item)=>sum+Math.max(0,item.amount-item.paid),0);
    const customerRecords=records.filter(item=>item.customer_id===customer.id);
    const nextFollow=customerRecords.filter(item=>item.follow_up_at&&!item.follow_up_completed_at).sort((a,b)=>String(a.follow_up_at).localeCompare(String(b.follow_up_at)))[0];
    return{outstanding,records:customerRecords,nextFollow,last:customerRecords[0]};
  },[invoices,records]);
  const filteredCustomers=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return customers.filter(customer=>{
      const metrics=customerMetrics(customer),matches=!term||`${customer.name} ${customer.phone} ${customer.email} ${customer.company||''}`.toLowerCase().includes(term);
      if(!matches)return false;
      if(filter==='due')return Boolean(metrics.nextFollow&&new Date(metrics.nextFollow.follow_up_at!).getTime()<=now);
      if(filter==='balance')return metrics.outstanding>0;
      return true;
    });
  },[customers,customerMetrics,query,filter,now]);
  const selected=useMemo(()=>customers.find(customer=>customer.id===selectedId)||null,[customers,selectedId]);
  const selectedMetrics=useMemo(()=>selected?customerMetrics(selected):null,[customerMetrics,selected]);
  const selectedEstimates=useMemo(()=>selected?estimates.filter(item=>item.customerId===selected.id||item.customer===selected.name):[],[estimates,selected]);
  const selectedInvoices=useMemo(()=>selected?invoices.filter(item=>item.customerId===selected.id||item.customer===selected.name):[],[invoices,selected]);
  const selectedProjects=useMemo(()=>selected?projects.filter(item=>item.customerId===selected.id||item.customer===selected.name):[],[projects,selected]);
  const fallbackDate=useMemo(()=>new Date(now).toISOString(),[now]);
  const timeline=useMemo<TimelineItem[]>(()=>{
    if(!selected)return[];
    const communications=records.filter(item=>item.customer_id===selected.id).map(item=>({id:item.id,date:item.occurred_at,kind:'communication' as const,title:item.subject||channels.find(channel=>channel.id===item.channel)?.label||'Contact',detail:item.body,record:item}));
    const documents:TimelineItem[]=[
      ...selectedEstimates.map(item=>({id:`estimate-${item.id}`,date:recordDate(item.date,fallbackDate),kind:'estimate' as const,title:`Estimate ${item.id}`,detail:`${item.project} · ${item.status}`,amount:item.amount})),
      ...selectedInvoices.map(item=>({id:`invoice-${item.id}`,date:recordDate(item.date,fallbackDate),kind:'invoice' as const,title:`Invoice ${item.id}`,detail:`${item.project} · ${item.status}`,amount:item.amount})),
      ...selectedProjects.map(item=>({id:`project-${item.id}`,date:recordDate(item.startDate,fallbackDate),kind:'project' as const,title:item.name,detail:`Project · ${item.status}`,amount:item.budget})),
    ];
    return[...communications,...documents].sort((a,b)=>b.date.localeCompare(a.date));
  },[fallbackDate,records,selected,selectedEstimates,selectedInvoices,selectedProjects]);
  const templates=useMemo(()=>[...builtinTemplates,...customTemplates],[customTemplates]);
  const dueFollowUps=useMemo(()=>records.filter(item=>item.follow_up_at&&!item.follow_up_completed_at).sort((a,b)=>String(a.follow_up_at).localeCompare(String(b.follow_up_at))),[records]);
  const dueNow=dueFollowUps.filter(item=>new Date(item.follow_up_at!).getTime()<=now).length;
  const contactedThisWeek=new Set(records.filter(item=>new Date(item.occurred_at).getTime()>=now-7*86400_000).map(item=>item.customer_id)).size;
  const pendingSync=records.filter(item=>item.sync_state==='pending').length;

  const variables=selected?{
    name:selected.name,business:business.name||'our team',outstanding:money(selectedMetrics?.outstanding||0,business.currency),
    project:selectedProjects.find(item=>item.status!=='Completed')?.name||selectedEstimates[0]?.project||'your project',
  }:{name:'customer',business:business.name||'our team',outstanding:money(0,business.currency),project:'your project'};
  const renderTemplate=(value:string)=>Object.entries(variables).reduce((text,[key,replacement])=>text.replaceAll(`{${key}}`,replacement),value);
  const applyTemplate=(template:ClientMessageTemplate)=>{setChannel(template.channel);setSubject(renderTemplate(template.subject||''));setBody(renderTemplate(template.body))};
  const copyMessage=async()=>{if(!body.trim()){setToast('Choose a template or write a message first.');return}try{await navigator.clipboard.writeText(body);setToast('Message copied')}catch{setToast('Could not copy the message.')}};

  const newRecord=(args:Partial<ClientCommunication>={}):ClientCommunication=>{
    if(!selected)throw new Error('Choose a customer first.');
    const[relatedType,relatedId]=related.split(':');
    return{id:createLocalId(),customer_id:selected.id,customer_name:selected.name,channel,direction:channel==='note'?'internal':'outbound',subject:subject.trim()||null,body:body.trim(),status:channel==='note'?'logged':'opened',occurred_at:new Date().toISOString(),follow_up_at:followUp?new Date(followUp).toISOString():null,follow_up_completed_at:null,related_type:(relatedType||'general') as ClientCommunication['related_type'],related_id:relatedId||null,sync_state:session?'pending':'local',...args};
  };
  const persistRecord=(record:ClientCommunication)=>{
    setRecords(current=>{
      const next=[record,...current.filter(item=>item.id!==record.id)].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
      setStored(communicationCacheKey,next);return next;
    });
    if(session&&navigator.onLine)void syncRecord(record);
  };
  const openChannel=()=>{
    if(!selected||!body.trim()){setToast('Choose a customer and add a message.');return}
    let href='';
    if(channel==='whatsapp'){
      const number=normaliseWhatsApp(selected.phone);if(!number){setToast('Add a phone number for this customer.');return}
      href=`https://wa.me/${number}?text=${encodeURIComponent(body)}`;
    }else if(channel==='email'){
      if(!selected.email){setToast('Add an email address for this customer.');return}
      href=`mailto:${selected.email}?subject=${encodeURIComponent(subject||`Message from ${business.name}`)}&body=${encodeURIComponent(body)}`;
    }else if(channel==='sms'){
      if(!selected.phone){setToast('Add a phone number for this customer.');return}
      href=`sms:${selected.phone}?body=${encodeURIComponent(body)}`;
    }else if(channel==='phone'){
      if(!selected.phone){setToast('Add a phone number for this customer.');return}
      href=`tel:${selected.phone}`;
    }
    if(href)window.open(href,'_blank','noopener,noreferrer');
    persistRecord(newRecord());setToast(channel==='note'?'Note saved':`${channels.find(item=>item.id===channel)?.label} opened — mark it sent after sending.`);
  };
  const logReply=()=>{if(!selected||!body.trim()){setToast('Write the customer reply first.');return}persistRecord(newRecord({direction:'inbound',status:'replied'}));setToast('Customer reply logged')};
  const updateRecord=async(record:ClientCommunication,changes:Partial<Pick<ClientCommunication,'status'|'follow_up_at'|'follow_up_completed_at'>>)=>{
    const local={...record,...changes,sync_state:session?'pending':'local'};replaceRecord(local);
    if(!session||!navigator.onLine)return;
    try{const saved=await updateClientCommunication(record.id,changes);replaceRecord({...saved,sync_state:'synced'})}catch{setToast('Change saved offline and waiting to sync.')}
  };
  const addQuickFollowUp=(days:number)=>{
    if(!selected)return;
    const target=new Date();target.setDate(target.getDate()+days);target.setHours(9,0,0,0);
    const record=newRecord({channel:'note',direction:'internal',status:'logged',subject:'Follow-up reminder',body:`Follow up with ${selected.name} about ${variables.project}.`,follow_up_at:target.toISOString()});
    persistRecord(record);setToast(`Follow-up set for ${dateTime(target.toISOString())}`);
  };
  const saveTemplate=async(event:FormEvent)=>{
    event.preventDefault();setSavingTemplate(true);
    const template:ClientMessageTemplate={id:createLocalId(),name:templateDraft.name.trim(),channel:templateDraft.channel,subject:templateDraft.subject.trim()||null,body:templateDraft.body.trim(),active:true};
    if(template.name.length<2||template.body.length<5){setToast('Add a template name and message.');setSavingTemplate(false);return}
    let saved={...template};
    if(session&&navigator.onLine){try{saved=await upsertClientMessageTemplate(template)}catch{setToast('Template saved on this device for now.')}}
    const next=[saved,...customTemplates];setCustomTemplates(next);setStored(templateCacheKey,next);setTemplateOpen(false);setTemplateDraft({name:'',channel:'whatsapp',subject:'',body:''});setSavingTemplate(false);setToast('Message template saved');
  };

  if(!customers.length)return <main className="chShell"><section className="chEmpty"><i><Users/></i><span>CLIENTHUB</span><h1>Add a customer to start a conversation.</h1><p>ClientHub connects messages, reminders, estimates and invoices to each customer record.</p><button onClick={()=>navigate('/customers/new')}><Plus/>Add first customer</button></section></main>;

  return <main className="chShell">
    {toast&&<div className="chToast" role="status"><Check/>{toast}</div>}
    <header className="chHero"><div><span><Sparkles/>CLIENTHUB</span><h1>Every client conversation, connected.</h1><p>Follow up faster, keep a complete contact history and open WhatsApp or email with the right message already prepared.</p></div><button onClick={()=>setTemplateOpen(true)}><Plus/>New template</button></header>
    <section className="chStats">
      <article><i><MessageSquareText/></i><div><span>Contact records</span><strong>{records.length}</strong><small>Messages, calls and notes</small></div></article>
      <article className={dueNow?'attention':''}><i><CalendarClock/></i><div><span>Follow-ups due</span><strong>{dueNow}</strong><small>{dueNow?'Needs attention':'Queue is clear'}</small></div></article>
      <article><i><Users/></i><div><span>Reached this week</span><strong>{contactedThisWeek}</strong><small>Unique customers</small></div></article>
      <article className={pendingSync?'pending':''}><i>{pendingSync?<RefreshCw/>:<CheckCircle2/>}</i><div><span>{session?'Secure sync':'Offline workspace'}</span><strong>{pendingSync||'✓'}</strong><small>{pendingSync?'Waiting to upload':online?'Up to date':'Offline copy ready'}</small></div></article>
    </section>

    <section className={`chWorkspace ${selected?'hasSelection':''}`}>
      <aside className="chCustomers">
        <header><div><span>CLIENTS</span><b>{filteredCustomers.length}</b></div><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search customers…"/></label><div className="chFilters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All</button><button className={filter==='due'?'active':''} onClick={()=>setFilter('due')}>Due</button><button className={filter==='balance'?'active':''} onClick={()=>setFilter('balance')}>Balance</button></div></header>
        <div className="chCustomerList">{filteredCustomers.map(customer=>{const metrics=customerMetrics(customer),due=Boolean(metrics.nextFollow&&new Date(metrics.nextFollow.follow_up_at!).getTime()<=now);return <button key={customer.id} className={`${selectedId===customer.id?'active':''} ${due?'due':''}`} onClick={()=>setSelectedId(customer.id)}><i>{customer.name.slice(0,2).toUpperCase()}</i><span><b>{customer.name}</b><small>{metrics.last?.body||customer.company||customer.phone}</small><em>{due?'Follow-up due':metrics.outstanding?`${money(metrics.outstanding,business.currency)} due`:metrics.last?dateTime(metrics.last.occurred_at):'No contact yet'}</em></span><ChevronRight/></button>})}</div>
      </aside>

      {selected&&<section className="chConversation">
        <header className="chConversationHead"><button className="chBack" onClick={()=>setSelectedId('')} aria-label="Back to customers"><ArrowLeft/></button><div className="chAvatar">{selected.name.slice(0,2).toUpperCase()}</div><div><span>CLIENT CONVERSATION</span><h2>{selected.name}</h2><p>{selected.phone}{selected.email?` · ${selected.email}`:''}</p></div><nav>{selected.phone&&<a href={`tel:${selected.phone}`} aria-label="Call customer"><Phone/></a>}{selected.phone&&<a href={`https://wa.me/${normaliseWhatsApp(selected.phone)}`} target="_blank" rel="noreferrer" aria-label="Open WhatsApp"><MessageCircle/></a>}{selected.email&&<a href={`mailto:${selected.email}`} aria-label="Email customer"><Mail/></a>}</nav></header>
        <div className="chAccountStrip"><span><MapPin/>{selected.siteAddress||selected.address||'No site address'}</span><span><CircleDollarSign/>{selectedMetrics?.outstanding?`${money(selectedMetrics.outstanding,business.currency)} outstanding`:'Account up to date'}</span><span><FolderKanban/>{selectedProjects.filter(item=>item.status!=='Completed').length} active jobs</span></div>
        <div className="chTimeline">{loading?<div className="chLoading"><RefreshCw/>Loading secure contact history…</div>:timeline.length?timeline.map(item=><article key={item.id} className={`chEvent ${item.kind}`}>
          <i>{item.kind==='communication'?(item.record?.channel==='email'?<Mail/>:item.record?.channel==='phone'?<Phone/>:item.record?.channel==='note'?<FileText/>:<MessageCircle/>):item.kind==='project'?<FolderKanban/>:item.kind==='invoice'?<CircleDollarSign/>:<FileText/>}</i>
          <div className="chEventBody"><header><div><b>{item.title}</b><span>{item.kind==='communication'?`${item.record?.direction==='inbound'?'Incoming':'Outgoing'} · ${statusLabels[item.record!.status]}`:item.detail}</span></div><time>{dateTime(item.date)}</time></header><p>{item.detail}</p>{item.amount!==undefined&&<strong>{money(item.amount,business.currency)}</strong>}
          {item.record&&<footer><span className={`chSync ${item.record.sync_state||'synced'}`}>{item.record.sync_state==='pending'?'Waiting to sync':item.record.sync_state==='local'?'Saved on device':statusLabels[item.record.status]}</span>{item.record.follow_up_at&&!item.record.follow_up_completed_at&&<button onClick={()=>void updateRecord(item.record!,{follow_up_completed_at:new Date().toISOString()})}><Check/>Complete follow-up</button>}{item.record.direction==='outbound'&&item.record.status==='opened'&&<><button onClick={()=>void updateRecord(item.record!,{status:'sent'})}>Mark sent</button><button onClick={()=>void updateRecord(item.record!,{status:'no_answer'})}>No answer</button></>}</footer>}
          </div></article>):<div className="chNoHistory"><Inbox/><b>No conversation history yet</b><span>Choose a template below to send the first professional follow-up.</span></div>}</div>
        <section className="chComposer"><header><div><span>MESSAGE COMPOSER</span><b>Prepare the next contact</b></div><button onClick={()=>setTemplateOpen(true)}><Plus/>Template</button></header><div className="chComposerControls"><label><span>Channel</span><select value={channel} onChange={event=>setChannel(event.target.value as CommunicationChannel)}>{channels.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label><span>Use template</span><select value="" onChange={event=>{const template=templates.find(item=>item.id===event.target.value);if(template)applyTemplate(template)}}><option value="">Choose a message…</option>{templates.map(template=><option value={template.id} key={template.id}>{template.name}</option>)}</select></label><label><span>Link to</span><select value={related} onChange={event=>setRelated(event.target.value)}><option value="general:">General conversation</option>{selectedEstimates.map(item=><option key={item.id} value={`estimate:${item.id}`}>Estimate {item.id}</option>)}{selectedInvoices.map(item=><option key={item.id} value={`invoice:${item.id}`}>Invoice {item.id}</option>)}{selectedProjects.map(item=><option key={item.id} value={`project:${item.id}`}>Project · {item.name}</option>)}</select></label></div>{channel==='email'&&<input className="chSubject" value={subject} onChange={event=>setSubject(event.target.value)} placeholder="Email subject" maxLength={240}/>}<textarea value={body} onChange={event=>setBody(event.target.value)} placeholder={channel==='note'?'Write a private customer note…':'Write or choose a reusable message…'} maxLength={5000}/><div className="chComposerBottom"><label><CalendarClock/><span><b>Follow up</b><input type="datetime-local" value={followUp} onChange={event=>setFollowUp(event.target.value)}/></span></label><div><button onClick={()=>void copyMessage()}><ClipboardCopy/>Copy</button><button onClick={logReply}><MessageSquareText/>Log reply</button><button className="primary" onClick={openChannel}>{channel==='note'?<FileText/>:channel==='phone'?<Phone/>:<Send/>}{channel==='note'?'Save note':channel==='phone'?'Call & log':`Open ${channels.find(item=>item.id===channel)?.label}`}</button></div></div><small className="chHonesty">Quotiq records when a messaging app is opened. Mark the contact as sent only after you finish sending it.</small></section>
      </section>}

      {selected&&<aside className="chTools"><section className="chNext"><span>NEXT ACTION</span><h3>Keep {selected.name.split(' ')[0]} moving</h3><p>Set a clear follow-up so no opportunity or payment is forgotten.</p><div><button onClick={()=>addQuickFollowUp(1)}>Tomorrow</button><button onClick={()=>addQuickFollowUp(3)}>3 days</button><button onClick={()=>addQuickFollowUp(7)}>1 week</button></div></section><section className="chDueQueue"><header><span>FOLLOW-UP QUEUE</span><b>{dueFollowUps.length}</b></header>{dueFollowUps.slice(0,5).map(record=><button key={record.id} onClick={()=>setSelectedId(record.customer_id)} className={new Date(record.follow_up_at!).getTime()<=now?'due':''}><CalendarClock/><span><b>{record.customer_name}</b><small>{dateTime(record.follow_up_at!)}</small></span><ChevronRight/></button>)}{!dueFollowUps.length&&<div><CheckCircle2/><b>Nothing waiting</b><span>Your follow-up queue is clear.</span></div>}</section><section className="chTemplates"><header><span>QUICK TEMPLATES</span><button onClick={()=>setTemplateOpen(true)}><Plus/></button></header>{templates.slice(0,5).map(template=><button key={template.id} onClick={()=>applyTemplate(template)}><i>{template.channel==='email'?<Mail/>:<MessageCircle/>}</i><span><b>{template.name}</b><small>{template.builtin?'Quotiq starter':'Your template'}</small></span><ChevronRight/></button>)}</section></aside>}
    </section>

    {templateOpen&&<div className="chModal" role="dialog" aria-modal="true" aria-labelledby="chTemplateTitle"><button className="chBackdrop" onClick={()=>setTemplateOpen(false)} aria-label="Close template editor"/><form onSubmit={saveTemplate}><header><div><span>REUSABLE MESSAGE</span><h2 id="chTemplateTitle">Create a template</h2><p>Use <b>{'{name}'}</b>, <b>{'{business}'}</b>, <b>{'{outstanding}'}</b> or <b>{'{project}'}</b> for automatic details.</p></div><button type="button" onClick={()=>setTemplateOpen(false)} aria-label="Close"><X/></button></header><label><span>Template name</span><input required value={templateDraft.name} onChange={event=>setTemplateDraft({...templateDraft,name:event.target.value})} placeholder="Maintenance reminder" maxLength={100}/></label><label><span>Default channel</span><select value={templateDraft.channel} onChange={event=>setTemplateDraft({...templateDraft,channel:event.target.value as typeof templateDraft.channel})}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></label>{templateDraft.channel==='email'&&<label><span>Email subject</span><input value={templateDraft.subject} onChange={event=>setTemplateDraft({...templateDraft,subject:event.target.value})} maxLength={240}/></label>}<label><span>Message</span><textarea required value={templateDraft.body} onChange={event=>setTemplateDraft({...templateDraft,body:event.target.value})} rows={7} maxLength={3000}/></label><footer><button type="button" onClick={()=>setTemplateOpen(false)}>Cancel</button><button className="primary" disabled={savingTemplate}><Check/>{savingTemplate?'Saving…':'Save template'}</button></footer></form></div>}
  </main>;
}
