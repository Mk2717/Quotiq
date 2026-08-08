import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeCheck, Building2, CalendarCheck2, CalendarDays, CheckCircle2, FileCheck2, Layers3, Loader2, LockKeyhole, Mail, MessageSquareText, Phone, Printer, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import type { EstimateOption, LineItem } from '../types';
import { loadPublicClientPortal, submitClientPortalResponse, type ClientPortalRecord } from '../lib/supabase';

type ResponseAction='accept'|'request_changes'|'decline';
type PortalLine=LineItem&{details?:string;category?:string};

const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency,minimumFractionDigits:2}).format(round(Number(value)||0));
const dateTime=(value?:string|null)=>value?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'';
const dateOnly=(value?:string|null)=>value?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'';
const statusLabel:Record<ClientPortalRecord['status'],string>={pending:'Awaiting your response',accepted:'Approved',changes_requested:'Changes requested',declined:'Declined',expired:'Link expired',revoked:'Link withdrawn'};

export default function ClientApprovalPortal({token}:{token:string}){
  const[portal,setPortal]=useState<ClientPortalRecord|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[action,setAction]=useState<ResponseAction|null>(null);
  const[name,setName]=useState('');
  const[email,setEmail]=useState('');
  const[message,setMessage]=useState('');
  const[selectedOptionId,setSelectedOptionId]=useState('');
  const[preferredDate,setPreferredDate]=useState('');
  const[consent,setConsent]=useState(false);
  const[submitting,setSubmitting]=useState(false);
  const[confirmed,setConfirmed]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    loadPublicClientPortal(token).then(data=>{
      if(cancelled)return;
      setPortal(data);setEmail(data.customer_email||'');setError('');
      const available=data.estimate_payload?.estimate?.options||[];
      setSelectedOptionId(available.find(option=>option.recommended)?.id||available[0]?.id||'');
      setPreferredDate(data.estimate_payload?.estimate?.preferredStart||'');
    }).catch((reason:Error&{portal?:ClientPortalRecord})=>{
      if(cancelled)return;
      if(reason.portal){setPortal(reason.portal);setEmail(reason.portal.customer_email||'')}
      setError(reason.message||'This approval link could not be opened.');
    }).finally(()=>!cancelled&&setLoading(false));
    return()=>{cancelled=true};
  },[token]);

  const estimate=portal?.estimate_payload?.estimate;
  const customer=portal?.estimate_payload?.customer;
  const totals=portal?.estimate_payload?.totals;
  const business=portal?.business_payload;
  const items=(estimate?.items||[]) as PortalLine[];
  const quoteOptions=(estimate?.options||[]) as EstimateOption[];
  const selectedOption=quoteOptions.find(option=>option.id===selectedOptionId);
  const approvalTotal=selectedOption?round(Number(totals?.total||portal?.total||0)*Math.max(.1,Number(selectedOption.multiplier)||1)):Number(portal?.total||0);
  const deposit=useMemo(()=>portal?round(approvalTotal*Number(portal.deposit_percent||0)/100):0,[portal,approvalTotal]);
  const finalStatus=portal?.status==='accepted'||portal?.status==='declined'||portal?.status==='expired'||portal?.status==='revoked';

  const choose=(next:ResponseAction)=>{setAction(next);setError('');setMessage('');setConsent(false);setTimeout(()=>document.getElementById('client-response-form')?.scrollIntoView({behavior:'smooth',block:'start'}),50)};
  const submit=async()=>{
    if(!action)return;
    if(action==='accept'&&quoteOptions.length&&!selectedOption){setError('Choose the package you want before approving.');return}
    setSubmitting(true);setError('');
    try{
      const responseMessage=[action==='accept'&&selectedOption?`Selected package: ${selectedOption.name} (${money(approvalTotal,portal?.currency)})`:'',action==='accept'&&preferredDate?`Preferred start date: ${dateOnly(preferredDate)}`:'',message.trim()].filter(Boolean).join('\n');
      const updated=await submitClientPortalResponse({token,action,name,email,message:responseMessage,consent});
      setPortal(updated);setConfirmed(true);setAction(null);window.scrollTo({top:0,behavior:'smooth'});
    }catch(reason){setError(reason instanceof Error?reason.message:'We could not record your response. Please try again.');}
    finally{setSubmitting(false)}
  };

  if(loading)return <main className="cpLoading"><div className="cpBrandMark">Q</div><Loader2 className="cpSpin"/><h1>Opening your secure estimate</h1><p>Checking the private approval link…</p></main>;
  if(!portal)return <main className="cpErrorPage"><div className="cpErrorCard"><AlertCircle/><span>QUOTIQ CLIENT PORTAL</span><h1>We could not open this estimate</h1><p>{error||'The link may be incomplete, expired or withdrawn.'}</p><small>Ask the contractor to send you a new Quotiq approval link.</small></div></main>;

  return <main className="cpPage">
    <header className="cpTopbar noPrint"><a href="https://quotiq-app.mikeezym.chatgpt.site" aria-label="Quotiq home"><span>Q</span><b>Quotiq</b></a><div><ShieldCheck/><span>Private client approval</span></div></header>
    <section className="cpHero">
      <div className="cpHeroIdentity"><div className="cpCompanyLogo">{business?.logo?<img src={business.logo} alt={`${business.name} logo`}/>:<Building2/>}</div><div><span>ESTIMATE FROM</span><h1>{business?.name||'Your contractor'}</h1><p>{[business?.address,business?.phone].filter(Boolean).join(' · ')}</p></div></div>
      <div className={`cpStatus ${portal.status}`}><i>{portal.status==='accepted'?<CheckCircle2/>:portal.status==='declined'?<XCircle/>:<FileCheck2/>}</i><div><span>STATUS</span><b>{statusLabel[portal.status]}</b></div></div>
    </section>

    {confirmed&&<div className="cpSuccess noPrint"><CheckCircle2/><div><b>Your response has been securely recorded.</b><span>{portal.status==='accepted'?`${business?.name||'The contractor'} can now prepare your invoice and project.`:'The contractor can now review your response.'}</span></div></div>}
    {error&&<div className="cpInlineError noPrint"><AlertCircle/><span>{error}</span></div>}

    <div className="cpShell">
      <article className={`cpDocument document-template document-template--${business?.documentTemplate||'modern'}`}>
        <header className="cpDocumentHeader"><div className="cpDocumentIdentity"><div className="cpDocumentLogo">{business?.logo?<img src={business.logo} alt={`${business.name} logo`}/>:<b>Q</b>}</div><div><span>PROFESSIONAL COST ESTIMATE</span><h2>{portal.estimate_number}</h2><p>{business?.name} · Prepared for <b>{portal.customer_name}</b></p></div></div><div><span>{quoteOptions.length?'SELECTED OPTION':'TOTAL ESTIMATE'}</span><strong>{money(approvalTotal,portal.currency)}</strong><p>Valid until {dateOnly(portal.expires_at)}</p></div></header>
        <section className="cpProjectMeta"><div><span>PROJECT / JOB</span><h3>{portal.project_name}</h3>{estimate?.trade&&<p>{estimate.trade}</p>}</div><div><span>CLIENT</span><h3>{customer?.name||portal.customer_name}</h3><p>{[customer?.phone,customer?.email,customer?.location].filter(Boolean).join(' · ')}</p></div></section>

        {quoteOptions.length>0&&<section className="cpPackageChoices"><header><Layers3/><div><span>YOUR CHOICE</span><h3>Choose the package that fits your project</h3></div></header><div>{quoteOptions.map(option=>{const amount=round(Number(totals?.total||portal.total)*Math.max(.1,Number(option.multiplier)||1)),selected=option.id===selectedOptionId;return <button type="button" className={`${selected?'selected':''} ${option.recommended?'recommended':''}`} key={option.id} onClick={()=>!finalStatus&&setSelectedOptionId(option.id)} disabled={finalStatus}><i>{selected?<CheckCircle2/>:<span/>}</i>{option.recommended&&<em><Sparkles/>POPULAR</em>}<small>{option.tagline}</small><h4>{option.name}</h4><strong>{money(amount,portal.currency)}</strong><p>{option.description}</p><span><BadgeCheck/>{option.warranty}</span></button>})}</div></section>}

        <div className="cpTableWrap"><table><thead><tr><th>#</th><th>Item / service</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{items.map((item,index)=><tr key={item.id||index}><td>{String(index+1).padStart(2,'0')}</td><td><b>{item.description}</b>{item.details&&<small>{item.details}</small>}{item.category&&<em>{item.category}</em>}</td><td>{item.qty}</td><td>{item.unit}</td><td>{money(item.rate,portal.currency)}</td><td><strong>{money(Number(item.qty)*Number(item.rate),portal.currency)}</strong></td></tr>)}</tbody></table></div>

        <section className="cpTotals"><div><span>Subtotal</span><b>{money(totals?.subtotal||0,portal.currency)}</b></div>{Number(totals?.discount)>0&&<div><span>Discount</span><b>- {money(totals?.discount||0,portal.currency)}</b></div>}{Number(totals?.tax)>0&&<div><span>Tax</span><b>{money(totals?.tax||0,portal.currency)}</b></div>}<div className="grand"><span>{selectedOption?`${selectedOption.name.toUpperCase()} TOTAL`:'ESTIMATED TOTAL'}</span><strong>{money(approvalTotal,portal.currency)}</strong></div></section>

        <section className="cpTerms"><div><span>SCOPE OF WORK / NOTES</span><p>{estimate?.notes||'Supply and completion of the listed items and services.'}</p><span>TERMS & CONDITIONS</span><p>{estimate?.terms||'Please contact the contractor if you need any clarification before approval.'}</p></div><aside><span>PAYMENT INFORMATION</span><p>{estimate?.paymentDetails||'Payment instructions will be provided by the contractor.'}</p>{portal.deposit_percent>0&&<div className="cpDeposit"><small>PLANNED DEPOSIT · {portal.deposit_percent}%</small><strong>{money(deposit,portal.currency)}</strong><p>Due only after approval, following the contractor’s payment instructions.</p></div>}<div className="cpAuthorisedSign"><div>{business?.signature?<img src={business.signature} alt="Authorised signature"/>:<strong className="documentTypedSignature">{business?.authorizedName||business?.name||'Authorised representative'}</strong>}</div><b>{business?.authorizedName||business?.name||'Authorised representative'}</b><small>{business?.authorizedTitle||'Authorised representative'}</small></div></aside></section>

        {portal.signature_text&&<section className="cpApprovalReceipt"><div><ShieldCheck/><span>DIGITAL APPROVAL RECORDED</span></div><h3>{portal.signature_text}</h3><p>Approved on {dateTime(portal.responded_at)}</p><small>Record ID: {portal.id.slice(0,8).toUpperCase()}</small></section>}
        <footer><div><b>{business?.name}</b><span>{[business?.phone,business?.email].filter(Boolean).join(' · ')}</span></div><small>{portal.estimate_number} · Securely shared with Quotiq</small></footer>
      </article>

      <aside className="cpActionPanel noPrint">
        <div className="cpActionIntro"><LockKeyhole/><div><span>YOUR DECISION</span><h2>{finalStatus?'Response complete':'Review and respond'}</h2></div></div>
        {portal.status==='pending'&&<p>Check the items, quantities, prices and terms. Your response is time-stamped and returned directly to {business?.name||'the contractor'}.</p>}
        {portal.status==='changes_requested'&&<p>Your requested changes were sent. You can still approve this version if the contractor has resolved your questions.</p>}
        {portal.status==='accepted'&&<div className="cpFinal accepted"><CheckCircle2/><b>Estimate approved</b><span>Signed by {portal.response_name} on {dateTime(portal.responded_at)}.{portal.response_message&&` ${portal.response_message.replaceAll('\n',' · ')}`}</span></div>}
        {portal.status==='declined'&&<div className="cpFinal declined"><XCircle/><b>Estimate declined</b><span>Your response was recorded on {dateTime(portal.responded_at)}.</span></div>}
        {portal.status==='expired'&&<div className="cpFinal expired"><CalendarDays/><b>This link has expired</b><span>Ask {business?.name||'the contractor'} to issue a new approval link.</span></div>}
        {portal.status==='revoked'&&<div className="cpFinal expired"><AlertCircle/><b>This link was withdrawn</b><span>Ask the contractor for the latest estimate.</span></div>}

        {!finalStatus&&quoteOptions.length>0&&<div className="cpSelectedPackage"><Layers3/><div><span>SELECTED PACKAGE</span><b>{selectedOption?.name||'Choose an option'}</b><small>{selectedOption?money(approvalTotal,portal.currency):'Tap a package above'}</small></div></div>}
        {!finalStatus&&<div className="cpDecisionButtons"><button className="approve" onClick={()=>choose('accept')}><CheckCircle2/>Approve {selectedOption?.name||'estimate'}</button><button onClick={()=>choose('request_changes')}><MessageSquareText/>Request changes</button><button className="decline" onClick={()=>choose('decline')}><XCircle/>Decline</button></div>}
        <button className="cpPrintButton" onClick={()=>window.print()}><Printer/>Print / Save PDF</button>
        <div className="cpTrust"><ShieldCheck/><p><b>Protected response</b><span>This private link is your access key. Quotiq will never ask for your account password on this page.</span></p></div>
        <div className="cpContact"><span>Questions before deciding?</span>{business?.phone&&<a href={`tel:${business.phone}`}><Phone/>{business.phone}</a>}{business?.email&&<a href={`mailto:${business.email}`}><Mail/>{business.email}</a>}</div>
      </aside>
    </div>

    {action&&<section className="cpResponseSection noPrint" id="client-response-form"><div className="cpResponseCard"><header><div><span>{action==='accept'?'DIGITAL ACCEPTANCE':action==='request_changes'?'REVISION REQUEST':'DECLINE ESTIMATE'}</span><h2>{action==='accept'?`Approve ${selectedOption?.name||'this estimate'}`:action==='request_changes'?'Tell us what should change':'Confirm your decision'}</h2></div><button onClick={()=>setAction(null)}>Cancel</button></header><div className="cpResponseGrid"><label><span>Full name *</span><input autoFocus value={name} onChange={event=>setName(event.target.value)} placeholder="Authorized person’s full name" maxLength={120}/></label><label><span>Email address</span><input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@company.com" maxLength={180}/></label>{action==='accept'&&<label><span>Preferred start date</span><div className="cpDateInput"><CalendarCheck2/><input type="date" min={new Date().toISOString().slice(0,10)} value={preferredDate} onChange={event=>setPreferredDate(event.target.value)}/></div></label>}{action==='accept'&&selectedOption&&<div className="cpApprovalSummary"><Sparkles/><span><small>APPROVING</small><b>{selectedOption.name} · {money(approvalTotal,portal.currency)}</b></span></div>}</div><label><span>{action==='request_changes'?'Changes required *':'Message to contractor (optional)'}</span><textarea rows={4} value={message} onChange={event=>setMessage(event.target.value)} placeholder={action==='request_changes'?'List the item, price, quantity or term you want revised.':'Add a short note if needed.'} maxLength={2000}/></label>{action==='accept'&&<label className="cpConsent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>I confirm that I am authorized to approve this estimate and accept its selected package, scope, total and terms. My typed name will be recorded as my digital signature.</span></label>}{error&&<div className="cpInlineError"><AlertCircle/><span>{error}</span></div>}<button className={`cpSubmit ${action}`} disabled={submitting} onClick={submit}>{submitting?<Loader2 className="cpSpin"/>:action==='accept'?<CheckCircle2/>:action==='request_changes'?<MessageSquareText/>:<XCircle/>}{submitting?'Recording securely…':action==='accept'?'Sign and approve':action==='request_changes'?'Send change request':'Confirm decline'}</button></div></section>}
  </main>;
}
