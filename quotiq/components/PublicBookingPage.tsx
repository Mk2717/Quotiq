'use client';

import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Mail, MapPin, Phone, ShieldCheck, Sparkles, Wrench, XCircle } from 'lucide-react';
import { loadPublicBookingPage, submitPublicBookingRequest } from '../lib/supabase';
import type { BookingPage, LeadUrgency } from '../types';

type FormState={
  customerName:string;phone:string;email:string;serviceType:string;siteAddress:string;
  preferredDate:string;preferredTime:string;budgetRange:string;urgency:LeadUrgency;details:string;website:string;
};

const initialForm:FormState={customerName:'',phone:'',email:'',serviceType:'',siteAddress:'',preferredDate:'',preferredTime:'',budgetRange:'',urgency:'normal',details:'',website:''};
const timeOptions=['Morning · 8am–12pm','Afternoon · 12pm–4pm','Evening · after 4pm','Flexible'];
const budgetOptions=['Not sure yet','Under GH₵1,000','GH₵1,000 – GH₵5,000','GH₵5,000 – GH₵15,000','GH₵15,000+'];

export default function PublicBookingPage({slug}:{slug:string}){
  const[page,setPage]=useState<BookingPage|null>(null);
  const[form,setForm]=useState<FormState>(initialForm);
  const[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
  const[error,setError]=useState(''),[success,setSuccess]=useState<{reference:string;message:string}|null>(null);
  const minDate=useMemo(()=>new Date().toISOString().slice(0,10),[]);

  useEffect(()=>{
    let active=true;
    loadPublicBookingPage(slug).then(result=>{
      if(!active)return;
      setPage(result);setForm(current=>({...current,serviceType:result.services[0]||''}));
    }).catch(reason=>active&&setError(reason instanceof Error?reason.message:'This booking page is unavailable.')).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[slug]);

  const set=<K extends keyof FormState>(key:K,value:FormState[K])=>setForm(current=>({...current,[key]:value}));
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');
    if(!form.phone.trim()&&!form.email.trim()){setError('Add a phone number or email so the contractor can contact you.');return}
    setSending(true);
    try{
      const result=await submitPublicBookingRequest({slug,...form});
      setSuccess({reference:String(result.reference||'RECEIVED'),message:String(result.message||'Your request has been sent.')});
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(reason){setError(reason instanceof Error?reason.message:'We could not send your request. Please try again.')}
    finally{setSending(false)}
  };

  if(loading)return <main className="pbShell"><section className="pbLoading"><span/><span/><span/><b>Opening secure booking…</b></section></main>;
  if(!page)return <main className="pbShell"><section className="pbUnavailable"><XCircle/><h1>Booking page unavailable</h1><p>{error||'Ask the contractor for a fresh link.'}</p></section></main>;

  const style={'--booking-accent':page.accent_color||'#2563eb'} as CSSProperties;
  if(success)return <main className="pbShell" style={style}>
    <section className="pbSuccess">
      <div className="pbSuccessIcon"><CheckCircle2/></div>
      <span>REQUEST RECEIVED</span><h1>Thank you, {form.customerName.split(' ')[0]}.</h1>
      <p>{success.message}</p>
      <div className="pbReference"><small>REFERENCE</small><strong>{success.reference}</strong></div>
      <div className="pbNext"><b>What happens next?</b><ol><li><i>1</i><span>{page.business_name} reviews your job details.</span></li><li><i>2</i><span>They contact you to confirm scope, timing and pricing.</span></li><li><i>3</i><span>You receive a professional estimate before work begins.</span></li></ol></div>
      {(page.business_phone||page.business_email)&&<div className="pbContactBar">
        {page.business_phone&&<a href={`tel:${page.business_phone}`}><Phone/>Call contractor</a>}
        {page.business_email&&<a href={`mailto:${page.business_email}`}><Mail/>Send email</a>}
      </div>}
      <button type="button" className="pbSecondary" onClick={()=>{setSuccess(null);setForm({...initialForm,serviceType:page.services[0]||''})}}>Submit another request</button>
    </section>
  </main>;

  return <main className="pbShell" style={style}>
    <div className="pbFrame">
      <aside className="pbIntro">
        <div className="pbBrand"><i>{page.business_name.slice(0,1).toUpperCase()}</i><div><strong>{page.business_name}</strong><span>Professional service booking</span></div></div>
        <div className="pbIntroCopy"><span><Sparkles/>QUICK REQUEST</span><h1>Tell us about your next job.</h1><p>{page.welcome_message}</p></div>
        <ul className="pbTrust"><li><Check/>No account required</li><li><Check/>Takes about two minutes</li><li><Check/>Sent directly to the contractor</li></ul>
        {page.service_area&&<div className="pbServiceArea"><MapPin/><div><small>SERVICE AREA</small><b>{page.service_area}</b></div></div>}
      </aside>

      <section className="pbFormPanel">
        <header className="pbMobileBrand"><div className="pbBrand"><i>{page.business_name.slice(0,1).toUpperCase()}</i><div><strong>{page.business_name}</strong><span>Professional service booking</span></div></div></header>
        <div className="pbProgress"><span className="active"><i>1</i>Your details</span><span className="active"><i>2</i>Job request</span><span><i>3</i>Contractor reply</span></div>
        <form onSubmit={submit}>
          <section className="pbSection"><div className="pbSectionHead"><span>01</span><div><h2>How can we reach you?</h2><p>Use the contact details you check most often.</p></div></div>
            <div className="pbGrid">
              <label className="pbWide"><span>Full name *</span><input required autoComplete="name" value={form.customerName} onChange={event=>set('customerName',event.target.value)} placeholder="Your full name" maxLength={160}/></label>
              <label><span>Phone number</span><div className="pbInputIcon"><Phone/><input type="tel" autoComplete="tel" value={form.phone} onChange={event=>set('phone',event.target.value)} placeholder="024 000 0000" maxLength={80}/></div></label>
              <label><span>Email address</span><div className="pbInputIcon"><Mail/><input type="email" autoComplete="email" value={form.email} onChange={event=>set('email',event.target.value)} placeholder="you@example.com" maxLength={180}/></div></label>
            </div>
          </section>

          <section className="pbSection"><div className="pbSectionHead"><span>02</span><div><h2>What work do you need?</h2><p>A clear brief helps the contractor respond accurately.</p></div></div>
            <div className="pbGrid">
              <label><span>Service *</span><div className="pbInputIcon"><Wrench/><select required value={form.serviceType} onChange={event=>set('serviceType',event.target.value)}>{page.services.map(service=><option key={service}>{service}</option>)}</select></div></label>
              <label><span>Estimated budget</span><select value={form.budgetRange} onChange={event=>set('budgetRange',event.target.value)}><option value="">Choose if known</option>{budgetOptions.map(option=><option key={option}>{option}</option>)}</select></label>
              <label className="pbWide"><span>Job / site address *</span><div className="pbInputIcon"><MapPin/><input required autoComplete="street-address" value={form.siteAddress} onChange={event=>set('siteAddress',event.target.value)} placeholder="Area, street or digital address" maxLength={320}/></div></label>
              <label className="pbWide"><span>Describe the job</span><textarea value={form.details} onChange={event=>set('details',event.target.value)} placeholder="What needs to be installed, repaired or inspected? Add quantities, model details or any access notes." maxLength={4000}/><small>{form.details.length}/4000</small></label>
            </div>
          </section>

          <section className="pbSection"><div className="pbSectionHead"><span>03</span><div><h2>When do you need it?</h2><p>Your preferred time is a request, not a confirmed appointment.</p></div></div>
            <div className="pbGrid">
              <label><span>Preferred date</span><div className="pbInputIcon"><CalendarDays/><input type="date" min={minDate} value={form.preferredDate} onChange={event=>set('preferredDate',event.target.value)}/></div></label>
              <label><span>Preferred time</span><div className="pbInputIcon"><Clock3/><select value={form.preferredTime} onChange={event=>set('preferredTime',event.target.value)}><option value="">Choose a time</option>{timeOptions.map(option=><option key={option}>{option}</option>)}</select></div></label>
              <fieldset className="pbWide pbUrgency"><legend>How urgent is it?</legend>{(['normal','soon','urgent'] as LeadUrgency[]).map(value=><button type="button" key={value} className={form.urgency===value?'active':''} onClick={()=>set('urgency',value)}><i>{form.urgency===value&&<Check/>}</i><span><b>{value==='normal'?'Flexible':value==='soon'?'Within a week':'Urgent'}</b><small>{value==='normal'?'Best available date':value==='soon'?'Please contact me soon':'Safety or service issue'}</small></span></button>)}</fieldset>
            </div>
          </section>

          <label className="pbHoneypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={event=>set('website',event.target.value)}/></label>
          {error&&<div className="pbError" role="alert"><XCircle/><span>{error}</span></div>}
          <button className="pbSubmit" disabled={sending}>{sending?'Sending securely…':<>Send request <ArrowRight/></>}</button>
          <div className="pbPrivacy"><ShieldCheck/><span>Your details are encrypted in transit and shared only with {page.business_name}.</span></div>
        </form>
        <footer>Powered by <b>Quotiq</b> · Contractor operations made simple</footer>
      </section>
    </div>
  </main>;
}
