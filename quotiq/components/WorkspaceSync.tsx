'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getStored } from '../lib/storage';
import { loadWorkspace, saveWorkspace, type WorkspaceSnapshot } from '../lib/supabase';
import type { Business } from '../types';

const businessFallback:Business={name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'};
const snapshot=():WorkspaceSnapshot=>({
  business:getStored('q-business',businessFallback),customers:getStored('q-customers',[]),estimates:getStored('q-estimates',[]),
  invoices:getStored('q-invoices',[]),projects:getStored('q-projects',[]),inventory:getStored('q-inventory',[]),
  expenses:getStored('q-expenses',[]),team:getStored('q-team',[]),
});
const publish=(status:'syncing'|'synced'|'offline'|'error')=>{localStorage.setItem('q-cloud-sync',status);window.dispatchEvent(new CustomEvent('quotiq:sync-status',{detail:{status}}));};

export default function WorkspaceSync({session,children}:{session:Session|null;children:ReactNode}){
  const[ready,setReady]=useState(!session);
  useEffect(()=>{
    if(!session){publish('offline');setReady(true);return}
    let active=true;publish('syncing');
    loadWorkspace(session.user.id).then(remote=>{
      if(!active)return;
      if(remote){
        const records:Record<string,unknown>={'q-business':remote.business,'q-customers':remote.customers,'q-estimates':remote.estimates,'q-invoices':remote.invoices,'q-projects':remote.projects,'q-inventory':remote.inventory,'q-expenses':remote.expenses,'q-team':remote.team};
        Object.entries(records).forEach(([key,value])=>localStorage.setItem(key,JSON.stringify(value)));
      }else return saveWorkspace(session.user.id,snapshot());
    }).then(()=>{if(active){publish('synced');setReady(true)}}).catch(()=>{if(active){publish('error');setReady(true)}});
    return()=>{active=false};
  },[session?.user.id]);
  useEffect(()=>{
    if(!session||!ready)return;
    let timer:ReturnType<typeof setTimeout>;
    const sync=()=>{clearTimeout(timer);publish('syncing');timer=setTimeout(()=>saveWorkspace(session.user.id,snapshot()).then(()=>publish('synced')).catch(()=>publish('error')),850)};
    window.addEventListener('quotiq:storage',sync);return()=>{clearTimeout(timer);window.removeEventListener('quotiq:storage',sync)};
  },[session?.user.id,ready]);
  if(!ready)return <main className="workspaceBoot"><img src="/quotiq-mark.svg" alt=""/><b>Preparing your workspace</b><span>Loading your latest business records…</span><i/></main>;
  return <>{children}</>;
}
