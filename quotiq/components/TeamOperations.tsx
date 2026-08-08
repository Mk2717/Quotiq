'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Coffee, Download, Edit3, FolderKanban, Gauge, Mail, Pause, Phone, Play, Plus, RefreshCw, Search, ShieldCheck, Timer, UserPlus, Users, WalletCards, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listWorkforceTimeEntries, upsertWorkforceTimeEntry } from '../lib/supabase';
import { getStored, setStored, uid, uuid } from '../lib/storage';
import type { Business, Project, TeamAvailability, TeamMember, WorkforceTimeEntry } from '../types';

const cacheKey='q-workforce-time-entries';
const pageOpenedAt=Date.now();
const fallbackBusiness:Business={name:'My Business',email:'',phone:'',address:'',taxId:'',bank:'',accountName:'',accountNumber:'',mobileMoney:'',estimatePrefix:'EST',invoicePrefix:'INV',currency:'GHS'};
const commonRoles=['Owner','Operations manager','Project manager','Estimator','Dispatcher','Electrician','CCTV technician','Solar technician','Plumber','HVAC technician','Installer','Builder','Painter','Driver','Apprentice'];
const availabilityOptions:TeamAvailability[]=['Available','Off duty','Leave'];

type MemberDraft={name:string;role:string;phone:string;email:string;hourlyRate:number;crew:string;skills:string;status:'Active'|'Inactive';availability:TeamAvailability};
type ManualDraft={memberId:string;projectId:string;date:string;start:string;end:string;breakMinutes:number;note:string};

const emptyMember=():MemberDraft=>({name:'',role:'Technician',phone:'',email:'',hourlyRate:0,crew:'',skills:'',status:'Active',availability:'Available'});
const today=()=>new Date().toISOString().slice(0,10);
const emptyManual=(memberId='',projectId=''):ManualDraft=>({memberId,projectId,date:today(),start:'08:00',end:'17:00',breakMinutes:60,note:''});
const money=(value:number,currency='GHS')=>new Intl.NumberFormat('en-GH',{style:'currency',currency}).format(value||0);
const dateTime=(value:string)=>new Intl.DateTimeFormat('en-GH',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join('').toUpperCase()||'TM';
const mergeById=<T extends{id:string}>(primary:T[],secondary:T[])=>Array.from(new Map([...secondary,...primary].map(item=>[item.id,item])).values());
const csvCell=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;

function entryBreakMinutes(entry:WorkforceTimeEntry,now:number){
  if(entry.status!=='break'||!entry.break_started_at)return entry.break_minutes;
  return entry.break_minutes+Math.max(0,Math.round((now-new Date(entry.break_started_at).getTime())/60_000));
}
function entryHours(entry:WorkforceTimeEntry,now:number){
  const end=entry.clock_out?new Date(entry.clock_out).getTime():now;
  const gross=Math.max(0,end-new Date(entry.clock_in).getTime())/3_600_000;
  return Math.max(0,gross-entryBreakMinutes(entry,now)/60);
}
function mondayOf(value:string){
  const date=new Date(`${value}T12:00:00`),day=(date.getDay()+6)%7;
  date.setDate(date.getDate()-day);return date.toISOString().slice(0,10);
}
function moveWeek(value:string,days:number){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)}
function weekEnd(value:string){return moveWeek(value,6)}
function weekLabel(value:string){
  const start=new Date(`${value}T12:00:00`),end=new Date(`${weekEnd(value)}T12:00:00`),format=new Intl.DateTimeFormat('en-GH',{day:'numeric',month:'short'});
  return`${format.format(start)} – ${format.format(end)}`;
}

export default function TeamOperations({session}:{session:Session|null}){
  const navigate=useNavigate();
  const[team,setTeam]=useState<TeamMember[]>(()=>getStored('q-team',[]));
  const[projects,setProjects]=useState<Project[]>(()=>getStored('q-projects',[]));
  const[business,setBusiness]=useState<Business>(()=>getStored('q-business',fallbackBusiness));
  const[entries,setEntries]=useState<WorkforceTimeEntry[]>(()=>getStored(cacheKey,[]));
  const[tab,setTab]=useState<'people'|'timesheets'>('people');
  const[query,setQuery]=useState(''),[week,setWeek]=useState(()=>mondayOf(today()));
  const[selectedMemberId,setSelectedMemberId]=useState(()=>team.find(member=>member.status==='Active')?.id||'');
  const[clockProjectId,setClockProjectId]=useState(''),[clockNote,setClockNote]=useState('');
  const[memberOpen,setMemberOpen]=useState(false),[editingId,setEditingId]=useState<string|null>(null),[memberDraft,setMemberDraft]=useState<MemberDraft>(emptyMember);
  const[manualOpen,setManualOpen]=useState(false),[manualDraft,setManualDraft]=useState<ManualDraft>(()=>emptyManual(team[0]?.id||''));
  const[online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine),[loading,setLoading]=useState(Boolean(session));
  const[now,setNow]=useState(pageOpenedAt),[toast,setToast]=useState('');

  const replaceEntry=useCallback((entry:WorkforceTimeEntry)=>{
    setEntries(current=>{
      const next=current.map(item=>item.id===entry.id?entry:item).sort((a,b)=>b.clock_in.localeCompare(a.clock_in));
      setStored(cacheKey,next);return next;
    });
  },[]);
  const syncEntry=useCallback(async(entry:WorkforceTimeEntry)=>{
    if(!session||!navigator.onLine)return;
    try{const synced=await upsertWorkforceTimeEntry(entry);replaceEntry({...synced,sync_state:'synced'})}
    catch(error){setToast(error instanceof Error&&error.message.includes('one_open_shift')?'This team member already has an open shift on another device.':'Saved offline — Quotiq will sync this shift when connected.')}
  },[replaceEntry,session]);
  const persistEntry=useCallback((entry:WorkforceTimeEntry)=>{
    setEntries(current=>{
      const next=[entry,...current.filter(item=>item.id!==entry.id)].sort((a,b)=>b.clock_in.localeCompare(a.clock_in));
      setStored(cacheKey,next);return next;
    });
    if(session&&navigator.onLine)void syncEntry(entry);
  },[session,syncEntry]);

  useEffect(()=>{
    const storage=(event:Event)=>{
      const key=(event as CustomEvent<{key?:string}>).detail?.key;
      if(!key||key==='q-team')setTeam(getStored('q-team',[]));
      if(!key||key==='q-projects')setProjects(getStored('q-projects',[]));
      if(!key||key==='q-business')setBusiness(getStored('q-business',fallbackBusiness));
    };
    window.addEventListener('quotiq:storage',storage);return()=>window.removeEventListener('quotiq:storage',storage);
  },[]);
  useEffect(()=>{
    const connected=()=>setOnline(true),disconnected=()=>setOnline(false);
    window.addEventListener('online',connected);window.addEventListener('offline',disconnected);
    return()=>{window.removeEventListener('online',connected);window.removeEventListener('offline',disconnected)};
  },[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),2800);return()=>window.clearTimeout(timer)},[toast]);
  useEffect(()=>{
    if(!session)return;
    let active=true;
    listWorkforceTimeEntries().then(cloudEntries=>{
      if(!active)return;
      const pending=getStored<WorkforceTimeEntry[]>(cacheKey,[])
        .filter(item=>item.sync_state!=='synced')
        .map(item=>({...item,sync_state:'pending' as const}));
      const merged=mergeById(pending,cloudEntries.map(item=>({...item,sync_state:'synced' as const}))).sort((a,b)=>b.clock_in.localeCompare(a.clock_in));
      setEntries(merged);setStored(cacheKey,merged);pending.forEach(item=>void syncEntry(item));
    }).catch(()=>setToast('Using the saved offline workforce copy.')).finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[session,syncEntry]);
  useEffect(()=>{
    if(!session||!online)return;
    entries.filter(item=>item.sync_state==='pending').forEach(item=>void syncEntry(item));
  },[entries,online,session,syncEntry]);

  const activeEntries=useMemo(()=>entries.filter(entry=>entry.status!=='completed'),[entries]);
  const activeByMember=useMemo(()=>new Map(activeEntries.map(entry=>[entry.member_id,entry])),[activeEntries]);
  const selectedMember=team.find(member=>member.id===selectedMemberId)||null;
  const selectedEntry=selectedMember?activeByMember.get(selectedMember.id)||null:null;
  const activeProjects=projects.filter(project=>project.status!=='Completed');
  const pendingSync=entries.filter(entry=>entry.sync_state==='pending').length;
  const availableCount=team.filter(member=>member.status==='Active'&&!activeByMember.has(member.id)&&(member.availability||'Available')==='Available').length;
  const liveHours=activeEntries.reduce((sum,entry)=>sum+entryHours(entry,now),0);
  const liveCost=activeEntries.reduce((sum,entry)=>sum+entryHours(entry,now)*entry.hourly_rate,0);

  const weekRange=useMemo(()=>{
    const start=new Date(`${week}T00:00:00`).getTime(),end=new Date(`${moveWeek(week,7)}T00:00:00`).getTime();return{start,end};
  },[week]);
  const weekEntries=useMemo(()=>entries.filter(entry=>{const time=new Date(entry.clock_in).getTime();return time>=weekRange.start&&time<weekRange.end}),[entries,weekRange]);
  const weekHours=weekEntries.reduce((sum,entry)=>sum+entryHours(entry,now),0),weekCost=weekEntries.reduce((sum,entry)=>sum+entryHours(entry,now)*entry.hourly_rate,0);
  const memberSummary=useMemo(()=>team.map(member=>{
    const records=weekEntries.filter(entry=>entry.member_id===member.id),hours=records.reduce((sum,entry)=>sum+entryHours(entry,now),0);
    return{member,records,hours,cost:records.reduce((sum,entry)=>sum+entryHours(entry,now)*entry.hourly_rate,0)};
  }).filter(item=>item.records.length||item.member.status==='Active').sort((a,b)=>b.hours-a.hours),[now,team,weekEntries]);
  const filteredTeam=team.filter(member=>`${member.name} ${member.role} ${member.crew||''} ${(member.skills||[]).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));

  const saveTeam=(next:TeamMember[])=>{setTeam(next);setStored('q-team',next)};
  const openNewMember=()=>{setEditingId(null);setMemberDraft(emptyMember());setMemberOpen(true)};
  const openMember=(member:TeamMember)=>{
    setEditingId(member.id);setMemberDraft({name:member.name,role:member.role,phone:member.phone,email:member.email,hourlyRate:member.hourlyRate||0,crew:member.crew||'',skills:(member.skills||[]).join(', '),status:member.status,availability:member.availability||'Available'});setMemberOpen(true);
  };
  const submitMember=(event:FormEvent)=>{
    event.preventDefault();
    if(memberDraft.name.trim().length<2){setToast('Add the team member name.');return}
    if(editingId&&memberDraft.status==='Inactive'&&activeByMember.has(editingId)){setToast('Clock this team member out before making them inactive.');return}
    const member:TeamMember={id:editingId||uid('TM'),name:memberDraft.name.trim(),role:memberDraft.role.trim()||'Technician',phone:memberDraft.phone.trim(),email:memberDraft.email.trim().toLowerCase(),status:memberDraft.status,hourlyRate:Math.max(0,Number(memberDraft.hourlyRate)||0),crew:memberDraft.crew.trim(),skills:memberDraft.skills.split(',').map(value=>value.trim()).filter(Boolean).slice(0,12),availability:memberDraft.status==='Inactive'?'Off duty':memberDraft.availability};
    const next=editingId?team.map(item=>item.id===editingId?member:item):[member,...team];saveTeam(next);if(!selectedMemberId)setSelectedMemberId(member.id);setMemberOpen(false);setToast(editingId?'Team member updated':'Team member added');
  };
  const setMemberAvailability=(member:TeamMember,availability:TeamAvailability)=>{saveTeam(team.map(item=>item.id===member.id?{...item,availability}:item));setToast(`${member.name} is ${availability.toLowerCase()}`)};

  const projectTimeFromEntry=(entry:WorkforceTimeEntry)=>{
    if(!entry.project_id||!entry.clock_out)return;
    const hours=Number(entryHours(entry,new Date(entry.clock_out).getTime()).toFixed(2));if(hours<=0)return;
    const next=projects.map(project=>{
      if(project.id!==entry.project_id)return project;
      const timeEntries=project.timeEntries||[];if(timeEntries.some(item=>item.sourceEntryId===entry.id))return project;
      return{...project,timeEntries:[{id:uid('TIME'),sourceEntryId:entry.id,member:entry.member_name,date:entry.clock_in.slice(0,10),hours,hourlyRate:entry.hourly_rate,note:entry.note||'Workforce timesheet'},...timeEntries],activities:[{id:uid('ACT'),date:today(),type:'Labour',message:`${entry.member_name} logged ${hours} hours`},...(project.activities||[])]};
    });
    setProjects(next);setStored('q-projects',next);
  };
  const startShift=()=>{
    if(!selectedMember){setToast('Choose an active team member.');return}if(selectedEntry)return;
    const project=projects.find(item=>item.id===clockProjectId),stamp=new Date().toISOString();
    const entry:WorkforceTimeEntry={id:uuid(),member_id:selectedMember.id,member_name:selectedMember.name,project_id:project?.id||null,project_name:project?.name||null,clock_in:stamp,clock_out:null,break_started_at:null,break_minutes:0,hourly_rate:selectedMember.hourlyRate||0,status:'active',note:clockNote.trim()||null,sync_state:session?'pending':'local'};
    persistEntry(entry);setClockNote('');setToast(`${selectedMember.name} clocked in`);
  };
  const startBreak=()=>{if(!selectedEntry||selectedEntry.status!=='active')return;persistEntry({...selectedEntry,status:'break',break_started_at:new Date().toISOString(),sync_state:session?'pending':'local'});setToast('Break started')};
  const resumeShift=()=>{
    if(!selectedEntry||selectedEntry.status!=='break'||!selectedEntry.break_started_at)return;
    const stamp=new Date().toISOString(),minutes=selectedEntry.break_minutes+Math.max(0,Math.round((new Date(stamp).getTime()-new Date(selectedEntry.break_started_at).getTime())/60_000));
    persistEntry({...selectedEntry,status:'active',break_started_at:null,break_minutes:minutes,sync_state:session?'pending':'local'});setToast('Shift resumed');
  };
  const clockOut=()=>{
    if(!selectedEntry)return;const stamp=new Date().toISOString();let breaks=selectedEntry.break_minutes;
    if(selectedEntry.status==='break'&&selectedEntry.break_started_at)breaks+=Math.max(0,Math.round((new Date(stamp).getTime()-new Date(selectedEntry.break_started_at).getTime())/60_000));
    const completed:WorkforceTimeEntry={...selectedEntry,status:'completed',clock_out:stamp,break_started_at:null,break_minutes:breaks,sync_state:session?'pending':'local'};
    persistEntry(completed);projectTimeFromEntry(completed);setToast(`${selectedEntry.member_name} clocked out`);
  };
  const openManual=()=>{setManualDraft(emptyManual(selectedMemberId||team[0]?.id||'',clockProjectId));setManualOpen(true)};
  const submitManual=(event:FormEvent)=>{
    event.preventDefault();const member=team.find(item=>item.id===manualDraft.memberId),project=projects.find(item=>item.id===manualDraft.projectId);
    if(!member){setToast('Choose a team member.');return}
    const clockIn=new Date(`${manualDraft.date}T${manualDraft.start}:00`),clockOutValue=new Date(`${manualDraft.date}T${manualDraft.end}:00`);
    if(Number.isNaN(clockIn.getTime())||clockOutValue<=clockIn){setToast('End time must be later than start time.');return}
    const maximumBreak=Math.max(0,Math.floor((clockOutValue.getTime()-clockIn.getTime())/60_000)-1),breakMinutes=Math.min(Math.max(0,Math.round(manualDraft.breakMinutes)),maximumBreak);
    const entry:WorkforceTimeEntry={id:uuid(),member_id:member.id,member_name:member.name,project_id:project?.id||null,project_name:project?.name||null,clock_in:clockIn.toISOString(),clock_out:clockOutValue.toISOString(),break_started_at:null,break_minutes:breakMinutes,hourly_rate:member.hourlyRate||0,status:'completed',note:manualDraft.note.trim()||null,sync_state:session?'pending':'local'};
    persistEntry(entry);projectTimeFromEntry(entry);setManualOpen(false);setTab('timesheets');setWeek(mondayOf(manualDraft.date));setToast('Completed time entry added');
  };
  const exportWeek=()=>{
    const rows=[['Team member','Project','Clock in','Clock out','Break minutes','Hours','Hourly cost','Labour cost','Status','Note'],...weekEntries.map(entry=>[entry.member_name,entry.project_name||'General',new Date(entry.clock_in).toLocaleString(),entry.clock_out?new Date(entry.clock_out).toLocaleString():'Open',entryBreakMinutes(entry,now),entryHours(entry,now).toFixed(2),entry.hourly_rate.toFixed(2),(entryHours(entry,now)*entry.hourly_rate).toFixed(2),entry.status,entry.note||''])];
    const blob=new Blob([rows.map(row=>row.map(csvCell).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`quotiq-timesheet-${week}.csv`;link.click();URL.revokeObjectURL(url);setToast('Weekly timesheet exported');
  };

  return <main className="woPage">
    {toast&&<div className="woToast" role="status"><Check/>{toast}</div>}
    <header className="woHero"><div><button className="woBack" onClick={()=>navigate('/')}><ArrowLeft/>Dashboard</button><span>TEAM & TIMESHEETS</span><h1>Know who is working—and what every hour costs.</h1><p>Build crews, clock time against jobs and turn completed shifts into live project labour cost, online or offline.</p></div><div className="woHeroActions"><button onClick={openManual}><Plus/>Add time</button><button className="woPrimary" onClick={openNewMember}><UserPlus/>Add team member</button></div></header>
    <section className="woStats">
      <article><i><Users/></i><div><span>Active team</span><strong>{team.filter(member=>member.status==='Active').length}</strong><small>{availableCount} available</small></div></article>
      <article className={activeEntries.length?'live':''}><i><Gauge/></i><div><span>Working now</span><strong>{activeEntries.length}</strong><small>{liveHours.toFixed(1)} live hrs</small></div></article>
      <article><i><WalletCards/></i><div><span>Live labour cost</span><strong>{money(liveCost,business.currency)}</strong><small>Open shifts</small></div></article>
      <article className={pendingSync?'attention':''}><i>{pendingSync?<RefreshCw/>:<ShieldCheck/>}</i><div><span>{session?'Secure sync':'Offline workspace'}</span><strong>{pendingSync||'✓'}</strong><small>{pendingSync?'Waiting to upload':online?'Up to date':'Offline copy ready'}</small></div></article>
    </section>

    <section className="woClock"><header><div><span>LIVE SHIFT DESK</span><h2>Clock crew time to the right job</h2></div>{selectedEntry&&<em className={selectedEntry.status}><i/>{selectedEntry.status==='break'?'On break':'Clocked in'} · {entryHours(selectedEntry,now).toFixed(2)} hrs</em>}</header>
      <div className="woClockGrid"><label><span>Team member</span><select value={selectedMemberId} onChange={event=>setSelectedMemberId(event.target.value)}><option value="">Choose team member</option>{team.filter(member=>member.status==='Active').map(member=><option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label><label><span>Project / job</span><select value={selectedEntry?.project_id||clockProjectId} disabled={Boolean(selectedEntry)} onChange={event=>setClockProjectId(event.target.value)}><option value="">General / non-project work</option>{activeProjects.map(project=><option key={project.id} value={project.id}>{project.name} · {project.customer}</option>)}</select></label><label className="woClockNote"><span>Work note</span><input value={selectedEntry?.note||clockNote} disabled={Boolean(selectedEntry)} onChange={event=>setClockNote(event.target.value)} placeholder="e.g. Cable routing and camera mounting"/></label><div className="woClockActions">{!selectedEntry?<button className="start" disabled={!selectedMember} onClick={startShift}><Play/>Clock in</button>:<>{selectedEntry.status==='active'?<button className="break" onClick={startBreak}><Coffee/>Start break</button>:<button className="resume" onClick={resumeShift}><Play/>Resume</button>}<button className="stop" onClick={clockOut}><Pause/>Clock out</button></>}</div></div>
      {selectedEntry&&<footer><span><Clock3/>Started {dateTime(selectedEntry.clock_in)}</span><span><FolderKanban/>{selectedEntry.project_name||'General work'}</span><span><Coffee/>{entryBreakMinutes(selectedEntry,now)} min break</span><strong>{money(entryHours(selectedEntry,now)*selectedEntry.hourly_rate,business.currency)} labour cost</strong></footer>}
    </section>

    <nav className="woTabs"><button className={tab==='people'?'active':''} onClick={()=>setTab('people')}><Users/>People <b>{team.length}</b></button><button className={tab==='timesheets'?'active':''} onClick={()=>setTab('timesheets')}><Timer/>Timesheets <b>{entries.length}</b></button></nav>

    {tab==='people'?<section className="woPeoplePanel"><header><div><span>CREW DIRECTORY</span><h2>Your workforce</h2><p>Keep roles, rates, skills and availability ready for dispatch.</p></div><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search people, crews or skills…"/><small>{filteredTeam.length}</small></label></header>{filteredTeam.length?<div className="woPeopleGrid">{filteredTeam.map(member=>{const shift=activeByMember.get(member.id),availability=shift?shift.status==='break'?'On break':'On job':member.status==='Inactive'?'Inactive':member.availability||'Available';return <article key={member.id} className={shift?'working':''}><header><i>{initials(member.name)}</i><div><h3>{member.name}</h3><span>{member.role}</span></div><em className={availability.toLowerCase().replaceAll(' ','-')}>{shift&&<i/>}{availability}</em></header><div className="woMemberMeta"><span><BriefcaseBusiness/>{member.crew||'No crew assigned'}</span>{member.phone&&<a href={`tel:${member.phone}`}><Phone/>{member.phone}</a>}{member.email&&<a href={`mailto:${member.email}`}><Mail/>{member.email}</a>}</div><div className="woSkills">{(member.skills||[]).length?(member.skills||[]).slice(0,4).map(skill=><span key={skill}>{skill}</span>):<span>Skills not added</span>}</div>{shift?<div className="woShiftMini"><div><b>{shift.project_name||'General work'}</b><span>{entryHours(shift,now).toFixed(2)} hrs · {money(entryHours(shift,now)*shift.hourly_rate,business.currency)}</span></div><button onClick={()=>{setSelectedMemberId(member.id);window.scrollTo({top:0,behavior:'smooth'})}}>Open shift</button></div>:<div className="woAvailability"><span>Availability</span><select disabled={member.status==='Inactive'} value={member.status==='Inactive'?'Off duty':member.availability||'Available'} onChange={event=>setMemberAvailability(member,event.target.value as TeamAvailability)}>{availabilityOptions.map(value=><option key={value}>{value}</option>)}</select></div>}<footer><span><WalletCards/>{money(member.hourlyRate||0,business.currency)} / hr</span><button onClick={()=>openMember(member)}><Edit3/>Edit</button>{!shift&&member.status==='Active'&&<button className="quick" onClick={()=>{setSelectedMemberId(member.id);window.scrollTo({top:0,behavior:'smooth'})}}><Play/>Start shift</button>}</footer></article>})}</div>:<div className="woEmpty"><Users/><h3>{team.length?'No team members match your search':'Build your first crew'}</h3><p>{team.length?'Try a different name, role or skill.':'Add technicians and managers so you can assign work and track labour cost.'}</p>{!team.length&&<button className="woPrimary" onClick={openNewMember}><UserPlus/>Add first member</button>}</div>}</section>:
    <section className="woTimesheets"><header className="woTimesheetHead"><div><span>WEEKLY TIMESHEET</span><h2>Payroll-ready labour summary</h2><p>Completed and active shifts for the selected week.</p></div><div className="woWeekControls"><button onClick={()=>setWeek(moveWeek(week,-7))} aria-label="Previous week"><ChevronLeft/></button><button className="current" onClick={()=>setWeek(mondayOf(today()))}><CalendarDays/><span>{weekLabel(week)}</span></button><button onClick={()=>setWeek(moveWeek(week,7))} aria-label="Next week"><ChevronRight/></button><button className="export" onClick={exportWeek} disabled={!weekEntries.length}><Download/>Export CSV</button></div></header><section className="woWeekStats"><article><span>Total hours</span><strong>{weekHours.toFixed(2)}</strong><small>{weekEntries.length} shift records</small></article><article><span>Labour cost</span><strong>{money(weekCost,business.currency)}</strong><small>Based on hourly cost</small></article><article><span>People recorded</span><strong>{new Set(weekEntries.map(entry=>entry.member_id)).size}</strong><small>{activeEntries.length} working now</small></article></section>
      <div className="woTimesheetLayout"><section className="woMemberSummary"><header><span>TEAM SUMMARY</span><b>{memberSummary.length}</b></header>{memberSummary.map(item=><article key={item.member.id}><i>{initials(item.member.name)}</i><div><b>{item.member.name}</b><span>{item.records.length} shift{item.records.length===1?'':'s'} · {item.member.role}</span></div><strong>{item.hours.toFixed(2)} hrs<small>{money(item.cost,business.currency)}</small></strong></article>)}</section><section className="woTimeLog"><header><span>TIME RECORDS</span><button onClick={openManual}><Plus/>Add time</button></header>{loading?<div className="woLoading"><RefreshCw/>Loading secure timesheets…</div>:weekEntries.length?weekEntries.map(entry=><article key={entry.id}><i className={entry.status}><Timer/></i><div><b>{entry.member_name}</b><span>{entry.project_name||'General work'}</span><small>{dateTime(entry.clock_in)} → {entry.clock_out?dateTime(entry.clock_out):entry.status==='break'?'On break':'Working now'} · {entryBreakMinutes(entry,now)} min break</small></div><strong>{entryHours(entry,now).toFixed(2)} hrs<small>{money(entryHours(entry,now)*entry.hourly_rate,business.currency)}</small></strong><em className={entry.sync_state||'synced'}>{entry.sync_state==='pending'?'Waiting to sync':entry.sync_state==='local'?'On this device':entry.status}</em></article>):<div className="woEmpty small"><Timer/><h3>No time recorded this week</h3><p>Clock in a crew member or add a completed shift.</p><button onClick={openManual}><Plus/>Add time</button></div>}</section></div><p className="woPayrollNote"><ShieldCheck/><span><b>Private cost records</b> Hourly rates and labour cost stay inside the contractor workspace and are never printed on client estimates or invoices.</span></p></section>}

    {memberOpen&&<div className="woModal" role="dialog" aria-modal="true" aria-labelledby="woMemberTitle"><button className="woBackdrop" onClick={()=>setMemberOpen(false)} aria-label="Close team member editor"/><form onSubmit={submitMember}><header><div><span>CREW PROFILE</span><h2 id="woMemberTitle">{editingId?'Edit team member':'Add team member'}</h2><p>Set the details used for scheduling and labour cost.</p></div><button type="button" onClick={()=>setMemberOpen(false)} aria-label="Close"><X/></button></header><div className="woFormGrid"><label className="wide"><span>Full name *</span><input required value={memberDraft.name} onChange={event=>setMemberDraft({...memberDraft,name:event.target.value})} maxLength={180}/></label><label><span>Role / trade</span><input list="woRoles" value={memberDraft.role} onChange={event=>setMemberDraft({...memberDraft,role:event.target.value})} maxLength={100}/><datalist id="woRoles">{commonRoles.map(role=><option value={role} key={role}/>)}</datalist></label><label><span>Crew / branch</span><input value={memberDraft.crew} onChange={event=>setMemberDraft({...memberDraft,crew:event.target.value})} placeholder="e.g. Installation crew A" maxLength={100}/></label><label><span>Phone</span><input type="tel" value={memberDraft.phone} onChange={event=>setMemberDraft({...memberDraft,phone:event.target.value})} maxLength={80}/></label><label><span>Email</span><input type="email" value={memberDraft.email} onChange={event=>setMemberDraft({...memberDraft,email:event.target.value})} maxLength={180}/></label><label><span>Hourly labour cost</span><input type="number" min="0" step="0.01" value={memberDraft.hourlyRate} onChange={event=>setMemberDraft({...memberDraft,hourlyRate:Number(event.target.value)})}/></label><label><span>Availability</span><select value={memberDraft.availability} onChange={event=>setMemberDraft({...memberDraft,availability:event.target.value as TeamAvailability})}>{availabilityOptions.map(value=><option key={value}>{value}</option>)}</select></label><label className="wide"><span>Skills (separate with commas)</span><input value={memberDraft.skills} onChange={event=>setMemberDraft({...memberDraft,skills:event.target.value})} placeholder="CCTV, fibre termination, testing" maxLength={500}/></label><label className="wide woMemberStatus"><span>Member status</span><select value={memberDraft.status} onChange={event=>setMemberDraft({...memberDraft,status:event.target.value as TeamMember['status']})}><option>Active</option><option>Inactive</option></select><small>Inactive members stay in old timesheets but cannot start new shifts.</small></label></div><footer><button type="button" onClick={()=>setMemberOpen(false)}>Cancel</button><button className="woPrimary"><Check/>{editingId?'Save changes':'Add team member'}</button></footer></form></div>}

    {manualOpen&&<div className="woModal" role="dialog" aria-modal="true" aria-labelledby="woManualTitle"><button className="woBackdrop" onClick={()=>setManualOpen(false)} aria-label="Close time entry editor"/><form onSubmit={submitManual}><header><div><span>COMPLETED SHIFT</span><h2 id="woManualTitle">Add time entry</h2><p>Record work completed earlier or correct a missed clock-in.</p></div><button type="button" onClick={()=>setManualOpen(false)} aria-label="Close"><X/></button></header><div className="woFormGrid"><label><span>Team member *</span><select required value={manualDraft.memberId} onChange={event=>setManualDraft({...manualDraft,memberId:event.target.value})}><option value="">Choose person</option>{team.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label><span>Project / job</span><select value={manualDraft.projectId} onChange={event=>setManualDraft({...manualDraft,projectId:event.target.value})}><option value="">General / non-project work</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>Date</span><input type="date" required value={manualDraft.date} onChange={event=>setManualDraft({...manualDraft,date:event.target.value})}/></label><label><span>Unpaid break (minutes)</span><input type="number" min="0" max="10080" value={manualDraft.breakMinutes} onChange={event=>setManualDraft({...manualDraft,breakMinutes:Number(event.target.value)})}/></label><label><span>Start time</span><input type="time" required value={manualDraft.start} onChange={event=>setManualDraft({...manualDraft,start:event.target.value})}/></label><label><span>End time</span><input type="time" required value={manualDraft.end} onChange={event=>setManualDraft({...manualDraft,end:event.target.value})}/></label><label className="wide"><span>Work note</span><textarea rows={3} value={manualDraft.note} onChange={event=>setManualDraft({...manualDraft,note:event.target.value})} placeholder="What work was completed?" maxLength={1200}/></label></div><footer><button type="button" onClick={()=>setManualOpen(false)}>Cancel</button><button className="woPrimary"><Check/>Save completed shift</button></footer></form></div>}
  </main>;
}
