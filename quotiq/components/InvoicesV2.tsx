import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, FolderKanban, LayoutDashboard, Plus, Printer, ReceiptText, Save, Search, Trash2, WalletCards, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Business, Customer, Invoice, LineItem, PaymentRecord, Project } from '../types';
import { getStored, setStored, uid } from '../lib/storage';

type DraftLine = LineItem & { details?: string };
const today=()=>new Date().toISOString().slice(0,10);
const num=(value:unknown)=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency,minimumFractionDigits:2}).format(value||0);
const business=()=>getStored<Business>('q-business',{name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'});
const blankLine=():DraftLine=>({id:uid('ITM'),description:'',details:'',qty:1,unit:'pcs',rate:0});

export default function InvoicesV2(){
 const location=useLocation();
 const id=decodeURIComponent(location.pathname.split('/')[2]||'');
 if(location.pathname==='/invoices/new')return <InvoiceBuilder/>;
 if(id)return <InvoiceDetail id={id}/>;
 return <InvoiceList/>;
}

function InvoiceList(){
 const navigate=useNavigate(),b=business();
 const[query,setQuery]=useState('');
 const invoices=getStored<Invoice[]>('q-invoices',[]);
 const filtered=invoices.filter(i=>[i.id,i.customer,i.project,i.status].join(' ').toLowerCase().includes(query.toLowerCase()));
 const billed=invoices.reduce((s,i)=>s+num(i.amount),0),paid=invoices.reduce((s,i)=>s+num(i.paid),0);
 return <main className="iv2Page"><header className="iv2Hero"><div><button className="iv2Back" onClick={()=>navigate('/')}><ArrowLeft/><LayoutDashboard/>Dashboard</button><span>PAYMENTS & BILLING</span><h1>Invoices</h1><p>Create clear client invoices, record payments and follow up on balances.</p></div><button className="iv2Primary" onClick={()=>navigate('/invoices/new')}><Plus/>New invoice</button></header>
 <section className="iv2Stats"><article><span>Total invoiced</span><strong>{money(billed,b.currency)}</strong></article><article><span>Collected</span><strong>{money(paid,b.currency)}</strong></article><article><span>Outstanding</span><strong>{money(Math.max(0,billed-paid),b.currency)}</strong></article><article><span>Unpaid invoices</span><strong>{invoices.filter(i=>i.status!=='Paid').length}</strong></article></section>
 <label className="iv2Search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search invoice, customer, project or status"/><small>{filtered.length} result{filtered.length===1?'':'s'}</small></label>
 <section className="iv2List">{filtered.length?filtered.map(i=><button key={i.id} onClick={()=>navigate(`/invoices/${encodeURIComponent(i.id)}`)}><i><ReceiptText/></i><div><b>{i.id}</b><h3>{i.project||'Client invoice'}</h3><p>{i.customer} · {i.date}</p></div><strong>{money(i.amount,b.currency)}</strong><span className={`iv2Status ${i.status.replaceAll(' ','').toLowerCase()}`}>{i.status}</span></button>):<div className="iv2Empty"><ReceiptText/><h2>No invoices found</h2><p>Create an invoice here, or convert an accepted estimate into one.</p><button className="iv2Primary" onClick={()=>navigate('/invoices/new')}><Plus/>Create invoice</button></div>}</section></main>;
}

function InvoiceBuilder(){
 const navigate=useNavigate(),b=business(),customers=getStored<Customer[]>('q-customers',[]),existing=getStored<Invoice[]>('q-invoices',[]);
 const[customerId,setCustomerId]=useState(customers[0]?.id||''),[project,setProject]=useState(''),[date,setDate]=useState(today()),[dueDate,setDueDate]=useState(''),[tax,setTax]=useState(0),[discount,setDiscount]=useState(0),[items,setItems]=useState<DraftLine[]>([blankLine()]),[error,setError]=useState('');
 const customer=customers.find(c=>c.id===customerId);
 const totals=useMemo(()=>{const subtotal=items.reduce((s,i)=>s+num(i.qty)*num(i.rate),0),off=subtotal*Math.min(100,num(discount))/100,taxValue=(subtotal-off)*Math.min(100,num(tax))/100;return{subtotal,off,taxValue,total:subtotal-off+taxValue}},[items,tax,discount]);
 const update=(id:string,key:keyof DraftLine,value:string)=>setItems(rows=>rows.map(row=>row.id===id?{...row,[key]:key==='qty'||key==='rate'?num(value):value}:row));
 const save=()=>{if(!customer){setError('Select a customer before saving.');return}if(!project.trim()){setError('Add a project or job title.');return}const valid=items.filter(i=>i.description.trim()&&num(i.qty)>0);if(!valid.length){setError('Add at least one priced item.');return}const id=`${b.invoicePrefix||'INV'}-${new Date().getFullYear()}-${String(existing.length+1).padStart(4,'0')}`;const invoice:Invoice={id,customerId:customer.id,customer:customer.name,project:project.trim(),amount:totals.total,paid:0,status:'Unpaid',date,items:valid,tax,discount,dueDate};setStored('q-invoices',[invoice,...existing]);navigate(`/invoices/${encodeURIComponent(id)}`)};
 return <main className="iv2Page"><header className="iv2BuilderHead"><button className="iv2Back" onClick={()=>navigate('/invoices')}><ArrowLeft/>Back to invoices</button><div><span>NEW CLIENT INVOICE</span><h1>Create invoice</h1><p>Itemize the work, confirm the total and save a payment-ready invoice.</p></div><button className="iv2Primary" onClick={save}><Save/>Save invoice</button></header>{error&&<div className="iv2Error">{error}</div>}
 <div className="iv2Builder"><section><article className="iv2Card"><h2><i>01</i>Customer & job</h2><div className="iv2Grid"><label>Customer<select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Project / job title<input value={project} onChange={e=>setProject(e.target.value)} placeholder="e.g. Electrical rewiring"/></label><label>Invoice date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Payment due<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>{!customers.length&&<p className="iv2Notice">No customers yet. <button onClick={()=>navigate('/customers/new')}>Add a customer first</button>.</p>}</article>
 <article className="iv2Card"><h2><i>02</i>Items & pricing</h2><div className="iv2ItemLabels"><span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total</span><span/></div><div className="iv2Items">{items.map((item,index)=><div className="iv2Item" key={item.id}><label><span>Item {index+1}</span><input value={item.description} onChange={e=>update(item.id,'description',e.target.value)} placeholder="Material, labour or service"/><input className="iv2Details" value={item.details||''} onChange={e=>update(item.id,'details',e.target.value)} placeholder="Optional detail or specification"/></label><label><span>Qty</span><input type="number" min="0" value={item.qty} onChange={e=>update(item.id,'qty',e.target.value)}/></label><label><span>Unit</span><input value={item.unit} onChange={e=>update(item.id,'unit',e.target.value)}/></label><label><span>Unit price</span><input type="number" min="0" value={item.rate} onChange={e=>update(item.id,'rate',e.target.value)}/></label><strong><span>Total</span>{money(num(item.qty)*num(item.rate),b.currency)}</strong><button aria-label="Remove item" onClick={()=>setItems(rows=>rows.length===1?[blankLine()]:rows.filter(r=>r.id!==item.id))}><Trash2/></button></div>)}</div><button className="iv2Add" onClick={()=>setItems(rows=>[...rows,blankLine()])}><Plus/>Add another item</button></article></section>
 <aside className="iv2Summary"><h2>Invoice summary</h2><div><span>Subtotal</span><b>{money(totals.subtotal,b.currency)}</b></div><label>Discount (%)<input type="number" min="0" max="100" value={discount} onChange={e=>setDiscount(num(e.target.value))}/></label><label>Tax (%)<input type="number" min="0" max="100" value={tax} onChange={e=>setTax(num(e.target.value))}/></label><div className="iv2Grand"><span>Amount due</span><strong>{money(totals.total,b.currency)}</strong></div><button className="iv2Primary" onClick={save}><Save/>Save invoice</button></aside></div></main>;
}

function InvoiceDetail({id}:{id:string}){
 const navigate=useNavigate(),b=business();
 const[invoices,setInvoices]=useState(()=>getStored<Invoice[]>('q-invoices',[]));
 const[payment,setPayment]=useState('');
 const[method,setMethod]=useState('Mobile Money');
 const[reference,setReference]=useState('');
 const[showPay,setShowPay]=useState(false);
 const[receipt,setReceipt]=useState<PaymentRecord|null>(null);
 const[notice,setNotice]=useState('');
 const invoice=invoices.find(i=>i.id===id);
 const projects=getStored<Project[]>('q-projects',[]);
 const customers=getStored<Customer[]>('q-customers',[]);
 if(!invoice)return <main className="iv2Page"><div className="iv2Empty"><FileText/><h2>Invoice not found</h2><button onClick={()=>navigate('/invoices')}>Back to invoices</button></div></main>;
 const balance=Math.max(0,num(invoice.amount)-num(invoice.paid));
 const linkedProject=projects.find(project=>project.invoiceId===invoice.id||(invoice.estimateId&&project.estimateId===invoice.estimateId));
 const customer=customers.find(item=>item.id===invoice.customerId||item.name===invoice.customer);
 const record=()=>{
  const amount=Math.min(balance,num(payment));
  if(!amount)return;
  const paid=num(invoice.paid)+amount;
  const paymentRecord={id:uid('PAY'),date:today(),amount,method,reference:reference.trim()};
  const next=invoices.map(item=>item.id===id?{...item,paid,status:paid>=num(item.amount)?'Paid':'Partially Paid',lastPaymentDate:today(),payments:[...(item.payments||[]),paymentRecord]}:item) as Invoice[];
  setInvoices(next);setStored('q-invoices',next);setPayment('');setReference('');setShowPay(false);setReceipt(paymentRecord);
  setNotice(paid>=num(invoice.amount)?'Invoice paid in full. The job is ready to move into delivery.':`${money(amount,b.currency)} payment recorded successfully.`);
 };
 const createProject=()=>{
  if(linkedProject){navigate(`/projects/${encodeURIComponent(linkedProject.id)}`);return}
  const due=new Date();due.setDate(due.getDate()+14);
  const project:Project={
   id:uid('PRJ'),customerId:invoice.customerId||customer?.id||'',customer:invoice.customer,name:invoice.project||`Work for ${invoice.customer}`,
   status:'Planned',stage:'Planning',startDate:today(),dueDate:invoice.dueDate||due.toISOString().slice(0,10),budget:num(invoice.amount),spent:0,assignee:'',
   siteAddress:customer?.siteAddress||customer?.address||'',estimateId:invoice.estimateId,invoiceId:invoice.id,
   notes:`Work authorised through ${invoice.id}.\nScope: ${invoice.items.map(item=>item.description).filter(Boolean).join(', ')}`,
   tasks:[
    {id:uid('TSK'),title:'Confirm scope, site access and work schedule',completed:false},
    {id:uid('TSK'),title:'Prepare materials, tools and assigned technician',completed:false},
    {id:uid('TSK'),title:'Complete installation, testing and customer handover',completed:false},
   ],materials:[],photos:[],activities:[{id:uid('ACT'),date:today(),type:'Created',message:`Project created from invoice ${invoice.id}`}],
  };
  setStored('q-projects',[project,...projects]);
  navigate(`/projects/${encodeURIComponent(project.id)}`);
 };
 return <main className="iv2Page"><header className="iv2DetailHead"><button className="iv2Back" onClick={()=>navigate('/invoices')}><ArrowLeft/>Invoices</button><div><span>INVOICE WORKSPACE</span><h1>{invoice.id}</h1><p>{invoice.customer} · {invoice.project}</p></div><div className="iv2DetailActions"><button onClick={()=>window.print()}><Printer/>Print / PDF</button><button className="iv2ProjectButton" onClick={createProject}><FolderKanban/>{linkedProject?'Open project':'Start project'}</button>{balance>0&&<button className="iv2Primary" onClick={()=>setShowPay(true)}><WalletCards/>Record payment</button>}</div></header>
 <section className="iv2PaymentStrip"><div><span>Total</span><strong>{money(invoice.amount,b.currency)}</strong></div><div><span>Paid</span><strong>{money(invoice.paid,b.currency)}</strong></div><div><span>Balance due</span><strong>{money(balance,b.currency)}</strong></div><span className={`iv2Status ${invoice.status.replaceAll(' ','').toLowerCase()}`}>{invoice.status}</span></section>
 {(notice||invoice.status==='Paid')&&<section className="iv2WorkflowCallout"><i><CheckCircle2/></i><div><span>{invoice.status==='Paid'?'PAYMENT COMPLETE':'PAYMENT UPDATED'}</span><h2>{notice||'This invoice is fully paid.'}</h2><p>{linkedProject?`Project ${linkedProject.id} is connected and ready to manage.`:'Turn this approved work into a tracked project with its scope, budget and starter tasks already prepared.'}</p></div><button onClick={createProject}>{linkedProject?'Open project':'Create project'}<ArrowRight/></button></section>}
 <div className="iv2DetailGrid">
  <PrintableInvoice invoice={invoice} business={b}/>
  <aside className="iv2History">
   <div className="iv2Chain"><span>CONNECTED WORKFLOW</span><h2>Document chain</h2>{invoice.estimateId&&<button onClick={()=>navigate(`/estimates/${encodeURIComponent(invoice.estimateId!)}`)}><FileText/><div><b>{invoice.estimateId}</b><small>Source estimate</small></div><ArrowRight/></button>}<button onClick={createProject}><FolderKanban/><div><b>{linkedProject?.id||'Create project'}</b><small>{linkedProject?'Linked delivery workspace':'Use this invoice as the job scope'}</small></div><ArrowRight/></button></div>
   <div className="iv2HistoryHeading"><h2>Payment history</h2><p>Every payment has a printable branded receipt.</p></div>
   {(invoice.payments||[]).length?(invoice.payments||[]).slice().reverse().map(item=><article key={item.id}><i><CheckCircle2/></i><div><b>{money(item.amount,b.currency)}</b><span>{item.method}{item.reference?` · ${item.reference}`:''}</span><small>{item.date}</small></div><button className="iv2ReceiptButton" onClick={()=>setReceipt(item)}><ReceiptText/>Receipt</button></article>):<div className="iv2NoPayments"><WalletCards/><b>No payments recorded</b><span>The first payment will appear here.</span></div>}
  </aside>
 </div>
 {showPay&&<div className="iv2Overlay"><div className="iv2PayModal"><button className="iv2Close" onClick={()=>setShowPay(false)}><X/></button><CheckCircle2/><span>RECORD PAYMENT</span><h2>How much was received?</h2><p>Outstanding balance: <b>{money(balance,b.currency)}</b></p><label>Payment amount<input autoFocus type="number" min="0" max={balance} value={payment} onChange={e=>setPayment(e.target.value)} placeholder="0.00"/></label><label>Payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option>Mobile Money</option><option>Bank Transfer</option><option>Cash</option><option>Card / Online</option><option>Cheque</option></select></label><label>Reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Transaction or receipt number"/></label><button className="iv2Primary" onClick={record}>Confirm payment</button></div></div>}
 {receipt&&<ReceiptOverlay invoice={invoice} payment={receipt} business={b} onClose={()=>setReceipt(null)}/>}
 </main>;
}

function PrintableInvoice({invoice,business}:{invoice:Invoice;business:Business}){
 const subtotal=invoice.items.reduce((s,i)=>s+num(i.qty)*num(i.rate),0),discount=subtotal*num(invoice.discount)/100,tax=(subtotal-discount)*num(invoice.tax)/100,balance=Math.max(0,num(invoice.amount)-num(invoice.paid)),template=business.documentTemplate||'modern',signer=business.authorizedName||business.name||'Authorised representative';
 return <article className={`iv2Paper document-template document-template--${template}`}><header><div className="iv2Brand">{business.logo?<img src={business.logo} alt="Company logo"/>:<i>Q</i>}<div><h2>{business.name}</h2><p>{business.address}</p><p>{[business.phone,business.email].filter(Boolean).join(' · ')}</p></div></div><div className="iv2Identity"><span>INVOICE</span><h1>{invoice.id}</h1><p>Issued {invoice.date}</p><em>{invoice.status}</em></div></header><div className="iv2Rule"/><section className="iv2Parties"><div><span>BILL TO</span><h3>{invoice.customer}</h3></div><div><span>PROJECT / JOB</span><h3>{invoice.project}</h3><p>{invoice.dueDate&&`Payment due ${invoice.dueDate}`}</p></div></section><table><thead><tr><th>#</th><th>Item / service</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{invoice.items.map((item,index)=><tr key={item.id}><td>{String(index+1).padStart(2,'0')}</td><td><b>{item.description}</b>{(item as DraftLine).details&&<small>{(item as DraftLine).details}</small>}</td><td>{item.qty}</td><td>{item.unit}</td><td>{money(item.rate,business.currency)}</td><td><b>{money(num(item.qty)*num(item.rate),business.currency)}</b></td></tr>)}</tbody></table><section className="iv2PaperBottom"><div><h4>PAYMENT DETAILS</h4><p>{business.mobileMoney&&`Mobile Money: ${business.mobileMoney}`}</p><p>{business.bank&&`${business.bank} · ${business.accountName} · ${business.accountNumber}`}</p><p>{business.terms||'Thank you for your business. Please use the invoice number as the payment reference.'}</p><div className="iv2DocumentSign"><div>{business.signature?<img src={business.signature} alt="Authorised signature"/>:<strong className="documentTypedSignature">{signer}</strong>}</div><b>{signer}</b><small>{business.authorizedTitle||'Authorised representative'}</small></div></div><aside><div><span>Subtotal</span><b>{money(subtotal,business.currency)}</b></div>{discount>0&&<div><span>Discount</span><b>-{money(discount,business.currency)}</b></div>}{tax>0&&<div><span>Tax</span><b>{money(tax,business.currency)}</b></div>}<div><span>Paid</span><b>-{money(invoice.paid,business.currency)}</b></div><div className="iv2PaperTotal"><span>BALANCE DUE</span><strong>{money(balance,business.currency)}</strong></div></aside></section><footer><b>Thank you for choosing {business.name}.</b><span>{invoice.id} · Generated with Quotiq</span></footer></article>
}

function ReceiptOverlay({invoice,payment,business,onClose}:{invoice:Invoice;payment:PaymentRecord;business:Business;onClose:()=>void}){
 useEffect(()=>{document.body.classList.add('printingReceipt');return()=>document.body.classList.remove('printingReceipt')},[]);
 const payments=invoice.payments||[],index=Math.max(0,payments.findIndex(item=>item.id===payment.id)),paidToDate=payments.slice(0,index+1).reduce((sum,item)=>sum+num(item.amount),0),balanceAfter=Math.max(0,num(invoice.amount)-paidToDate),receiptNumber=`RCT-${invoice.id.replace(/[^A-Z0-9]/gi,'').slice(-12).toUpperCase()}-${String(index+1).padStart(2,'0')}`,template=business.documentTemplate||'modern';
 const signer=business.authorizedName||business.name||'Authorised representative';
 return <div className="iv2ReceiptOverlay"><div className="iv2ReceiptToolbar noPrint"><button onClick={onClose}><ArrowLeft/>Back to invoice</button><div><span>PAYMENT RECEIPT</span><h2>{receiptNumber}</h2></div><button className="iv2Primary" onClick={()=>window.print()}><Printer/>Print / Save PDF</button></div><article className={`iv2ReceiptPaper document-template document-template--${template}`}><header><div className="iv2ReceiptBrand">{business.logo?<img src={business.logo} alt="Company logo"/>:<i>Q</i>}<div><h1>{business.name}</h1><p>{business.address}</p><p>{[business.phone,business.email].filter(Boolean).join(' · ')}</p></div></div><div className="iv2ReceiptIdentity"><span>PAYMENT RECEIPT</span><b>{receiptNumber}</b><em>PAID</em></div></header><div className="iv2ReceiptRule"/><section className="iv2ReceiptCustomer"><span>RECEIVED FROM</span><h2>{invoice.customer}</h2><p>Payment toward {invoice.project||'contractor services'}</p></section><section className="iv2ReceiptAmount"><span>AMOUNT RECEIVED</span><strong>{money(payment.amount,business.currency)}</strong><p>Thank you. This payment has been recorded successfully.</p></section><dl className="iv2ReceiptDetails"><div><dt>Invoice number</dt><dd>{invoice.id}</dd></div><div><dt>Payment date</dt><dd>{payment.date}</dd></div><div><dt>Payment method</dt><dd>{payment.method}</dd></div><div><dt>Transaction reference</dt><dd>{payment.reference||'Not provided'}</dd></div><div><dt>Invoice total</dt><dd>{money(invoice.amount,business.currency)}</dd></div><div><dt>Balance after payment</dt><dd>{money(balanceAfter,business.currency)}</dd></div></dl><section className="iv2ReceiptNote"><CheckCircle2/><div><b>Payment confirmed</b><p>This receipt confirms that {business.name} received the amount shown above against invoice {invoice.id}.</p></div></section><section className="iv2ReceiptSign"><div>{business.signature?<img src={business.signature} alt="Authorised signature"/>:<strong className="documentTypedSignature">{signer}</strong>}</div><b>{signer}</b><small>{business.authorizedTitle||'Authorised representative'}</small></section><footer><div><b>{business.name}</b><span>{business.taxId&&`Tax / Registration ID: ${business.taxId}`}</span></div><small>{receiptNumber} · Generated with Quotiq</small></footer></article></div>;
}
