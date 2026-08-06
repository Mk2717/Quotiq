import { useMemo, useState } from 'react';
import { ArrowLeft, FileText, Plus, Printer, Save, Search, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Business, Customer, Estimate, LineItem } from '../types';
import { getStored, setStored, uid } from '../lib/storage';

type DraftLine = LineItem;

const today = () => new Date().toISOString().slice(0, 10);
const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const lineTotal = (line: DraftLine) => roundMoney(n(line.qty) * n(line.rate));
const money = (value: number, currency = 'GHS') =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(roundMoney(value));
const getBusiness = () =>
  getStored<Business>('q-business', {
    name: 'Quotiq', email: '', phone: '', address: '', taxId: '', bank: '', accountName: '', accountNumber: '',
    mobileMoney: '', estimatePrefix: 'EST', invoicePrefix: 'INV', currency: 'GHS'
  });

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
  const filtered = estimates.filter((estimate) =>
    [estimate.id, estimate.customer, estimate.project, estimate.status].join(' ').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="ev2Page">
      <header className="ev2ListHeader">
        <div>
          <span>ESTIMATES & QUOTATIONS</span>
          <h1>Estimates</h1>
          <p>Create saved estimates or prepare a quick one-time printable quotation.</p>
        </div>
        <div className="ev2HeaderActions">
          <button onClick={() => navigate('/estimates/quick')}><Printer size={18} />Quick Print</button>
          <button className="ev2Primary" onClick={() => navigate('/estimates/new')}><Plus size={18} />Create Estimate</button>
        </div>
      </header>

      <div className="ev2Stats">
        <article><span>Total estimates</span><strong>{estimates.length}</strong></article>
        <article><span>Draft value</span><strong>{money(estimates.filter(e => e.status === 'Draft').reduce((sum, e) => sum + n(e.amount), 0), business.currency)}</strong></article>
        <article><span>Pending value</span><strong>{money(estimates.filter(e => e.status === 'Pending').reduce((sum, e) => sum + n(e.amount), 0), business.currency)}</strong></article>
      </div>

      <label className="ev2Search"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search estimate, customer or project" /></label>

      <section className="ev2EstimateList">
        {filtered.length ? filtered.map((estimate) => (
          <article key={estimate.id}>
            <FileText />
            <div><b>{estimate.id}</b><h3>{estimate.project}</h3><p>{estimate.customer} · {estimate.date}</p></div>
            <strong>{money(estimate.amount, business.currency)}</strong>
            <span>{estimate.status}</span>
          </article>
        )) : (
          <div className="ev2Empty"><FileText size={42} /><h2>No estimates yet</h2><p>Create a saved estimate or use Quick Print for a one-time quotation.</p></div>
        )}
      </section>
    </div>
  );
}

function EstimateBuilder({ quick }: { quick: boolean }) {
  const navigate = useNavigate();
  const business = getBusiness();
  const customers = getStored<Customer[]>('q-customers', []);
  const existing = getStored<Estimate[]>('q-estimates', []);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [quickCustomer, setQuickCustomer] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickLocation, setQuickLocation] = useState('');
  const [project, setProject] = useState('');
  const [date, setDate] = useState(today());
  const [validDays, setValidDays] = useState(14);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('Supply, installation, testing and handover of the listed items and services.');
  const [terms, setTerms] = useState(business.terms || 'Quotation is valid for the stated period.\nAdditional work outside this scope will be charged separately.');
  const [items, setItems] = useState<DraftLine[]>([{ id: uid('ITM'), description: '', qty: 1, unit: 'pcs', rate: 0 }]);
  const [error, setError] = useState('');

  const customer = customers.find(c => c.id === customerId);
  const customerName = quick ? quickCustomer : customer?.name || '';
  const customerPhone = quick ? quickPhone : customer?.phone || '';
  const customerLocation = quick ? quickLocation : customer?.siteAddress || customer?.address || '';
  const quoteNo = `${business.estimatePrefix || 'EST'}-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;

  const totals = useMemo(() => {
    const subtotal = roundMoney(items.reduce((sum, item) => sum + lineTotal(item), 0));
    const discount = roundMoney(subtotal * Math.max(0, n(discountPercent)) / 100);
    const taxable = roundMoney(Math.max(0, subtotal - discount));
    const tax = roundMoney(taxable * Math.max(0, n(taxPercent)) / 100);
    const total = roundMoney(taxable + tax);
    return { subtotal, discount, tax, total };
  }, [items, discountPercent, taxPercent]);

  const updateItem = (id: string, key: keyof DraftLine, value: string) => {
    setItems(current => current.map(item => item.id === id ? { ...item, [key]: key === 'qty' || key === 'rate' ? n(value) : value } : item));
  };

  const validate = () => {
    if (!customerName.trim()) return setError('Enter or select a customer.'), false;
    if (!project.trim()) return setError('Enter the project or job title.'), false;
    if (!items.some(item => item.description.trim())) return setError('Add at least one item or service.'), false;
    setError('');
    return true;
  };

  const save = () => {
    if (quick || !validate() || !customer) return;
    const validItems = items.filter(item => item.description.trim());
    const estimate: Estimate = {
      id: quoteNo, customerId: customer.id, customer: customer.name, project: project.trim(), amount: totals.total,
      status: 'Draft', date, items: validItems, tax: n(taxPercent), discount: n(discountPercent)
    };
    setStored('q-estimates', [estimate, ...existing]);
    navigate('/estimates');
  };

  const print = () => {
    if (validate()) setTimeout(() => window.print(), 80);
  };

  return (
    <div className="ev2BuilderPage">
      <header className="ev2BuilderTop noPrint">
        <button className="ev2Back" onClick={() => navigate('/estimates')}><ArrowLeft size={18} />Back to estimates</button>
        <div><span>{quick ? 'QUICK PRINT' : 'NEW ESTIMATE'}</span><h1>{quick ? 'One-time quotation' : 'Create estimate'}</h1></div>
        <div className="ev2HeaderActions">{!quick && <button onClick={save}><Save size={18} />Save Draft</button>}<button className="ev2Primary" onClick={print}><Printer size={18} />Print / Save PDF</button></div>
      </header>

      {error && <div className="ev2Error noPrint">{error}</div>}

      <div className="ev2BuilderGrid">
        <section className="ev2Editor noPrint">
          <Panel number="01" title="Customer & project">
            <div className="ev2FormGrid">
              {quick ? <>
                <Field label="Customer name *"><input value={quickCustomer} onChange={e => setQuickCustomer(e.target.value)} /></Field>
                <Field label="Phone"><input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} /></Field>
                <Field label="Location"><input value={quickLocation} onChange={e => setQuickLocation(e.target.value)} /></Field>
              </> : <>
                <Field label="Customer *"><select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Phone"><input readOnly value={customerPhone} /></Field>
                <Field label="Location"><input readOnly value={customerLocation} /></Field>
              </>}
              <Field label="Project title *"><input value={project} onChange={e => setProject(e.target.value)} /></Field>
            </div>
          </Panel>

          <Panel number="02" title="Estimate details">
            <div className="ev2FormGrid">
              <Field label="Estimate number"><input readOnly value={quoteNo} /></Field>
              <Field label="Issue date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
              <Field label="Valid for (days)"><input type="number" min="1" value={validDays} onChange={e => setValidDays(n(e.target.value))} /></Field>
              <Field label="Currency"><input readOnly value={business.currency || 'GHS'} /></Field>
            </div>
          </Panel>

          <Panel number="03" title="Items & pricing">
            <div className="ev2ItemHeader"><span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total cost</span><span /></div>
            <div className="ev2Items">
              {items.map((item, index) => <div className="ev2Item" key={item.id}>
                <div className="ev2Description"><small>ITEM {String(index + 1).padStart(2, '0')}</small><input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Item or service description" /></div>
                <Field label="Qty"><input type="number" min="0" step="0.01" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} /></Field>
                <Field label="Unit"><input value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} placeholder="pcs" /></Field>
                <Field label="Unit price"><input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} /></Field>
                <div className="ev2LineTotal"><span>Total cost</span><strong>{money(lineTotal(item), business.currency)}</strong></div>
                <button className="ev2Remove" onClick={() => items.length > 1 && setItems(items.filter(row => row.id !== item.id))}><Trash2 size={17} /></button>
              </div>)}
            </div>
            <button className="ev2Add" onClick={() => setItems([...items, { id: uid('ITM'), description: '', qty: 1, unit: 'pcs', rate: 0 }])}><Plus size={18} />Add another item</button>
          </Panel>

          <Panel number="04" title="Notes, tax & discount">
            <Field label="Scope of work / notes"><textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
            <Field label="Terms & conditions"><textarea rows={4} value={terms} onChange={e => setTerms(e.target.value)} /></Field>
            <div className="ev2FormGrid"><Field label="Discount %"><input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(n(e.target.value))} /></Field><Field label="Tax %"><input type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(n(e.target.value))} /></Field></div>
          </Panel>
        </section>

        <PrintableQuote business={business} quoteNo={quoteNo} customer={customerName} phone={customerPhone} location={customerLocation} project={project} date={date} validDays={validDays} items={items} notes={notes} terms={terms} totals={totals} />
      </div>
    </div>
  );
}

function Panel({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section className="ev2Panel"><header><span>{number}</span><h2>{title}</h2></header>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="ev2Field"><span>{label}</span>{children}</label>;
}
function PrintableQuote({ business, quoteNo, customer, phone, location, project, date, validDays, items, notes, terms, totals }: any) {
  const printableItems = items.filter((item: DraftLine) => item.description.trim());
  return <article className="ev2Quote printArea">
    <div className="ev2Watermark">{business.logo ? <img src={business.logo} alt="" /> : <span>Q</span>}</div>
    <header className="ev2QuoteHeader">
      <div className="ev2Company">{business.logo ? <img src={business.logo} alt="Company logo" /> : <div className="ev2LogoFallback">Q</div>}<div><h2>{business.name || 'Your Company'}</h2><p>{business.address || 'Business address'}</p><p>{business.phone}{business.email ? ` · ${business.email}` : ''}</p></div></div>
      <div className="ev2QuoteTitle"><h1>QUOTATION</h1><strong>{quoteNo}</strong><p>Issued: {date}</p><p>Valid for: {validDays} days</p></div>
    </header>
    <div className="ev2Accent" />
    <section className="ev2QuoteMeta"><div><span>PREPARED FOR</span><h3>{customer || 'Customer name'}</h3><p>{phone || 'Phone number'}</p><p>{location || 'Project location'}</p></div><div><span>PROJECT</span><h3>{project || 'Project title'}</h3></div></section>
    <div className="ev2TableWrap"><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Total cost</th></tr></thead><tbody>{printableItems.length ? printableItems.map((item: DraftLine, index: number) => <tr key={item.id}><td>{String(index + 1).padStart(2, '0')}</td><td>{item.description}</td><td>{item.qty}</td><td>{item.unit}</td><td>{money(item.rate, business.currency)}</td><td><strong>{money(lineTotal(item), business.currency)}</strong></td></tr>) : <tr><td colSpan={6} className="ev2NoItems">Add items to see them here.</td></tr>}</tbody></table></div>
    <section className="ev2Totals"><div><span>Subtotal</span><b>{money(totals.subtotal, business.currency)}</b></div><div><span>Discount</span><b>- {money(totals.discount, business.currency)}</b></div><div><span>Tax</span><b>{money(totals.tax, business.currency)}</b></div><div className="ev2Grand"><span>TOTAL COST</span><strong>{money(totals.total, business.currency)}</strong></div></section>
    <section className="ev2QuoteNotes"><div><h4>SCOPE OF WORK / NOTES</h4><p>{notes}</p><h4>TERMS & CONDITIONS</h4>{terms.split('\n').filter(Boolean).map((line: string, index: number) => <p key={index}>• {line}</p>)}</div><div className="ev2Signature"><div>{business.signature && <img src={business.signature} alt="Signature" />}</div><span>Authorised signature</span></div></section>
    <footer><strong>Thank you for the opportunity to quote.</strong><span>Generated with Quotiq</span></footer>
  </article>;
}
