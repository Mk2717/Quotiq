import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileCheck2, Printer, ReceiptText, Send, ShieldCheck, X } from 'lucide-react';
import type { Business, Customer, Estimate, Invoice, LineItem } from '../types';
import { getStored, setStored, uid } from '../lib/storage';

type PreviewEvent = CustomEvent<{ estimateId: string }>;
type WorkflowStatus = 'Draft' | 'Pending' | 'Accepted' | 'Rejected' | 'Converted';

const money = (value:number,currency='GHS') => new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(value||0);
const today = () => new Date().toISOString().slice(0,10);

export default function DocumentWorkspace(){
  const [estimateId,setEstimateId] = useState<string|null>(null);
  const [zoom,setZoom] = useState(0.86);
  const [signature,setSignature] = useState('');
  const [message,setMessage] = useState('');

  useEffect(()=>{
    const open=(event:Event)=>setEstimateId((event as PreviewEvent).detail.estimateId);
    addEventListener('quotiq-preview-estimate',open);
    return()=>removeEventListener('quotiq-preview-estimate',open);
  },[]);

  const estimates=getStored<Estimate[]>('q-estimates',[]);
  const estimate=estimateId?estimates.find(item=>item.id===estimateId):undefined;
  const business=getStored<Business>('q-business',{name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'});
  const customers=getStored<Customer[]>('q-customers',[]);
  const customer=estimate?customers.find(item=>item.id===estimate.customerId):undefined;

  const calculations=useMemo(()=>{
    if(!estimate)return{subtotal:0,discount:0,tax:0,total:0};
    const subtotal=(estimate.items||[]).reduce((sum,item)=>sum+(Number(item.qty)||0)*(Number(item.rate)||0),0);
    const discount=subtotal*(Number(estimate.discount)||0)/100;
    const tax=(subtotal-discount)*(Number(estimate.tax)||0)/100;
    return{subtotal,discount,tax,total:subtotal-discount+tax};
  },[estimate]);

  if(!estimateId||!estimate)return null;

  const saveStatus=(status:WorkflowStatus)=>{
    const next=estimates.map(item=>item.id===estimate.id?{...item,status:status==='Converted'?'Accepted':status==='Rejected'?'Draft':status as Estimate['status'],workflowStatus:status,approvedBy:status==='Accepted'?signature||'Customer approval recorded':undefined,approvedAt:status==='Accepted'?new Date().toISOString():undefined}:item);
    setStored('q-estimates',next);
    setMessage(`Estimate marked ${status.toLowerCase()}.`);
    setTimeout(()=>setMessage(''),2400);
  };

  const convertToInvoice=()=>{
    const invoices=getStored<Invoice[]>('q-invoices',[]);
    const existing=invoices.find(item=>(item as any).estimateId===estimate.id);
    if(existing){setMessage(`Invoice ${existing.id} already exists.`);return;}
    const invoice:Invoice={
      id:`${business.invoicePrefix||'INV'}-${new Date().getFullYear()}-${String(invoices.length+1).padStart(4,'0')}`,
      customerId:estimate.customerId,
      customer:estimate.customer,
      project:estimate.project,
      amount:calculations.total,
      paid:0,
      status:'Unpaid',
      date:today(),
      items:(estimate.items||[]).map((item:LineItem)=>({...item,id:uid('ITM')})),
      tax:estimate.tax,
      discount:estimate.discount,
      estimateId:estimate.id
    } as Invoice;
    setStored('q-invoices',[invoice,...invoices]);
    saveStatus('Converted');
    setMessage(`Invoice ${invoice.id} created successfully.`);
  };

  const printDocument=()=>window.print();
  const verification=`QT-${estimate.id.replace(/[^A-Z0-9]/gi,'').slice(-12).toUpperCase()}`;
  const status=(estimate as any).workflowStatus||estimate.status;
  const terms=business.terms||'This estimate is valid for the stated period. Work starts after approval and agreed deposit payment.';

  return <div className="documentWorkspace">
    <header className="documentToolbar">
      <div className="documentToolbarIdentity"><button onClick={()=>setEstimateId(null)}><ArrowLeft/></button><div><span>DOCUMENT WORKSPACE</span><strong>{estimate.id} · {estimate.project}</strong></div></div>
      <div className="documentZoom"><button onClick={()=>setZoom(Math.max(.55,zoom-.1))}>−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(1.15,zoom+.1))}>+</button></div>
      <div className="documentActions"><button onClick={()=>saveStatus('Pending')}><Send/>Mark sent</button><button onClick={printDocument}><Printer/>Print</button><button className="primary" onClick={printDocument}><Download/>Save PDF</button><button className="documentClose" onClick={()=>setEstimateId(null)}><X/></button></div>
    </header>

    {message&&<div className="documentToast">{message}</div>}

    <div className="documentStage">
      <aside className="documentControlPanel">
        <section><span>APPROVAL WORKFLOW</span><h3>Estimate status</h3><div className="workflowSteps">{['Draft','Pending','Accepted','Converted'].map((step,index)=><div className={status===step?'active':(['Pending','Accepted','Converted'].indexOf(status)>=index-1?'complete':'')} key={step}><i>{index+1}</i><div><b>{step}</b><small>{step==='Draft'?'Being prepared':step==='Pending'?'Ready or sent to customer':step==='Accepted'?'Customer approved':'Invoice created'}</small></div></div>)}</div></section>
        <section><span>DIGITAL APPROVAL</span><h3>Customer signature</h3><label>Approved by<input value={signature} onChange={e=>setSignature(e.target.value)} placeholder="Customer or authorized person"/></label><button className="primary fullButton" onClick={()=>saveStatus('Accepted')}><CheckCircle2/>Record approval</button><button className="fullButton" onClick={()=>saveStatus('Rejected')}>Mark rejected</button></section>
        <section><span>NEXT ACTION</span><h3>Create invoice</h3><p>Copy the customer, project, items, discount and tax into a new invoice.</p><button className="primary fullButton" onClick={convertToInvoice}><ReceiptText/>Convert to invoice</button></section>
      </aside>

      <main className="paperViewport">
        <article className="estimatePaper" style={{transform:`scale(${zoom})`,transformOrigin:'top center'}}>
          <div className={`documentWatermark ${String(status).toLowerCase()}`}>{status}</div>
          <header className="paperHeader">
            <div className="paperBrand"><div className="paperLogo">{business.logo?<img src={business.logo} alt="Company logo"/>:<b>Q</b>}</div><div><h1>{business.name||'Quotiq Contractor'}</h1><p>{business.address}</p><p>{[business.phone,business.email].filter(Boolean).join(' · ')}</p></div></div>
            <div className="paperDocumentIdentity"><span>ESTIMATE</span><h2>{estimate.id}</h2><p>Issued: {estimate.date}</p><div className={`paperStatus ${String(status).toLowerCase()}`}>{status}</div></div>
          </header>

          <section className="paperIntro">
            <div><span>PREPARED FOR</span><h3>{estimate.customer}</h3><p>{customer?.company}</p><p>{customer?.phone}</p><p>{customer?.email}</p><p>{customer?.siteAddress||customer?.address}</p></div>
            <div><span>PROJECT</span><h3>{estimate.project}</h3><p>Customer reference: {customer?.id||estimate.customerId}</p><p>Estimate date: {estimate.date}</p><p>Tax ID: {business.taxId||'—'}</p></div>
          </section>

          <section className="paperScope"><span>SCOPE OF WORK</span><p>Supply, installation, configuration and commissioning for <b>{estimate.project}</b>, based on the itemized requirements and conditions below.</p></section>

          <table className="paperItems"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Total</th></tr></thead><tbody>{(estimate.items||[]).map((item,index)=><tr key={item.id}><td>{index+1}</td><td><b>{item.description}</b><small>{(item as any).category||'Item'}</small></td><td>{item.qty}</td><td>{item.unit}</td><td>{money(item.rate,business.currency)}</td><td>{money(item.qty*item.rate,business.currency)}</td></tr>)}</tbody></table>

          <section className="paperBottom">
            <div className="paperTerms"><span>TERMS & CONDITIONS</span><p>{terms}</p><div className="paymentBox"><b>Payment information</b><p>{business.mobileMoney&&`Mobile Money: ${business.mobileMoney}`}</p><p>{business.bank&&`${business.bank} · ${business.accountName} · ${business.accountNumber}`}</p></div></div>
            <div className="paperTotals"><div><span>Subtotal</span><b>{money(calculations.subtotal,business.currency)}</b></div><div><span>Discount ({estimate.discount||0}%)</span><b>-{money(calculations.discount,business.currency)}</b></div><div><span>Tax ({estimate.tax||0}%)</span><b>{money(calculations.tax,business.currency)}</b></div><div className="paperGrandTotal"><span>TOTAL</span><strong>{money(calculations.total,business.currency)}</strong></div></div>
          </section>

          <section className="signatureGrid"><div><span>PREPARED BY</span><div className="signatureLine">{business.signature?<img src={business.signature} alt="Signature"/>:<em>Authorized signature</em>}</div><b>{business.name}</b></div><div><span>CUSTOMER APPROVAL</span><div className="signatureLine">{(estimate as any).approvedBy?<strong>{(estimate as any).approvedBy}</strong>:<em>Sign and date</em>}</div><b>{(estimate as any).approvedAt?new Date((estimate as any).approvedAt).toLocaleDateString():''}</b></div></section>

          <footer className="paperFooter"><div><ShieldCheck/><span>Verification code</span><b>{verification}</b></div><p>Generated securely with Quotiq · Quote smarter. Build better.</p><div className="fakeQr"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></footer>
        </article>
      </main>
    </div>
  </div>;
}
