import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  MapPin,
  Plus,
  Route,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Project, ScheduleStatus, TeamMember } from '../types';
import { getStored, setStored } from '../lib/storage';

const today=()=>new Date().toISOString().slice(0,10);
const parseDate=(value:string)=>new Date(`${value}T12:00:00`);
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(value:string,days:number)=>{const date=parseDate(value);date.setDate(date.getDate()+days);return iso(date)};
const mondayOf=(value:string)=>{const date=parseDate(value),day=(date.getDay()+6)%7;date.setDate(date.getDate()-day);return iso(date)};
const prettyDay=(value:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(parseDate(value));
const prettyRange=(start:string)=>{const end=addDays(start,6),a=parseDate(start),b=parseDate(end);return a.getMonth()===b.getMonth()?`${a.getDate()}–${b.getDate()} ${new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(b)}`:`${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(a)} – ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(b)}`};
const minutes=(value='')=>{const [hour=0,minute=0]=value.split(':').map(Number);return hour*60+minute};
const duration=(start='',end='')=>Math.max(0,minutes(end)-minutes(start));
const overlaps=(aStart='',aEnd='',bStart='',bEnd='')=>Boolean(aStart&&aEnd&&bStart&&bEnd&&minutes(aStart)<minutes(bEnd)&&minutes(bStart)<minutes(aEnd));
const statusClass=(value?:string)=>String(value||'Scheduled').toLowerCase().replaceAll(' ','-');

export default function ScheduleV2(){
  const navigate=useNavigate();
  const[projects,setProjects]=useState<Project[]>(()=>getStored('q-projects',[]));
  const team=getStored<TeamMember[]>('q-team',[]).filter(member=>member.status==='Active');
  const[weekStart,setWeekStart]=useState(()=>mondayOf(today()));
  const[selectedDay,setSelectedDay]=useState(today());
  const[query,setQuery]=useState('');
  const[view,setView]=useState<'week'|'agenda'>('week');
  const[editorId,setEditorId]=useState<string|null>(null);
  const[editorOpen,setEditorOpen]=useState(false);
  const days=useMemo(()=>Array.from({length:7},(_,index)=>addDays(weekStart,index)),[weekStart]);
  const weekEnd=days[6];
  const scheduled=projects.filter(project=>project.scheduleDate);
  const weekJobs=scheduled
    .filter(project=>Boolean(project.scheduleDate)&&project.scheduleDate!>=weekStart&&project.scheduleDate!<=weekEnd)
    .sort(sortJobs);
  const selectedJobs=weekJobs.filter(project=>project.scheduleDate===selectedDay);
  const unscheduled=projects.filter(project=>project.status!=='Completed'&&!project.scheduleDate&&[project.name,project.customer,project.assignee].join(' ').toLowerCase().includes(query.toLowerCase()));
  const todayJobs=scheduled.filter(project=>project.scheduleDate===today()&&project.scheduleStatus!=='Completed');
  const conflicts=countConflicts(weekJobs);
  const openEditor=(id?:string)=>{setEditorId(id||null);setEditorOpen(true)};
  const persist=(next:Project[])=>{setProjects(next);setStored('q-projects',next)};
  const saveSchedule=(id:string,changes:Partial<Project>)=>persist(projects.map(project=>project.id===id?{...project,...changes}:project));
  const unschedule=(id:string)=>{persist(projects.map(project=>project.id===id?{...project,scheduleDate:undefined,scheduleStart:undefined,scheduleEnd:undefined,scheduleStatus:undefined,crewMemberIds:undefined,scheduleNotes:undefined}:project));setEditorOpen(false)};
  const goWeek=(offset:number)=>{const next=addDays(weekStart,offset*7);setWeekStart(next);setSelectedDay(next)};
  const goToday=()=>{setWeekStart(mondayOf(today()));setSelectedDay(today())};

  return <main className="schPage">
    <header className="schHero">
      <div>
        <button className="schBack" onClick={()=>navigate('/')}><ArrowLeft/><LayoutDashboard/>Dashboard</button>
        <span>SCHEDULING & DISPATCH</span>
        <h1>Put the right crew on every job</h1>
        <p>Plan work, prevent double-booking and keep technicians clear on where they need to be.</p>
      </div>
      <div className="schHeroActions"><button onClick={()=>navigate('/projects/new')}><FolderKanban/>New project</button><button className="schPrimary" onClick={()=>openEditor()}><Plus/>Schedule job</button></div>
    </header>

    <section className="schStats">
      <article><i><CalendarCheck2/></i><div><span>This week</span><strong>{weekJobs.length}</strong><small>scheduled jobs</small></div></article>
      <article><i><Clock3/></i><div><span>Today</span><strong>{todayJobs.length}</strong><small>active visits</small></div></article>
      <article className={unscheduled.length?'attention':''}><i><CircleDot/></i><div><span>Unscheduled</span><strong>{unscheduled.length}</strong><small>jobs need a slot</small></div></article>
      <article className={conflicts?'danger':''}><i><AlertTriangle/></i><div><span>Conflicts</span><strong>{conflicts}</strong><small>{conflicts?'crew overlaps found':'schedule is clear'}</small></div></article>
    </section>

    <section className="schBoard">
      <header className="schToolbar">
        <div className="schWeekControl"><button aria-label="Previous week" onClick={()=>goWeek(-1)}><ChevronLeft/></button><button className="schToday" onClick={goToday}>Today</button><button aria-label="Next week" onClick={()=>goWeek(1)}><ChevronRight/></button><div><span>WORK WEEK</span><h2>{prettyRange(weekStart)}</h2></div></div>
        <div className="schViewSwitch"><button className={view==='week'?'active':''} onClick={()=>setView('week')}><CalendarDays/>Week</button><button className={view==='agenda'?'active':''} onClick={()=>setView('agenda')}><Route/>Agenda</button></div>
      </header>

      <div className="schMobileDays">{days.map(day=><button key={day} className={`${day===selectedDay?'active':''} ${day===today()?'today':''}`} onClick={()=>setSelectedDay(day)}><span>{new Intl.DateTimeFormat('en-GB',{weekday:'short'}).format(parseDate(day))}</span><b>{parseDate(day).getDate()}</b><i>{weekJobs.filter(project=>project.scheduleDate===day).length||''}</i></button>)}</div>

      {view==='week'?<div className="schWeekGrid">{days.map(day=><section className={`${day===today()?'today':''}`} key={day}><header><span>{new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(parseDate(day))}</span><b>{parseDate(day).getDate()}</b><small>{weekJobs.filter(project=>project.scheduleDate===day).length} jobs</small></header><div>{weekJobs.filter(project=>project.scheduleDate===day).map(project=><JobCard key={project.id} project={project} team={team} open={()=>openEditor(project.id)}/>)}{!weekJobs.some(project=>project.scheduleDate===day)&&<button className="schEmptySlot" onClick={()=>{setSelectedDay(day);openEditor()}}><Plus/><span>Add job</span></button>}</div></section>)}</div>:<div className="schAgenda">{days.map(day=>{const jobs=weekJobs.filter(project=>project.scheduleDate===day);return <section key={day}><header><div><span>{new Intl.DateTimeFormat('en-GB',{weekday:'long'}).format(parseDate(day))}</span><h3>{prettyDay(day)}</h3></div><b>{jobs.length} job{jobs.length===1?'':'s'}</b></header>{jobs.length?jobs.map(project=><AgendaRow key={project.id} project={project} team={team} open={()=>openEditor(project.id)}/>):<button className="schAgendaEmpty" onClick={()=>{setSelectedDay(day);openEditor()}}><Plus/>Schedule a job</button>}</section>})}</div>}

      <div className="schMobileAgenda"><header><div><span>SELECTED DAY</span><h2>{prettyDay(selectedDay)}</h2></div><button onClick={()=>openEditor()}><Plus/>Add</button></header>{selectedJobs.length?selectedJobs.map(project=><AgendaRow key={project.id} project={project} team={team} open={()=>openEditor(project.id)}/>):<div className="schNoJobs"><CalendarDays/><b>No work scheduled</b><span>This day is available for a new job.</span><button className="schPrimary" onClick={()=>openEditor()}>Schedule a job</button></div>}</div>
    </section>

    <div className="schLowerGrid">
      <section className="schQueue">
        <header><div><span>DISPATCH QUEUE</span><h2>Jobs waiting for a time</h2></div><b>{unscheduled.length}</b></header>
        <label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search unscheduled jobs…"/></label>
        <div>{unscheduled.length?unscheduled.slice(0,8).map(project=><article key={project.id}><i><FolderKanban/></i><div><b>{project.name}</b><span>{project.customer}</span><small>{project.siteAddress||'Site address not added'} · Due {project.dueDate||'not set'}</small></div><button onClick={()=>openEditor(project.id)}>Schedule</button></article>):<div className="schClear"><Check/><b>Everything is scheduled</b><span>No active project is waiting for a slot.</span></div>}</div>
      </section>

      <section className="schCrewBoard">
        <header><div><span>CREW CAPACITY</span><h2>Team workload</h2></div><Users/></header>
        {team.length?team.map(member=>{const jobs=weekJobs.filter(project=>(project.crewMemberIds||[]).includes(member.id)),workMinutes=jobs.reduce((sum,project)=>sum+duration(project.scheduleStart,project.scheduleEnd),0),next=jobs.find(project=>project.scheduleDate!>=today());return <article key={member.id}><div className="schAvatar">{member.name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase()}</div><div><b>{member.name}</b><span>{member.role}</span><small>{next?`Next: ${prettyDay(next.scheduleDate!)} · ${next.scheduleStart||'All day'}`:'No upcoming assignment'}</small></div><strong>{jobs.length} job{jobs.length===1?'':'s'}<small>{Math.round(workMinutes/60*10)/10} hrs</small></strong></article>}):<div className="schClear"><Users/><b>No active technicians</b><span>Add team members before assigning crews.</span><button onClick={()=>navigate('/team')}>Open team</button></div>}
      </section>
    </div>

    {editorOpen&&<ScheduleEditor key={`${editorId||'new'}-${selectedDay}`} initialId={editorId} defaultDate={selectedDay} projects={projects} team={team} close={()=>setEditorOpen(false)} save={(id,changes)=>{saveSchedule(id,changes);setEditorOpen(false)}} unschedule={unschedule}/>} 
  </main>;
}

function sortJobs(a:Project,b:Project){return `${a.scheduleDate||''}${a.scheduleStart||''}`.localeCompare(`${b.scheduleDate||''}${b.scheduleStart||''}`)}

function countConflicts(projects:Project[]){
  let count=0;
  for(let i=0;i<projects.length;i++)for(let j=i+1;j<projects.length;j++){
    const a=projects[i],b=projects[j],shared=(a.crewMemberIds||[]).some(id=>(b.crewMemberIds||[]).includes(id));
    if(a.scheduleDate===b.scheduleDate&&shared&&overlaps(a.scheduleStart,a.scheduleEnd,b.scheduleStart,b.scheduleEnd))count++;
  }
  return count;
}

function crewNames(project:Project,team:TeamMember[]){
  const names=(project.crewMemberIds||[]).map(id=>team.find(member=>member.id===id)?.name).filter(Boolean) as string[];
  return names.length?names.join(', '):project.assignee||'Unassigned';
}

function JobCard({project,team,open}:{project:Project;team:TeamMember[];open:()=>void}){
  return <button className={`schJob ${statusClass(project.scheduleStatus)}`} onClick={open}><span>{project.scheduleStart||'All day'}{project.scheduleEnd?`–${project.scheduleEnd}`:''}</span><h3>{project.name}</h3><p>{project.customer}</p><small><UserRound/>{crewNames(project,team)}</small>{project.siteAddress&&<small><MapPin/>{project.siteAddress}</small>}<em>{project.scheduleStatus||'Scheduled'}</em></button>;
}

function AgendaRow({project,team,open}:{project:Project;team:TeamMember[];open:()=>void}){
  return <button className="schAgendaRow" onClick={open}><time><b>{project.scheduleStart||'All day'}</b><span>{project.scheduleEnd||''}</span></time><i className={statusClass(project.scheduleStatus)}/><div><h3>{project.name}</h3><p>{project.customer} · {crewNames(project,team)}</p><small>{project.siteAddress||'Site address not added'}</small></div><em>{project.scheduleStatus||'Scheduled'}</em><ChevronRight/></button>;
}

function ScheduleEditor({initialId,defaultDate,projects,team,close,save,unschedule}:{initialId:string|null;defaultDate:string;projects:Project[];team:TeamMember[];close:()=>void;save:(id:string,changes:Partial<Project>)=>void;unschedule:(id:string)=>void}){
  const initial=projects.find(project=>project.id===initialId);
  const isEditing=Boolean(initial?.scheduleDate);
  const[projectId,setProjectId]=useState(initialId||projects.find(project=>project.status!=='Completed'&&!project.scheduleDate)?.id||projects.find(project=>project.status!=='Completed')?.id||'');
  const project=projects.find(item=>item.id===projectId);
  const[date,setDate]=useState(initial?.scheduleDate||defaultDate||today());
  const[start,setStart]=useState(initial?.scheduleStart||'08:00');
  const[end,setEnd]=useState(initial?.scheduleEnd||'10:00');
  const[status,setStatus]=useState<ScheduleStatus>(initial?.scheduleStatus||'Scheduled');
  const[crew,setCrew]=useState<string[]>(initial?.crewMemberIds||team.filter(member=>member.name===initial?.assignee).map(member=>member.id));
  const[notes,setNotes]=useState(initial?.scheduleNotes||'');
  const[error,setError]=useState('');
  const conflicts=useMemo(()=>projects.filter(other=>other.id!==projectId&&other.scheduleDate===date&&overlaps(start,end,other.scheduleStart,other.scheduleEnd)&&(other.crewMemberIds||[]).some(id=>crew.includes(id))),[projects,projectId,date,start,end,crew]);
  const toggleCrew=(id:string)=>setCrew(rows=>rows.includes(id)?rows.filter(value=>value!==id):[...rows,id]);
  const submit=()=>{
    if(!project){setError('Choose a project to schedule.');return}
    if(!date||!start||!end){setError('Choose a date, start time and end time.');return}
    if(minutes(end)<=minutes(start)){setError('End time must be later than the start time.');return}
    const lead=team.find(member=>member.id===crew[0]);
    save(project.id,{scheduleDate:date,scheduleStart:start,scheduleEnd:end,scheduleStatus:status,crewMemberIds:crew,scheduleNotes:notes.trim(),assignee:lead?.name||project.assignee,status:status==='Completed'?'Completed':status==='In Progress'?'In Progress':project.status==='Completed'?'Planned':project.status});
  };
  return <div className="schOverlay" role="dialog" aria-modal="true" aria-labelledby="schEditorTitle"><button className="schBackdrop" aria-label="Close schedule editor" onClick={close}/><section className="schEditor"><header><div><i><CalendarCheck2/></i><span><small>DISPATCH JOB</small><h2 id="schEditorTitle">{isEditing?'Edit scheduled visit':'Schedule a project'}</h2></span></div><button onClick={close} aria-label="Close"><X/></button></header>
    <div className="schEditorBody">
      <label className="full"><span>Project / job</span><select value={projectId} disabled={isEditing} onChange={event=>setProjectId(event.target.value)}><option value="">Select project</option>{projects.filter(item=>item.status!=='Completed'||item.id===projectId).map(item=><option key={item.id} value={item.id}>{item.name} · {item.customer}</option>)}</select></label>
      {project&&<div className="schProjectSummary"><FolderKanban/><div><b>{project.name}</b><span>{project.customer}</span><small><MapPin/>{project.siteAddress||'Site address not added'}</small></div><button onClick={()=>location.hash=`#/projects/${encodeURIComponent(project.id)}`}><ArrowLeft/>Open</button></div>}
      <div className="schEditorGrid"><label><span>Visit date</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label><span>Dispatch status</span><select value={status} onChange={event=>setStatus(event.target.value as ScheduleStatus)}><option>Scheduled</option><option>Dispatched</option><option>In Progress</option><option>Completed</option></select></label><label><span>Start time</span><input type="time" value={start} onChange={event=>setStart(event.target.value)}/></label><label><span>End time</span><input type="time" value={end} onChange={event=>setEnd(event.target.value)}/></label></div>
      <section className="schCrewPicker"><header><div><span>ASSIGN CREW</span><h3>Who is going to the site?</h3></div><small>{crew.length} selected</small></header>{team.length?<div>{team.map(member=><button type="button" className={crew.includes(member.id)?'selected':''} key={member.id} onClick={()=>toggleCrew(member.id)}><i>{crew.includes(member.id)?<Check/>:member.name.slice(0,1)}</i><span><b>{member.name}</b><small>{member.role}</small></span></button>)}</div>:<p>Add active team members in the Team panel before assigning a crew.</p>}</section>
      {conflicts.length>0&&<div className="schConflict"><AlertTriangle/><div><b>Crew scheduling conflict</b><span>{conflicts.map(item=>`${item.name} (${item.scheduleStart}–${item.scheduleEnd})`).join(', ')}</span></div></div>}
      <label className="full"><span>Dispatch note</span><textarea rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Access instructions, contact person, tools or materials to carry…"/></label>
      {error&&<div className="schError"><AlertTriangle/>{error}</div>}
    </div>
    <footer>{isEditing&&initial?<button className="schRemove" onClick={()=>unschedule(initial.id)}>Remove from schedule</button>:<span/>}<div><button onClick={close}>Cancel</button><button className="schPrimary" disabled={!project} onClick={submit}><Send/>{conflicts.length?'Schedule anyway':'Save schedule'}</button></div></footer>
  </section></div>;
}
