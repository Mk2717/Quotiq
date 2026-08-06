import { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Eye, FileText, Plus, Printer, Save, Search, Trash2, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Business, Customer, Estimate, LineItem } from '../types';
import { getStored, setStored, uid } from '../lib/storage';

type DraftLine = LineItem & { details?: string; category?: 'Material' | 'Labour' | 'Service' | 'Other' };
type EstimateTrade = 'General contractor' | 'Electrician' | 'Security / CCTV installer' | 'Solar / Starlink installer' | 'Plumber' | 'Carpenter' | 'Painter';
const today = () => new Date().toISOString().slice(0, 10);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const clampPercent = (value: unknown) => Math.min(100, Math.max(0, num(value)));
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const lineTotal = (line: DraftLine) => round(Math.max(0, num(line.qty)) * Math.max(0, num(line.rate)));
const money = (value: number, currency = 'GHS') => new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(round(value));
const prettyDate = (value: string) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';
const getBusiness = () => getStored<Business>('q-business', { name: 'Quotiq', email: '', phone: '', address: '', taxId: '', bank: '', accountName: '', accountNumber: '', mobileMoney: '', estimatePrefix: 'EST', invoicePrefix: 'INV', currency: 'GHS' });
const blankItem = (): DraftLine => ({ id: uid('ITM'), description: '', details: '', category: 'Material', qty: 1, unit: 'pcs', rate: 0 });
const tradeTemplates: Record<EstimateTrade, Array<Omit<DraftLine, 'id' | 'rate'>>> = {
  'General contractor': [{ description: 'Materials and supplies', details: 'Specify brands, models or measurements', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Labour and installation', details: 'Complete installation and workmanship', category: 'Labour', qty: 1, unit: 'job' }],
  Electrician: [{ description: 'Electrical materials', details: 'Cables, switches, sockets and accessories', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Electrical installation', details: 'Wiring, fitting, testing and commissioning', category: 'Labour', qty: 1, unit: 'job' }],
  'Security / CCTV installer': [{ description: 'Security camera', details: 'Add camera type, resolution and model', category: 'Material', qty: 1, unit: 'pcs' }, { description: 'Recorder and storage', details: 'DVR/NVR and surveillance hard drive', category: 'Material', qty: 1, unit: 'set' }, { description: 'Cabling and accessories', details: 'Cable, connectors, power and installation accessories', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Installation and configuration', details: 'Mounting, setup, testing and mobile viewing', category: 'Labour', qty: 1, unit: 'job' }],
  'Solar / Starlink installer': [{ description: 'Equipment supply', details: 'Add system model and specification', category: 'Material', qty: 1, unit: 'set' }, { description: 'Mounting and cabling accessories', details: 'Brackets, cable, protection and fittings', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Installation and configuration', details: 'Mounting, alignment, setup and testing', category: 'Labour', qty: 1, unit: 'job' }],
  Plumber: [{ description: 'Plumbing materials', details: 'Pipes, fittings, valves and fixtures', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Plumbing installation', details: 'Fitting, pressure testing and finishing', category: 'Labour', qty: 1, unit: 'job' }],
  Carpenter: [{ description: 'Timber and materials', details: 'Add dimensions, finish and material grade', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Fabrication and installation', details: 'Carpentry labour, fitting and finishing', category: 'Labour', qty: 1, unit: 'job' }],
  Painter: [{ description: 'Paint and materials', details: 'Add brand, colour, finish and coverage', category: 'Material', qty: 1, unit: 'lot' }, { description: 'Surface preparation', details: 'Filling, sanding, priming and protection', category: 'Service', qty: 1, unit: 'job' }, { description: 'Painting labour', details: 'Application and final finishing', category: 'Labour', qty: 1, unit: 'job' }]
};

export default function EstimatesV2() {
  const location = useLocation();
  if (location.pathname === '/estimates/new') return <EstimateBuilder quick={false} />;
  if (location.pathname === '/estimates/quick') return <EstimateBuilder quick />;
  return <EstimateList />;
}

function EstimateList() {
  const navigate = useNavigate();
  const business = getBusiness();
  const [query, setQuery] = useState('');
  const estimates = getStored<Estimate[]>('q-estimates', []);
  const filtered = estimates.filter(e => [e.id, e.customer, e.project, e.status].join(' ').toLowerCase().includes(query.toLowerCase()));
  const totalValue = estimates.reduce((sum, e) => sum + num(e.amount), 0);
  return <main className="ev2Page">
    <header className="ev2ListHeader"><div><span>ESTIMATES & QUOTATIONS</span><h1>Estimates</h1><p>Create detailed contractor estimates or prepare a fast one-time quotation.</p></div><div className="ev2HeaderActions"><button onClick={() => navigate('/estimates/quick')}><Printer size={18}/>Quick Print</button><button className="ev2Primary" onClick={() => navigate('/estimates/new')}><Plus size={18}/>Create Estimate</button></div></header>
    <div className="ev2Stats"><article><span>Total estimates</span><strong>{estimates.length}</strong></article><article><span>Total quoted value</span><strong>{money(totalValue, business.currency)}</strong></article><article><span>Draft value</span><strong>{money(estimates.filter(e => e.status === 'Draft').reduce((s,e)=>s+num(e.amount),0), business.currency)}</strong></article><article><span>Pending value</span><strong>{money(estimates.filter(e => e.status === 'Pending').reduce((s,e)=>s+num(e.amount),0), business.currency)}</strong></article></div>
    <label className="ev2Search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search estimate number, customer, project or status"/><small>{filtered.length} result{filtered.length === 1 ? '' : 's'}</small></label>
    <section className="ev2EstimateList">{filtered.length ? filtered.map(e => <article key={e.id}><FileText/><div><b>{e.id}</b><h3>{e.project}</h3><p>{e.customer} · {prettyDate(e.date)}</p></div><strong>{money(e.amount,business.currency)}</strong><span>{e.status}</span></article>) : <div className="ev2Empty"><FileText size={42}/><h2>No estimates found</h2><p>Create a saved estimate or use Quick Print for a quotation you do not need to keep.</p><div className="ev2EmptyActions"><button onClick={()=>navigate('/estimates/quick')}><Printer size={17}/>Quick Print</button><button className="ev2Primary" onClick={()=>navigate('/estimates/new')}><Plus size={17}/>Create Estimate</button></div></div>}</section>
  </main>;
}

function EstimateBuilder({ quick }: { quick: boolean }) {
  const navigate = useNavigate();
  const business = getBusiness();
  const customers = getStored<Customer[]>('q-customers', []);
  const existing = getStored<Estimate[]>('q-estimates', []);
  const [preview, setPreview] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [quickCustomer, setQuickCustomer] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [estimateTrade, setEstimateTrade] = useState<EstimateTrade>('General contractor');
  const [project, setProject] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today());
  const [validDays, setValidDays] = useState(14);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('Supply, installation, testing and handover of the listed items and services.');
  const [terms, setTerms] = useState(business.terms || 'Quotation is valid for the stated period.\nA deposit may be required before work begins.\nAdditional work outside this scope will be quoted separately.');
  const [paymentDetails, setPaymentDetails] = useState(business.mobileMoney || business.bank || 'Payment details will be provided upon acceptance.');
  const [items, setItems] = useState<DraftLine[]>([blankItem()]);
  const [error, setError] = useState('');
  const customer = customers.find(c => c.id === customerId);
  const customerName = quick ? quickCustomer : customer?.name || '';
  const customerPhone = quick ? quickPhone : customer?.phone || '';
  const customerEmail = quick ? quickEmail : customer?.email || '';
  const customerLocation = quick ? quickLocation : customer?.siteAddress || customer?.address || '';
  const quoteNo = `${business.estimatePrefix || 'EST'}-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;
  const totals = useMemo(() => { const subtotal = round(items.reduce((s,i)=>s+lineTotal(i),0)); const discount = round(subtotal*clampPercent(discountPercent)/100); const taxable = round(Math.max(0,subtotal-discount)); const tax = round(taxable*clampPercent(taxPercent)/100); return { subtotal, discount, tax, total: round(taxable+tax) }; }, [items,discountPercent,taxPercent]);
  const validItems = items.filter(i=>i.description.trim());
  const updateItem = (id:string,key:keyof DraftLine,value:string) => setItems(rows=>rows.map(i=>i.id===id?{...i,[key]:key==='qty'||key==='rate'?Math.max(0,num(value)):value}:i));
  const moveItem = (index:number,direction:-1|1) => setItems(rows => { const target=index+direction; if(target<0||target>=rows.length)return rows; const next=[...rows]; [next[index],next[target]]=[next[target],next[index]]; return next; });
  const duplicateItem = (item:DraftLine,index:number) => setItems(rows=>[...rows.slice(0,index+1),{...item,id:uid('ITM')},...rows.slice(index+1)]);
  const loadTradeTemplate = () => {
    setItems(tradeTemplates[estimateTrade].map(item => ({ ...item, id: uid('ITM'), rate: 0 })));
    if (!project.trim()) setProject(`${estimateTrade} works`);
  };
  const validate = () => { if(!customerName.trim()){setError('Enter or select a customer.');return false} if(!project.trim()){setError('Enter the project or job title.');return false} if(!validItems.length){setError('Add at least one item or service.');return false} if(validItems.some(i=>num(i.qty)<=0)){setError('Every listed item must have a quantity greater than zero.');return false} setError('');return true };
  const openPreview = () => { if(validate()) { setPreview(true); window.scrollTo(0,0); } };
  const save = () => { if(quick || !validate() || !customer) return; const estimate:Estimate={id:quoteNo,customerId:customer.id,customer:customer.name,project:project.trim(),amount:totals.total,status:'Draft',date,items:validItems,tax:clampPercent(taxPercent),discount:clampPercent(discountPercent)}; setStored('q-estimates',[estimate,...existing]); navigate('/estimates'); };

  if (preview) return <div className="ev2PreviewPage"><div className="ev2PreviewToolbar noPrint"><button onClick={()=>setPreview(false)}><ArrowLeft size={18}/>Back to edit</button><div><span>DOCUMENT PREVIEW</span><h1>{quoteNo}</h1><p>Check the document before printing or saving it as PDF.</p></div><button className="ev2Primary" onClick={()=>window.print()}><Printer size={18}/>Print / Save PDF</button></div><PrintableQuote business={business} quoteNo={quoteNo} customer={customerName} phone={customerPhone} email={customerEmail} location={customerLocation} project={project} reference={reference} estimateTrade={estimateTrade} date={date} validDays={validDays} items={validItems} notes={notes} terms={terms} paymentDetails={paymentDetails} totals={totals}/></div>;

  return <main className="ev2BuilderPage">
    <header className="ev2BuilderTop"><button className="ev2Back" onClick={()=>navigate('/estimates')}><ArrowLeft size={18}/>Back to estimates</button><div><span>{quick?'QUICK PRINT':'NEW ESTIMATE'}</span><h1>{quick?'One-time quotation':'Create estimate'}</h1><p>{quick?'Prepare and print without saving a customer or estimate record.':'Create a detailed estimate linked to a saved customer.'}</p></div><div className="ev2HeaderActions">{!quick&&<button onClick={save}><Save size={18}/>Save Draft</button>}<button className="ev2Primary" onClick={openPreview}><Eye size={18}/>Preview / Print</button></div></header>
    {error&&<div className="ev2Error">{error}</div>}
    {!quick&&!customers.length&&<div className="ev2CustomerNotice"><Users size={20}/><div><b>No saved customers yet</b><span>Add a customer first, or use Quick Print for a one-time quotation.</span></div><button onClick={()=>navigate('/customers/new')}>Add customer</button></div>}
    <div className="ev2BuilderShell">
    <section className="ev2EditorOnly">
      <section className="ev2TradePicker"><div><span>START WITH A TRADE TEMPLATE</span><h2>What type of work are you quoting?</h2><p>Choose a trade, then load suggested item rows. Everything remains editable.</p></div><div className="ev2TradeControls"><select value={estimateTrade} onChange={e=>setEstimateTrade(e.target.value as EstimateTrade)}>{Object.keys(tradeTemplates).map(trade=><option key={trade}>{trade}</option>)}</select><button onClick={loadTradeTemplate}><Plus size={17}/>Load starter items</button></div></section>
      <Panel number="01" title="Customer & project" subtitle="Who the quotation is for and what the work covers."><div className="ev2FormGrid">{quick?<><Field label="Customer name *"><input value={quickCustomer} onChange={e=>setQuickCustomer(e.target.value)} placeholder="Customer or company name"/></Field><Field label="Phone"><input value={quickPhone} onChange={e=>setQuickPhone(e.target.value)} placeholder="024 000 0000"/></Field><Field label="Email"><input type="email" value={quickEmail} onChange={e=>setQuickEmail(e.target.value)} placeholder="customer@email.com"/></Field><Field label="Site / project location"><input value={quickLocation} onChange={e=>setQuickLocation(e.target.value)} placeholder="Town, area or full address"/></Field></>:<><Field label="Customer *"><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Phone"><input readOnly value={customerPhone}/></Field><Field label="Email"><input readOnly value={customerEmail}/></Field><Field label="Site / project location"><input readOnly value={customerLocation}/></Field></>}<Field label="Project title *"><input value={project} onChange={e=>setProject(e.target.value)} placeholder="e.g. 8-camera CCTV supply and installation"/></Field><Field label="Customer reference / attention"><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional PO, reference or contact person"/></Field></div></Panel>
      <Panel number="02" title="Estimate details" subtitle="Document identity, issue date and validity."><div className="ev2FormGrid"><Field label="Estimate number"><input readOnly value={quoteNo}/></Field><Field label="Issue date"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Valid for (days)"><input type="number" min="1" max="365" value={validDays} onChange={e=>setValidDays(Math.max(1,num(e.target.value)))}/></Field><Field label="Currency"><input readOnly value={business.currency||'GHS'}/></Field></div></Panel>
      <Panel number="03" title="Items & pricing" subtitle="List every material, labour charge or service separately."><div className="ev2ItemHeader"><span>Description</span><span>Category</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total cost</span><span/></div><div className="ev2Items">{items.map((item,index)=><div className="ev2Item" key={item.id}><div className="ev2Description"><small>ITEM {String(index+1).padStart(2,'0')}</small><input value={item.description} onChange={e=>updateItem(item.id,'description',e.target.value)} placeholder="Item or service description"/><textarea rows={2} value={item.details||''} onChange={e=>updateItem(item.id,'details',e.target.value)} placeholder="Optional model, specification, warranty or installation note"/></div><Field label="Category"><select value={item.category||'Material'} onChange={e=>updateItem(item.id,'category',e.target.value)}><option>Material</option><option>Labour</option><option>Service</option><option>Other</option></select></Field><Field label="Qty"><input type="number" min="0.01" step="0.01" value={item.qty} onChange={e=>updateItem(item.id,'qty',e.target.value)}/></Field><Field label="Unit"><input value={item.unit} onChange={e=>updateItem(item.id,'unit',e.target.value)} placeholder="pcs, m, job"/></Field><Field label="Unit price"><input type="number" min="0" step="0.01" value={item.rate} onChange={e=>updateItem(item.id,'rate',e.target.value)}/></Field><div className="ev2LineTotal"><span>Total cost</span><strong>{money(lineTotal(item),business.currency)}</strong></div><div className="ev2ItemActions"><button title="Move up" disabled={index===0} onClick={()=>moveItem(index,-1)}><ArrowUp size={15}/></button><button title="Move down" disabled={index===items.length-1} onClick={()=>moveItem(index,1)}><ArrowDown size={15}/></button><button title="Duplicate item" onClick={()=>duplicateItem(item,index)}><Copy size={15}/></button><button className="ev2Remove" title="Remove item" disabled={items.length===1} onClick={()=>items.length>1&&setItems(items.filter(r=>r.id!==item.id))}><Trash2 size={15}/></button></div></div>)}</div><button className="ev2Add" onClick={()=>setItems([...items,blankItem()])}><Plus size={18}/>Add another item</button></Panel>
      <Panel number="04" title="Notes & terms" subtitle="Add only the information your customer needs to approve the work."><div className="ev2NotesGrid"><Field label="Scope of work / notes"><textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)}/></Field><Field label="Terms & conditions"><textarea rows={5} value={terms} onChange={e=>setTerms(e.target.value)}/></Field><Field label="Payment instructions"><textarea rows={3} value={paymentDetails} onChange={e=>setPaymentDetails(e.target.value)}/></Field></div></Panel>
    </section>
    <aside className="ev2BuilderRail">
      <div className="ev2RailHeading"><span>LIVE TOTAL</span><p>{quoteNo}</p><strong>{money(totals.total,business.currency)}</strong><small>{validItems.length} priced item{validItems.length===1?'':'s'}</small></div>
      <div className="ev2RailAdjustments"><Field label="Discount %"><input type="number" min="0" max="100" value={discountPercent} onChange={e=>setDiscountPercent(clampPercent(e.target.value))}/></Field><Field label="Tax %"><input type="number" min="0" max="100" value={taxPercent} onChange={e=>setTaxPercent(clampPercent(e.target.value))}/></Field></div>
      <div className="ev2EditorTotals"><div><span>Subtotal</span><b>{money(totals.subtotal,business.currency)}</b></div>{totals.discount>0&&<div><span>Discount</span><b>- {money(totals.discount,business.currency)}</b></div>}{totals.tax>0&&<div><span>Tax</span><b>{money(totals.tax,business.currency)}</b></div>}<div className="grand"><span>Estimate total</span><strong>{money(totals.total,business.currency)}</strong></div></div>
      <div className="ev2Readiness"><h3>Ready to send?</h3><p className={customerName.trim()?'done':''}><i>{customerName.trim()?<Check size={12}/>:1}</i>Customer selected</p><p className={project.trim()?'done':''}><i>{project.trim()?<Check size={12}/>:2}</i>Project named</p><p className={validItems.length?'done':''}><i>{validItems.length?<Check size={12}/>:3}</i>Pricing added</p></div>
      <button className="ev2Primary ev2SummaryPreview" onClick={openPreview}><Eye size={18}/>Preview quotation</button>
      {!quick&&<button className="ev2RailSave" onClick={save}><Save size={17}/>Save as draft</button>}
    </aside>
    </div>
  </main>;
}

function Panel({number,title,subtitle,children}:{number:string;title:string;subtitle?:string;children:React.ReactNode}){return <section className="ev2Panel"><header><span>{number}</span><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div></header>{children}</section>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="ev2Field"><span>{label}</span>{children}</label>}
function PrintableQuote({business,quoteNo,customer,phone,email,location,project,reference,estimateTrade,date,validDays,items,notes,terms,paymentDetails,totals}:any){return <article className="ev2Quote printArea"><div className="ev2Watermark">{business.logo?<img src={business.logo} alt=""/>:<span>Q</span>}</div><header className="ev2QuoteHeader"><div className="ev2Company">{business.logo?<img src={business.logo} alt="Company logo"/>:<div className="ev2LogoFallback">Q</div>}<div><h2>{business.name||'Your Company'}</h2><p>{business.address||'Business address'}</p><p>{[business.phone,business.email].filter(Boolean).join(' · ')}</p>{business.taxId&&<p>Tax ID: {business.taxId}</p>}</div></div><div className="ev2QuoteTitle"><span>PROFESSIONAL COST ESTIMATE</span><h1>ESTIMATE</h1><strong>{quoteNo}</strong><p>Issued: {prettyDate(date)}</p><p>Valid for: {validDays} days</p></div></header><div className="ev2Accent"/><div className="ev2TradeLabel">{estimateTrade}</div><section className="ev2QuoteMeta"><div><span>PREPARED FOR</span><h3>{customer}</h3>{phone&&<p>{phone}</p>}{email&&<p>{email}</p>}{location&&<p>{location}</p>}</div><div><span>PROJECT / JOB</span><h3>{project}</h3>{reference&&<p>Reference: {reference}</p>}</div></section><div className="ev2TableWrap"><table><thead><tr><th>#</th><th>Item / service description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{items.map((item:DraftLine,index:number)=><tr key={item.id}><td>{String(index+1).padStart(2,'0')}</td><td><b>{item.description}</b>{item.details&&<small>{item.details}</small>}{item.category&&<em>{item.category}</em>}</td><td className="ev2QtyCell">{item.qty}</td><td>{item.unit}</td><td className="ev2MoneyCell">{money(item.rate,business.currency)}</td><td className="ev2MoneyCell"><strong>{money(lineTotal(item),business.currency)}</strong></td></tr>)}</tbody></table></div><section className="ev2Totals"><div><span>Subtotal</span><b>{money(totals.subtotal,business.currency)}</b></div>{totals.discount>0&&<div><span>Discount</span><b>- {money(totals.discount,business.currency)}</b></div>}{totals.tax>0&&<div><span>Tax</span><b>{money(totals.tax,business.currency)}</b></div>}<div className="ev2Grand"><span>ESTIMATED TOTAL</span><strong>{money(totals.total,business.currency)}</strong></div></section><section className="ev2QuoteDetails"><div><h4>SCOPE OF WORK / NOTES</h4><p>{notes}</p><h4>TERMS & CONDITIONS</h4><p>{terms}</p></div><aside><h4>PAYMENT DETAILS</h4><p>{paymentDetails}</p><div className="ev2Signature"><div>{business.signature&&<img src={business.signature} alt="Signature"/>}</div><span>Authorised signature</span></div></aside></section><footer><div><b>Thank you for the opportunity to quote.</b><span>Prepared especially for {customer}.</span></div><small>{quoteNo} · Generated with Quotiq</small></footer></article>}
