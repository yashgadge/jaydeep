import { useEffect, useState, type FormEvent } from 'react';
import { call, failureText } from './api';
import { blankContact, type ContactForm } from './types';

export default function ClientPreferences() {
  const [form,setForm] = useState<ContactForm>(blankContact);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    call<void,Partial<ContactForm>>('getOwnContactPreferences',undefined).then(result => { if(active) setForm({...blankContact,...result}); }).catch(error => {if(active)setError(failureText(error));}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);
  async function save(event:FormEvent) {
    event.preventDefault(); setSaving(true); setSaved(false); setError('');
    try { await call('saveOwnContactPreferences',form); setSaved(true); } catch(error) {setError(failureText(error));} finally {setSaving(false);}
  }
  return <section className="billing-card"><div className="billing-card-heading"><h2>WhatsApp preferences</h2><p>You choose what reaches your phone. Both choices are optional and can be changed anytime.</p></div>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Your preferences have been saved.</p>}{loading?<p role="status">Loading your preferences…</p>:<form onSubmit={save}><div className="billing-fields"><label>Your name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>WhatsApp number<input type="tel" autoComplete="tel" placeholder="+91…" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div><label className="billing-toggle"><input type="checkbox" checked={form.updatesOptIn} onChange={e=>setForm({...form,updatesOptIn:e.target.checked})}/><span>Send me booking, payment, and delivery updates on WhatsApp.<small>Useful updates about my orders.</small></span></label><label className="billing-toggle"><input type="checkbox" checked={form.marketingOptIn} onChange={e=>setForm({...form,marketingOptIn:e.target.checked})}/><span>Send me occasional offers and studio news on WhatsApp.<small>Separate from my booking updates.</small></span></label><p className="billing-setup">You can also reply STOP on WhatsApp. If you previously sent STOP, reply START to the studio before resuming messages.</p><button className="billing-primary" disabled={saving}>{saving?'Saving…':'Save preferences'}</button></form>}</section>;
}
