import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Building2, Check, ChevronLeft, ChevronRight, FileText, LockKeyhole, Mail, MapPin, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { cloudConfigured, getSession, signIn, signUp, supabase } from '../lib/supabase';

type SetupData = {
  ownerName: string;
  companyName: string;
  businessType: string;
  country: string;
  currency: string;
  phone: string;
  email: string;
  address: string;
  estimatePrefix: string;
  invoicePrefix: string;
  taxRate: string;
  paymentMethod: string;
};

const setupSeed: SetupData = {
  ownerName: 'Michael', companyName: '', businessType: 'CCTV & Security', country: 'Ghana', currency: 'GHS',
  phone: '', email: '', address: 'Sunyani, Ghana', estimatePrefix: 'EST', invoicePrefix: 'INV', taxRate: '0', paymentMethod: 'Mobile Money',
};

export function AuthGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudConfigured);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [setupDone, setSetupDone] = useState(() => localStorage.getItem('q-onboarding-complete') === 'true');
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    getSession().then(setSession).catch(e => setError(e.message)).finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && !setupDone && (!cloudConfigured || session)) setShowSetup(true);
  }, [ready, session, setupDone]);

  if (!ready) return <LoadingScreen />;
  if (showSetup) return <Onboarding onComplete={() => { setSetupDone(true); setShowSetup(false); window.location.reload(); }} />;
  if (!cloudConfigured || session) return <>{children(session)}</>;

  const submit = async () => {
    setError('');
    if (!email || password.length < 6) return setError('Enter a valid email and a password of at least 6 characters.');
    setWorking(true);
    try {
      if (mode === 'signin') await signIn(email, password); else await signUp(email, password);
      if (mode === 'signup') setError('Account created. Check your email to confirm your account, then sign in.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.'); }
    finally { setWorking(false); }
  };

  return <div className="authShell">
    <section className="authStory">
      <div className="authBrand"><img src="/quotiq-mark.svg" alt="Quotiq"/><strong>Quotiq</strong></div>
      <div className="authMessage"><span>CONTRACTOR BUSINESS OS</span><h1>Quote smarter.<br/>Build better.</h1><p>Create estimates, convert them to invoices, manage projects and understand your cash flow from one secure workspace.</p></div>
      <div className="authBenefits"><div><ShieldCheck/><span><b>Secure workspace</b><small>Your business records stay separated and protected.</small></span></div><div><Sparkles/><span><b>Built for contractors</b><small>Fast workflows for real jobs, stock and payments.</small></span></div></div>
    </section>
    <section className="authFormPanel"><div className="authCard authCardV2">
      <div className="authMobileBrand"><img src="/quotiq-mark.svg"/><strong>Quotiq</strong></div>
      <span className="authEyebrow">{mode === 'signin' ? 'WELCOME BACK' : 'START YOUR WORKSPACE'}</span>
      <h1>{mode === 'signin' ? 'Sign in to Quotiq' : 'Create your account'}</h1>
      <p>{mode === 'signin' ? 'Continue managing your estimates, invoices and projects.' : 'Set up a professional contractor workspace in minutes.'}</p>
      <label>Email address<div className="inputWithIcon"><Mail/><input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} /></div></label>
      <label>Password<div className="inputWithIcon"><LockKeyhole/><input type={showPassword ? 'text' : 'password'} placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="showPassword" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
      {error && <div className="authError">{error}</div>}
      <button className="primary authButton" onClick={submit} disabled={working}>{working ? 'Please wait…' : mode === 'signin' ? 'Sign in securely' : 'Create my workspace'}</button>
      <div className="authSwitch"><span>{mode === 'signin' ? 'New to Quotiq?' : 'Already registered?'}</span><button className="linkButton" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div>
    </div></section>
  </div>;
}

function LoadingScreen(){return <div className="authPage"><div className="loadingBrand"><img src="/quotiq-mark.svg"/><h1>Quotiq</h1><p>Preparing your secure workspace…</p><i/></div></div>}

function Onboarding({onComplete}:{onComplete:()=>void}){
  const [step,setStep]=useState(0); const [data,setData]=useState<SetupData>(setupSeed);
  const steps=useMemo(()=>[
    {title:'Welcome to Quotiq',subtitle:'Let’s create a workspace that fits your contracting business.',icon:Sparkles},
    {title:'Tell us about the business',subtitle:'These details identify your company across Quotiq.',icon:Building2},
    {title:'Contact and location',subtitle:'This information can appear on customer documents.',icon:MapPin},
    {title:'Document preferences',subtitle:'Choose numbering and tax defaults for new documents.',icon:FileText},
    {title:'How customers pay you',subtitle:'Set a preferred payment method. You can add more later.',icon:WalletCards},
  ],[]);
  const update=(key:keyof SetupData,value:string)=>setData(v=>({...v,[key]:value}));
  const finish=()=>{
    const existing=JSON.parse(localStorage.getItem('q-business')||'{}');
    localStorage.setItem('q-business',JSON.stringify({...existing,name:data.companyName||'My Business',email:data.email,phone:data.phone,address:data.address,currency:data.currency,estimatePrefix:data.estimatePrefix||'EST',invoicePrefix:data.invoicePrefix||'INV',mobileMoney:data.paymentMethod==='Mobile Money'?data.phone:existing.mobileMoney||'',taxRate:Number(data.taxRate)||0,ownerName:data.ownerName,businessType:data.businessType,country:data.country,paymentMethod:data.paymentMethod}));
    localStorage.setItem('q-onboarding-complete','true'); onComplete();
  };
  const Icon=steps[step].icon;
  return <div className="onboardingShell"><aside className="onboardingAside"><div className="authBrand"><img src="/quotiq-mark.svg"/><strong>Quotiq</strong></div><div><span>SETUP YOUR WORKSPACE</span><h1>Professional from your very first quote.</h1><p>Quotiq will use these choices to prepare your dashboard and document defaults.</p></div><div className="setupSteps">{steps.map((s,i)=><div className={i===step?'active':i<step?'done':''} key={s.title}><i>{i<step?<Check/>:i+1}</i><span><b>{s.title}</b><small>{i<step?'Completed':i===step?'In progress':'Up next'}</small></span></div>)}</div></aside>
    <main className="onboardingMain"><div className="setupProgress"><span>Step {step+1} of {steps.length}</span><div><i style={{width:`${(step+1)/steps.length*100}%`}}/></div></div><div className="setupCard"><div className="setupIcon"><Icon/></div><h2>{steps[step].title}</h2><p>{steps[step].subtitle}</p>{step===0&&<div className="setupIntro"><div><Check/><span>Professional estimates and invoices</span></div><div><Check/><span>Projects, inventory and expense tracking</span></div><div><Check/><span>Offline-ready workspace with optional cloud sync</span></div></div>}{step===1&&<div className="setupGrid"><SetupField label="Your name" value={data.ownerName} change={v=>update('ownerName',v)}/><SetupField label="Company name" value={data.companyName} change={v=>update('companyName',v)} placeholder="e.g. Star Security"/><SetupSelect label="Business type" value={data.businessType} change={v=>update('businessType',v)} options={['CCTV & Security','Electrical','Solar Installation','Starlink & Networking','Construction','Plumbing','HVAC','General Contractor','Other']}/><SetupSelect label="Country" value={data.country} change={v=>update('country',v)} options={['Ghana','Nigeria','Kenya','South Africa','United Kingdom','United States','Other']}/><SetupSelect label="Currency" value={data.currency} change={v=>update('currency',v)} options={['GHS','USD','NGN','KES','ZAR','GBP','EUR']}/></div>}{step===2&&<div className="setupGrid"><SetupField label="Business phone" value={data.phone} change={v=>update('phone',v)} placeholder="024 000 0000"/><SetupField label="Business email" value={data.email} change={v=>update('email',v)} placeholder="hello@company.com"/><div className="setupWide"><SetupField label="Business address" value={data.address} change={v=>update('address',v)}/></div></div>}{step===3&&<div className="setupGrid"><SetupField label="Estimate prefix" value={data.estimatePrefix} change={v=>update('estimatePrefix',v)}/><SetupField label="Invoice prefix" value={data.invoicePrefix} change={v=>update('invoicePrefix',v)}/><SetupField label="Default tax rate (%)" value={data.taxRate} change={v=>update('taxRate',v)} type="number"/></div>}{step===4&&<div className="paymentChoices">{['Mobile Money','Bank Transfer','Cash','Card / Online'].map(x=><button className={data.paymentMethod===x?'selected':''} onClick={()=>update('paymentMethod',x)} key={x}><WalletCards/><span><b>{x}</b><small>{x==='Mobile Money'?'Recommended for Ghana':x==='Bank Transfer'?'Show bank details on documents':x==='Cash'?'Record payments manually':'Connect a gateway later'}</small></span><i>{data.paymentMethod===x&&<Check/>}</i></button>)}</div>}</div><div className="setupNav"><button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}><ChevronLeft/>Back</button>{step<steps.length-1?<button className="primary" onClick={()=>setStep(step+1)}>Continue<ChevronRight/></button>:<button className="primary" onClick={finish}>Finish setup<Check/></button>}</div></main></div>
}
function SetupField({label,value,change,placeholder='',type='text'}:{label:string,value:string,change:(v:string)=>void,placeholder?:string,type?:string}){return <label>{label}<input type={type} value={value} placeholder={placeholder} onChange={e=>change(e.target.value)}/></label>}
function SetupSelect({label,value,change,options}:{label:string,value:string,change:(v:string)=>void,options:string[]}){return <label>{label}<select value={value} onChange={e=>change(e.target.value)}>{options.map(x=><option key={x}>{x}</option>)}</select></label>}
