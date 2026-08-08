'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange, FilePlus2, FileText, FolderKanban, Home, Inbox, MapPinned, Menu, MessageSquareText, Package, Plus, ReceiptText, RefreshCcw, Search, Settings, ShieldCheck, ShoppingCart, UserCog, Users, WalletCards, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const destinations=[
  {label:'Dashboard',path:'/',caption:'Business overview',Icon:Home},
  {label:'Leads & bookings',path:'/leads',caption:'Requests & sales pipeline',Icon:Inbox},
  {label:'ClientHub',path:'/clienthub',caption:'Messages & follow-ups',Icon:MessageSquareText},
  {label:'Customers',path:'/customers',caption:'Contacts & job history',Icon:Users},
  {label:'Estimates',path:'/estimates',caption:'Quotes & approvals',Icon:FileText},
  {label:'Invoices',path:'/invoices',caption:'Billing & payments',Icon:ReceiptText},
  {label:'Projects',path:'/projects',caption:'Jobs & progress',Icon:FolderKanban},
  {label:'Schedule',path:'/schedule',caption:'Calendar & crew dispatch',Icon:CalendarRange},
  {label:'Field tools & maps',path:'/field-tools',caption:'Measure sites & plan routes',Icon:MapPinned},
  {label:'Service plans',path:'/service-plans',caption:'Maintenance, assets & renewals',Icon:RefreshCcw},
  {label:'Team & timesheets',path:'/team',caption:'Crew, shifts & labour cost',Icon:UserCog},
  {label:'Inventory',path:'/inventory',caption:'Stock & suppliers',Icon:Package},
  {label:'Purchase orders',path:'/purchasing',caption:'Ordering & stock receiving',Icon:ShoppingCart},
  {label:'Expenses',path:'/expenses',caption:'Costs & purchases',Icon:WalletCards},
  {label:'Reports',path:'/reports',caption:'Business insights',Icon:BarChart3},
  {label:'Security',path:'/security',caption:'Access & protection',Icon:ShieldCheck},
  {label:'Settings',path:'/settings',caption:'Brand & workspace',Icon:Settings},
] as const;

const mobile=destinations.filter(({path})=>['/','/customers','/estimates','/invoices','/projects'].includes(path));

export default function GlobalNavigator(){
  const navigate=useNavigate(),location=useLocation();
  const[open,setOpen]=useState(false),[query,setQuery]=useState(''),[mobileSheet,setMobileSheet]=useState(false);

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault();
        setMobileSheet(window.matchMedia('(max-width:760px)').matches);
        setOpen(true);
      }
      if(event.key==='Escape')setOpen(false);
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);

  useEffect(()=>{
    if(!open)return;
    document.body.classList.add('qMenuOpen');
    return()=>document.body.classList.remove('qMenuOpen');
  },[open]);

  const openMenu=()=>{
    setMobileSheet(window.matchMedia('(max-width:760px)').matches);
    setOpen(true);
  };
  const closeMenu=()=>{setOpen(false);setQuery('')};
  const go=(path:string)=>{closeMenu();navigate(path)};
  const isActive=(path:string)=>path==='/'?location.pathname===path:location.pathname.startsWith(path);
  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return term?destinations.filter(({label,caption})=>`${label} ${caption}`.toLowerCase().includes(term)):destinations;
  },[query]);

  return <>
    <nav className="qMobileNav noPrint" aria-label="Primary navigation">
      {mobile.map(({label,path,Icon})=><button type="button" key={path} aria-current={isActive(path)?'page':undefined} className={isActive(path)?'active':''} onClick={()=>go(path)}><Icon/><span>{label}</span></button>)}
      <button type="button" className={open?'active':''} onClick={openMenu}><Menu/><span>More</span></button>
    </nav>

    <button type="button" className="qCommandTrigger noPrint" onClick={openMenu}><Search/><span>Quick menu</span><kbd>⌘ K</kbd></button>

    {open&&<div className="qCommandOverlay noPrint" role="dialog" aria-modal="true" aria-labelledby="qCommandTitle">
      <button type="button" className="qCommandBackdrop" aria-label="Close quick menu" onClick={closeMenu}/>
      <section className={`qCommand ${mobileSheet?'qCommandMobile':''}`}>
        <div className="qSheetHandle" aria-hidden="true"/>
        <header className="qCommandHeader">
          <div className="qCommandTitle"><i><Menu/></i><div><small>QUOTIQ MENU</small><strong id="qCommandTitle">More tools</strong></div></div>
          <button type="button" className="qCommandClose" aria-label="Close quick menu" onClick={closeMenu}><X/></button>
        </header>

        <label className="qCommandSearch"><Search/><input type="search" autoFocus={!mobileSheet} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&filtered.length===1)go(filtered[0].path)}} placeholder="Search panels…" aria-label="Search Quotiq panels"/>{query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')}><X/></button>}</label>

        <div className="qCommandBody">
          {!query&&<section className="qCommandSection">
            <div className="qSectionHeading"><span>QUICK ACTIONS</span><small>Start something new</small></div>
            <div className="qQuickCreate">
              <button type="button" onClick={()=>go('/estimates/new')}><FilePlus2/><span><b>New estimate</b><small>Prepare a quote</small></span></button>
              <button type="button" onClick={()=>go('/invoices/new')}><Plus/><span><b>New invoice</b><small>Bill a customer</small></span></button>
              <button type="button" onClick={()=>go('/customers/new')}><Users/><span><b>Add customer</b><small>Create a contact</small></span></button>
              <button type="button" onClick={()=>go('/leads')}><Inbox/><span><b>View bookings</b><small>Follow new requests</small></span></button>
              <button type="button" onClick={()=>go('/clienthub')}><MessageSquareText/><span><b>Contact a client</b><small>Open ClientHub</small></span></button>
              <button type="button" onClick={()=>go('/purchasing')}><ShoppingCart/><span><b>New purchase order</b><small>Order supplier stock</small></span></button>
              <button type="button" onClick={()=>go('/field-tools')}><MapPinned/><span><b>Measure a site</b><small>Map, calculate and quote</small></span></button>
              <button type="button" onClick={()=>go('/service-plans')}><RefreshCcw/><span><b>New service plan</b><small>Build recurring maintenance</small></span></button>
            </div>
          </section>}

          <section className="qCommandSection qPanelSection">
            <div className="qSectionHeading"><span>{query?'SEARCH RESULTS':'ALL PANELS'}</span><small>{filtered.length} available</small></div>
            <div className="qCommandLinks">
              {filtered.map(({label,path,caption,Icon})=><button type="button" key={path} className={isActive(path)?'active':''} aria-current={isActive(path)?'page':undefined} onClick={()=>go(path)}><Icon/><span><b>{label}</b><small>{caption}</small></span></button>)}
              {!filtered.length&&<div className="qCommandEmpty"><Search/><b>No panel found</b><span>Try another word.</span></div>}
            </div>
          </section>
        </div>
      </section>
    </div>}
  </>;
}
