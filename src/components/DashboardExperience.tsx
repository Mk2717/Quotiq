import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilePlus2, ReceiptText, UserPlus, FolderPlus, CalendarDays, ArrowUpRight, CircleDollarSign, Activity, PackageSearch } from 'lucide-react';

type AnyRecord = Record<string, any>;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const money = (value = 0, currency = 'GHS') =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(value);

const go = (path: string) => {
  window.location.hash = path;
};

export default function DashboardExperience() {
  const [target, setTarget] = useState<Element | null>(null);
  const [isDashboard, setIsDashboard] = useState(() => !window.location.hash || window.location.hash === '#/' || window.location.hash === '#');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sync = () => {
      setIsDashboard(!window.location.hash || window.location.hash === '#/' || window.location.hash === '#');
      setTarget(document.querySelector('.content'));
      setTick(value => value + 1);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', sync);
    window.addEventListener('storage', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const data = useMemo(() => {
    const business = read<AnyRecord>('q-business', { name: 'Quotiq Demo Company', currency: 'GHS' });
    const projects = read<AnyRecord[]>('q-projects', []);
    const invoices = read<AnyRecord[]>('q-invoices', []);
    const estimates = read<AnyRecord[]>('q-estimates', []);
    const expenses = read<AnyRecord[]>('q-expenses', []);
    const inventory = read<AnyRecord[]>('q-inventory', []);
    const collected = invoices.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const outstanding = invoices.reduce((sum, item) => sum + Math.max(0, Number(item.amount || 0) - Number(item.paid || 0)), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const jobsToday = projects.filter(item => item.startDate === today || item.dueDate === today).slice(0, 3);
    const lowStock = inventory.filter(item => Number(item.quantity || 0) <= Number(item.reorderLevel || 0));
    const activities = [
      ...projects.slice(0, 2).map(item => ({ title: item.name, meta: `${item.customer || 'Project'} · ${item.status || 'Planned'}`, icon: Activity })),
      ...expenses.slice(0, 2).map(item => ({ title: item.description, meta: `${item.category || 'Expense'} · ${money(item.amount, business.currency)}`, icon: CircleDollarSign })),
      ...estimates.slice(0, 1).map(item => ({ title: item.project || item.id, meta: `Estimate · ${item.status || 'Draft'}`, icon: FilePlus2 })),
    ].slice(0, 5);
    return { business, projects, invoices, collected, outstanding, expenseTotal, jobsToday, lowStock, activities };
  }, [tick]);

  if (!target || !isDashboard) return null;

  const firstName = data.business.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return createPortal(
    <div className="dashboardExperience">
      <section className="welcomeHero">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{greeting}, {firstName} 👋</h1>
          <p>Here is what needs your attention across jobs, payments and stock today.</p>
        </div>
        <div className="heroSnapshot">
          <span>Available cash</span>
          <strong>{money(data.collected - data.expenseTotal, data.business.currency)}</strong>
          <small><ArrowUpRight size={14}/> Updated from your saved records</small>
        </div>
      </section>

      <section className="quickActionsPanel">
        <div className="sectionHeading">
          <div><span>QUICK ACTIONS</span><h2>Start something new</h2></div>
          <small>Common tasks are one click away.</small>
        </div>
        <div className="quickActionGrid">
          <button onClick={() => go('/estimates')}><i><FilePlus2/></i><b>New estimate</b><span>Create a professional quote</span></button>
          <button onClick={() => go('/invoices')}><i><ReceiptText/></i><b>New invoice</b><span>Bill a customer quickly</span></button>
          <button onClick={() => go('/customers')}><i><UserPlus/></i><b>Add customer</b><span>Save a new client record</span></button>
          <button onClick={() => go('/projects')}><i><FolderPlus/></i><b>New project</b><span>Plan and assign a job</span></button>
        </div>
      </section>

      <section className="dashboardDetailGrid">
        <article className="card focusCard">
          <div className="cardHead"><div><span>TODAY</span><h2>Jobs and deadlines</h2></div><CalendarDays/></div>
          {data.jobsToday.length ? data.jobsToday.map(job => (
            <div className="focusRow" key={job.id}>
              <div><b>{job.name}</b><small>{job.customer || 'Customer'} · {job.assignee || 'Unassigned'}</small></div>
              <span>{job.status || 'Planned'}</span>
            </div>
          )) : <div className="emptyState"><CalendarDays/><b>No jobs scheduled today</b><span>Your day is clear for new work.</span></div>}
        </article>

        <article className="card focusCard">
          <div className="cardHead"><div><span>PAYMENTS</span><h2>Money to collect</h2></div><CircleDollarSign/></div>
          <div className="paymentSummary"><strong>{money(data.outstanding, data.business.currency)}</strong><span>Outstanding across {data.invoices.length} invoice{data.invoices.length === 1 ? '' : 's'}</span></div>
          <button className="textAction" onClick={() => go('/invoices')}>Review invoices <ArrowUpRight/></button>
        </article>

        <article className="card focusCard">
          <div className="cardHead"><div><span>ACTIVITY</span><h2>Latest updates</h2></div><Activity/></div>
          {data.activities.length ? data.activities.map((item, index) => {
            const Icon = item.icon;
            return <div className="activityRow" key={`${item.title}-${index}`}><i><Icon/></i><div><b>{item.title}</b><small>{item.meta}</small></div></div>;
          }) : <div className="emptyState"><Activity/><b>No recent activity</b><span>New records will appear here.</span></div>}
        </article>

        <article className="card focusCard">
          <div className="cardHead"><div><span>INVENTORY</span><h2>Stock health</h2></div><PackageSearch/></div>
          {data.lowStock.length ? data.lowStock.slice(0, 3).map(item => (
            <div className="focusRow" key={item.id}><div><b>{item.name}</b><small>{item.sku || item.category}</small></div><span>{item.quantity} {item.unit || ''}</span></div>
          )) : <div className="emptyState"><PackageSearch/><b>Stock levels look good</b><span>No items are below reorder level.</span></div>}
        </article>
      </section>
    </div>,
    target,
  );
}
