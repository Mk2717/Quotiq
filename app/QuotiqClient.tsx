'use client';

import { useEffect, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import '../quotiq/lib/bootstrapWorkspace';
import RoutedApp from '../quotiq/components/RoutedApp';
import MobileOffline from '../quotiq/components/MobileOffline';
import { SecurityProvider } from '../quotiq/components/SecurityProvider';
import { AuthGate } from '../quotiq/components/AuthGate';
import WorkspaceSync from '../quotiq/components/WorkspaceSync';
import GlobalNavigator from '../quotiq/components/GlobalNavigator';
import DashboardExperience from '../quotiq/components/DashboardExperience';
import ClientApprovalPortal from '../quotiq/components/ClientApprovalPortal';
import PublicBookingPage from '../quotiq/components/PublicBookingPage';

function getApprovalToken(){
  if(typeof window==='undefined')return'';
  const match=window.location.hash.match(/^#\/approve\/([A-Za-z0-9_-]{32,96})\/?$/);
  return match?.[1]||'';
}
function getBookingSlug(){
  if(typeof window==='undefined')return'';
  const match=window.location.hash.match(/^#\/book\/(q-[a-z0-9]{16,40})\/?$/i);
  return match?.[1]?.toLowerCase()||'';
}

export default function QuotiqClient() {
  const[approvalToken,setApprovalToken]=useState(getApprovalToken);
  const[bookingSlug,setBookingSlug]=useState(getBookingSlug);
  useEffect(()=>{const onHashChange=()=>{setApprovalToken(getApprovalToken());setBookingSlug(getBookingSlug())};window.addEventListener('hashchange',onHashChange);return()=>window.removeEventListener('hashchange',onHashChange)},[]);
  if(approvalToken)return <ClientApprovalPortal key={approvalToken} token={approvalToken}/>;
  if(bookingSlug)return <PublicBookingPage key={bookingSlug} slug={bookingSlug}/>;
  return (
    <AuthGate>{session => {
      const email = session?.user.email || 'local@quotiq.app';
      const name = String(session?.user.user_metadata?.full_name || email.split('@')[0] || 'Quotiq User');
      return <SecurityProvider user={{ displayName: name, fullName: name, email }}>
        <WorkspaceSync session={session}><HashRouter>
          <RoutedApp session={session} />
          <DashboardExperience />
          <GlobalNavigator />
          <MobileOffline />
        </HashRouter></WorkspaceSync>
      </SecurityProvider>;
    }}</AuthGate>
  );
}
