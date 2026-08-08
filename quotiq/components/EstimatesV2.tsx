import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, BadgeCheck, CalendarClock, Check, CheckCircle2, CircleDollarSign, Copy, ExternalLink, Eye, FileText, Layers3, LayoutDashboard, Link2, Loader2, MessageCircle, Plus, Printer, ReceiptText, RefreshCw, Save, Search, Send, ShieldCheck, Sparkles, Trash2, Users, WifiOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Business, Customer, Estimate, EstimateOption, Invoice, LineItem } from '../types';
import { getStored, setStored, uid } from '../lib/storage';
import { createEstimatePortal, getPortalForEstimate, getStoredPortalLink, revokeEstimatePortal, type ClientPortalRecord } from '../lib/supabase';

type DraftLine = LineItem & { details?: string; category?: 'Material' | 'Labour' | 'Service' | 'Other' };
type EstimateTrade = 'General contractor' | 'Electrician' | 'Security / CCTV installer' | 'Solar installer' | 'Starlink / Network installer' | 'Plumber' | 'Carpenter' | 'Painter' | 'Mason / Tiler' | 'Welder / Fabricator' | 'Air-conditioning technician';
const today = () => new Date().toISOString().slice(0, 10);
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const clampPercent = (value: unknown) => Math.min(100, Math.max(0, num(value)));
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const lineTotal = (line: DraftLine) => round(Math.max(0, num(line.qty)) * Math.max(0, num(line.rate)));
const money = (value: number, currency = 'GHS') => new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(round(value));
const prettyDate = (value: string) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '';
const dateOnly = (value?: string | null) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '';
const getBusiness = () => getStored<Business>('q-business', { name: 'Quotiq', email: '', phone: '', address: '', taxId: '', bank: '', accountName: '', accountNumber: '', mobileMoney: '', estimatePrefix: 'EST', invoicePrefix: 'INV', currency: 'GHS' });
const blankItem = (): DraftLine => ({ id: uid('ITM'), description: '', details: '', category: 'Material', qty: 1, unit: 'pcs', rate: 0 });
const defaultOptions = (): EstimateOption[] => [
  { id: 'essential', name: 'Essential', tagline: 'Reliable essentials', description: 'A practical solution covering the core scope and required materials.', multiplier: 0.9, warranty: '30-day workmanship warranty' },
  { id: 'recommended', name: 'Recommended', tagline: 'Best overall value', description: 'The complete professional solution with balanced quality, protection and support.', multiplier: 1, warranty: '90-day workmanship warranty', recommended: true },
  { id: 'premium', name: 'Premium', tagline: 'Maximum performance', description: 'Higher-specification delivery, priority scheduling and extended aftercare.', multiplier: 1.22, warranty: '12-month workmanship warranty' }
];
const optionTotal = (baseTotal: number, option: EstimateOption) => round(baseTotal * Math.max(.1, num(option.multiplier)));
const tradeTemplates: Record<EstimateTrade, Array<Omit<DraftLine, 'id' | 'rate'>>> = {
  'General contractor': [
    { description: 'Cement', details: 'Ghacem or approved equivalent, 50 kg bag', category: 'Material', qty: 20, unit: 'bags' },
    { description: 'Sand', details: 'Washed building sand delivered to site', category: 'Material', qty: 1, unit: 'trip' },
    { description: 'Chippings / stones', details: 'Construction aggregate delivered to site', category: 'Material', qty: 1, unit: 'trip' },
    { description: 'Blocks', details: '5-inch or 6-inch solid/sandcrete blocks', category: 'Material', qty: 100, unit: 'pcs' },
    { description: 'Reinforcement steel', details: 'Specify diameter and length', category: 'Material', qty: 10, unit: 'lengths' },
    { description: 'Transportation and delivery', details: 'Material haulage to project site', category: 'Service', qty: 1, unit: 'trip' },
    { description: 'Skilled and general labour', details: 'Construction, supervision and site finishing', category: 'Labour', qty: 1, unit: 'job' }
  ],
  Electrician: [
    { description: '1.5 mm² copper cable', details: 'Lighting circuit cable, approved brand', category: 'Material', qty: 2, unit: 'coils' },
    { description: '2.5 mm² copper cable', details: 'Socket circuit cable, approved brand', category: 'Material', qty: 2, unit: 'coils' },
    { description: '20 mm PVC conduit', details: 'Heavy-duty electrical conduit', category: 'Material', qty: 20, unit: 'lengths' },
    { description: '13A double socket outlet', details: 'Complete socket with pattress/back box', category: 'Material', qty: 8, unit: 'pcs' },
    { description: 'Light switch', details: 'One-gang or two-gang switch with box', category: 'Material', qty: 6, unit: 'pcs' },
    { description: 'LED light fitting', details: 'Indoor ceiling light, specify wattage', category: 'Material', qty: 8, unit: 'pcs' },
    { description: 'Consumer unit / distribution board', details: 'Complete with MCBs, RCCB and surge protection', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Earthing system', details: 'Earth rod, clamp, cable and inspection chamber', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Electrical installation labour', details: 'Chasing, wiring, termination, testing and commissioning', category: 'Labour', qty: 1, unit: 'job' }
  ],
  'Security / CCTV installer': [
    { description: 'IP / HD CCTV camera', details: 'Specify brand, resolution, lens and camera type', category: 'Material', qty: 4, unit: 'pcs' },
    { description: 'DVR / NVR recorder', details: 'Recorder sized for the required camera channels', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Surveillance hard drive', details: '24/7 CCTV-rated storage; specify capacity', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Cat6 / CCTV cable', details: 'Pure copper or approved cable type', category: 'Material', qty: 1, unit: 'box' },
    { description: 'Camera power / PoE equipment', details: 'Power supply, adapters or PoE switch as required', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Connectors and accessories', details: 'RJ45/BNC, DC plugs, junction boxes, clips and trunking', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'UPS backup', details: 'Backup power for recorder, cameras and router', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Installation and configuration', details: 'Mounting, cabling, remote viewing, testing and handover', category: 'Labour', qty: 1, unit: 'job' }
  ],
  'Solar installer': [
    { description: 'Solar panel', details: 'Mono-crystalline panel; specify wattage and brand', category: 'Material', qty: 4, unit: 'pcs' },
    { description: 'Hybrid inverter', details: 'Specify capacity, phase and MPPT rating', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Lithium / deep-cycle battery', details: 'Specify voltage and storage capacity', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Solar mounting structure', details: 'Roof/ground rails, clamps and fasteners', category: 'Material', qty: 1, unit: 'set' },
    { description: 'PV cable and MC4 connectors', details: 'UV-resistant solar cable and connector pairs', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'DC/AC protection board', details: 'Breakers, isolators, surge protection and enclosure', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Earthing and lightning protection', details: 'Earth rod, cable, clamps and bonding', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Solar installation and commissioning', details: 'Mounting, wiring, programming, testing and handover', category: 'Labour', qty: 1, unit: 'job' }
  ],
  'Starlink / Network installer': [
    { description: 'Starlink kit', details: 'Standard or Mini kit with router and supplied cable', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Roof / wall mounting bracket', details: 'Galvanised pole, wall bracket or custom mount', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Wi-Fi 6 router / mesh node', details: 'Additional router or mesh access point', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Outdoor Cat6 cable', details: 'UV-rated pure copper network cable', category: 'Material', qty: 50, unit: 'm' },
    { description: 'RJ45 connectors and weatherproof box', details: 'Connectors, couplers, clips and cable protection', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Surge protector / UPS backup', details: 'Power and network protection for equipment', category: 'Material', qty: 1, unit: 'pcs' },
    { description: 'Installation and network setup', details: 'Mounting, alignment, cable routing, Wi-Fi setup and testing', category: 'Labour', qty: 1, unit: 'job' }
  ],
  Plumber: [
    { description: 'PPR / PVC pipe', details: 'Specify diameter, pressure class and application', category: 'Material', qty: 10, unit: 'lengths' },
    { description: 'Pipe fittings', details: 'Elbows, tees, reducers, sockets and unions', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Stop valve / gate valve', details: 'Approved water control valve', category: 'Material', qty: 3, unit: 'pcs' },
    { description: 'Wash hand basin', details: 'Basin complete with tap, trap and waste fittings', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Water closet / toilet set', details: 'WC bowl, cistern, seat and connectors', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Shower set', details: 'Mixer/tap, shower head and accessories', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Sealants and consumables', details: 'PTFE tape, solvent cement, clips and fasteners', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Plumbing installation labour', details: 'Pipework, fixture fitting, pressure testing and finishing', category: 'Labour', qty: 1, unit: 'job' }
  ],
  Carpenter: [
    { description: 'Hardwood / softwood timber', details: 'Specify dimensions, grade and total lengths', category: 'Material', qty: 20, unit: 'lengths' },
    { description: 'Plywood / MDF board', details: 'Specify thickness, grade and finish', category: 'Material', qty: 4, unit: 'sheets' },
    { description: 'Hinges and drawer runners', details: 'Heavy-duty hardware as required', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Locks, handles and accessories', details: 'Approved ironmongery and fittings', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Wood screws, nails and adhesive', details: 'Fabrication consumables', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Wood treatment and finishing', details: 'Preservative, sanding, stain, lacquer or paint', category: 'Service', qty: 1, unit: 'job' },
    { description: 'Fabrication and installation labour', details: 'Cutting, assembly, fitting and final adjustment', category: 'Labour', qty: 1, unit: 'job' }
  ],
  Painter: [
    { description: 'Interior emulsion paint', details: 'Specify brand, colour and container size', category: 'Material', qty: 4, unit: 'buckets' },
    { description: 'Exterior weatherproof paint', details: 'Specify brand, colour and container size', category: 'Material', qty: 2, unit: 'buckets' },
    { description: 'Primer / sealer', details: 'Wall primer appropriate for the surface', category: 'Material', qty: 2, unit: 'buckets' },
    { description: 'Wall filler / putty', details: 'Crack repair and surface levelling compound', category: 'Material', qty: 4, unit: 'bags' },
    { description: 'Painting tools and consumables', details: 'Rollers, brushes, masking tape, sandpaper and covers', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Surface preparation', details: 'Scraping, filling, sanding, cleaning and priming', category: 'Service', qty: 1, unit: 'job' },
    { description: 'Painting labour', details: 'Application of agreed coats and final finishing', category: 'Labour', qty: 1, unit: 'job' }
  ],
  'Mason / Tiler': [
    { description: 'Floor / wall tiles', details: 'Specify size, design and coverage area', category: 'Material', qty: 20, unit: 'boxes' },
    { description: 'Tile adhesive', details: 'Approved cement-based tile adhesive', category: 'Material', qty: 10, unit: 'bags' },
    { description: 'Tile grout', details: 'Specify colour and application', category: 'Material', qty: 5, unit: 'packs' },
    { description: 'Cement and sand', details: 'For screeding, bedding and patching', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Tile trims and spacers', details: 'Edge trims, levelling clips and spacers', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Surface preparation / screeding', details: 'Levelling and preparing substrate', category: 'Service', qty: 1, unit: 'job' },
    { description: 'Tiling labour', details: 'Setting-out, cutting, laying, grouting and cleaning', category: 'Labour', qty: 1, unit: 'm²' }
  ],
  'Welder / Fabricator': [
    { description: 'Square / rectangular steel tube', details: 'Specify section size, gauge and length', category: 'Material', qty: 10, unit: 'lengths' },
    { description: 'Steel plate / flat bar', details: 'Specify thickness and dimensions', category: 'Material', qty: 2, unit: 'sheets' },
    { description: 'Hinges, locks and rollers', details: 'Gate or fabrication hardware', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Welding electrodes / wire', details: 'Electrodes, MIG wire or cutting discs', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Anti-rust primer and paint', details: 'Metal preparation and protective finish', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'Fabrication labour', details: 'Cutting, welding, grinding and assembly', category: 'Labour', qty: 1, unit: 'job' },
    { description: 'Delivery and installation', details: 'Transportation, positioning, fixing and adjustment', category: 'Service', qty: 1, unit: 'job' }
  ],
  'Air-conditioning technician': [
    { description: 'Split air conditioner', details: 'Specify brand, capacity, inverter type and energy rating', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Copper pipe pair', details: 'Insulated refrigerant pipe sized for unit', category: 'Material', qty: 5, unit: 'm' },
    { description: 'Drain hose and communication cable', details: 'Condensate drain and interconnection cable', category: 'Material', qty: 5, unit: 'm' },
    { description: 'Outdoor unit brackets', details: 'Heavy-duty wall brackets and anti-vibration pads', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Electrical isolator and cable', details: 'Dedicated AC power connection and protection', category: 'Material', qty: 1, unit: 'set' },
    { description: 'Refrigerant / servicing consumables', details: 'Gas top-up where required, insulation and sealant', category: 'Material', qty: 1, unit: 'lot' },
    { description: 'AC installation and commissioning', details: 'Mounting, piping, vacuuming, testing and handover', category: 'Labour', qty: 1, unit: 'job' }
  ]
};

export default function EstimatesV2() {
  const location = useLocation();
  if (location.pathname === '/estimates/new') return <EstimateBuilder quick={false} />;
  if (location.pathname === '/estimates/quick') return <EstimateBuilder quick />;
  const id=decodeURIComponent(location.pathname.split('/')[2]||'');
  if(id)return <EstimateDetail id={id}/>;
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
    <header className="ev2ListHeader"><div><button className="ev2DashboardBack" onClick={()=>navigate('/')}><ArrowLeft size={16}/><LayoutDashboard size={16}/>Dashboard</button><span>ESTIMATES & QUOTATIONS</span><h1>Estimates</h1><p>Create detailed contractor estimates or prepare a fast one-time quotation.</p></div><div className="ev2HeaderActions"><button onClick={() => navigate('/estimates/quick')}><Printer size={18}/>Quick Print</button><button className="ev2Primary" onClick={() => navigate('/estimates/new')}><Plus size={18}/>Create Estimate</button></div></header>
    <div className="ev2Stats"><article><span>Total estimates</span><strong>{estimates.length}</strong></article><article><span>Total quoted value</span><strong>{money(totalValue, business.currency)}</strong></article><article><span>Draft value</span><strong>{money(estimates.filter(e => e.status === 'Draft').reduce((s,e)=>s+num(e.amount),0), business.currency)}</strong></article><article><span>Pending value</span><strong>{money(estimates.filter(e => e.status === 'Pending').reduce((s,e)=>s+num(e.amount),0), business.currency)}</strong></article></div>
    <label className="ev2Search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search estimate number, customer, project or status"/><small>{filtered.length} result{filtered.length === 1 ? '' : 's'}</small></label>
    <section className="ev2EstimateList">{filtered.length ? filtered.map(e => <button className="ev2EstimateRow" key={e.id} onClick={()=>navigate(`/estimates/${encodeURIComponent(e.id)}`)}><FileText/><div><b>{e.id}</b><h3>{e.project}</h3><p>{e.customer} · {prettyDate(e.date)}</p></div><strong>{money(e.amount,business.currency)}</strong><span className={`ev2Status ${e.status.toLowerCase()}`}>{e.status}</span><Eye size={18}/></button>) : <div className="ev2Empty"><FileText size={42}/><h2>No estimates found</h2><p>Create a saved estimate or use Quick Print for a quotation you do not need to keep.</p><div className="ev2EmptyActions"><button onClick={()=>navigate('/estimates/quick')}><Printer size={17}/>Quick Print</button><button className="ev2Primary" onClick={()=>navigate('/estimates/new')}><Plus size={17}/>Create Estimate</button></div></div>}</section>
  </main>;
}

function EstimateDetail({id}:{id:string}){
 const navigate=useNavigate(),business=getBusiness();
 const[estimates,setEstimates]=useState(()=>getStored<Estimate[]>('q-estimates',[]));
 const[notice,setNotice]=useState('');
 const[portal,setPortal]=useState<ClientPortalRecord|null>(null);
 const[portalLink,setPortalLink]=useState('');
 const[portalBusy,setPortalBusy]=useState(true);
 const[depositPercent,setDepositPercent]=useState(()=>getStored<Estimate[]>('q-estimates',[]).find(item=>item.id===id)?.depositPercent??50);
 const customers=getStored<Customer[]>('q-customers',[]),invoices=getStored<Invoice[]>('q-invoices',[]);
 const estimate=estimates.find(e=>e.id===id);

 useEffect(()=>{
  let cancelled=false;
  getPortalForEstimate(id).then(record=>{
   if(cancelled)return;
   setPortal(record);setPortalLink(record?getStoredPortalLink(id,record.id):'');
   if(record?.deposit_percent!==undefined)setDepositPercent(Number(record.deposit_percent));
   if(record?.status==='accepted')setEstimates(current=>{
    const match=current.find(item=>item.id===id);if(!match||match.status==='Accepted')return current;
    const selectedOption=match.options?.find(option=>record.response_message?.includes(option.name));
    const next=current.map(item=>item.id===id?{...item,status:'Accepted' as const,selectedOptionId:selectedOption?.id||item.selectedOptionId,amount:selectedOption?optionTotal(item.amount,selectedOption):item.amount}:item);setStored('q-estimates',next);return next;
   });
  }).catch(reason=>!cancelled&&setNotice(reason instanceof Error?reason.message:'Could not load the client approval status.')).finally(()=>!cancelled&&setPortalBusy(false));
  return()=>{cancelled=true};
 },[id]);

 if(!estimate)return <main className="ev2Page"><div className="ev2Empty"><FileText/><h2>Estimate not found</h2><button onClick={()=>navigate('/estimates')}>Back to estimates</button></div></main>;
 const customer=customers.find(c=>c.id===estimate.customerId),subtotal=estimate.items.reduce((s,i)=>s+lineTotal(i),0),discount=subtotal*clampPercent(estimate.discount)/100,tax=(subtotal-discount)*clampPercent(estimate.tax)/100,total=subtotal-discount+tax;
 const selectedOption=estimate.options?.find(option=>option.id===estimate.selectedOptionId);
 const invoiceTotal=selectedOption?optionTotal(total,selectedOption):total;
 const linked=invoices.find(i=>i.estimateId===estimate.id);
 const totals={subtotal,discount,tax,total};
 const updateStatus=(status:Estimate['status'])=>{const next=estimates.map(e=>e.id===estimate.id?{...e,status}:e);setEstimates(next);setStored('q-estimates',next);setNotice(`Estimate marked ${status.toLowerCase()}.`)};
 const convert=()=>{if(linked){navigate(`/invoices/${encodeURIComponent(linked.id)}`);return}const invoiceId=`${business.invoicePrefix||'INV'}-${new Date().getFullYear()}-${String(invoices.length+1).padStart(4,'0')}`,due=new Date();due.setDate(due.getDate()+14);const invoice:Invoice={id:invoiceId,customerId:estimate.customerId,customer:estimate.customer,project:selectedOption?`${estimate.project} · ${selectedOption.name}`:estimate.project,amount:invoiceTotal,paid:0,status:'Unpaid',date:today(),dueDate:due.toISOString().slice(0,10),items:estimate.items.map(i=>({...i,id:uid('ITM')})),tax:estimate.tax,discount:estimate.discount,estimateId:estimate.id,payments:[]};setStored('q-invoices',[invoice,...invoices]);updateStatus('Accepted');navigate(`/invoices/${encodeURIComponent(invoiceId)}`)};
 const copyLink=async(link=portalLink)=>{if(!link)return;try{await navigator.clipboard.writeText(link);setNotice('Secure approval link copied. Send it only to the customer.')}catch{window.prompt('Copy this secure approval link:',link)}};
 const createPortal=async()=>{
  if(!navigator.onLine){setNotice('Connect to the internet once to create a secure client link. Your estimate remains saved offline.');return}
  setPortalBusy(true);setNotice('');
  try{const created=await createEstimatePortal({estimate,business,customer,totals,depositPercent});setPortal(created.portal);setPortalLink(created.link);if(estimate.status==='Draft')updateStatus('Pending');await copyLink(created.link);setNotice(created.reused?'Secure approval link copied.':'New secure approval link created and copied.');}
  catch(reason){setNotice(reason instanceof Error?reason.message:'Could not create the approval link.');}
  finally{setPortalBusy(false)}
 };
 const revokePortal=async()=>{if(!portal)return;setPortalBusy(true);try{await revokeEstimatePortal(portal);setPortal({...portal,status:'revoked'});setPortalLink('');setNotice('The client approval link has been withdrawn.')}catch(reason){setNotice(reason instanceof Error?reason.message:'Could not withdraw the link.')}finally{setPortalBusy(false)}};
 const shareWhatsApp=()=>{if(!portalLink)return;const text=`Hello ${estimate.customer}, please review ${estimate.id} for ${estimate.project}. You can choose an option, request changes or approve securely here: ${portalLink}`;window.open(`https://wa.me/${(customer?.phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')};
 const portalLabel=portal?({pending:'Awaiting client',accepted:'Client approved',changes_requested:'Changes requested',declined:'Client declined',expired:'Link expired',revoked:'Link withdrawn'} as const)[portal.status]:'';

 return <main className="ev2DetailPage"><header className="ev2DetailHeader"><button className="ev2Back" onClick={()=>navigate('/estimates')}><ArrowLeft/>All estimates</button><div><span>ESTIMATE WORKFLOW</span><h1>{estimate.id}</h1><p>{estimate.customer} · {estimate.project}</p></div><div className="ev2DetailActions"><button onClick={()=>window.print()}><Printer/>Print / PDF</button><button className="ev2Primary" onClick={convert}><ReceiptText/>{linked?'Open invoice':'Convert to invoice'}</button></div></header>{notice&&<div className="ev2Notice">{notice}</div>}
 <section className="ev2Workflow"><div className={estimate.status==='Draft'?'active done':'done'}><i><Check/></i><span>Draft</span></div><div className={estimate.status==='Pending'?'active':estimate.status==='Accepted'?'done':''}><i>{estimate.status!=='Draft'?<Check/>:2}</i><span>Sent / Pending</span></div><div className={estimate.status==='Accepted'?'active done':''}><i>{estimate.status==='Accepted'?<Check/>:3}</i><span>Accepted</span></div><div className={linked?'active done':''}><i>{linked?<Check/>:4}</i><span>Invoiced</span></div></section>
 <div className="ev2DetailGrid"><aside className="ev2DetailPanel"><h2>Next action</h2>{estimate.status==='Draft'&&<><p>Finalize this estimate or send the customer a private approval link.</p><button className="ev2Primary" onClick={()=>updateStatus('Pending')}><Send/>Mark as sent</button></>}{estimate.status==='Pending'&&portal?.status!=='accepted'&&<><p>Waiting for the customer’s response. You can still record acceptance manually.</p><button className="ev2Primary" onClick={()=>updateStatus('Accepted')}><CheckCircle2/>Record acceptance</button></>}{estimate.status==='Accepted'&&!linked&&<><p>The estimate is approved and ready for billing.</p><button className="ev2Primary" onClick={convert}><ReceiptText/>Create invoice</button></>}{linked&&<><p>This estimate is connected to invoice <b>{linked.id}</b>.</p><button onClick={()=>navigate(`/invoices/${encodeURIComponent(linked.id)}`)}><Eye/>View invoice</button></>}
 <section className="ev2PortalCard"><div className="ev2PortalTitle"><ShieldCheck/><div><span>CLIENT PORTAL</span><h3>Approval & signature</h3></div></div>{portalBusy?<p className="ev2PortalLoading"><Loader2/>Checking secure link…</p>:portal?<><div className={`ev2PortalState ${portal.status}`}><b>{portalLabel}</b><span>{portal.status==='pending'?`Expires ${dateOnly(portal.expires_at)}`:portal.responded_at?`${portal.response_name||'Client'} · ${dateOnly(portal.responded_at)}`:`Updated ${dateOnly(portal.updated_at)}`}</span></div>{portal.response_message&&<blockquote>“{portal.response_message}”</blockquote>}{portalLink?<><div className="ev2PortalActions"><button className="ev2Primary" onClick={()=>copyLink()}><Copy/>Copy link</button><button onClick={shareWhatsApp}><MessageCircle/>WhatsApp</button><button onClick={()=>window.open(portalLink,'_blank','noopener,noreferrer')}><ExternalLink/>Open</button></div></>:portal.status!=='accepted'&&portal.status!=='declined'&&<button onClick={createPortal}><RefreshCw/>Issue a new link</button>}{(portal.status==='pending'||portal.status==='changes_requested')&&<button className="ev2RevokeLink" onClick={revokePortal}>Withdraw this link</button>}</>:<><p>Create a private page where the client can compare options, request changes, choose a start date and sign securely.</p><label className="ev2DepositField"><span>Deposit after approval</span><div><input type="number" min="0" max="100" value={depositPercent} onChange={event=>setDepositPercent(clampPercent(event.target.value))}/><b>%</b></div></label><button className="ev2Primary" onClick={createPortal}><Link2/>Create & copy link</button></>}
 <div className="ev2PortalSecurity"><WifiOff/><span>Estimates still work offline. Internet is required only to create or receive a client response.</span></div></section>
 <hr/><h3>Customer</h3><b>{estimate.customer}</b><span>{customer?.phone}</span><span>{customer?.email}</span><span>{customer?.siteAddress||customer?.address}</span></aside>
 <PrintableQuote business={business} quoteNo={estimate.id} customer={estimate.customer} phone={customer?.phone||''} email={customer?.email||''} location={customer?.siteAddress||customer?.address||''} project={estimate.project} reference={estimate.reference||''} estimateTrade={estimate.trade||'Professional contractor'} date={estimate.date} validDays={estimate.validDays||14} items={estimate.items} notes={estimate.notes||'Supply, installation, testing and handover of the listed items and services.'} terms={estimate.terms||business.terms||'Quotation is valid for the stated period.'} paymentDetails={estimate.paymentDetails||business.mobileMoney||business.bank||'Payment details will be provided upon acceptance.'} totals={totals} pricingStyle={estimate.pricingStyle} options={estimate.options} depositPercent={estimate.depositPercent} preferredStart={estimate.preferredStart}/>
 </div></main>;
}

function EstimateBuilder({ quick }: { quick: boolean }) {
  const navigate = useNavigate();
  const route = useLocation();
  const business = getBusiness();
  const customers = getStored<Customer[]>('q-customers', []);
  const existing = getStored<Estimate[]>('q-estimates', []);
  const requestedCustomer = new URLSearchParams(route.search).get('customer') || '';
  const initialCustomer = customers.some(customer => customer.id === requestedCustomer) ? requestedCustomer : customers[0]?.id || '';
  const [preview, setPreview] = useState(false);
  const [customerId, setCustomerId] = useState(initialCustomer);
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
  const [pricingStyle, setPricingStyle] = useState<'standard' | 'choices'>('standard');
  const [options, setOptions] = useState<EstimateOption[]>(defaultOptions);
  const [depositPercent, setDepositPercent] = useState(30);
  const [preferredStart, setPreferredStart] = useState('');
  const [internalCost, setInternalCost] = useState(0);
  const [notes, setNotes] = useState('Supply, installation, testing and handover of the listed items and services.');
  const [terms, setTerms] = useState(business.terms || 'Quotation is valid for the stated period.\nA deposit may be required before work begins.\nAdditional work outside this scope will be quoted separately.');
  const [paymentDetails, setPaymentDetails] = useState(business.mobileMoney || business.bank || 'Payment details will be provided upon acceptance.');
  const [items, setItems] = useState<DraftLine[]>([blankItem()]);
  const [error, setError] = useState('');
  useEffect(()=>{if(!preview)return;document.body.classList.add('printingEstimate');return()=>document.body.classList.remove('printingEstimate')},[preview]);
  const customer = customers.find(c => c.id === customerId);
  const customerName = quick ? quickCustomer : customer?.name || '';
  const customerPhone = quick ? quickPhone : customer?.phone || '';
  const customerEmail = quick ? quickEmail : customer?.email || '';
  const customerLocation = quick ? quickLocation : customer?.siteAddress || customer?.address || '';
  const quoteNo = `${business.estimatePrefix || 'EST'}-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;
  const totals = useMemo(() => { const subtotal = round(items.reduce((s,i)=>s+lineTotal(i),0)); const discount = round(subtotal*clampPercent(discountPercent)/100); const taxable = round(Math.max(0,subtotal-discount)); const tax = round(taxable*clampPercent(taxPercent)/100); return { subtotal, discount, tax, total: round(taxable+tax) }; }, [items,discountPercent,taxPercent]);
  const validItems = items.filter(i=>i.description.trim());
  const margin = round(totals.total - Math.max(0, internalCost));
  const marginPercent = totals.total > 0 ? round(margin / totals.total * 100) : 0;
  const healthChecks = [customerName.trim(), project.trim(), validItems.length, validItems.every(item => item.rate > 0), notes.trim(), terms.trim(), paymentDetails.trim(), pricingStyle === 'standard' || options.length === 3];
  const healthScore = Math.round(healthChecks.filter(Boolean).length / healthChecks.length * 100);
  const updateItem = (id:string,key:keyof DraftLine,value:string) => setItems(rows=>rows.map(i=>i.id===id?{...i,[key]:key==='qty'||key==='rate'?Math.max(0,num(value)):value}:i));
  const updateOption = (id:string,key:keyof EstimateOption,value:string) => setOptions(rows=>rows.map(option=>option.id===id?{...option,[key]:key==='multiplier'?Math.max(.1,num(value)):value}:option));
  const moveItem = (index:number,direction:-1|1) => setItems(rows => { const target=index+direction; if(target<0||target>=rows.length)return rows; const next=[...rows]; [next[index],next[target]]=[next[target],next[index]]; return next; });
  const duplicateItem = (item:DraftLine,index:number) => setItems(rows=>[...rows.slice(0,index+1),{...item,id:uid('ITM')},...rows.slice(index+1)]);
  const loadTradeTemplate = () => {
    setItems(tradeTemplates[estimateTrade].map((item, index) => ({ ...item, id: `${uid('ITM')}-${index}`, rate: 0 })));
    if (!project.trim()) setProject(`${estimateTrade} works`);
  };
  const validate = () => { if(!customerName.trim()){setError('Enter or select a customer.');return false} if(!project.trim()){setError('Enter the project or job title.');return false} if(!validItems.length){setError('Add at least one item or service.');return false} if(validItems.some(i=>num(i.qty)<=0)){setError('Every listed item must have a quantity greater than zero.');return false} setError('');return true };
  const openPreview = () => { if(validate()) { setPreview(true); window.scrollTo(0,0); } };
  const save = () => { if(quick || !validate() || !customer) return; const estimate:Estimate={id:quoteNo,customerId:customer.id,customer:customer.name,project:project.trim(),amount:totals.total,status:'Draft',date,items:validItems,tax:clampPercent(taxPercent),discount:clampPercent(discountPercent),validDays,reference,trade:estimateTrade,notes,terms,paymentDetails,pricingStyle,options:pricingStyle==='choices'?options:undefined,depositPercent,preferredStart,internalCost}; setStored('q-estimates',[estimate,...existing]); navigate(`/estimates/${encodeURIComponent(estimate.id)}`); };

  if (preview) return <div className="ev2PreviewPage"><div className="ev2PreviewToolbar noPrint"><button onClick={()=>setPreview(false)}><ArrowLeft size={18}/>Back to edit</button><div><span>DOCUMENT PREVIEW</span><h1>{quoteNo}</h1><p>Check the document before printing or saving it as PDF.</p></div><button className="ev2Primary" onClick={()=>window.print()}><Printer size={18}/>Print / Save PDF</button></div><PrintableQuote business={business} quoteNo={quoteNo} customer={customerName} phone={customerPhone} email={customerEmail} location={customerLocation} project={project} reference={reference} estimateTrade={estimateTrade} date={date} validDays={validDays} items={validItems} notes={notes} terms={terms} paymentDetails={paymentDetails} totals={totals} pricingStyle={pricingStyle} options={options} depositPercent={depositPercent} preferredStart={preferredStart}/></div>;

  return <main className="ev2BuilderPage">
    <header className="ev2BuilderTop"><button className="ev2Back" onClick={()=>navigate('/')}><ArrowLeft size={18}/><LayoutDashboard size={17}/>Dashboard</button><div><span>{quick?'QUICK PRINT':'NEW ESTIMATE'}</span><h1>{quick?'One-time quotation':'Create estimate'}</h1><p>{quick?'Prepare and print without saving a customer or estimate record.':'Create a detailed estimate linked to a saved customer.'}</p></div><div className="ev2HeaderActions">{!quick&&<button onClick={save}><Save size={18}/>Save Draft</button>}<button className="ev2Primary" onClick={openPreview}><Eye size={18}/>Preview / Print</button></div></header>
    {error&&<div className="ev2Error">{error}</div>}
    {!quick&&!customers.length&&<div className="ev2CustomerNotice"><Users size={20}/><div><b>No saved customers yet</b><span>Add a customer first, or use Quick Print for a one-time quotation.</span></div><button onClick={()=>navigate('/customers/new')}>Add customer</button></div>}
    <div className="ev2BuilderShell">
    <section className="ev2EditorOnly">
      <section className="ev2TradePicker"><div><span>START WITH A PROFESSIONAL TEMPLATE</span><h2>Choose your profession</h2><p>Load realistic materials, accessories, services and labour. Edit quantities and remove anything you do not need.</p></div><div className="ev2TradeControls"><select aria-label="Contractor profession" value={estimateTrade} onChange={e=>setEstimateTrade(e.target.value as EstimateTrade)}>{(Object.keys(tradeTemplates) as EstimateTrade[]).map(trade=><option key={trade} value={trade}>{trade} · {tradeTemplates[trade].length} items</option>)}</select><button onClick={loadTradeTemplate}><Plus size={17}/>Load starter items</button></div></section>
      <Panel number="01" title="Customer & project" subtitle="Who the quotation is for and what the work covers."><div className="ev2FormGrid">{quick?<><Field label="Customer name *"><input value={quickCustomer} onChange={e=>setQuickCustomer(e.target.value)} placeholder="Customer or company name"/></Field><Field label="Phone"><input value={quickPhone} onChange={e=>setQuickPhone(e.target.value)} placeholder="024 000 0000"/></Field><Field label="Email"><input type="email" value={quickEmail} onChange={e=>setQuickEmail(e.target.value)} placeholder="customer@email.com"/></Field><Field label="Site / project location"><input value={quickLocation} onChange={e=>setQuickLocation(e.target.value)} placeholder="Town, area or full address"/></Field></>:<><Field label="Customer *"><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Phone"><input readOnly value={customerPhone}/></Field><Field label="Email"><input readOnly value={customerEmail}/></Field><Field label="Site / project location"><input readOnly value={customerLocation}/></Field></>}<Field label="Project title *"><input value={project} onChange={e=>setProject(e.target.value)} placeholder="e.g. 8-camera CCTV supply and installation"/></Field><Field label="Customer reference / attention"><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional PO, reference or contact person"/></Field></div></Panel>
      <Panel number="02" title="Estimate details" subtitle="Document identity, issue date and validity."><div className="ev2FormGrid"><Field label="Estimate number"><input readOnly value={quoteNo}/></Field><Field label="Issue date"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Valid for (days)"><input type="number" min="1" max="365" value={validDays} onChange={e=>setValidDays(Math.max(1,num(e.target.value)))}/></Field><Field label="Currency"><input readOnly value={business.currency||'GHS'}/></Field></div></Panel>
      <Panel number="03" title="Items & pricing" subtitle="List every material, labour charge or service separately."><div className="ev2ItemHeader"><span>Description</span><span>Category</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Line total</span><span/></div><div className="ev2Items">{items.map((item,index)=><div className="ev2Item" key={item.id}><div className="ev2Description"><small>ITEM {String(index+1).padStart(2,'0')}</small><input value={item.description} onChange={e=>updateItem(item.id,'description',e.target.value)} placeholder="Item or service description"/><textarea rows={2} value={item.details||''} onChange={e=>updateItem(item.id,'details',e.target.value)} placeholder="Optional model, specification, warranty or installation note"/></div><Field label="Category"><select value={item.category||'Material'} onChange={e=>updateItem(item.id,'category',e.target.value)}><option>Material</option><option>Labour</option><option>Service</option><option>Other</option></select></Field><Field label="Qty"><input type="number" min="0.01" step="0.01" value={item.qty} onChange={e=>updateItem(item.id,'qty',e.target.value)}/></Field><Field label="Unit"><input value={item.unit} onChange={e=>updateItem(item.id,'unit',e.target.value)} placeholder="pcs, m, job"/></Field><Field label="Unit price"><input type="number" min="0" step="0.01" value={item.rate} onChange={e=>updateItem(item.id,'rate',e.target.value)}/></Field><div className="ev2LineTotal"><span>Line total</span><strong>{money(lineTotal(item),business.currency)}</strong></div><div className="ev2ItemActions"><button title="Move up" disabled={index===0} onClick={()=>moveItem(index,-1)}><ArrowUp size={15}/></button><button title="Move down" disabled={index===items.length-1} onClick={()=>moveItem(index,1)}><ArrowDown size={15}/></button><button title="Duplicate item" onClick={()=>duplicateItem(item,index)}><Copy size={15}/></button><button className="ev2Remove" title="Remove item" disabled={items.length===1} onClick={()=>items.length>1&&setItems(items.filter(r=>r.id!==item.id))}><Trash2 size={15}/></button></div></div>)}</div><button className="ev2Add" onClick={()=>setItems([...items,blankItem()])}><Plus size={18}/>Add another item</button></Panel>
      <Panel number="04" title="Client choices & payment plan" subtitle="Offer one fixed price or let the customer compare Good / Better / Best packages."><div className="qiModePicker"><button className={pricingStyle==='standard'?'active':''} onClick={()=>setPricingStyle('standard')}><FileText/><span><b>Standard estimate</b><small>One clear itemized total</small></span></button><button className={pricingStyle==='choices'?'active':''} onClick={()=>setPricingStyle('choices')}><Layers3/><span><b>Choice estimate</b><small>Three packages clients can select</small></span></button></div>{pricingStyle==='choices'&&<div className="qiOptionEditor">{options.map(option=><article className={option.recommended?'recommended':''} key={option.id}>{option.recommended&&<em><Sparkles/>RECOMMENDED</em>}<input className="qiOptionName" value={option.name} onChange={event=>updateOption(option.id,'name',event.target.value)}/><input value={option.tagline} onChange={event=>updateOption(option.id,'tagline',event.target.value)} placeholder="Short benefit"/><textarea rows={3} value={option.description} onChange={event=>updateOption(option.id,'description',event.target.value)} placeholder="What this package includes"/><label><span>Price factor</span><div><input type="number" min="0.1" step="0.01" value={option.multiplier} onChange={event=>updateOption(option.id,'multiplier',event.target.value)}/><b>×</b></div></label><label><span>Warranty / aftercare</span><input value={option.warranty} onChange={event=>updateOption(option.id,'warranty',event.target.value)}/></label><strong>{money(optionTotal(totals.total,option),business.currency)}</strong></article>)}</div>}<div className="qiPaymentPlan"><Field label="Deposit after approval (%)"><input type="number" min="0" max="100" value={depositPercent} onChange={event=>setDepositPercent(clampPercent(event.target.value))}/></Field><Field label="Earliest available start date"><input type="date" value={preferredStart} onChange={event=>setPreferredStart(event.target.value)}/></Field><div><CalendarClock/><p><b>Approval-ready scheduling</b><span>The customer can confirm a preferred start date in the secure approval page.</span></p></div></div></Panel>
      <Panel number="05" title="Notes & terms" subtitle="Add only the information your customer needs to approve the work."><div className="ev2NotesGrid"><Field label="Scope of work / notes"><textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)}/></Field><Field label="Terms & conditions"><textarea rows={5} value={terms} onChange={e=>setTerms(e.target.value)}/></Field><Field label="Payment instructions"><textarea rows={3} value={paymentDetails} onChange={e=>setPaymentDetails(e.target.value)}/></Field></div></Panel>
    </section>
    <aside className="ev2BuilderRail">
      <div className="ev2RailHeading"><span>LIVE TOTAL</span><p>{quoteNo}</p><strong>{money(totals.total,business.currency)}</strong><small>{validItems.length} priced item{validItems.length===1?'':'s'}</small></div>
      <div className="ev2RailAdjustments"><Field label="Discount %"><input type="number" min="0" max="100" value={discountPercent} onChange={e=>setDiscountPercent(clampPercent(e.target.value))}/></Field><Field label="Tax %"><input type="number" min="0" max="100" value={taxPercent} onChange={e=>setTaxPercent(clampPercent(e.target.value))}/></Field></div>
      <div className="ev2EditorTotals"><div><span>Subtotal</span><b>{money(totals.subtotal,business.currency)}</b></div>{totals.discount>0&&<div><span>Discount</span><b>- {money(totals.discount,business.currency)}</b></div>}{totals.tax>0&&<div><span>Tax</span><b>{money(totals.tax,business.currency)}</b></div>}<div className="grand"><span>Estimate total</span><strong>{money(totals.total,business.currency)}</strong></div></div>
      <div className={`qiHealth ${healthScore===100?'ready':''}`}><div><BadgeCheck/><span><b>Quote health</b><small>{healthScore===100?'Ready to impress':healthScore>=75?'Almost ready':'Needs attention'}</small></span><strong>{healthScore}%</strong></div><i><span style={{width:`${healthScore}%`}}/></i></div>
      <div className="qiMargin"><header><CircleDollarSign/><span><b>Private profit guard</b><small>Never shown to the customer</small></span></header><Field label="Estimated internal cost"><input type="number" min="0" step="0.01" value={internalCost} onChange={event=>setInternalCost(Math.max(0,num(event.target.value)))}/></Field><div><span>Projected gross profit</span><b className={margin<0?'negative':''}>{money(margin,business.currency)}</b></div><div><span>Gross margin</span><strong className={marginPercent<15?'warning':''}>{marginPercent}%</strong></div></div>
      <div className="ev2Readiness"><h3>Ready to send?</h3><p className={customerName.trim()?'done':''}><i>{customerName.trim()?<Check size={12}/>:1}</i>Customer selected</p><p className={project.trim()?'done':''}><i>{project.trim()?<Check size={12}/>:2}</i>Project named</p><p className={validItems.length?'done':''}><i>{validItems.length?<Check size={12}/>:3}</i>Pricing added</p></div>
      <button className="ev2Primary ev2SummaryPreview" onClick={openPreview}><Eye size={18}/>Preview quotation</button>
      {!quick&&<button className="ev2RailSave" onClick={save}><Save size={17}/>Save as draft</button>}
    </aside>
    </div>
  </main>;
}

function Panel({number,title,subtitle,children}:{number:string;title:string;subtitle?:string;children:React.ReactNode}){return <section className="ev2Panel"><header><span>{number}</span><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div></header>{children}</section>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="ev2Field"><span>{label}</span>{children}</label>}
type PrintableQuoteProps={business:Business;quoteNo:string;customer:string;phone:string;email:string;location:string;project:string;reference:string;estimateTrade:string;date:string;validDays:number;items:DraftLine[];notes:string;terms:string;paymentDetails:string;totals:{subtotal:number;discount:number;tax:number;total:number};pricingStyle?:'standard'|'choices';options?:EstimateOption[];depositPercent?:number;preferredStart?:string};
function PrintableQuote({business,quoteNo,customer,phone,email,location,project,reference,estimateTrade,date,validDays,items,notes,terms,paymentDetails,totals,pricingStyle,options,depositPercent,preferredStart}:PrintableQuoteProps){const template=business.documentTemplate||'modern',signer=business.authorizedName||business.name||'Authorised representative',quoteOptions=options||[];return <article className={`ev2Quote printArea document-template document-template--${template}`}><div className="ev2Watermark">{business.logo?<img src={business.logo} alt=""/>:<span>Q</span>}</div><header className="ev2QuoteHeader"><div className="ev2Company">{business.logo?<img src={business.logo} alt="Company logo"/>:<div className="ev2LogoFallback">Q</div>}<div><h2>{business.name||'Your Company'}</h2><p>{business.address||'Business address'}</p><p>{[business.phone,business.email].filter(Boolean).join(' · ')}</p>{business.taxId&&<p>Tax ID: {business.taxId}</p>}</div></div><div className="ev2QuoteTitle"><span>PROFESSIONAL COST ESTIMATE</span><h1>ESTIMATE</h1><strong>{quoteNo}</strong><p>Issued: {prettyDate(date)}</p><p>Valid for: {validDays} days</p></div></header><div className="ev2Accent"/><div className="ev2TradeLabel">{estimateTrade}</div><section className="ev2QuoteMeta"><div><span>PREPARED FOR</span><h3>{customer}</h3>{phone&&<p>{phone}</p>}{email&&<p>{email}</p>}{location&&<p>{location}</p>}</div><div><span>PROJECT / JOB</span><h3>{project}</h3>{reference&&<p>Reference: {reference}</p>}</div></section><div className="ev2TableWrap"><table><thead><tr><th>#</th><th>Item / service description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{items.map((item:DraftLine,index:number)=><tr key={item.id}><td>{String(index+1).padStart(2,'0')}</td><td><b>{item.description}</b>{item.details&&<small>{item.details}</small>}{item.category&&<em>{item.category}</em>}</td><td className="ev2QtyCell">{item.qty}</td><td>{item.unit}</td><td className="ev2MoneyCell">{money(item.rate,business.currency)}</td><td className="ev2MoneyCell"><strong>{money(lineTotal(item),business.currency)}</strong></td></tr>)}</tbody></table></div>{pricingStyle==='choices'&&quoteOptions.length>0&&<section className="qiPrintChoices"><header><span>CHOOSE THE RIGHT FIT</span><h3>Three clear ways to complete your project</h3></header><div>{quoteOptions.map(option=><article className={option.recommended?'recommended':''} key={option.id}>{option.recommended&&<em>RECOMMENDED</em>}<span>{option.tagline}</span><h4>{option.name}</h4><strong>{money(optionTotal(totals.total,option),business.currency)}</strong><p>{option.description}</p><small><BadgeCheck/>{option.warranty}</small></article>)}</div><p className="qiChoiceNote">The itemized schedule above describes the recommended scope. Final specifications are confirmed for the option selected by the client.</p></section>}<section className="ev2Totals"><div><span>Subtotal</span><b>{money(totals.subtotal,business.currency)}</b></div>{totals.discount>0&&<div><span>Discount</span><b>- {money(totals.discount,business.currency)}</b></div>}{totals.tax>0&&<div><span>Tax</span><b>{money(totals.tax,business.currency)}</b></div>}<div className="ev2Grand"><span>{pricingStyle==='choices'?'RECOMMENDED TOTAL':'ESTIMATED TOTAL'}</span><strong>{money(totals.total,business.currency)}</strong></div></section><section className="ev2QuoteDetails"><div><h4>SCOPE OF WORK / NOTES</h4><p>{notes}</p><h4>TERMS & CONDITIONS</h4><p>{terms}</p></div><aside><h4>PAYMENT DETAILS</h4><p>{paymentDetails}</p>{Number(depositPercent)>0&&<p className="qiDepositLine"><b>{depositPercent}% deposit</b> after approval{preferredStart?` · Earliest start ${prettyDate(preferredStart)}`:''}</p>}<div className="ev2Signature"><div>{business.signature?<img src={business.signature} alt="Authorised signature"/>:<strong className="documentTypedSignature">{signer}</strong>}</div><b>{signer}</b><small>{business.authorizedTitle||'Authorised representative'}</small><span>Authorised signature</span></div></aside></section><footer><div><b>Thank you for the opportunity to quote.</b><span>Prepared especially for {customer}.</span></div><small>{quoteNo} · Generated with Quotiq</small></footer></article>}
