'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,ArrowLeft,Boxes,CalendarDays,CheckCircle2,ChevronRight,ClipboardCheck,
  Copy,FileDown,LayoutDashboard,Mail,MessageCircle,PackageCheck,Plus,Printer,RefreshCw,Search,
  ShoppingCart,Sparkles,Truck,X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Business,Expense,InventoryItem,Project,PurchaseOrder,PurchaseOrderLine,StockMovement,Supplier } from '../types';
import { getStored,setStored,uid,uuid } from '../lib/storage';
import { listPurchaseOrders,upsertPurchaseOrder } from '../lib/supabase';

const today=()=>new Date().toISOString().slice(0,10);
const dateAfter=(days:number)=>{const value=new Date();value.setDate(value.getDate()+days);return value.toISOString().slice(0,10)};
const round=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(value||0);
const defaultBusiness:Business={name:'My Business',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'};
const openStatuses=new Set<PurchaseOrder['status']>(['Draft','Ordered','Partially Received']);

function nextOrderNumber(orders:PurchaseOrder[]){
  const year=new Date().getFullYear();
  let max=0;
  for(const order of orders){const match=order.orderNumber.match(/(\d+)$/);if(match)max=Math.max(max,Number(match[1])||0)}
  return`PO-${year}-${String(max+1).padStart(4,'0')}`;
}

function mergeOrder(records:PurchaseOrder[],order:PurchaseOrder){
  return[order,...records.filter(record=>record.id!==order.id)].sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
}

export default function PurchaseOrders({session}:{session:Session|null}){
  const navigate=useNavigate();
  const business=getStored<Business>('q-business',defaultBusiness);
  const suppliers=getStored<Supplier[]>('q-suppliers',[]);
  const inventory=getStored<InventoryItem[]>('q-inventory',[]);
  const projects=getStored<Project[]>('q-projects',[]);
  const[orders,setOrders]=useState<PurchaseOrder[]>(()=>getStored('q-purchase-orders',[]));
  const[selectedId,setSelectedId]=useState(()=>orders[0]?.id||'');
  const[query,setQuery]=useState('');
  const[status,setStatus]=useState<'All'|PurchaseOrder['status']>('All');
  const[composer,setComposer]=useState<'blank'|'reorder'|null>(null);
  const[receiving,setReceiving]=useState(false);
  const[receiveQty,setReceiveQty]=useState<Record<string,number>>({});
  const[notice,setNotice]=useState('');
  const[syncing,setSyncing]=useState(false);

  const persist=(next:PurchaseOrder[])=>{setOrders(next);setStored('q-purchase-orders',next)};
  const selected=orders.find(order=>order.id===selectedId)||orders[0]||null;
  const lowStock=inventory.filter(item=>(item.itemType||'Material')==='Material'&&item.quantity<=item.reorderLevel);
  const dueSoon=orders.filter(order=>openStatuses.has(order.status)&&order.expectedDate&&order.expectedDate<=dateAfter(3)).length;
  const committed=orders.filter(order=>openStatuses.has(order.status)).reduce((sum,order)=>sum+Math.max(0,order.total-order.postedCost),0);
  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return orders.filter(order=>(status==='All'||order.status===status)&&(!term||`${order.orderNumber} ${order.supplierName} ${order.projectName||''} ${order.status}`.toLowerCase().includes(term)));
  },[orders,query,status]);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    const sync=async()=>{
      if(!navigator.onLine)return;
      setSyncing(true);
      try{
        const local=getStored<PurchaseOrder[]>('q-purchase-orders',[]);
        await Promise.all(local.filter(order=>order.sync_state!=='synced').map(order=>upsertPurchaseOrder(order)));
        const cloud=await listPurchaseOrders();
        if(active){persist(cloud);setSelectedId(current=>current||cloud[0]?.id||'');setNotice('Purchase orders are synced securely.')}
      }catch{
        if(active)setNotice('Orders remain saved on this device. Cloud sync will retry when available.');
      }finally{if(active)setSyncing(false)}
    };
    void sync();
    window.addEventListener('online',sync);
    return()=>{active=false;window.removeEventListener('online',sync)};
  },[session]);

  const saveOrder=async(order:PurchaseOrder)=>{
    const local={...order,updated_at:new Date().toISOString(),sync_state:session?'pending':'local'} as PurchaseOrder;
    persist(mergeOrder(orders,local));setSelectedId(local.id);setComposer(null);setNotice(session?'Saved. Secure cloud sync is running.':'Saved on this device. Sign in to sync it securely.');
    if(session&&navigator.onLine){
      try{const synced=await upsertPurchaseOrder(local);persist(mergeOrder(getStored('q-purchase-orders',[]),synced));setNotice('Purchase order saved and synced.')}
      catch{setNotice('Saved on this device. Cloud sync will retry automatically.')}
    }
  };

  const updateOrder=(changes:Partial<PurchaseOrder>)=>{
    if(!selected)return;
    void saveOrder({...selected,...changes});
  };

  const receiveOrder=()=>{
    if(!selected)return;
    const deltas=new Map<string,number>();
    const items=selected.items.map(line=>{
      const outstanding=Math.max(0,line.qty-line.receivedQty);
      const delta=Math.min(outstanding,Math.max(0,Number(receiveQty[line.id])||0));
      if(delta>0)deltas.set(line.id,delta);
      return{...line,receivedQty:round(line.receivedQty+delta)};
    });
    if(!deltas.size){setNotice('Enter at least one received quantity.');return}

    const receivedBase=items.reduce((sum,line)=>sum+line.receivedQty*line.unitCost,0);
    const targetPosted=selected.subtotal>0?round(selected.total*Math.min(1,receivedBase/selected.subtotal)):selected.postedCost;
    const costDelta=round(Math.max(0,targetPosted-selected.postedCost));
    const inventoryNow=getStored<InventoryItem[]>('q-inventory',[]);
    const movements=getStored<StockMovement[]>('q-stock-movements',[]);
    const movementAdditions:StockMovement[]=[];
    const inventoryNext=inventoryNow.map(item=>{
      const receivedLines=selected.items.filter(candidate=>candidate.inventoryId===item.id&&deltas.has(candidate.id));
      if(!receivedLines.length)return item;
      const delta=round(receivedLines.reduce((sum,line)=>sum+(deltas.get(line.id)||0),0));
      const latestCost=receivedLines.find(line=>line.unitCost>0)?.unitCost||item.cost;
      movementAdditions.push({id:uid('MOV'),itemId:item.id,itemName:item.name,date:today(),type:'Stock In',quantity:delta,note:`Received on ${selected.orderNumber}`,supplierId:selected.supplierId});
      return{...item,quantity:round(item.quantity+delta),cost:latestCost,supplierId:selected.supplierId||item.supplierId};
    });
    setStored('q-inventory',inventoryNext);
    setStored('q-stock-movements',[...movementAdditions,...movements]);

    if(costDelta>0){
      const expenses=getStored<Expense[]>('q-expenses',[]);
      setStored('q-expenses',[{id:uid('EXP'),date:today(),category:'Materials / Purchasing',description:`${selected.orderNumber} · ${selected.supplierName}`,projectId:selected.projectId||'',amount:costDelta,paymentMethod:'Purchase order'},...expenses]);
      if(selected.projectId){
        const projectRecords=getStored<Project[]>('q-projects',[]);
        setStored('q-projects',projectRecords.map(project=>project.id===selected.projectId?{
          ...project,spent:round(project.spent+costDelta),activities:[{id:uid('ACT'),date:today(),type:'Purchasing',message:`Received ${selected.orderNumber} · ${money(costDelta,selected.currency)} posted to job cost`},...(project.activities||[])],
        }:project));
      }
    }

    const fullyReceived=items.every(line=>line.receivedQty>=line.qty);
    void saveOrder({...selected,items,postedCost:Math.max(selected.postedCost,targetPosted),status:fullyReceived?'Received':'Partially Received'});
    setReceiveQty({});setReceiving(false);
    setNotice(`${movementAdditions.length} stock item${movementAdditions.length===1?'':'s'} received. ${money(costDelta,selected.currency)} posted once to costs.`);
  };

  const supplierMessage=selected?`${selected.orderNumber} from ${business.name}\nSupplier: ${selected.supplierName}\nItems: ${selected.items.map(line=>`${line.qty} ${line.unit} ${line.description}`).join(', ')}\nTotal: ${money(selected.total,selected.currency)}\nExpected: ${selected.expectedDate||'Please confirm'}`:'';
  const copyMessage=async()=>{await navigator.clipboard.writeText(supplierMessage);setNotice('Supplier order message copied.')};
  const shareWhatsApp=()=>{if(!selected?.supplierPhone)return;let digits=selected.supplierPhone.replace(/\D/g,'');if(digits.startsWith('0'))digits=`233${digits.slice(1)}`;window.open(`https://wa.me/${digits}?text=${encodeURIComponent(supplierMessage)}`,'_blank','noopener,noreferrer')};
  const shareEmail=()=>{if(!selected?.supplierEmail)return;window.location.href=`mailto:${selected.supplierEmail}?subject=${encodeURIComponent(selected.orderNumber)}&body=${encodeURIComponent(supplierMessage)}`};
  const printOrder=()=>{document.body.classList.add('printingPurchaseOrder');const clean=()=>document.body.classList.remove('printingPurchaseOrder');window.addEventListener('afterprint',clean,{once:true});window.print();window.setTimeout(clean,1200)};

  return <main className="poPage">
    <header className="poHero">
      <div><button type="button" onClick={()=>navigate('/')}><ArrowLeft/><LayoutDashboard/>Dashboard</button><span>PURCHASING & SUPPLIERS</span><h1>Purchase orders</h1><p>Order materials, receive stock and keep every supplier cost tied to the right job.</p></div>
      <div className="poHeroActions"><button type="button" onClick={()=>setComposer('reorder')}><Sparkles/>Reorder low stock</button><button type="button" className="poPrimary" onClick={()=>setComposer('blank')}><Plus/>New purchase order</button></div>
    </header>

    <section className="poStats">
      <article><i><ShoppingCart/></i><div><span>Open orders</span><strong>{orders.filter(order=>openStatuses.has(order.status)).length}</strong><small>Draft, ordered or receiving</small></div></article>
      <article><i><CalendarDays/></i><div><span>Due soon</span><strong>{dueSoon}</strong><small>Expected in the next 3 days</small></div></article>
      <article><i><Truck/></i><div><span>Committed spend</span><strong>{money(committed,business.currency)}</strong><small>Not yet posted to expenses</small></div></article>
      <article className={lowStock.length?'poWarning':''}><i><AlertTriangle/></i><div><span>Low stock</span><strong>{lowStock.length}</strong><small>Ready for smart reorder</small></div></article>
    </section>

    <div className="poSyncBar"><span className={session?'cloud':'local'}>{syncing?<RefreshCw className="spin"/>:session?<CheckCircle2/>:<Boxes/>}{syncing?'Syncing purchase orders…':session?'Owner-protected cloud records':'Offline-ready · saved on this device'}</span>{notice&&<p>{notice}</p>}<button type="button" onClick={()=>navigate('/inventory')}><Boxes/>Open inventory</button></div>

    <section className="poWorkspace">
      <aside className="poListPane">
        <div className="poFilters"><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search PO, supplier or project"/></label><select value={status} onChange={event=>setStatus(event.target.value as typeof status)} aria-label="Filter purchase orders by status"><option>All</option><option>Draft</option><option>Ordered</option><option>Partially Received</option><option>Received</option><option>Cancelled</option></select></div>
        <div className="poListCount"><strong>{filtered.length} order{filtered.length===1?'':'s'}</strong><span>Newest first</span></div>
        <div className="poOrderList">{filtered.length?filtered.map(order=><button type="button" key={order.id} className={selected?.id===order.id?'active':''} onClick={()=>{setSelectedId(order.id);setReceiving(false)}}><i className={`status-${order.status.toLowerCase().replaceAll(' ','-')}`}><ShoppingCart/></i><span><small>{order.orderNumber}</small><b>{order.supplierName}</b><em>{order.projectName||'General stock'} · {order.items.length} line{order.items.length===1?'':'s'}</em></span><strong>{money(order.total,order.currency)}<small>{order.status}</small></strong><ChevronRight/></button>):<div className="poEmpty"><ShoppingCart/><h2>No purchase orders found</h2><p>Create a supplier order or let Quotiq prepare one from low stock.</p><button type="button" className="poPrimary" onClick={()=>setComposer('reorder')}><Sparkles/>Start smart reorder</button></div>}</div>
      </aside>

      <section className="poDetailPane">{selected?<>
        <div className="poDetailActions noPrint"><div><button type="button" onClick={copyMessage}><Copy/>Copy</button>{selected.supplierPhone&&<button type="button" onClick={shareWhatsApp}><MessageCircle/>WhatsApp</button>}{selected.supplierEmail&&<button type="button" onClick={shareEmail}><Mail/>Email</button>}</div><div><button type="button" onClick={printOrder}><Printer/>Print / PDF</button>{selected.status==='Draft'&&<button type="button" className="poPrimary" onClick={()=>updateOrder({status:'Ordered'})}><CheckCircle2/>Mark ordered</button>}{!['Received','Cancelled'].includes(selected.status)&&<button type="button" className="poReceiveButton" onClick={()=>setReceiving(value=>!value)}><PackageCheck/>Receive stock</button>}</div></div>
        {receiving&&<section className="poReceivePanel noPrint"><header><div><span>RECEIVING WORKFLOW</span><h3>Post this delivery</h3><p>Only quantities entered below will increase stock and job cost.</p></div><button type="button" aria-label="Close receiving panel" onClick={()=>setReceiving(false)}><X/></button></header><div>{selected.items.map(line=>{const outstanding=Math.max(0,line.qty-line.receivedQty);return <label key={line.id}><span><b>{line.description}</b><small>{line.receivedQty} of {line.qty} received · {outstanding} outstanding</small></span><input type="number" min="0" max={outstanding} step="any" disabled={!outstanding} value={receiveQty[line.id]??''} onChange={event=>setReceiveQty(current=>({...current,[line.id]:Number(event.target.value)}))} placeholder="0"/><em>{line.unit}</em></label>})}</div><footer><p><ClipboardCheck/>A traceable stock movement and expense will be created. Reopening this order cannot post the same quantity twice.</p><button type="button" className="poPrimary" onClick={receiveOrder}><PackageCheck/>Post received stock</button></footer></section>}
        <PurchaseOrderDocument order={selected} business={business}/>
        <div className="poRecordFooter noPrint"><span>Cost posted: <b>{money(selected.postedCost,selected.currency)}</b></span><span>Balance to receive: <b>{money(Math.max(0,selected.total-selected.postedCost),selected.currency)}</b></span>{['Draft','Ordered'].includes(selected.status)&&<button type="button" onClick={()=>updateOrder({status:'Cancelled'})}>Cancel order</button>}</div>
      </>:<div className="poEmpty poDetailEmpty"><FileDown/><h2>Select an order</h2><p>Order details, receiving and print controls will appear here.</p></div>}</section>
    </section>

    {composer&&<PurchaseOrderComposer mode={composer} orderNumber={nextOrderNumber(orders)} suppliers={suppliers} inventory={inventory} projects={projects} business={business} close={()=>setComposer(null)} save={saveOrder}/>} 
  </main>;
}

function PurchaseOrderDocument({order,business}:{order:PurchaseOrder;business:Business}){
  const receivedValue=order.items.reduce((sum,line)=>sum+line.receivedQty*line.unitCost,0);
  return <article className="poPrintSheet">
    <header className="poDocumentHeader"><div className="poDocumentBrand">{business.logo?<img src={business.logo} alt=""/>:<i>{business.name.trim().slice(0,1)||'Q'}</i>}<span><b>{business.name}</b><small>{business.address||business.email||'Contractor operations'}</small></span></div><div><span>PURCHASE ORDER</span><h2>{order.orderNumber}</h2><small>Issued {order.issueDate}</small></div></header>
    <div className="poAccent"/>
    <section className="poParties"><div><span>SUPPLIER</span><h3>{order.supplierName}</h3><p>{order.supplierPhone||'No phone provided'}{order.supplierEmail?<><br/>{order.supplierEmail}</>:null}</p></div><div><span>DELIVER TO</span><h3>{order.deliveryLocation||business.name}</h3><p>{order.projectName?`For job: ${order.projectName}`:'General inventory replenishment'}<br/>Expected: {order.expectedDate||'Please confirm'}</p></div><em className={`status-${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</em></section>
    <div className="poTable" role="table" aria-label="Purchase order items"><div className="poTableHead" role="row"><span>#</span><span>ITEM / MATERIAL</span><span>QTY</span><span>UNIT</span><span>UNIT COST</span><span>LINE TOTAL</span></div>{order.items.map((line,index)=><div className="poTableRow" role="row" key={line.id}><span>{String(index+1).padStart(2,'0')}</span><span><b>{line.description}</b><small>{line.sku||'Supplier specification to be confirmed'}</small>{line.receivedQty>0&&<em>{line.receivedQty} received</em>}</span><span>{line.qty}</span><span>{line.unit}</span><span>{money(line.unitCost,order.currency)}</span><span>{money(line.qty*line.unitCost,order.currency)}</span></div>)}</div>
    <section className="poDocumentBottom"><div><span>ORDER NOTES</span><p>{order.notes||'Please confirm availability, delivery date and any substitutions before dispatch.'}</p><small>Received value: {money(receivedValue,order.currency)}</small></div><div className="poTotals"><p><span>Subtotal</span><b>{money(order.subtotal,order.currency)}</b></p><p><span>Tax ({order.taxPercent}%)</span><b>{money(order.subtotal*order.taxPercent/100,order.currency)}</b></p><p><span>Delivery / shipping</span><b>{money(order.shipping,order.currency)}</b></p><strong><span>ORDER TOTAL</span><b>{money(order.total,order.currency)}</b></strong></div></section>
    <footer className="poDocumentFooter"><div><b>Authorised by</b><span>{business.authorizedName||business.name||'Authorised representative'}</span><small>{business.authorizedTitle||'Owner / Manager'}</small></div><p>{business.phone||business.email||'Generated with Quotiq'}<br/><b>Thank you for supplying our team.</b></p></footer>
  </article>;
}

function PurchaseOrderComposer({mode,orderNumber,suppliers,inventory,projects,business,close,save}:{mode:'blank'|'reorder';orderNumber:string;suppliers:Supplier[];inventory:InventoryItem[];projects:Project[];business:Business;close:()=>void;save:(order:PurchaseOrder)=>void}){
  const lowStock=inventory.filter(item=>(item.itemType||'Material')==='Material'&&item.quantity<=item.reorderLevel);
  const initialSupplierId=mode==='reorder'?(lowStock.find(item=>item.supplierId)?.supplierId||''):'';
  const initialSupplier=suppliers.find(supplier=>supplier.id===initialSupplierId);
  const blankLine=():PurchaseOrderLine=>({id:uid('POL'),description:'',qty:1,receivedQty:0,unit:'pcs',unitCost:0});
  const reorderLines=(supplierId:string)=>{
    const candidates=supplierId?lowStock.filter(item=>item.supplierId===supplierId):lowStock;
    return candidates.map((item):PurchaseOrderLine=>({id:uid('POL'),inventoryId:item.id,description:item.name,sku:item.sku,qty:Math.max(1,item.reorderLevel*2-item.quantity),receivedQty:0,unit:item.unit,unitCost:item.cost}));
  };
  const[supplierId,setSupplierId]=useState(initialSupplierId);
  const[supplierName,setSupplierName]=useState(initialSupplier?.name||'');
  const[supplierPhone,setSupplierPhone]=useState(initialSupplier?.phone||'');
  const[supplierEmail,setSupplierEmail]=useState(initialSupplier?.email||'');
  const[projectId,setProjectId]=useState('');
  const[issueDate,setIssueDate]=useState(today());
  const[expectedDate,setExpectedDate]=useState(dateAfter(7));
  const[deliveryLocation,setDeliveryLocation]=useState(business.address||'');
  const[notes,setNotes]=useState('Please confirm stock availability and delivery schedule before dispatch.');
  const[taxPercent,setTaxPercent]=useState(0);
  const[shipping,setShipping]=useState(0);
  const[lines,setLines]=useState<PurchaseOrderLine[]>(()=>mode==='reorder'&&reorderLines(initialSupplierId).length?reorderLines(initialSupplierId):[blankLine()]);
  const[error,setError]=useState('');
  const subtotal=round(lines.reduce((sum,line)=>sum+Math.max(0,line.qty)*Math.max(0,line.unitCost),0));
  const total=round(subtotal+subtotal*Math.max(0,taxPercent)/100+Math.max(0,shipping));

  const selectSupplier=(id:string)=>{const supplier=suppliers.find(candidate=>candidate.id===id);setSupplierId(id);if(supplier){setSupplierName(supplier.name);setSupplierPhone(supplier.phone);setSupplierEmail(supplier.email||'')}};
  const selectInventory=(lineId:string,itemId:string)=>{const item=inventory.find(candidate=>candidate.id===itemId);setLines(current=>current.map(line=>line.id!==lineId?line:item?{...line,inventoryId:item.id,description:item.name,sku:item.sku,unit:item.unit,unitCost:item.cost}:{...line,inventoryId:undefined}))};
  const updateLine=(lineId:string,changes:Partial<PurchaseOrderLine>)=>setLines(current=>current.map(line=>line.id===lineId?{...line,...changes}:line));
  const loadLowStock=()=>{const suggested=reorderLines(supplierId);if(!suggested.length){setError(supplierId?'This supplier has no assigned low-stock items.':'No low-stock materials are available.');return}setLines(suggested);setError('')};
  const submit=()=>{
    const cleanLines=lines.map(line=>({...line,description:line.description.trim(),qty:Math.max(0,Number(line.qty)||0),unitCost:Math.max(0,Number(line.unitCost)||0),unit:line.unit.trim()||'pcs'})).filter(line=>line.description&&line.qty>0);
    if(supplierName.trim().length<2){setError('Add or select a supplier.');return}
    if(!cleanLines.length){setError('Add at least one material with a quantity.');return}
    const project=projects.find(candidate=>candidate.id===projectId);
    save({id:uuid(),orderNumber,supplierId:supplierId||undefined,supplierName:supplierName.trim(),supplierPhone:supplierPhone.trim()||undefined,supplierEmail:supplierEmail.trim()||undefined,projectId:project?.id,projectName:project?.name,issueDate,expectedDate:expectedDate||undefined,currency:business.currency||'GHS',status:'Draft',items:cleanLines,subtotal,taxPercent:Math.max(0,taxPercent),shipping:Math.max(0,shipping),total,postedCost:0,deliveryLocation:deliveryLocation.trim()||undefined,notes:notes.trim()||undefined,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),sync_state:'local'});
  };

  return <div className="poOverlay" role="dialog" aria-modal="true" aria-labelledby="poComposerTitle"><button type="button" className="poBackdrop" onClick={close} aria-label="Close purchase order builder"/><section className="poComposer"><header><div><span>{mode==='reorder'?'SMART REORDER':'NEW PURCHASE ORDER'}</span><h2 id="poComposerTitle">{orderNumber}</h2><p>{mode==='reorder'?'Quotiq has prepared realistic reorder quantities from your stock levels.':'Build a clear, supplier-ready material order.'}</p></div><button type="button" onClick={close} aria-label="Close"><X/></button></header>
    <div className="poComposerBody">
      {mode==='reorder'&&<div className="poReorderBanner"><Sparkles/><div><b>{lowStock.length} low-stock material{lowStock.length===1?'':'s'} detected</b><span>Suggested quantity restores each item to twice its reorder level.</span></div><button type="button" onClick={loadLowStock}>Reload suggestions</button></div>}
      <section className="poFormSection"><div className="poSectionTitle"><span>01</span><div><h3>Supplier & delivery</h3><p>Use a saved contact or type a one-time supplier.</p></div></div><div className="poFormGrid"><label>Saved supplier<select value={supplierId} onChange={event=>selectSupplier(event.target.value)}><option value="">Select or enter manually</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Supplier name *<input value={supplierName} onChange={event=>setSupplierName(event.target.value)} placeholder="Supplier or merchant"/></label><label>Phone<input inputMode="tel" value={supplierPhone} onChange={event=>setSupplierPhone(event.target.value)} placeholder="For WhatsApp ordering"/></label><label>Email<input type="email" value={supplierEmail} onChange={event=>setSupplierEmail(event.target.value)} placeholder="purchasing@supplier.com"/></label><label>Project / job<select value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="">General inventory</option>{projects.filter(project=>project.status!=='Completed').map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Deliver to<input value={deliveryLocation} onChange={event=>setDeliveryLocation(event.target.value)} placeholder="Warehouse, office or job site"/></label><label>Issue date<input type="date" value={issueDate} onChange={event=>setIssueDate(event.target.value)}/></label><label>Expected date<input type="date" min={issueDate} value={expectedDate} onChange={event=>setExpectedDate(event.target.value)}/></label></div></section>
      <section className="poFormSection"><div className="poSectionTitle"><span>02</span><div><h3>Materials & cost</h3><p>Every line keeps its own quantity, unit and price.</p></div><button type="button" onClick={()=>setLines(current=>[...current,blankLine()])}><Plus/>Add line</button></div><div className="poLineEditor"><div className="poLineHead"><span>ITEM / MATERIAL</span><span>QTY</span><span>UNIT</span><span>UNIT COST</span><span>TOTAL</span><span/></div>{lines.map((line,index)=><div className="poLineEdit" key={line.id}><div><small>ITEM {String(index+1).padStart(2,'0')}</small><select value={line.inventoryId||''} onChange={event=>selectInventory(line.id,event.target.value)}><option value="">Custom material</option>{inventory.filter(item=>(item.itemType||'Material')==='Material').map(item=><option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit}</option>)}</select><input value={line.description} onChange={event=>updateLine(line.id,{description:event.target.value})} placeholder="Material description"/></div><label><span>Qty</span><input type="number" min="0" step="any" value={line.qty} onChange={event=>updateLine(line.id,{qty:Number(event.target.value)})}/></label><label><span>Unit</span><input value={line.unit} onChange={event=>updateLine(line.id,{unit:event.target.value})}/></label><label><span>Unit cost</span><input type="number" min="0" step="any" value={line.unitCost} onChange={event=>updateLine(line.id,{unitCost:Number(event.target.value)})}/></label><strong>{money(line.qty*line.unitCost,business.currency)}</strong><button type="button" disabled={lines.length===1} onClick={()=>setLines(current=>current.filter(candidate=>candidate.id!==line.id))} aria-label={`Remove ${line.description||`item ${index+1}`}`}><X/></button></div>)}</div></section>
      <section className="poFormSection poTermsSection"><div className="poSectionTitle"><span>03</span><div><h3>Totals & instructions</h3><p>Confirm delivery cost, tax and supplier notes.</p></div></div><div className="poFormGrid"><label>Tax %<input type="number" min="0" max="100" step="any" value={taxPercent} onChange={event=>setTaxPercent(Number(event.target.value))}/></label><label>Delivery / shipping<input type="number" min="0" step="any" value={shipping} onChange={event=>setShipping(Number(event.target.value))}/></label><label className="full">Order notes<textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)}/></label></div><div className="poLiveTotal"><span>LIVE ORDER TOTAL</span><strong>{money(total,business.currency)}</strong><small>{lines.filter(line=>line.description&&line.qty>0).length} priced line{lines.filter(line=>line.description&&line.qty>0).length===1?'':'s'}</small></div></section>
      {error&&<p className="poFormError"><AlertTriangle/>{error}</p>}
    </div><footer><button type="button" onClick={close}>Cancel</button><button type="button" className="poPrimary" onClick={submit}><ShoppingCart/>Save purchase order</button></footer>
  </section></div>;
}
