'use client';

import { useState } from 'react';
import { ArrowLeft, Check, Clock3, KeyRound, LockKeyhole, LogOut, ShieldCheck, Smartphone, UserCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from './SecurityProvider';
import { signOut } from '../lib/supabase';

type SecurityEvent = { id: string; action: string; date: string };
const events = (): SecurityEvent[] => { try { return JSON.parse(localStorage.getItem('q-security-events') || '[]'); } catch { return []; } };
const roles = [
  ['Owner', 'Full access, security, billing and team management'],
  ['Manager', 'Customers, projects, documents, expenses and reports'],
  ['Estimator', 'Customers, estimates and invoices'],
  ['Technician', 'Assigned projects, tasks, materials and photos'],
  ['Viewer', 'Read-only access to approved business records'],
];

export default function SecurityCentre() {
  const navigate = useNavigate(); const security = useSecurity();
  const [pin, setPin] = useState(''); const [confirm, setConfirm] = useState(''); const [minutes, setMinutes] = useState(security.settings.autoLockMinutes); const [message, setMessage] = useState('');
  const activity = events();
  const savePin = async () => {
    if (!/^\d{4}$/.test(pin)) return setMessage('Choose a 4-digit numeric PIN.');
    if (pin !== confirm) return setMessage('The PIN confirmation does not match.');
    await security.configurePin(pin, minutes); setPin(''); setConfirm(''); setMessage('Device PIN protection is active.');
  };
  return <main className="securityPage">
    <header className="securityHero"><div><button onClick={() => navigate('/')}><ArrowLeft/>Dashboard</button><span>SECURITY CENTRE</span><h1>Protect your Quotiq workspace</h1><p>Manage verified sign-in, device protection, access roles and security activity.</p></div><i><ShieldCheck/></i></header>
    <section className="securityStatus"><article><i className="secure"><UserCheck/></i><div><span>ACCOUNT IDENTITY</span><h2>Signed in securely</h2><p>{security.user.email}</p></div><b><Check/>Verified</b></article><article><i className={security.settings.enabled ? 'secure' : ''}><Smartphone/></i><div><span>DEVICE LOCK</span><h2>{security.settings.enabled ? 'PIN protection active' : 'Protection available'}</h2><p>{security.settings.enabled ? `Locks after ${security.settings.autoLockMinutes} minutes` : 'Add a PIN for offline privacy'}</p></div><b className={security.settings.enabled ? '' : 'attention'}>{security.settings.enabled ? <><Check/>Active</> : 'Set up'}</b></article></section>
    <div className="securityGrid"><section className="securityCard"><header><i><KeyRound/></i><div><span>DEVICE SECURITY</span><h2>Offline device PIN</h2></div></header><p>Require a separate PIN whenever this browser session starts or becomes inactive. This adds protection even without internet.</p>{!security.settings.enabled ? <div className="pinForm"><label>New 4-digit PIN<input inputMode="numeric" type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}/></label><label>Confirm PIN<input inputMode="numeric" type="password" maxLength={4} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}/></label><label>Lock automatically<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}><option value="5">After 5 minutes</option><option value="15">After 15 minutes</option><option value="30">After 30 minutes</option><option value="60">After 1 hour</option></select></label><button onClick={savePin}><LockKeyhole/>Enable device PIN</button></div> : <div className="pinEnabled"><ShieldCheck/><div><b>Device protection enabled</b><span>Quotiq automatically locks after {security.settings.autoLockMinutes} minutes of inactivity.</span></div><button onClick={security.lock}>Lock now</button><button className="danger" onClick={security.disablePin}>Disable PIN</button></div>}{message && <p className="securityMessage">{message}</p>}</section>
      <section className="securityCard"><header><i><Users/></i><div><span>ACCESS CONTROL</span><h2>Role permissions</h2></div></header><p>Use defined access levels when staff accounts are invited in the next security stage.</p><div className="roleList">{roles.map(([name, detail], index) => <article key={name}><i>{index + 1}</i><div><b>{name}</b><span>{detail}</span></div>{name === 'Owner' && <em>YOU</em>}</article>)}</div></section></div>
    <div className="securityGrid"><section className="securityCard"><header><i><Clock3/></i><div><span>SECURITY ACTIVITY</span><h2>Recent events</h2></div></header>{activity.length ? <div className="securityEvents">{activity.slice(0, 8).map(event => <article key={event.id}><i><Check/></i><div><b>{event.action}</b><span>{new Date(event.date).toLocaleString()}</span></div></article>)}</div> : <div className="securityEmpty"><ShieldCheck/><p>No device security events recorded yet.</p></div>}</section><section className="securityCard accountCard"><header><i><UserCheck/></i><div><span>YOUR SESSION</span><h2>{security.user.displayName}</h2></div></header><dl><div><dt>Verified email</dt><dd>{security.user.email}</dd></div><div><dt>Workspace role</dt><dd>Owner</dd></div><div><dt>Site access</dt><dd>Protected</dd></div></dl><button onClick={()=>signOut()}><LogOut/>Sign out securely</button></section></div>
  </main>;
}
