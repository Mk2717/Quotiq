import { createClient, type Session } from '@supabase/supabase-js';
import type { BookingPage,Business,ClientCommunication,ClientMessageTemplate,CommunicationStatus,Customer,Estimate,Invoice,Project,InventoryItem,Expense,TeamMember,ServiceLead,LeadStatus,LeadUrgency,WorkforceTimeEntry,PurchaseOrder,PurchaseOrderLine,SiteMeasurement,MapPoint,ServiceAgreement,ServiceAsset,ServiceVisit } from '../types';
const url=(import.meta.env.VITE_SUPABASE_URL as string|undefined)||'https://htduwihggkgzxohqvszt.supabase.co';
const anonKey=(import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined)||'sb_publishable_AaTYc1vyA6au6jEBjxvI-A_bU9EBxrL';
const liveAppUrl='https://quotiq-app.mikeezym.chatgpt.site';
export const cloudConfigured=Boolean(url&&anonKey);export const supabase=cloudConfigured?createClient(url!,anonKey!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
export type WorkspaceSnapshot={business:Business;customers:Customer[];estimates:Estimate[];invoices:Invoice[];projects:Project[];inventory:InventoryItem[];expenses:Expense[];team:TeamMember[];updated_at?:string};
export async function getSession():Promise<Session|null>{if(!supabase)return null;const{data,error}=await supabase.auth.getSession();if(error)throw error;return data.session}
export async function signIn(email:string,password:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}
export function getAppRedirectUrl(){
  if(typeof window==='undefined')return liveAppUrl;
  const {hostname,origin,protocol}=window.location;
  return protocol==='https:'&&hostname.endsWith('.chatgpt.site')?origin:liveAppUrl;
}
export async function signUp(email:string,password:string){if(!supabase)throw new Error('Supabase is not configured.');const{data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:getAppRedirectUrl()}});if(error)throw error;return data.session}
export async function resendSignupConfirmation(email:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.resend({type:'signup',email,options:{emailRedirectTo:getAppRedirectUrl()}});if(error)throw error}
export type SocialProvider='google'|'azure'|'apple';
export async function getSocialProviders():Promise<Record<SocialProvider,boolean>>{const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:anonKey!}});if(!response.ok)throw new Error('Unable to check social sign-in availability.');const settings=await response.json();return{google:Boolean(settings.external?.google),azure:Boolean(settings.external?.azure),apple:Boolean(settings.external?.apple)}}
export async function signInWithProvider(provider:SocialProvider){if(!supabase)throw new Error('Supabase is not configured.');const{data,error}=await supabase.auth.signInWithOAuth({provider,options:{skipBrowserRedirect:true,redirectTo:getAppRedirectUrl(),...(provider==='azure'?{scopes:'openid email profile'}:{})}});if(error)throw error;if(!data.url)throw new Error('The sign-in provider did not return a secure login address.');window.location.assign(data.url)}
export async function resetPassword(email:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:getAppRedirectUrl()});if(error)throw error}
export async function updatePassword(password:string){if(!supabase)throw new Error('Supabase is not configured.');const{error}=await supabase.auth.updateUser({password});if(error)throw error}
export async function signOut(){if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)throw error}
export async function loadWorkspace(userId:string):Promise<WorkspaceSnapshot|null>{if(!supabase)return null;const{data,error}=await supabase.from('workspace_snapshots').select('business,customers,estimates,invoices,projects,inventory,expenses,team,updated_at').eq('user_id',userId).maybeSingle();if(error)throw error;return data as WorkspaceSnapshot|null}
export async function saveWorkspace(userId:string,snapshot:WorkspaceSnapshot){if(!supabase)return;const{error}=await supabase.from('workspace_snapshots').upsert({user_id:userId,...snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error}

export type ClientPortalStatus='pending'|'accepted'|'changes_requested'|'declined'|'expired'|'revoked';
export type ClientPortalRecord={
  id:string;
  estimate_id?:string;
  estimate_number:string;
  customer_name:string;
  customer_email?:string|null;
  project_name:string;
  currency:string;
  total:number;
  deposit_percent:number;
  estimate_payload:{
    estimate:Estimate;
    customer:{name:string;phone:string;email:string;location:string};
    totals:{subtotal:number;discount:number;tax:number;total:number};
  };
  business_payload:Pick<Business,'name'|'email'|'phone'|'address'|'taxId'|'currency'|'logo'|'signature'|'authorizedName'|'authorizedTitle'|'documentTemplate'>;
  status:ClientPortalStatus;
  response_name?:string|null;
  response_email?:string|null;
  response_message?:string|null;
  signature_text?:string|null;
  responded_at?:string|null;
  expires_at:string;
  last_viewed_at?:string|null;
  view_count?:number;
  created_at:string;
  updated_at:string;
  share_token_hash?:string;
};

type StoredPortalToken={portalId:string;token:string};
type StoredPortalTokens=Record<string,StoredPortalToken>;
const portalTokenStorageKey='q-client-portal-tokens';

function readPortalTokens():StoredPortalTokens{
  if(typeof window==='undefined')return{};
  try{return JSON.parse(localStorage.getItem(portalTokenStorageKey)||'{}') as StoredPortalTokens}catch{return{}}
}
function rememberPortalToken(estimateId:string,value:StoredPortalToken){
  if(typeof window==='undefined')return;
  const tokens=readPortalTokens();tokens[estimateId]=value;
  localStorage.setItem(portalTokenStorageKey,JSON.stringify(tokens));
}
function forgetPortalToken(estimateId:string){
  if(typeof window==='undefined')return;
  const tokens=readPortalTokens();delete tokens[estimateId];
  localStorage.setItem(portalTokenStorageKey,JSON.stringify(tokens));
}
function randomPortalToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  let binary='';bytes.forEach(byte=>{binary+=String.fromCharCode(byte)});
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
async function hashPortalToken(token:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function getStoredPortalLink(estimateId:string,portalId?:string){
  const stored=readPortalTokens()[estimateId];
  if(!stored||portalId&&stored.portalId!==portalId)return'';
  return `${getAppRedirectUrl()}/#/approve/${stored.token}`;
}
export async function getPortalForEstimate(estimateId:string):Promise<ClientPortalRecord|null>{
  if(!supabase)return null;
  const{data,error}=await supabase.from('client_portals').select('*').eq('estimate_id',estimateId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;return data as ClientPortalRecord|null;
}
export async function createEstimatePortal(args:{
  estimate:Estimate;
  business:Business;
  customer:Customer|undefined;
  totals:{subtotal:number;discount:number;tax:number;total:number};
  depositPercent:number;
}){
  if(!supabase)throw new Error('Cloud approval is not configured.');
  const{data:{session},error:sessionError}=await supabase.auth.getSession();
  if(sessionError)throw sessionError;if(!session)throw new Error('Sign in to create a secure approval link.');
  const{estimate,business,customer,totals}=args;
  const{data:active,error:activeError}=await supabase.from('client_portals').select('*').eq('estimate_id',estimate.id).in('status',['pending','changes_requested']).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(activeError)throw activeError;
  const stored=readPortalTokens()[estimate.id];
  if(active&&stored?.portalId===active.id&&active.share_token_hash===await hashPortalToken(stored.token)){
    return{portal:active as ClientPortalRecord,link:`${getAppRedirectUrl()}/#/approve/${stored.token}`,reused:true};
  }
  if(active){
    const{error}=await supabase.from('client_portals').update({status:'revoked',updated_at:new Date().toISOString()}).eq('id',active.id);
    if(error)throw error;
  }
  const token=randomPortalToken(),shareTokenHash=await hashPortalToken(token);
  const validDays=Math.min(365,Math.max(1,Number(estimate.validDays)||14));
  const expiry=new Date();expiry.setDate(expiry.getDate()+validDays);
  const depositPercent=Math.min(100,Math.max(0,Number(args.depositPercent)||0));
  const estimatePayload={
    estimate:{...estimate,amount:totals.total},
    customer:{name:estimate.customer,phone:customer?.phone||'',email:customer?.email||'',location:customer?.siteAddress||customer?.address||''},
    totals,
  };
  const businessPayload={name:business.name,email:business.email,phone:business.phone,address:business.address,taxId:business.taxId,currency:business.currency,logo:business.logo,signature:business.signature,authorizedName:business.authorizedName,authorizedTitle:business.authorizedTitle,documentTemplate:business.documentTemplate||'modern'};
  const{data,error}=await supabase.from('client_portals').insert({
    owner_id:session.user.id,
    estimate_id:estimate.id,
    estimate_number:estimate.id,
    customer_id:estimate.customerId||null,
    customer_name:estimate.customer,
    customer_email:customer?.email||null,
    project_name:estimate.project,
    currency:business.currency||'GHS',
    total:totals.total,
    deposit_percent:depositPercent,
    share_token_hash:shareTokenHash,
    estimate_payload:estimatePayload,
    business_payload:businessPayload,
    status:'pending',
    expires_at:expiry.toISOString(),
  }).select('*').single();
  if(error)throw error;
  rememberPortalToken(estimate.id,{portalId:data.id,token});
  return{portal:data as ClientPortalRecord,link:`${getAppRedirectUrl()}/#/approve/${token}`,reused:false};
}
export async function revokeEstimatePortal(portal:ClientPortalRecord){
  if(!supabase)throw new Error('Cloud approval is not configured.');
  const{error}=await supabase.from('client_portals').update({status:'revoked',updated_at:new Date().toISOString()}).eq('id',portal.id);
  if(error)throw error;if(portal.estimate_id)forgetPortalToken(portal.estimate_id);
}
type PortalFunctionError=Error&{portal?:ClientPortalRecord};
async function callPortalFunction(body:Record<string,unknown>):Promise<ClientPortalRecord>{
  const response=await fetch(`${url}/functions/v1/client-approval`,{method:'POST',headers:{'Content-Type':'application/json',apikey:anonKey!},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({error:'The approval service returned an invalid response.'}));
  if(!response.ok){const error=new Error(payload.error||'The approval request failed.') as PortalFunctionError;if(payload.portal)error.portal=payload.portal;throw error}
  return payload.portal as ClientPortalRecord;
}
export function loadPublicClientPortal(token:string){return callPortalFunction({action:'view',token})}
export function submitClientPortalResponse(args:{token:string;action:'accept'|'request_changes'|'decline';name:string;email:string;message:string;consent:boolean}){return callPortalFunction(args)}

export const defaultBookingServices=[
  'Electrical','Security / CCTV','Solar','Starlink / Networking','Plumbing','HVAC',
  'Construction / Building','Painting','Roofing','Cleaning / Maintenance','Other',
];
const bookingPageColumns='id,owner_id,slug,business_name,business_phone,business_email,service_area,welcome_message,services,accent_color,active,created_at,updated_at';
const publicBookingPageColumns='id,slug,business_name,business_phone,business_email,service_area,welcome_message,services,accent_color,active';
const serviceLeadColumns='id,owner_id,booking_page_id,source,customer_name,phone,email,service_type,site_address,preferred_date,preferred_time,budget_range,urgency,details,status,follow_up_at,internal_notes,created_at,updated_at';

function randomBookingSlug(){
  const bytes=crypto.getRandomValues(new Uint8Array(10));
  return`q-${Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}

async function requireCloudUser(){
  if(!supabase)throw new Error('Cloud booking is not configured.');
  const{data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;if(!session)throw new Error('Sign in to manage booking requests.');
  return session.user;
}

export async function getOrCreateBookingPage(business:Business):Promise<BookingPage>{
  const user=await requireCloudUser();
  const{data:existing,error:lookupError}=await supabase!.from('booking_pages').select(bookingPageColumns).eq('owner_id',user.id).maybeSingle();
  if(lookupError)throw lookupError;if(existing)return existing as BookingPage;
  const record={
    owner_id:user.id,
    slug:randomBookingSlug(),
    business_name:(business.name||'My Business').trim().slice(0,160),
    business_phone:null,
    business_email:null,
    service_area:null,
    welcome_message:'Tell us about the work you need and we will contact you with the next steps.',
    services:defaultBookingServices,
    accent_color:'#2563eb',
    active:true,
  };
  const{data,error}=await supabase!.from('booking_pages').insert(record).select(bookingPageColumns).single();
  if(!error)return data as BookingPage;
  if(error.code==='23505'){
    const{data:concurrent,error:retryError}=await supabase!.from('booking_pages').select(bookingPageColumns).eq('owner_id',user.id).maybeSingle();
    if(retryError)throw retryError;if(concurrent)return concurrent as BookingPage;
  }
  throw error;
}

export async function updateBookingPage(page:BookingPage):Promise<BookingPage>{
  await requireCloudUser();
  const update={
    business_name:page.business_name.trim().slice(0,160),
    business_phone:page.business_phone?.trim().slice(0,80)||null,
    business_email:page.business_email?.trim().slice(0,180)||null,
    service_area:page.service_area?.trim().slice(0,240)||null,
    welcome_message:page.welcome_message.trim().slice(0,500),
    services:page.services.map(value=>value.trim().slice(0,120)).filter(Boolean).slice(0,30),
    accent_color:page.accent_color,
    active:page.active,
    updated_at:new Date().toISOString(),
  };
  if(update.business_name.length<2)throw new Error('Enter a business name.');
  if(update.welcome_message.length<10)throw new Error('Add a slightly longer welcome message.');
  if(!update.services.length)throw new Error('Keep at least one service available.');
  const{data,error}=await supabase!.from('booking_pages').update(update).eq('id',page.id).select(bookingPageColumns).single();
  if(error)throw error;return data as BookingPage;
}

export async function listServiceLeads():Promise<ServiceLead[]>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('service_leads').select(serviceLeadColumns).order('created_at',{ascending:false});
  if(error)throw error;return(data||[]) as ServiceLead[];
}

export async function createManualServiceLead(pageId:string,args:{
  customerName:string;phone:string;email:string;serviceType:string;siteAddress:string;
  preferredDate?:string;preferredTime?:string;budgetRange?:string;urgency:LeadUrgency;details?:string;
}):Promise<ServiceLead>{
  const user=await requireCloudUser();
  const followUpAt=new Date(Date.now()+24*60*60_000).toISOString();
  const{data,error}=await supabase!.from('service_leads').insert({
    owner_id:user.id,booking_page_id:pageId,source:'manual',customer_name:args.customerName.trim(),
    phone:args.phone.trim()||null,email:args.email.trim().toLowerCase()||null,service_type:args.serviceType,
    site_address:args.siteAddress.trim(),preferred_date:args.preferredDate||null,preferred_time:args.preferredTime||null,
    budget_range:args.budgetRange||null,urgency:args.urgency,details:args.details?.trim()||null,
    status:'new',follow_up_at:followUpAt,
  }).select(serviceLeadColumns).single();
  if(error)throw error;return data as ServiceLead;
}

export async function updateServiceLead(id:string,changes:Partial<Pick<ServiceLead,'status'|'follow_up_at'|'internal_notes'|'customer_name'|'phone'|'email'|'service_type'|'site_address'|'preferred_date'|'preferred_time'|'budget_range'|'urgency'|'details'>>):Promise<ServiceLead>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('service_leads').update({...changes,updated_at:new Date().toISOString()}).eq('id',id).select(serviceLeadColumns).single();
  if(error)throw error;return data as ServiceLead;
}

export function getBookingShareUrl(slug:string){return`${getAppRedirectUrl()}/#/book/${slug}`}

async function callBookingFunction(body:Record<string,unknown>){
  const response=await fetch(`${url}/functions/v1/service-booking`,{method:'POST',headers:{'Content-Type':'application/json',apikey:anonKey!},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({error:'The booking service returned an invalid response.'}));
  if(!response.ok)throw new Error(payload.error||'The booking request failed.');
  return payload;
}

export async function loadPublicBookingPage(slug:string):Promise<BookingPage>{
  const payload=await callBookingFunction({action:'page',slug});
  const page=payload.page as BookingPage;
  const safe:BookingPage={...page,services:Array.isArray(page?.services)?page.services:[],business_phone:page?.business_phone||null,business_email:page?.business_email||null,service_area:page?.service_area||null};
  return Object.fromEntries(Object.entries(safe).filter(([key])=>publicBookingPageColumns.split(',').includes(key))) as BookingPage;
}

export async function submitPublicBookingRequest(args:{slug:string;customerName:string;phone:string;email:string;serviceType:string;siteAddress:string;preferredDate:string;preferredTime:string;budgetRange:string;urgency:LeadUrgency;details:string;website?:string}){
  return callBookingFunction({action:'submit',...args});
}

export const leadStatusLabels:Record<LeadStatus,string>={new:'New',contacted:'Contacted',site_visit:'Site visit',quoted:'Quoted',won:'Won',lost:'Lost'};

const communicationColumns='id,owner_id,customer_id,customer_name,channel,direction,subject,body,status,occurred_at,follow_up_at,follow_up_completed_at,related_type,related_id,created_at,updated_at';
const messageTemplateColumns='id,owner_id,name,channel,subject,body,active,created_at,updated_at';

export async function listClientCommunications():Promise<ClientCommunication[]>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('client_communications').select(communicationColumns).order('occurred_at',{ascending:false}).limit(1200);
  if(error)throw error;return(data||[]) as ClientCommunication[];
}

export async function upsertClientCommunication(record:ClientCommunication):Promise<ClientCommunication>{
  const user=await requireCloudUser();
  const payload={
    id:record.id,owner_id:user.id,customer_id:record.customer_id.slice(0,120),customer_name:record.customer_name.slice(0,180),
    channel:record.channel,direction:record.direction,subject:record.subject?.slice(0,240)||null,body:record.body.trim().slice(0,5000),
    status:record.status,occurred_at:record.occurred_at,follow_up_at:record.follow_up_at,follow_up_completed_at:record.follow_up_completed_at,
    related_type:record.related_type,related_id:record.related_id?.slice(0,160)||null,updated_at:new Date().toISOString(),
  };
  if(!payload.body)throw new Error('Add a message or contact note.');
  const{data,error}=await supabase!.from('client_communications').upsert(payload,{onConflict:'id'}).select(communicationColumns).single();
  if(error)throw error;return data as ClientCommunication;
}

export async function updateClientCommunication(id:string,changes:Partial<Pick<ClientCommunication,'status'|'follow_up_at'|'follow_up_completed_at'|'body'|'subject'>>):Promise<ClientCommunication>{
  await requireCloudUser();
  const update={...changes,updated_at:new Date().toISOString()};
  const{data,error}=await supabase!.from('client_communications').update(update).eq('id',id).select(communicationColumns).single();
  if(error)throw error;return data as ClientCommunication;
}

export async function setClientCommunicationStatus(id:string,status:CommunicationStatus){
  return updateClientCommunication(id,{status});
}

export async function listClientMessageTemplates():Promise<ClientMessageTemplate[]>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('client_message_templates').select(messageTemplateColumns).eq('active',true).order('updated_at',{ascending:false});
  if(error)throw error;return(data||[]) as ClientMessageTemplate[];
}

export async function upsertClientMessageTemplate(template:ClientMessageTemplate):Promise<ClientMessageTemplate>{
  const user=await requireCloudUser();
  const payload={id:template.id,owner_id:user.id,name:template.name.trim().slice(0,100),channel:template.channel,subject:template.subject?.trim().slice(0,240)||null,body:template.body.trim().slice(0,3000),active:template.active,updated_at:new Date().toISOString()};
  if(payload.name.length<2||payload.body.length<5)throw new Error('Add a template name and message.');
  const{data,error}=await supabase!.from('client_message_templates').upsert(payload,{onConflict:'id'}).select(messageTemplateColumns).single();
  if(error)throw error;return data as ClientMessageTemplate;
}

const workforceTimeColumns='id,owner_id,member_id,member_name,project_id,project_name,clock_in,clock_out,break_started_at,break_minutes,hourly_rate,status,note,created_at,updated_at';

export async function listWorkforceTimeEntries():Promise<WorkforceTimeEntry[]>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('workforce_time_entries').select(workforceTimeColumns).order('clock_in',{ascending:false}).limit(2500);
  if(error)throw error;return(data||[]) as WorkforceTimeEntry[];
}

export async function upsertWorkforceTimeEntry(entry:WorkforceTimeEntry):Promise<WorkforceTimeEntry>{
  const user=await requireCloudUser();
  const payload={
    id:entry.id,owner_id:user.id,member_id:entry.member_id.slice(0,120),member_name:entry.member_name.trim().slice(0,180),
    project_id:entry.project_id?.slice(0,160)||null,project_name:entry.project_name?.slice(0,240)||null,
    clock_in:entry.clock_in,clock_out:entry.clock_out,break_started_at:entry.break_started_at,
    break_minutes:Math.max(0,Math.min(10080,Math.round(entry.break_minutes||0))),
    hourly_rate:Math.max(0,Math.min(100000000,Number(entry.hourly_rate)||0)),status:entry.status,
    note:entry.note?.trim().slice(0,1200)||null,updated_at:new Date().toISOString(),
  };
  if(payload.member_name.length<2)throw new Error('Add the team member name before saving time.');
  const{data,error}=await supabase!.from('workforce_time_entries').upsert(payload,{onConflict:'id'}).select(workforceTimeColumns).single();
  if(error)throw error;return data as WorkforceTimeEntry;
}

const purchaseOrderColumns='id,owner_id,order_number,supplier_id,supplier_name,supplier_phone,supplier_email,project_id,project_name,issue_date,expected_date,currency,status,items,subtotal,tax_percent,shipping,total,posted_cost,delivery_location,notes,created_at,updated_at';

type PurchaseOrderRow={
  id:string;owner_id:string;order_number:string;supplier_id:string|null;supplier_name:string;
  supplier_phone:string|null;supplier_email:string|null;project_id:string|null;project_name:string|null;
  issue_date:string;expected_date:string|null;currency:string;status:PurchaseOrder['status'];items:PurchaseOrderLine[];
  subtotal:number|string;tax_percent:number|string;shipping:number|string;total:number|string;posted_cost:number|string;
  delivery_location:string|null;notes:string|null;created_at:string;updated_at:string;
};

function purchaseOrderFromRow(row:PurchaseOrderRow):PurchaseOrder{
  return{
    id:row.id,owner_id:row.owner_id,orderNumber:row.order_number,supplierId:row.supplier_id||undefined,
    supplierName:row.supplier_name,supplierPhone:row.supplier_phone||undefined,supplierEmail:row.supplier_email||undefined,
    projectId:row.project_id||undefined,projectName:row.project_name||undefined,issueDate:row.issue_date,
    expectedDate:row.expected_date||undefined,currency:row.currency,status:row.status,
    items:Array.isArray(row.items)?row.items:[],subtotal:Number(row.subtotal)||0,taxPercent:Number(row.tax_percent)||0,
    shipping:Number(row.shipping)||0,total:Number(row.total)||0,postedCost:Number(row.posted_cost)||0,
    deliveryLocation:row.delivery_location||undefined,notes:row.notes||undefined,created_at:row.created_at,
    updated_at:row.updated_at,sync_state:'synced',
  };
}

export async function listPurchaseOrders():Promise<PurchaseOrder[]>{
  await requireCloudUser();
  const{data,error}=await supabase!.from('purchase_orders').select(purchaseOrderColumns).order('updated_at',{ascending:false}).limit(1500);
  if(error)throw error;return((data||[]) as PurchaseOrderRow[]).map(purchaseOrderFromRow);
}

export async function upsertPurchaseOrder(order:PurchaseOrder):Promise<PurchaseOrder>{
  const user=await requireCloudUser();
  const items=order.items.slice(0,250).map(line=>({
    id:line.id,inventoryId:line.inventoryId?.slice(0,160),description:line.description.trim().slice(0,500),
    sku:line.sku?.trim().slice(0,120),qty:Math.max(0,Math.min(1000000,Number(line.qty)||0)),
    receivedQty:Math.max(0,Math.min(Number(line.qty)||0,Number(line.receivedQty)||0)),unit:line.unit.trim().slice(0,40),
    unitCost:Math.max(0,Math.min(1000000000,Number(line.unitCost)||0)),
  })).filter(line=>line.description&&line.qty>0);
  if(!items.length)throw new Error('Add at least one purchase-order item.');
  const payload={
    id:order.id,owner_id:user.id,order_number:order.orderNumber.trim().slice(0,80),
    supplier_id:order.supplierId?.slice(0,120)||null,supplier_name:order.supplierName.trim().slice(0,180),
    supplier_phone:order.supplierPhone?.trim().slice(0,80)||null,supplier_email:order.supplierEmail?.trim().toLowerCase().slice(0,180)||null,
    project_id:order.projectId?.slice(0,160)||null,project_name:order.projectName?.trim().slice(0,240)||null,
    issue_date:order.issueDate,expected_date:order.expectedDate||null,currency:order.currency.slice(0,8),status:order.status,
    items,subtotal:Math.max(0,order.subtotal),tax_percent:Math.max(0,Math.min(100,order.taxPercent)),
    shipping:Math.max(0,order.shipping),total:Math.max(0,order.total),posted_cost:Math.max(0,order.postedCost),
    delivery_location:order.deliveryLocation?.trim().slice(0,500)||null,notes:order.notes?.trim().slice(0,3000)||null,
    updated_at:new Date().toISOString(),
  };
  if(payload.order_number.length<3||payload.supplier_name.length<2)throw new Error('Add a supplier and purchase-order number.');
  const{data,error}=await supabase!.from('purchase_orders').upsert(payload,{onConflict:'id'}).select(purchaseOrderColumns).single();
  if(error)throw error;return purchaseOrderFromRow(data as PurchaseOrderRow);
}

const siteMeasurementColumns='id,owner_id,name,project_id,project_name,customer_id,customer_name,mode,trade_tool,points,center_lat,center_lng,zoom,distance_m,perimeter_m,area_m2,waste_percent,depth_m,quantity,unit,description,unit_rate,takeoff_lines,location_lat,location_lng,location_accuracy_m,location_captured_at,created_at,updated_at';
type SiteMeasurementRow={
  id:string;owner_id:string;name:string;project_id:string|null;project_name:string|null;customer_id:string|null;customer_name:string|null;
  mode:SiteMeasurement['mode'];trade_tool:string;points:MapPoint[];center_lat:number|string;center_lng:number|string;zoom:number|string;
  distance_m:number|string;perimeter_m:number|string;area_m2:number|string;waste_percent:number|string;depth_m:number|string;
  quantity:number|string;unit:string;description:string;unit_rate:number|string;takeoff_lines:SiteMeasurement['takeoffLines']|null;
  location_lat:number|string|null;location_lng:number|string|null;location_accuracy_m:number|string|null;location_captured_at:string|null;
  created_at:string;updated_at:string;
};

function siteMeasurementFromRow(row:SiteMeasurementRow):SiteMeasurement{
  return{id:row.id,owner_id:row.owner_id,name:row.name,projectId:row.project_id||undefined,projectName:row.project_name||undefined,
    customerId:row.customer_id||undefined,customerName:row.customer_name||undefined,mode:row.mode,tradeTool:row.trade_tool,
    points:Array.isArray(row.points)?row.points:[],center:{lat:Number(row.center_lat)||0,lng:Number(row.center_lng)||0},zoom:Number(row.zoom)||17,
    distanceM:Number(row.distance_m)||0,perimeterM:Number(row.perimeter_m)||0,areaM2:Number(row.area_m2)||0,
    wastePercent:Number(row.waste_percent)||0,depthM:Number(row.depth_m)||0,quantity:Number(row.quantity)||0,
    unit:row.unit,description:row.description,unitRate:Number(row.unit_rate)||0,takeoffLines:Array.isArray(row.takeoff_lines)?row.takeoff_lines:[],
    capturedLocation:row.location_lat!==null&&row.location_lng!==null?{point:{lat:Number(row.location_lat)||0,lng:Number(row.location_lng)||0},accuracyM:Number(row.location_accuracy_m)||0,capturedAt:row.location_captured_at||row.updated_at}:undefined,
    created_at:row.created_at,updated_at:row.updated_at,sync_state:'synced'};
}

export async function listSiteMeasurements():Promise<SiteMeasurement[]>{
  const user=await requireCloudUser();
  const{data,error}=await supabase!.from('site_measurements').select(siteMeasurementColumns).eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(1000);
  if(error)throw error;return((data||[]) as SiteMeasurementRow[]).map(siteMeasurementFromRow);
}

export async function upsertSiteMeasurement(measurement:SiteMeasurement):Promise<SiteMeasurement>{
  const user=await requireCloudUser();
  const points=measurement.points.slice(0,500).map(point=>({lat:Math.max(-90,Math.min(90,Number(point.lat)||0)),lng:Math.max(-180,Math.min(180,Number(point.lng)||0))}));
  const payload={
    id:measurement.id.slice(0,120),owner_id:user.id,name:measurement.name.trim().slice(0,200),
    project_id:measurement.projectId?.slice(0,160)||null,project_name:measurement.projectName?.trim().slice(0,240)||null,
    customer_id:measurement.customerId?.slice(0,160)||null,customer_name:measurement.customerName?.trim().slice(0,240)||null,
    mode:measurement.mode,trade_tool:measurement.tradeTool.trim().slice(0,120),points,
    center_lat:Math.max(-90,Math.min(90,Number(measurement.center.lat)||0)),center_lng:Math.max(-180,Math.min(180,Number(measurement.center.lng)||0)),
    zoom:Math.max(2,Math.min(20,Math.round(measurement.zoom)||17)),distance_m:Math.max(0,measurement.distanceM),
    perimeter_m:Math.max(0,measurement.perimeterM),area_m2:Math.max(0,measurement.areaM2),waste_percent:Math.max(0,Math.min(100,measurement.wastePercent)),
    depth_m:Math.max(0,Math.min(100,measurement.depthM)),quantity:Math.max(0,measurement.quantity),unit:measurement.unit.trim().slice(0,40),
    description:measurement.description.trim().slice(0,500),unit_rate:Math.max(0,measurement.unitRate),
    takeoff_lines:(measurement.takeoffLines||[]).slice(0,100).map(line=>({id:line.id.slice(0,120),source:line.source,tool:line.tool.slice(0,120),description:line.description.trim().slice(0,500),qty:Math.max(0,Number(line.qty)||0),unit:line.unit.trim().slice(0,40),rate:Math.max(0,Number(line.rate)||0),note:line.note?.trim().slice(0,500)||undefined})),
    location_lat:measurement.capturedLocation?Math.max(-90,Math.min(90,Number(measurement.capturedLocation.point.lat)||0)):null,
    location_lng:measurement.capturedLocation?Math.max(-180,Math.min(180,Number(measurement.capturedLocation.point.lng)||0)):null,
    location_accuracy_m:measurement.capturedLocation?Math.max(0,Math.min(100000,Number(measurement.capturedLocation.accuracyM)||0)):null,
    location_captured_at:measurement.capturedLocation?.capturedAt||null,updated_at:new Date().toISOString(),
  };
  if(payload.name.length<2||payload.description.length<2)throw new Error('Add a measurement name and estimate description.');
  if(payload.points.length<2)throw new Error('Add at least two measurement points.');
  const{data,error}=await supabase!.from('site_measurements').upsert(payload,{onConflict:'id'}).select(siteMeasurementColumns).single();
  if(error)throw error;return siteMeasurementFromRow(data as SiteMeasurementRow);
}

export async function deleteSiteMeasurement(id:string){
  const user=await requireCloudUser();
  const{error}=await supabase!.from('site_measurements').delete().eq('id',id).eq('owner_id',user.id);
  if(error)throw error;
}

const serviceAssetColumns='id,owner_id,customer_id,customer_name,name,type,manufacturer,model,serial_number,site_address,installed_on,warranty_until,status,notes,created_at,updated_at';
const serviceAgreementColumns='id,owner_id,agreement_number,customer_id,customer_name,asset_ids,plan_name,trade,status,start_date,end_date,next_visit_date,renewal_date,interval_days,billing_cycle,price,auto_invoice,assigned_member_id,assigned_member_name,scope,completed_visits,included_visits,notes,created_at,updated_at';
const serviceVisitColumns='id,owner_id,agreement_id,scheduled_for,status,completed_at,technician_name,checklist,notes,invoice_id,created_at,updated_at';

export async function listServiceAssets():Promise<ServiceAsset[]>{
  const user=await requireCloudUser();
  const{data,error}=await supabase!.from('service_assets').select(serviceAssetColumns).eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(2500);
  if(error)throw error;return(data||[]).map(row=>({...row,manufacturer:row.manufacturer||null,model:row.model||null,serial_number:row.serial_number||null,site_address:row.site_address||null,installed_on:row.installed_on||null,warranty_until:row.warranty_until||null,notes:row.notes||null,sync_state:'synced'})) as ServiceAsset[];
}

export async function upsertServiceAsset(asset:ServiceAsset):Promise<ServiceAsset>{
  const user=await requireCloudUser();
  const payload={
    id:asset.id,owner_id:user.id,customer_id:asset.customer_id.slice(0,160),customer_name:asset.customer_name.trim().slice(0,180),
    name:asset.name.trim().slice(0,200),type:asset.type.trim().slice(0,120),manufacturer:asset.manufacturer?.trim().slice(0,120)||null,
    model:asset.model?.trim().slice(0,120)||null,serial_number:asset.serial_number?.trim().slice(0,160)||null,
    site_address:asset.site_address?.trim().slice(0,500)||null,installed_on:asset.installed_on||null,warranty_until:asset.warranty_until||null,
    status:asset.status,notes:asset.notes?.trim().slice(0,2500)||null,updated_at:new Date().toISOString(),
  };
  if(payload.customer_id.length<1||payload.name.length<2||payload.type.length<2)throw new Error('Add the customer, equipment name and type.');
  const{data,error}=await supabase!.from('service_assets').upsert(payload,{onConflict:'id'}).select(serviceAssetColumns).single();
  if(error)throw error;return{...data,sync_state:'synced'} as ServiceAsset;
}

export async function listServiceAgreements():Promise<ServiceAgreement[]>{
  const user=await requireCloudUser();
  const{data,error}=await supabase!.from('service_agreements').select(serviceAgreementColumns).eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(2500);
  if(error)throw error;return(data||[]).map(row=>({...row,asset_ids:Array.isArray(row.asset_ids)?row.asset_ids:[],scope:Array.isArray(row.scope)?row.scope:[],
    price:Number(row.price)||0,interval_days:Number(row.interval_days)||90,completed_visits:Number(row.completed_visits)||0,included_visits:Number(row.included_visits)||0,
    end_date:row.end_date||null,next_visit_date:row.next_visit_date||null,renewal_date:row.renewal_date||null,assigned_member_id:row.assigned_member_id||null,
    assigned_member_name:row.assigned_member_name||null,notes:row.notes||null,sync_state:'synced'})) as ServiceAgreement[];
}

export async function upsertServiceAgreement(agreement:ServiceAgreement):Promise<ServiceAgreement>{
  const user=await requireCloudUser();
  const payload={
    id:agreement.id,owner_id:user.id,agreement_number:agreement.agreement_number.trim().slice(0,80),customer_id:agreement.customer_id.slice(0,160),
    customer_name:agreement.customer_name.trim().slice(0,180),asset_ids:agreement.asset_ids.slice(0,100),plan_name:agreement.plan_name.trim().slice(0,200),
    trade:agreement.trade.trim().slice(0,120),status:agreement.status,start_date:agreement.start_date,end_date:agreement.end_date,
    next_visit_date:agreement.next_visit_date,renewal_date:agreement.renewal_date,interval_days:Math.max(1,Math.min(3650,Math.round(agreement.interval_days))),
    billing_cycle:agreement.billing_cycle,price:Math.max(0,Math.min(1000000000,Number(agreement.price)||0)),auto_invoice:Boolean(agreement.auto_invoice),
    assigned_member_id:agreement.assigned_member_id?.slice(0,160)||null,assigned_member_name:agreement.assigned_member_name?.trim().slice(0,180)||null,
    scope:agreement.scope.map(item=>item.trim().slice(0,500)).filter(Boolean).slice(0,100),completed_visits:Math.max(0,Math.min(10000,Math.round(agreement.completed_visits))),
    included_visits:Math.max(1,Math.min(1000,Math.round(agreement.included_visits))),notes:agreement.notes?.trim().slice(0,4000)||null,
    updated_at:new Date().toISOString(),
  };
  if(payload.agreement_number.length<3||payload.customer_id.length<1||payload.plan_name.length<3)throw new Error('Add an agreement number, customer and plan name.');
  if(!payload.scope.length)throw new Error('Keep at least one service task in the plan.');
  const{data,error}=await supabase!.from('service_agreements').upsert(payload,{onConflict:'id'}).select(serviceAgreementColumns).single();
  if(error)throw error;return{...data,price:Number(data.price)||0,interval_days:Number(data.interval_days)||90,completed_visits:Number(data.completed_visits)||0,included_visits:Number(data.included_visits)||0,sync_state:'synced'} as ServiceAgreement;
}

export async function listServiceVisits():Promise<ServiceVisit[]>{
  const user=await requireCloudUser();
  const{data,error}=await supabase!.from('service_visits').select(serviceVisitColumns).eq('owner_id',user.id).order('scheduled_for',{ascending:true}).limit(5000);
  if(error)throw error;return(data||[]).map(row=>({...row,completed_at:row.completed_at||null,technician_name:row.technician_name||null,
    checklist:Array.isArray(row.checklist)?row.checklist:[],notes:row.notes||null,invoice_id:row.invoice_id||null,sync_state:'synced'})) as ServiceVisit[];
}

export async function upsertServiceVisit(visit:ServiceVisit):Promise<ServiceVisit>{
  const user=await requireCloudUser();
  const payload={
    id:visit.id,owner_id:user.id,agreement_id:visit.agreement_id,scheduled_for:visit.scheduled_for,status:visit.status,
    completed_at:visit.completed_at,technician_name:visit.technician_name?.trim().slice(0,180)||null,
    checklist:visit.checklist.slice(0,100).map(item=>({id:item.id.slice(0,120),label:item.label.trim().slice(0,500),completed:Boolean(item.completed)})),
    notes:visit.notes?.trim().slice(0,3000)||null,invoice_id:visit.invoice_id?.slice(0,120)||null,updated_at:new Date().toISOString(),
  };
  const{data,error}=await supabase!.from('service_visits').upsert(payload,{onConflict:'id'}).select(serviceVisitColumns).single();
  if(error)throw error;return{...data,sync_state:'synced'} as ServiceVisit;
}

export async function deleteServiceAgreement(id:string){
  const user=await requireCloudUser();
  const{error}=await supabase!.from('service_agreements').delete().eq('id',id).eq('owner_id',user.id);
  if(error)throw error;
}
