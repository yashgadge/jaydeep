import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { motion } from 'framer-motion';
import { appCheckConfigured, auth, db, functions } from '../firebase/client';
import InvoiceDocument from './InvoiceDocument';
import { printInvoice } from './printInvoice';
import { formatInvoiceDate, formatMoney, initialInvoiceSettings, type Invoice, type InvoiceSettings } from './types';
import './workspace.css';

type Role = { owner: boolean; invoiceManage: boolean; contactsManage:boolean; whatsappSend:boolean; clientsExport:boolean; paymentsManage:boolean };
type OrderSummary = { id: string; title: string; client?: { name: string }; invoiceId?: string };
type Member = Role & { id: string; email: string; active: boolean };
type Tab = 'invoices' | 'settings' | 'members' | 'preferences';
const ClientPreferences=lazy(()=>import('../operations/ClientPreferences'));
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';

const fields: Array<{ key: keyof InvoiceSettings; label: string; kind?: string; required?: boolean; max?: number }> = [
  { key: 'businessName', label: 'Business name', required: true, max: 100 },
  { key: 'address', label: 'Business address', kind: 'textarea', required: true, max: 700 },
  { key: 'phone', label: 'Contact number', required: true, max: 50 },
  { key: 'email', label: 'Business email', kind: 'email', max: 150 },
  { key: 'website', label: 'Website', max: 200 },
  { key: 'logoUrl', label: 'Logo image URL (HTTPS)', kind: 'url', max: 500 },
  { key: 'documentTitle', label: 'Document heading', required: true, max: 60 },
  { key: 'prefix', label: 'Invoice number prefix', required: true, max: 12 },
  { key: 'registrationLabel', label: 'Registration field label (optional)', max: 80 },
  { key: 'registrationValue', label: 'Registration value (optional)', max: 100 },
  { key: 'signatureName', label: 'Authorised issuer name', max: 100 },
  { key: 'accent', label: 'Accent colour', kind: 'color' },
  { key: 'terms', label: 'Terms and notes', kind: 'textarea', max: 2500 },
  { key: 'footer', label: 'Footer message', kind: 'textarea', max: 1000 },
];

function SettingsEditor({ value, onChange, onSave, busy }: { value: InvoiceSettings; onChange: (value: InvoiceSettings) => void; onSave?: () => Promise<void>; busy: boolean }) {
  const submit = (event: FormEvent) => { event.preventDefault(); void onSave?.(); };
  return <form className="billing-settings" onSubmit={submit}><div className="billing-card-heading"><h2>Invoice identity</h2><p>Order details sync automatically. These settings are saved as a snapshot when a bill is issued.</p></div><div className="billing-fields">{fields.map(field => <label key={field.key}>{field.label}{field.kind === 'textarea' ? <textarea rows={3} maxLength={field.max} value={String(value[field.key])} required={field.required} onChange={e => onChange({ ...value, [field.key]: e.target.value })} /> : <input type={field.kind || 'text'} maxLength={field.max} value={String(value[field.key])} required={field.required} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />}</label>)}</div><label className="billing-toggle"><input type="checkbox" checked={value.bypassEnabled} onChange={e => onChange({ ...value, bypassEnabled: e.target.checked })} /><span>Allow zero-value bypass invoices<small>No payment collected. Agreed order value remains in the internal record.</small></span></label>{onSave && <button className="billing-primary" disabled={busy}>{busy ? 'Saving…' : 'Save invoice settings'}</button>}</form>;
}

export function InvoiceLayoutPreview() {
  const [settings, setSettings] = useState(initialInvoiceSettings);
  return <div className="billing-root"><header className="billing-topbar"><a href="/">MVM <span>STUDIO</span></a><span>Local invoice design</span><a href="/billing">Open billing</a></header><main className="billing-main"><div className="billing-intro"><p className="billing-kicker">DESIGN WORKSPACE</p><h1>A bill worth keeping.</h1><p>Blank layout with field labels only. No client, order, price, or invoice number has been invented. Changes here are unsaved; this is not the admin panel.</p></div><div className="billing-design-grid"><SettingsEditor value={settings} onChange={setSettings} busy={false} /><div className="billing-preview"><InvoiceDocument invoice={null} settings={settings} /></div></div></main></div>;
}

export default function BillingWorkspace() {
  const intent=new URLSearchParams(window.location.search).get('intent');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState(initialInvoiceSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberEnabled, setMemberEnabled] = useState(true);
  const [memberCanIssue, setMemberCanIssue] = useState(true);
  const [memberPermissions,setMemberPermissions]=useState({contactsManage:false,whatsappSend:false,clientsExport:false,paymentsManage:false});

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Client space | Maharashtra Vision Media';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async current => {
      const token = ++generation;
      setUser(current); setRole(null); setInvoices([]); setOrders([]); setMembers([]); setSelectedId(null); setError('');
      if (!current) { setAuthLoading(false); return; }
      if (!appCheckConfigured) { setError('Online billing is still being prepared. Please contact the studio for your existing bills.'); setAuthLoading(false); return; }
      setAuthLoading(true);
      try {
        const result = await httpsCallable<void, Role>(functions, 'syncInvoiceIdentity')();
        if (generation === token) setRole(result.data);
      } catch (failure) { if (generation === token) setError(errorText(failure)); }
      finally { if (generation === token) setAuthLoading(false); }
    });
    return () => { generation++; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !role) return;
    setListLoading(true);
    const constraints = role.invoiceManage ? [orderBy('issuedAt', 'desc'), limit(50)] : [where('clientUid', '==', user.uid), orderBy('issuedAt', 'desc'), limit(50)];
    const unsubscribers = [onSnapshot(query(collection(db, 'invoices'), ...constraints), snapshot => {
      setInvoices(snapshot.docs.map(row => ({ ...row.data(), id: row.id }) as Invoice)); setListLoading(false);
    }, failure => { setError(errorText(failure)); setListLoading(false); })];
    if (role.invoiceManage) {
      unsubscribers.push(onSnapshot(doc(db, 'settings', 'invoicing'), snapshot => {
        if (snapshot.exists()) setSettings({ ...initialInvoiceSettings, ...snapshot.data() } as InvoiceSettings);
      }, failure => setError(errorText(failure))));
      unsubscribers.push(onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100)), snapshot => {
        setOrders(snapshot.docs.map(row => ({ ...row.data(), id: row.id }) as OrderSummary));
      }, failure => setError(errorText(failure))));
    }
    if (role.owner) unsubscribers.push(onSnapshot(query(collection(db, 'members'), limit(100)), snapshot => {
      setMembers(snapshot.docs.map(row => ({ ...row.data(), id: row.id }) as Member));
    }, failure => setError(errorText(failure))));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, role]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  };
  const selected = invoices.find(invoice => invoice.id === selectedId);
  const login = () => run(async () => { const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); await signInWithPopup(auth, provider); });
  const issue = () => run(async () => {
    const result = await httpsCallable<{ orderId: string }, { invoiceId: string; number: string }>(functions, 'issueInvoice')({ orderId });
    setSelectedId(result.data.invoiceId); setNotice(`Invoice ${result.data.number} is available. Repeated issuance returns the same invoice.`);
  });
  const save = () => run(async () => { await httpsCallable(functions, 'saveInvoiceSettings')(settings); setNotice('Invoice settings saved. Previously issued invoices are unchanged.'); });
  const saveMember = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await httpsCallable(functions, 'setInvoiceMember')({ email: memberEmail, active: memberEnabled, invoiceManage: memberCanIssue,...memberPermissions });
    setNotice('Member permissions saved. They take effect on the next request.');
  }); };

  return <div className="billing-root"><header className="billing-topbar"><a href="/">MVM <span>STUDIO</span></a><span>MAHARASHTRA VISION MEDIA</span>{user && <button onClick={() => void run(() => signOut(auth))}>Sign out</button>}</header><main className="billing-main"><motion.div className="billing-intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><p className="billing-kicker">{role?.invoiceManage ? 'STUDIO WORKSPACE' : 'YOUR CLIENT SPACE'}</p><h1>{role?.invoiceManage ? 'Details, beautifully in order.' : intent==='shoot'?'Let’s plan your next shoot.':intent==='management'?'Let’s grow your presence.':'Your work. Your records.'}</h1><p>{role?.invoiceManage ? 'Issue bills from real orders, keep the numbers consistent, and give every client a clear record.' : 'Sign in with your Google account to access your private client space.'}</p></motion.div>
      {error && <div className="billing-alert" role="alert">{error}</div>}{notice && <div className="billing-notice" role="status">{notice}</div>}
      {authLoading ? <div className="billing-card" role="status">Checking your account…</div> : !user ? <section className="billing-login billing-card"><div className="billing-icon" aria-hidden>↗</div><h2>Your private client space.</h2><p>Sign in to access the studio records linked to your account.</p><button className="billing-primary" onClick={() => void login()} disabled={busy}>{busy ? 'Opening Google…' : 'Continue with Google'}</button>{!appCheckConfigured && <p className="billing-setup">Online billing is being prepared. Please contact the studio for existing bills.</p>}</section> : role && <>
        <div className="billing-account"><span>{user.email}</span><span className="billing-badge">{role.owner ? 'Owner' : role.invoiceManage ? 'Billing team' : 'Client'}</span></div>
        <nav className="billing-tabs" aria-label="Billing sections">{(role.owner ? ['invoices','settings','members','preferences'] : ['invoices','preferences']).map(item => <button aria-current={tab === item ? 'page' : undefined} key={item} onClick={() => setTab(item as Tab)}>{item === 'invoices' ? 'Invoices' : item === 'settings' ? 'Invoice settings' : item === 'members' ? 'Team access' : 'WhatsApp preferences'}</button>)}</nav>
        {(role.owner||role.contactsManage||role.whatsappSend||role.clientsExport||role.paymentsManage)&&<p style={{marginBottom:20}}><a href="/admin">Open studio management: clients, WhatsApp & payments →</a></p>}
        {tab==='preferences'&&<Suspense fallback={<p>Loading preferences…</p>}><ClientPreferences/></Suspense>}
        {tab === 'invoices' && <>{role.invoiceManage && <section className="billing-card billing-issue"><div><h2>Issue from an order</h2><p>The server copies the saved plan, deliverables, client, and prices.</p></div><div className="billing-issue-controls"><select aria-label="Select order" value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Select an existing order</option>{orders.map(order => <option key={order.id} value={order.id}>{order.title} · {order.client?.name ?? order.id}{order.invoiceId ? ' · Invoice issued' : ''}</option>)}</select><button className="billing-primary" disabled={!orderId || busy} onClick={() => void issue()}>{busy ? 'Working…' : 'Issue invoice'}</button></div>{orders.length === 0 && <p className="billing-setup">No orders have been added. Orders will appear here when the booking/custom-order workflow saves real records.</p>}</section>}
          {selected ? <><div className="billing-document-actions"><button onClick={() => setSelectedId(null)}>← All invoices</button><button className="billing-primary" disabled={busy} onClick={() => void run(() => printInvoice(selected))}>Print / Save PDF</button></div><InvoiceDocument invoice={selected} /></> : <section className="billing-card"><div className="billing-card-heading"><h2>{role.invoiceManage ? 'Issued invoices' : 'My invoices'}</h2><p>Latest 50 records. Issued bills retain their original details.</p></div>{listLoading ? <p role="status">Loading invoices…</p> : invoices.length === 0 ? <div className="billing-empty"><span aria-hidden>▤</span><h3>No invoices yet</h3><p>{role.invoiceManage ? 'Save your invoice settings and issue a bill from an existing order.' : 'An invoice will appear here when the studio issues one for your order.'}</p></div> : <div className="billing-invoice-list">{invoices.map(invoice => <button className="billing-invoice-row" key={invoice.id} onClick={() => setSelectedId(invoice.id)}><span><strong>{invoice.number}</strong><small>{invoice.project} · {formatInvoiceDate(invoice.issuedAt)}</small></span><span><strong>{formatMoney(invoice.totalPaise)}</strong><small>{invoice.paymentStatus} ↗</small></span></button>)}</div>}</section>}</>}
        {tab === 'settings' && role.owner && <div className="billing-design-grid"><SettingsEditor value={settings} onChange={setSettings} onSave={save} busy={busy} /><div className="billing-preview"><InvoiceDocument invoice={null} settings={settings} /></div></div>}
        {tab === 'members' && role.owner && <section className="billing-card">
          <div className="billing-card-heading"><h2>Team access</h2><p>Add a registered Google account. Only the owner can change settings and grant access.</p></div>
          <form onSubmit={saveMember} className="billing-member-form">
            <label>Registered Google email<input type="email" required value={memberEmail} onChange={e => setMemberEmail(e.target.value)} /></label>
            <label className="billing-toggle"><input type="checkbox" checked={memberEnabled} onChange={e => setMemberEnabled(e.target.checked)} />Active member</label>
            <label className="billing-toggle"><input type="checkbox" checked={memberCanIssue} onChange={e => setMemberCanIssue(e.target.checked)} />View orders and issue invoices</label>
            {([['contactsManage','View and edit clients'],['whatsappSend','Send WhatsApp messages and view recipients'],['clientsExport','Export client details to Excel'],['paymentsManage','View and record payments']] as const).map(([key,label])=><label className="billing-toggle" key={key}><input type="checkbox" checked={memberPermissions[key]} onChange={e=>setMemberPermissions({...memberPermissions,[key]:e.target.checked})}/>{label}</label>)}
            <button className="billing-primary" disabled={busy}>Save access</button>
          </form>
          <div className="billing-invoice-list">{members.map(member => <button type="button" className="billing-invoice-row" disabled={member.owner} key={member.id} onClick={()=>{setMemberEmail(member.email);setMemberEnabled(member.active);setMemberCanIssue(!!member.invoiceManage);setMemberPermissions({contactsManage:!!member.contactsManage,whatsappSend:!!member.whatsappSend,clientsExport:!!member.clientsExport,paymentsManage:!!member.paymentsManage});}}><span><strong>{member.email}</strong><small>{member.owner?'Owner':'Select to edit permissions'}</small></span><span className="billing-badge">{member.active?'Active':'Disabled'}</span></button>)}</div>
        </section>}
      </>}
    </main><footer className="billing-page-footer">Maharashtra Vision Media · Studio billing</footer></div>;
}
