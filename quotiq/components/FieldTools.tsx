'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft, Calculator, Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardCheck,
  ClipboardList, Cloud, CloudOff, Compass, Copy, Crosshair, ExternalLink, FilePlus2,
  FolderKanban, HardHat, Layers3, LocateFixed, MapPin, MapPinned, Navigation, PackageCheck,
  PanelTop, PencilRuler, Plus, Radio, RefreshCw, Route, Rows3, Ruler, Save, Search,
  ShieldCheck, Sparkles, Trash2, Undo2, Users, X, Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type {
  Business, CapturedLocation, Customer, Estimate, MapPoint, Project, SiteMeasurement,
  SiteMeasurementMode, SiteTakeoffLine,
} from '../types';
import { getStored, setStored, uid } from '../lib/storage';
import { deleteSiteMeasurement, listSiteMeasurements, upsertSiteMeasurement } from '../lib/supabase';

const DEFAULT_CENTER:MapPoint={lat:7.3349,lng:-2.3123};
const EARTH_RADIUS=6_371_008.8;
const round=(value:number,places=2)=>{const factor=10**places;return Math.round((value+Number.EPSILON)*factor)/factor};
const today=()=>new Date().toISOString().slice(0,10);
const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency,minimumFractionDigits:2}).format(value||0);
const pointLabel=(point:MapPoint)=>`${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
const radians=(value:number)=>value*Math.PI/180;

export function haversineDistance(a:MapPoint,b:MapPoint){
  const dLat=radians(b.lat-a.lat),dLng=radians(b.lng-a.lng),lat1=radians(a.lat),lat2=radians(b.lat);
  const value=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*EARTH_RADIUS*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
}
function pathDistance(points:MapPoint[],closed=false){
  if(points.length<2)return 0;
  let total=0;
  for(let index=1;index<points.length;index+=1)total+=haversineDistance(points[index-1],points[index]);
  if(closed&&points.length>2)total+=haversineDistance(points[points.length-1],points[0]);
  return total;
}
export function polygonArea(points:MapPoint[]){
  if(points.length<3)return 0;
  let sum=0;
  for(let index=0;index<points.length;index+=1){
    const current=points[index],next=points[(index+1)%points.length];
    sum+=radians(next.lng-current.lng)*(2+Math.sin(radians(current.lat))+Math.sin(radians(next.lat)));
  }
  return Math.abs(sum*EARTH_RADIUS*EARTH_RADIUS/2);
}
function centroid(points:MapPoint[],fallback=DEFAULT_CENTER){
  if(!points.length)return fallback;
  return{lat:points.reduce((sum,point)=>sum+point.lat,0)/points.length,lng:points.reduce((sum,point)=>sum+point.lng,0)/points.length};
}
function parseCoordinates(value:string):MapPoint|null{
  const match=value.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if(!match)return null;
  const lat=Number(match[1]),lng=Number(match[2]);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
function mergeMeasurements(local:SiteMeasurement[],cloud:SiteMeasurement[]){
  const records=new Map<string,SiteMeasurement>();
  [...local,...cloud].forEach(record=>{
    const previous=records.get(record.id);
    if(!previous||new Date(record.updated_at).getTime()>=new Date(previous.updated_at).getTime())records.set(record.id,record);
  });
  return[...records.values()].sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
}

type TradeTool='custom'|'painting'|'roofing'|'flooring'|'concrete'|'fence'|'landscaping'|'solar';
const tradeTools:Record<TradeTool,{label:string;description:string;mode:SiteMeasurementMode;unit:string;waste:number;caption:string}>={
  custom:{label:'Custom measurement',description:'Measured site work',mode:'distance',unit:'m',waste:0,caption:'Use the measured line or area exactly as drawn.'},
  painting:{label:'Painting surfaces',description:'Surface preparation and painting',mode:'area',unit:'m²',waste:10,caption:'Wall or ceiling coverage with material allowance.'},
  roofing:{label:'Roofing',description:'Roof covering, accessories and installation',mode:'area',unit:'m²',waste:12,caption:'Roof footprint with cutting and overlap allowance.'},
  flooring:{label:'Flooring / tiling',description:'Floor or wall tiling installation',mode:'area',unit:'m²',waste:10,caption:'Tile coverage with cutting and breakage allowance.'},
  concrete:{label:'Concrete slab',description:'Concrete slab supply and placement',mode:'area',unit:'m³',waste:5,caption:'Area multiplied by slab depth, plus waste.'},
  fence:{label:'Fence / cable route',description:'Fence, trenching or cable route installation',mode:'distance',unit:'m',waste:5,caption:'Linear run with slack, joints or cutting allowance.'},
  landscaping:{label:'Lawn / landscaping',description:'Landscaping and ground treatment',mode:'area',unit:'m²',waste:5,caption:'Measured ground coverage with a small material allowance.'},
  solar:{label:'Solar panel layout',description:'Solar panel layout allowance',mode:'area',unit:'panels',waste:0,caption:'Approximate panel count using 2.2 m² of usable area per panel.'},
};

type PrecisionTool='room'|'walls'|'roofPitch'|'concreteVolume'|'fencePosts'|'paintLitres'|'tileBoxes'|'voltageDrop'|'pipeFall';
const precisionTools:Record<PrecisionTool,{label:string;caption:string;unit:string}>={
  room:{label:'Room / floor area',caption:'Length × width for floors, ceilings and room planning.',unit:'m²'},
  walls:{label:'Wall surface area',caption:'Room perimeter × height, less doors and windows.',unit:'m²'},
  roofPitch:{label:'Roof pitch area',caption:'Convert a measured roof footprint into sloped roof area.',unit:'m²'},
  concreteVolume:{label:'Concrete volume',caption:'Slab, footing or pad volume from exact dimensions.',unit:'m³'},
  fencePosts:{label:'Fence post count',caption:'Calculate the post count from run length and spacing.',unit:'posts'},
  paintLitres:{label:'Paint litres',caption:'Coverage from surface area, coats and product spread rate.',unit:'L'},
  tileBoxes:{label:'Tile / flooring boxes',caption:'Boxes needed from floor area, waste and box coverage.',unit:'boxes'},
  voltageDrop:{label:'Cable voltage drop',caption:'Quick copper conductor voltage-drop screening.',unit:'%'},
  pipeFall:{label:'Pipe fall / drainage',caption:'Required fall over a measured drainage run.',unit:'mm'},
};

const connectedTools=[
  {label:'Digital approvals',caption:'Client e-signature and approval links',path:'/estimates',status:'Ready',Icon:ShieldCheck},
  {label:'Choice estimates',caption:'Good / Better / Best packages',path:'/estimates/new',status:'Ready',Icon:PanelTop},
  {label:'Scheduling',caption:'Crew calendar and dispatch',path:'/schedule',status:'Ready',Icon:Navigation},
  {label:'Field inspections',caption:'Checklists, job photos and handover',path:'/projects',status:'Ready',Icon:ClipboardCheck},
  {label:'Inventory & purchasing',caption:'Stock, suppliers and receiving',path:'/inventory',status:'Ready',Icon:PackageCheck},
  {label:'ClientHub',caption:'Messages, follow-ups and account history',path:'/clienthub',status:'Ready',Icon:Users},
  {label:'Job costing',caption:'Labour, expenses and live profitability',path:'/reports',status:'Ready',Icon:CircleDollarSign},
  {label:'AI & automation',caption:'Scope writing and business workflows',path:'/automation',status:'Ready',Icon:Sparkles},
] as const;

export default function FieldTools({session}:{session:Session|null}){
  const navigate=useNavigate();
  const takeoffDraftKey=`q-site-takeoff-draft-${session?.user.id||'local'}`;
  const business=getStored<Business>('q-business',{name:'Quotiq',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'});
  const projects=getStored<Project[]>('q-projects',[]),customers=getStored<Customer[]>('q-customers',[]);
  const mapHostRef=useRef<HTMLDivElement>(null),mapRef=useRef<LeafletMap|null>(null),leafletRef=useRef<typeof import('leaflet')|null>(null);
  const drawingLayerRef=useRef<LayerGroup|null>(null),locationLayerRef=useRef<LayerGroup|null>(null),watchIdRef=useRef<number|null>(null),pendingPinRef=useRef(false),followLocationRef=useRef(true);
  const[mapReady,setMapReady]=useState(false),[mapError,setMapError]=useState('');
  const[center,setCenter]=useState<MapPoint>(DEFAULT_CENTER),[zoom,setZoom]=useState(17),[locationInput,setLocationInput]=useState('');
  const[mode,setMode]=useState<SiteMeasurementMode>('area'),[drawing,setDrawing]=useState(true),[points,setPoints]=useState<MapPoint[]>([]);
  const[userLocation,setUserLocation]=useState<CapturedLocation|null>(null),[tracking,setTracking]=useState(false),[followLocation,setFollowLocation]=useState(true),[locationStatus,setLocationStatus]=useState('Tap Live GPS to place your position on the map.');
  const[tradeTool,setTradeTool]=useState<TradeTool>('painting'),[wastePercent,setWastePercent]=useState(10),[depthM,setDepthM]=useState(.1);
  const[description,setDescription]=useState(tradeTools.painting.description),[unitRate,setUnitRate]=useState(0);
  const[measurementName,setMeasurementName]=useState('New site measurement'),[projectId,setProjectId]=useState(''),[customerId,setCustomerId]=useState('');
  const[measurements,setMeasurements]=useState<SiteMeasurement[]>(()=>getStored('q-site-measurements',[]));
  const[selectedId,setSelectedId]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[syncing,setSyncing]=useState(Boolean(session));
  const[routeIds,setRouteIds]=useState<string[]>(()=>getStored<SiteMeasurement[]>('q-site-measurements',[]).slice(0,5).map(measurement=>measurement.id)),[routeOrder,setRouteOrder]=useState<string[]>([]);
  const[takeoffLines,setTakeoffLines]=useState<SiteTakeoffLine[]>(()=>getStored(takeoffDraftKey,[]));
  const[precisionTool,setPrecisionTool]=useState<PrecisionTool>('room'),[precisionRate,setPrecisionRate]=useState(0);
  const[lengthM,setLengthM]=useState(5),[widthM,setWidthM]=useState(4),[heightM,setHeightM]=useState(2.8),[openingsM2,setOpeningsM2]=useState(3.2);
  const[manualDepthM,setManualDepthM]=useState(.15),[spacingM,setSpacingM]=useState(2.5),[coats,setCoats]=useState(2),[coverage,setCoverage]=useState(10);
  const[boxCoverage,setBoxCoverage]=useState(1.44),[roofRise,setRoofRise]=useState(4),[roofRun,setRoofRun]=useState(12),[currentA,setCurrentA]=useState(20),[cableSize,setCableSize]=useState(4),[supplyVoltage,setSupplyVoltage]=useState(230),[fallPerM,setFallPerM]=useState(10);

  const distanceM=useMemo(()=>pathDistance(points,false),[points]);
  const areaM2=useMemo(()=>mode==='area'?polygonArea(points):0,[mode,points]);
  const perimeterM=useMemo(()=>mode==='area'?pathDistance(points,true):0,[mode,points]);
  const tool=tradeTools[tradeTool];
  const quantity=useMemo(()=>{
    const allowance=1+Math.max(0,wastePercent)/100;
    if(tradeTool==='concrete')return round(areaM2*Math.max(0,depthM)*allowance,3);
    if(tradeTool==='solar')return Math.max(0,Math.floor(areaM2/2.2));
    const raw=tool.mode==='area'?areaM2:(mode==='area'?perimeterM:distanceM);
    return round(raw*allowance,2);
  },[areaM2,depthM,distanceM,mode,perimeterM,tool.mode,tradeTool,wastePercent]);
  const selectedProject=projects.find(project=>project.id===projectId);
  const selectedCustomer=customers.find(customer=>customer.id===(selectedProject?.customerId||customerId));

  const precisionResult=useMemo(()=>{
    const floorArea=Math.max(0,lengthM)*Math.max(0,widthM);
    const wallArea=Math.max(0,(2*(Math.max(0,lengthM)+Math.max(0,widthM))*Math.max(0,heightM))-Math.max(0,openingsM2));
    switch(precisionTool){
      case'room':return{qty:round(floorArea,2),description:`Room / floor area (${lengthM} m × ${widthM} m)`};
      case'walls':return{qty:round(wallArea,2),description:`Wall surface area less ${openingsM2} m² openings`};
      case'roofPitch':{const multiplier=Math.sqrt(Math.max(.01,roofRun)**2+Math.max(0,roofRise)**2)/Math.max(.01,roofRun);return{qty:round(floorArea*multiplier*(1+wastePercent/100),2),description:`Sloped roof area · ${roofRise}:${roofRun} pitch · ${wastePercent}% allowance`}}
      case'concreteVolume':return{qty:round(floorArea*Math.max(0,manualDepthM)*(1+wastePercent/100),3),description:`Concrete volume (${lengthM} m × ${widthM} m × ${manualDepthM} m)`};
      case'fencePosts':return{qty:Math.max(0,Math.ceil(Math.max(0,lengthM)/Math.max(.1,spacingM))+1),description:`Fence posts at ${spacingM} m centres over ${lengthM} m`};
      case'paintLitres':return{qty:round((wallArea*Math.max(1,coats))/Math.max(.1,coverage),2),description:`Paint for ${wallArea.toFixed(1)} m² · ${coats} coats · ${coverage} m²/L`};
      case'tileBoxes':return{qty:Math.max(0,Math.ceil((floorArea*(1+wastePercent/100))/Math.max(.01,boxCoverage))),description:`Tile boxes for ${floorArea.toFixed(1)} m² · ${wastePercent}% waste`};
      case'voltageDrop':{const volts=(2*.0175*Math.max(0,lengthM)*Math.max(0,currentA))/Math.max(.1,cableSize);return{qty:round((volts/Math.max(1,supplyVoltage))*100,2),description:`Copper cable voltage drop · ${lengthM} m · ${currentA} A · ${cableSize} mm²`}}
      case'pipeFall':return{qty:round(Math.max(0,lengthM)*Math.max(0,fallPerM),1),description:`Pipe fall over ${lengthM} m at ${fallPerM} mm per metre`};
    }
  },[boxCoverage,cableSize,coats,coverage,currentA,fallPerM,heightM,lengthM,manualDepthM,openingsM2,precisionTool,roofRise,roofRun,spacingM,supplyVoltage,wastePercent,widthM]);
  const takeoffTotal=useMemo(()=>takeoffLines.reduce((sum,line)=>sum+(line.qty*line.rate),0),[takeoffLines]);

  useEffect(()=>{
    const host=mapHostRef.current;
    if(!host)return;
    let disposed=false;
    import('leaflet').then(L=>{
      if(disposed||mapRef.current)return;
      leafletRef.current=L;
      const map=L.map(host,{zoomControl:false,attributionControl:true,tap:true}).setView([DEFAULT_CENTER.lat,DEFAULT_CENTER.lng],17);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors',crossOrigin:true}).addTo(map);
      L.control.zoom({position:'topright'}).addTo(map);
      const updateCenter=()=>{const current=map.getCenter();setCenter({lat:current.lat,lng:current.lng});setZoom(map.getZoom())};
      map.on('moveend',updateCenter);
      mapRef.current=map;
      setMapReady(true);
    }).catch(()=>setMapError('The background map could not load. Saved measurements and calculators still work offline.'));
    return()=>{disposed=true;if(watchIdRef.current!==null)navigator.geolocation?.clearWatch(watchIdRef.current);mapRef.current?.remove();mapRef.current=null;leafletRef.current=null;setMapReady(false)};
  },[]);

  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!mapReady)return;
    const onClick=(event:LeafletMouseEvent)=>{if(!drawing)return;setPoints(current=>[...current,{lat:round(event.latlng.lat,7),lng:round(event.latlng.lng,7)}])};
    map.on('click',onClick);
    return()=>{map.off('click',onClick)};
  },[drawing,mapReady]);

  useEffect(()=>{
    const map=mapRef.current,L=leafletRef.current;
    if(!map||!L)return;
    if(drawingLayerRef.current)map.removeLayer(drawingLayerRef.current);
    const group=L.layerGroup().addTo(map);
    drawingLayerRef.current=group;
    points.forEach((point,index)=>L.circleMarker([point.lat,point.lng],{radius:index===0?7:6,color:'#fff',weight:3,fillColor:index===0?'#14b86d':'#2866ef',fillOpacity:1}).bindTooltip(String(index+1),{permanent:true,direction:'center',className:'ftPointLabel'}).addTo(group));
    if(points.length>1){
      if(mode==='area')L.polygon(points.map(point=>[point.lat,point.lng] as [number,number]),{color:'#2866ef',weight:4,fillColor:'#2866ef',fillOpacity:.18,dashArray:points.length<3?'7 7':undefined}).addTo(group);
      else L.polyline(points.map(point=>[point.lat,point.lng] as [number,number]),{color:'#2866ef',weight:5,lineCap:'round'}).addTo(group);
    }
  },[mode,points,mapReady]);

  useEffect(()=>{
    const map=mapRef.current,L=leafletRef.current;
    if(!map||!L)return;
    if(locationLayerRef.current)map.removeLayer(locationLayerRef.current);
    if(!userLocation)return;
    const group=L.layerGroup().addTo(map);
    locationLayerRef.current=group;
    L.circle([userLocation.point.lat,userLocation.point.lng],{radius:Math.max(2,userLocation.accuracyM),color:'#0aa56e',weight:1,fillColor:'#4ee2a9',fillOpacity:.13,interactive:false}).addTo(group);
    L.circleMarker([userLocation.point.lat,userLocation.point.lng],{radius:11,color:'#fff',weight:4,fillColor:'#0dbb78',fillOpacity:1,className:'ftUserPin'}).bindTooltip('You are here',{permanent:true,direction:'top',offset:[0,-12],className:'ftUserLabel'}).addTo(group);
  },[mapReady,userLocation]);

  useEffect(()=>{setStored(takeoffDraftKey,takeoffLines)},[takeoffDraftKey,takeoffLines]);
  useEffect(()=>{followLocationRef.current=followLocation},[followLocation]);

  useEffect(()=>{
    if(!session)return;
    let cancelled=false;
    listSiteMeasurements().then(cloud=>{
      if(cancelled)return;
      const merged=mergeMeasurements(getStored('q-site-measurements',[]),cloud);
      setMeasurements(merged);setStored('q-site-measurements',merged);setRouteIds(current=>current.length?current:merged.slice(0,5).map(measurement=>measurement.id));setNotice('Secure site measurements synced.');
    }).catch(()=>{if(!cancelled)setNotice('Measurements remain saved on this device. Cloud sync will retry later.')}).finally(()=>!cancelled&&setSyncing(false));
    return()=>{cancelled=true};
  },[session]);

  const changeTool=(next:TradeTool)=>{const config=tradeTools[next];setTradeTool(next);setMode(config.mode);setWastePercent(config.waste);setDescription(config.description);setNotice(`${config.label} calculator ready.`)};
  const changeMode=(next:SiteMeasurementMode)=>{setMode(next);if(tradeTools[tradeTool].mode!==next){setTradeTool('custom');setWastePercent(0);setDescription(next==='area'?'Measured site area':'Measured site distance')}};
  const changeProject=(nextId:string)=>{setProjectId(nextId);const project=projects.find(item=>item.id===nextId);if(project){setCustomerId(project.customerId);setMeasurementName(`${project.name} site measurement`)}};
  const persist=(next:SiteMeasurement[])=>{setMeasurements(next);setStored('q-site-measurements',next);window.dispatchEvent(new Event('quotiq-data'))};
  const geometryReady=mode==='area'?points.length>=3:points.length>=2;

  const buildRecord=(reportErrors=true):SiteMeasurement|null=>{
    if(!geometryReady){if(reportErrors)setNotice(mode==='area'?'Tap at least three boundary points to close an area.':'Tap at least two points to measure a distance.');return null}
    if(!quantity&&!takeoffLines.length){if(reportErrors)setNotice('The calculated quantity is zero. Check the points and calculator.');return null}
    const now=new Date().toISOString(),existing=measurements.find(item=>item.id===selectedId);
    return{id:existing?.id||uid('MAP'),name:measurementName.trim()||`${tool.label} · ${today()}`,projectId:selectedProject?.id,projectName:selectedProject?.name,
      customerId:selectedCustomer?.id,customerName:selectedCustomer?.name,mode,tradeTool,points,center:centroid(points,center),zoom,distanceM:round(distanceM,3),perimeterM:round(perimeterM,3),areaM2:round(areaM2,3),
      wastePercent:round(wastePercent,2),depthM:round(depthM,4),quantity,unit:tool.unit,description:description.trim()||tool.description,unitRate:Math.max(0,unitRate),
      takeoffLines,capturedLocation:userLocation||undefined,created_at:existing?.created_at||now,updated_at:now,sync_state:session?'pending':'local'};
  };

  const saveMeasurement=async()=>{
    const record=buildRecord();if(!record)return null;
    setSaving(true);persist(mergeMeasurements(measurements,[record]));setSelectedId(record.id);
    if(session){
      try{const synced=await upsertSiteMeasurement(record);persist(mergeMeasurements(getStored('q-site-measurements',[]),[synced]));setNotice('Measurement and takeoff saved securely.');setSaving(false);return synced}
      catch{setNotice('Saved on this device. Cloud sync will retry when available.')}
    }else setNotice('Measurement and takeoff saved on this device for offline work.');
    setSaving(false);return record;
  };
  const removeMeasurement=async(record:SiteMeasurement)=>{
    persist(measurements.filter(item=>item.id!==record.id));
    if(selectedId===record.id){setSelectedId('');setPoints([]);setTakeoffLines([])}
    if(session)try{await deleteSiteMeasurement(record.id)}catch{setNotice('Removed locally. Cloud deletion could not be confirmed.')}
    setNotice('Site measurement removed.');
  };
  const loadMeasurement=(record:SiteMeasurement)=>{
    setSelectedId(record.id);setMeasurementName(record.name);setProjectId(record.projectId||'');setCustomerId(record.customerId||'');setMode(record.mode);setTradeTool((record.tradeTool in tradeTools?record.tradeTool:'custom') as TradeTool);
    setPoints(record.points);setWastePercent(record.wastePercent);setDepthM(record.depthM);setDescription(record.description);setUnitRate(record.unitRate);setCenter(record.center);setZoom(record.zoom);setTakeoffLines(record.takeoffLines||[]);setUserLocation(record.capturedLocation||null);
    mapRef.current?.setView([record.center.lat,record.center.lng],record.zoom);if(record.points.length>1)mapRef.current?.fitBounds(record.points.map(point=>[point.lat,point.lng]),{padding:[42,42]});setNotice(`${record.name} loaded with ${record.takeoffLines?.length||0} takeoff lines.`);window.scrollTo({top:0,behavior:'smooth'});
  };

  const stopLocationTracking=()=>{
    if(watchIdRef.current!==null)navigator.geolocation?.clearWatch(watchIdRef.current);
    watchIdRef.current=null;setTracking(false);setLocationStatus(userLocation?'Location pin saved on the map.':'Live GPS stopped.');
  };
  const startLocationTracking=(pinAsPoint=false)=>{
    if(!navigator.geolocation){setNotice('Location is not available on this device.');return}
    if(pinAsPoint&&userLocation){setPoints(current=>[...current,userLocation.point]);setNotice('Current GPS position added as a measurement point.');return}
    pendingPinRef.current=pinAsPoint;setTracking(true);setFollowLocation(true);setLocationStatus('Requesting precise location…');setNotice('Allow location access to place your live pin.');
    if(watchIdRef.current!==null)navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current=navigator.geolocation.watchPosition(position=>{
      const captured:CapturedLocation={point:{lat:round(position.coords.latitude,7),lng:round(position.coords.longitude,7)},accuracyM:round(position.coords.accuracy,1),capturedAt:new Date(position.timestamp).toISOString()};
      setUserLocation(captured);setCenter(captured.point);setLocationInput(pointLabel(captured.point));setLocationStatus(`Live · accurate to about ${Math.round(captured.accuracyM)} m`);
      if(followLocationRef.current)mapRef.current?.flyTo([captured.point.lat,captured.point.lng],Math.max(18,mapRef.current.getZoom()));
      if(pendingPinRef.current){setPoints(current=>[...current,captured.point]);pendingPinRef.current=false;setNotice('Current GPS position added as a measurement point.')}
    },error=>{
      setTracking(false);watchIdRef.current=null;pendingPinRef.current=false;
      const message=error.code===1?'Location permission is off. Enable it for this browser in your phone settings, then try again.':error.code===2?'Your device could not determine a position. Move into an open area and try again.':'Location took too long. Try again with GPS and mobile location services enabled.';
      setLocationStatus(message);setNotice(message);
    },{enableHighAccuracy:true,timeout:20_000,maximumAge:5_000});
  };
  const recenterLocation=()=>{if(!userLocation){startLocationTracking();return}setFollowLocation(true);mapRef.current?.flyTo([userLocation.point.lat,userLocation.point.lng],Math.max(18,zoom));setNotice('Map centred on your live pin.')};
  const copyCoordinates=async()=>{if(!userLocation)return;try{await navigator.clipboard.writeText(pointLabel(userLocation.point));setNotice('Current coordinates copied.')}catch{setNotice(pointLabel(userLocation.point))}};
  const findLocation=()=>{
    const parsed=parseCoordinates(locationInput);
    if(parsed){setCenter(parsed);mapRef.current?.flyTo([parsed.lat,parsed.lng],Math.max(17,zoom));setNotice('Map centred on the entered coordinates.');return}
    if(!locationInput.trim()){setNotice('Enter coordinates or a site address.');return}
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationInput.trim())}`,'_blank','noopener,noreferrer');setNotice('Address search opened in Google Maps. Copy the GPS coordinates back into Quotiq to measure precisely.');
  };

  const addMapToTakeoff=()=>{
    if(!quantity){setNotice('Complete a map measurement before adding this line.');return}
    setTakeoffLines(current=>[...current,{id:uid('TKO'),source:'map',tool:tool.label,description:description.trim()||tool.description,qty:quantity,unit:tool.unit,rate:Math.max(0,unitRate),note:mode==='area'?`${round(areaM2)} m² footprint · ${round(perimeterM)} m perimeter`:`${round(distanceM)} m measured route`}]);
    setNotice(`${tool.label} added to the takeoff.`);
  };
  const addPrecisionToTakeoff=()=>{
    if(!precisionResult.qty){setNotice('Enter valid dimensions before adding this calculation.');return}
    const config=precisionTools[precisionTool];
    setTakeoffLines(current=>[...current,{id:uid('TKO'),source:'calculator',tool:config.label,description:precisionResult.description,qty:precisionResult.qty,unit:config.unit,rate:Math.max(0,precisionRate)}]);
    setNotice(`${config.label} added to the takeoff.`);
  };
  const updateTakeoffLine=(id:string,changes:Partial<SiteTakeoffLine>)=>setTakeoffLines(current=>current.map(line=>line.id===id?{...line,...changes}:line));

  const createEstimate=async()=>{
    if(!selectedCustomer){setNotice('Select a customer or a project linked to a customer before creating an estimate.');return}
    const lines=takeoffLines.length?takeoffLines:(quantity?[{id:uid('TKO'),source:'map' as const,tool:tool.label,description:description.trim()||tool.description,qty:quantity,unit:tool.unit,rate:Math.max(0,unitRate)}]:[]);
    if(!lines.length){setNotice('Add at least one measured or calculated takeoff line.');return}
    const record=buildRecord(false),existing=getStored<Estimate[]>('q-estimates',[]),prefix=business.estimatePrefix||'EST';let counter=existing.length+1,id='';
    do{id=`${prefix}-${new Date().getFullYear()}-${String(counter).padStart(4,'0')}`;counter+=1}while(existing.some(estimate=>estimate.id===id));
    const captured=userLocation?`GPS ${pointLabel(userLocation.point)} · accuracy about ${Math.round(userLocation.accuracyM)} m.`:'';
    const estimate:Estimate={id,customerId:selectedCustomer.id,customer:selectedCustomer.name,project:selectedProject?.name||measurementName.trim()||'Site takeoff',amount:round(lines.reduce((sum,line)=>sum+(line.qty*line.rate),0)),status:'Draft',date:today(),items:lines.map(line=>({id:uid('ITM'),description:line.description,qty:line.qty,unit:line.unit,rate:line.rate})),tax:0,discount:0,validDays:14,reference:record?.id||uid('TAKEOFF'),trade:'Field takeoff',notes:`Prepared from Quotiq Field Intelligence with ${lines.length} itemized line${lines.length===1?'':'s'}. ${geometryReady?(mode==='area'?`${round(areaM2)} m² area · ${round(perimeterM)} m perimeter.`:`${round(distanceM)} m measured route.`):''} ${captured}`.trim(),pricingStyle:'standard'};
    if(record){persist(mergeMeasurements(measurements,[{...record,takeoffLines:lines}]));if(session)void upsertSiteMeasurement({...record,takeoffLines:lines}).catch(()=>undefined)}
    setStored('q-estimates',[estimate,...existing]);setTakeoffLines([]);window.dispatchEvent(new Event('quotiq-data'));setNotice(`${id} created with ${lines.length} itemized takeoff lines.`);window.setTimeout(()=>navigate(`/estimates/${encodeURIComponent(id)}`),350);
  };

  const orderedRoute=useMemo(()=>{const selected=measurements.filter(item=>routeIds.includes(item.id));if(!routeOrder.length)return selected;return routeOrder.map(id=>selected.find(item=>item.id===id)).filter(Boolean) as SiteMeasurement[]},[measurements,routeIds,routeOrder]);
  const optimizeRoute=()=>{
    const remaining=measurements.filter(item=>routeIds.includes(item.id)),ordered:SiteMeasurement[]=[];let current=userLocation?.point||center;
    while(remaining.length){remaining.sort((a,b)=>haversineDistance(current,centroid(a.points,a.center))-haversineDistance(current,centroid(b.points,b.center)));const next=remaining.shift()!;ordered.push(next);current=centroid(next.points,next.center)}
    setRouteOrder(ordered.map(item=>item.id));setNotice('Stops reordered from nearest to furthest. Google Maps will calculate the road route.');
  };
  const openRoute=()=>{
    if(!orderedRoute.length){setNotice('Select at least one saved site stop.');return}
    const origin=userLocation?.point||center,stops=orderedRoute.slice(0,5).map(item=>centroid(item.points,item.center));const params=new URLSearchParams({api:'1',origin:`${origin.lat},${origin.lng}`,destination:`${stops[stops.length-1].lat},${stops[stops.length-1].lng}`,travelmode:'driving'});
    if(stops.length>1)params.set('waypoints',stops.slice(0,-1).map(point=>`${point.lat},${point.lng}`).join('|'));
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`,'_blank','noopener,noreferrer');
  };

  const field=(label:string,value:number,setter:(value:number)=>void,step='0.1',min='0')=><label><span>{label}</span><input type="number" min={min} step={step} value={value} onChange={event=>setter(Math.max(Number(min),Number(event.target.value)||0))}/></label>;
  const precisionConfig=precisionTools[precisionTool];

  return <main className="ftPage">
    <header className="ftHero"><div><button type="button" onClick={()=>navigate('/')}><ArrowLeft/>Dashboard</button><span>FIELD INTELLIGENCE</span><h1>Measure, locate and build the full takeoff</h1><p>Place your live GPS pin, measure real sites, calculate trade quantities and create one clean itemized estimate from the entire visit.</p></div><div className="ftHeroBadges"><span><MapPinned/>Live MapMeasure</span><span><HardHat/>Precision tools</span><span><ClipboardList/>Takeoff builder</span></div></header>
    {notice?<div className="ftNotice"><CheckCircle2/><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={()=>setNotice('')}><X/></button></div>:null}

    <section className="ftWorkspace">
      <div className="ftMapCard">
        <header><div><span>01 · LIVE MAPMEASURE</span><h2>Your position and the real site boundary</h2><p>Start Live GPS to place the green pin, then tap the map or use your current position as an exact measurement point.</p></div><span className={session?'cloud':'local'}>{syncing?<RefreshCw className="spin"/>:session?<Cloud/>:<CloudOff/>}{session?'Cloud protected':'Offline ready'}</span></header>
        <div className="ftLocationBar"><label><Search/><input value={locationInput} onChange={event=>setLocationInput(event.target.value)} onKeyDown={event=>event.key==='Enter'&&findLocation()} placeholder="Coordinates or site address"/></label><button type="button" onClick={findLocation}><Compass/>Find</button><button type="button" className={tracking?'live':''} onClick={()=>tracking?stopLocationTracking():startLocationTracking()}>{tracking?<Radio/>:<LocateFixed/>}{tracking?'Stop GPS':'Live GPS'}</button></div>
        <div className="ftGpsStrip"><div className={tracking?'active':''}><i><MapPin/></i><span><b>{userLocation?'Current location pinned':'Current location'}</b><small>{locationStatus}</small></span></div><button type="button" onClick={recenterLocation}><Crosshair/>Recenter</button><button type="button" onClick={()=>startLocationTracking(true)}><Plus/>Use as point</button><button type="button" disabled={!userLocation} onClick={copyCoordinates}><Copy/>Copy GPS</button></div>
        <div className="ftModeBar"><button type="button" className={mode==='area'?'active':''} onClick={()=>changeMode('area')}><PencilRuler/><span><b>Area</b><small>Roof, floor, land</small></span></button><button type="button" className={mode==='distance'?'active':''} onClick={()=>changeMode('distance')}><Ruler/><span><b>Distance</b><small>Cable, pipe, fence</small></span></button><button type="button" className={drawing?'recording':''} onClick={()=>setDrawing(!drawing)}>{drawing?<Check/>:<Plus/>}{drawing?'Finish tapping':'Continue drawing'}</button></div>
        <div className="ftMapWrap"><div ref={mapHostRef} className="ftMap" aria-label="Interactive site measurement map"/>{!mapReady&&!mapError?<div className="ftMapLoading"><RefreshCw className="spin"/><b>Loading site map…</b></div>:null}{mapError?<div className="ftMapLoading error"><CloudOff/><b>{mapError}</b></div>:null}<div className="ftMapHelp"><b>{drawing?'Tap the map to add points':'Drawing paused'}</b><span>{points.length} point{points.length===1?'':'s'} · {pointLabel(center)}</span></div>{userLocation?<div className="ftAccuracy"><span>GPS accuracy</span><strong>±{Math.round(userLocation.accuracyM)} m</strong><button type="button" onClick={()=>setFollowLocation(!followLocation)}>{followLocation?'Following':'Follow pin'}</button></div>:null}</div>
        <footer className="ftMapFooter"><div><button type="button" disabled={!points.length} onClick={()=>setPoints(current=>current.slice(0,-1))}><Undo2/>Undo point</button><button type="button" disabled={!points.length} onClick={()=>{setPoints([]);setSelectedId('')}}><Trash2/>Clear</button></div><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue <ExternalLink/></a></footer>
      </div>

      <aside className="ftCalculator">
        <header><span>02 · MAP QUANTITY</span><h2>Measured contractor calculator</h2><p>{tool.caption}</p></header>
        <label><span>Trade calculation</span><select value={tradeTool} onChange={event=>changeTool(event.target.value as TradeTool)}>{(Object.keys(tradeTools) as TradeTool[]).map(key=><option key={key} value={key}>{tradeTools[key].label}</option>)}</select></label>
        <div className="ftMetricGrid"><article><small>Distance</small><strong>{distanceM>=1000?`${round(distanceM/1000,2)} km`:`${round(distanceM,1)} m`}</strong></article><article><small>Perimeter</small><strong>{round(perimeterM,1)} m</strong></article><article><small>Area</small><strong>{areaM2>=10_000?`${round(areaM2/10_000,3)} ha`:`${round(areaM2,1)} m²`}</strong></article><article className="result"><small>Quote quantity</small><strong>{quantity.toLocaleString()} {tool.unit}</strong></article></div>
        <div className="ftCalcFields"><label><span>Waste / allowance %</span><input type="number" min="0" max="100" step="1" value={wastePercent} onChange={event=>setWastePercent(Math.max(0,Number(event.target.value)||0))}/></label>{tradeTool==='concrete'?<label><span>Slab depth (metres)</span><input type="number" min="0.01" max="10" step="0.01" value={depthM} onChange={event=>setDepthM(Math.max(0,Number(event.target.value)||0))}/></label>:null}<label><span>Unit price ({business.currency||'GHS'})</span><input type="number" min="0" step="0.01" value={unitRate} onChange={event=>setUnitRate(Math.max(0,Number(event.target.value)||0))}/></label></div>
        <div className="ftQuoteValue"><span>Estimated line total</span><strong>{money(quantity*unitRate,business.currency)}</strong><small>Quantity × unit price</small></div>
        <label><span>Estimate item description</span><textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)}/></label>
        <button type="button" className="ftAddLine" onClick={addMapToTakeoff}><Rows3/>Add measured line to takeoff</button>
      </aside>
    </section>

    <section className="ftPrecision">
      <header><div><span>03 · PRECISION TOOLBOX</span><h2>Contractor measuring tools for the details maps cannot see</h2><p>Calculate internal rooms, walls, pitch, concrete, posts, paint, tiles, cable performance and drainage fall—then add each result to the same takeoff.</p></div><Layers3/></header>
      <div className="ftPrecisionBody"><nav>{(Object.keys(precisionTools) as PrecisionTool[]).map(key=><button type="button" key={key} className={precisionTool===key?'active':''} onClick={()=>setPrecisionTool(key)}><span>{precisionTools[key].label}</span><ChevronRight/></button>)}</nav><div className="ftPrecisionCalc"><div className="ftPrecisionTitle"><i>{precisionTool==='voltageDrop'?<Zap/>:<Calculator/>}</i><div><h3>{precisionConfig.label}</h3><p>{precisionConfig.caption}</p></div></div><div className="ftPrecisionFields">
        {['room','walls','roofPitch','concreteVolume','fencePosts','paintLitres','tileBoxes','voltageDrop','pipeFall'].includes(precisionTool)?field(precisionTool==='voltageDrop'||precisionTool==='pipeFall'||precisionTool==='fencePosts'?'Run length (m)':'Length (m)',lengthM,setLengthM):null}
        {['room','walls','roofPitch','concreteVolume','tileBoxes'].includes(precisionTool)?field('Width (m)',widthM,setWidthM):null}
        {['walls','paintLitres'].includes(precisionTool)?field('Wall height (m)',heightM,setHeightM):null}
        {['walls','paintLitres'].includes(precisionTool)?field('Doors / windows (m²)',openingsM2,setOpeningsM2):null}
        {precisionTool==='roofPitch'?field('Pitch rise',roofRise,setRoofRise,'1'):null}{precisionTool==='roofPitch'?field('Pitch run',roofRun,setRoofRun,'1','1'):null}
        {precisionTool==='concreteVolume'?field('Depth (m)',manualDepthM,setManualDepthM,'0.01','0.01'):null}
        {precisionTool==='fencePosts'?field('Post spacing (m)',spacingM,setSpacingM,'0.1','0.1'):null}
        {precisionTool==='paintLitres'?field('Number of coats',coats,setCoats,'1','1'):null}{precisionTool==='paintLitres'?field('Coverage (m²/L)',coverage,setCoverage,'0.5','0.1'):null}
        {precisionTool==='tileBoxes'?field('Coverage per box (m²)',boxCoverage,setBoxCoverage,'0.01','0.01'):null}
        {precisionTool==='voltageDrop'?field('Load current (A)',currentA,setCurrentA,'1'):null}{precisionTool==='voltageDrop'?field('Cable size (mm²)',cableSize,setCableSize,'0.5','0.1'):null}{precisionTool==='voltageDrop'?field('Supply voltage (V)',supplyVoltage,setSupplyVoltage,'1','1'):null}
        {precisionTool==='pipeFall'?field('Fall per metre (mm)',fallPerM,setFallPerM,'1'):null}
        <label><span>Unit price ({business.currency||'GHS'})</span><input type="number" min="0" step="0.01" value={precisionRate} onChange={event=>setPrecisionRate(Math.max(0,Number(event.target.value)||0))}/></label>
      </div><div className="ftPrecisionResult"><span>Calculated result</span><strong>{precisionResult.qty.toLocaleString()} {precisionConfig.unit}</strong><small>{precisionResult.description}</small>{precisionTool==='voltageDrop'?<em className={precisionResult.qty<=3?'good':'warn'}>{precisionResult.qty<=3?'Within a common 3% screening target':'Review conductor size, route or design before installation'}</em>:null}<button type="button" onClick={addPrecisionToTakeoff}><Plus/>Add this result to takeoff</button></div></div></div>
    </section>

    <section className="ftTakeoff">
      <header><div><span>04 · PROFESSIONAL TAKEOFF</span><h2>One site visit, one itemized estimate</h2><p>Combine map measurements and precision calculations. Adjust descriptions, quantities and prices before creating the estimate.</p></div><strong>{takeoffLines.length} line{takeoffLines.length===1?'':'s'}</strong></header>
      {takeoffLines.length?<div className="ftTakeoffTable"><div className="ftTakeoffHead"><span>Item / source</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total</span><span/></div>{takeoffLines.map(line=><article key={line.id}><div><small>{line.tool} · {line.source}</small><input value={line.description} aria-label="Takeoff item description" onChange={event=>updateTakeoffLine(line.id,{description:event.target.value})}/></div><input type="number" min="0" step="0.01" value={line.qty} aria-label="Takeoff quantity" onChange={event=>updateTakeoffLine(line.id,{qty:Math.max(0,Number(event.target.value)||0)})}/><input value={line.unit} aria-label="Takeoff unit" onChange={event=>updateTakeoffLine(line.id,{unit:event.target.value})}/><input type="number" min="0" step="0.01" value={line.rate} aria-label="Takeoff unit price" onChange={event=>updateTakeoffLine(line.id,{rate:Math.max(0,Number(event.target.value)||0)})}/><strong>{money(line.qty*line.rate,business.currency)}</strong><button type="button" aria-label={`Remove ${line.description}`} onClick={()=>setTakeoffLines(current=>current.filter(item=>item.id!==line.id))}><Trash2/></button></article>)}<footer><button type="button" onClick={()=>setTakeoffLines([])}><Trash2/>Clear takeoff</button><div><span>Takeoff total</span><strong>{money(takeoffTotal,business.currency)}</strong></div></footer></div>:<div className="ftTakeoffEmpty"><ClipboardList/><div><h3>Your takeoff basket is empty</h3><p>Add a measured map line or use one of the precision contractor calculators above.</p></div></div>}
    </section>

    <section className="ftSavePanel"><header><div><span>05 · SAVE & QUOTE</span><h2>Connect the complete field record to the job</h2><p>GPS, geometry and takeoff lines remain available offline and sync securely when signed in.</p></div></header><div className="ftSaveGrid"><label><span>Measurement name</span><input value={measurementName} onChange={event=>setMeasurementName(event.target.value)}/></label><label><span>Project / job</span><select value={projectId} onChange={event=>changeProject(event.target.value)}><option value="">No project selected</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name} · {project.customer}</option>)}</select></label><label><span>Customer</span><select value={selectedProject?.customerId||customerId} disabled={Boolean(selectedProject)} onChange={event=>setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label></div><div className="ftSaveActions"><button type="button" onClick={saveMeasurement} disabled={saving}><Save/>{saving?'Saving…':'Save field record'}</button><button type="button" className="primary" onClick={createEstimate}><FilePlus2/>Create itemized estimate <ChevronRight/></button></div></section>

    <section className="ftLowerGrid">
      <div className="ftSaved"><header><div><span>SAVED SITES</span><h2>Measurements & reusable takeoffs</h2></div><strong>{measurements.length}</strong></header>{measurements.length?<div>{measurements.map(record=><article key={record.id} className={record.id===selectedId?'active':''}><button type="button" className="ftSavedMain" onClick={()=>loadMeasurement(record)}><i>{record.mode==='area'?<PencilRuler/>:<Ruler/>}</i><span><small>{record.id}</small><b>{record.name}</b><em>{record.projectName||record.customerName||'Unlinked site'} · {record.takeoffLines?.length||0} takeoff lines</em></span><strong>{record.mode==='area'?`${round(record.areaM2)} m²`:`${round(record.distanceM)} m`}<small>{record.sync_state==='synced'?'Cloud synced':'Saved locally'}</small></strong><ChevronRight/></button><button type="button" className="ftDeleteSaved" aria-label={`Delete ${record.name}`} onClick={()=>removeMeasurement(record)}><Trash2/></button></article>)}</div>:<div className="ftEmpty"><MapPinned/><h3>No saved measurements yet</h3><p>Place your GPS pin, tap points on the map and save the field record.</p></div>}</div>
      <div className="ftRoutePlanner"><header><div><span>ROUTE PLANNER</span><h2>Order today’s site visits</h2><p>Select up to five measured sites. Your live GPS pin becomes the route origin.</p></div><Route/></header><div className="ftRouteStops">{measurements.length?measurements.map(record=><label key={record.id}><input type="checkbox" checked={routeIds.includes(record.id)} onChange={event=>{if(event.target.checked){if(routeIds.length>=5){setNotice('Mobile routes support five measured stops at a time.');return}setRouteIds([...routeIds,record.id])}else setRouteIds(routeIds.filter(id=>id!==record.id));setRouteOrder([])}}/><i>{routeIds.indexOf(record.id)+1||''}</i><span><b>{record.name}</b><small>{record.projectName||pointLabel(record.center)}</small></span></label>):<p>Save measured sites to plan a route.</p>}</div>{orderedRoute.length>0?<ol>{orderedRoute.map((record,index)=><li key={record.id}><i>{index+1}</i><span><b>{record.name}</b><small>{round(haversineDistance(index?centroid(orderedRoute[index-1].points,orderedRoute[index-1].center):(userLocation?.point||center),centroid(record.points,record.center))/1000,2)} km straight-line</small></span></li>)}</ol>:null}<footer><button type="button" onClick={optimizeRoute} disabled={!routeIds.length}><Sparkles/>Optimize order</button><button type="button" className="primary" onClick={openRoute} disabled={!routeIds.length}><Navigation/>Open road route <ExternalLink/></button></footer></div>
    </section>

    <section className="ftConnected"><header><span>QUOTIQ CONNECTED WORKFLOW</span><h2>The field tools around every job</h2><p>GPS takeoffs now flow into the operational features Quotiq has already built, so contractors do not need separate apps at each stage.</p></header><div>{connectedTools.map(({label,caption,path,status,Icon})=><button type="button" key={label} onClick={()=>navigate(path)}><i><Icon/></i><span><b>{label}</b><small>{caption}</small></span><em><Check/>{status}</em><ChevronRight/></button>)}</div><aside><FolderKanban/><p><b>Measurements support professional judgment.</b><span>GPS accuracy varies by device and surroundings. Confirm critical dimensions, cable design, roof structure and drainage levels with appropriate instruments before installation.</span></p></aside></section>
  </main>;
}
