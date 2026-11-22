import {useRef,useState} from 'react';
import {call,failureText} from '../operations/api';
import type {RecordData} from './types';

const labels:Record<string,string>={
 'enquiry.created':'Booking request received',
 'enquiry.updated':'Booking request status updated',
 'booking-request.edited':'Booking request details edited',
 'booking-request.accepted':'Request accepted · shoot scheduled',
 'order.confirmed':'Shoot confirmed',
 'order.claim':'Shoot team member assigned',
 'order.team.assigned':'Shoot team assignment updated',
 'order.unassign':'Shoot team assignment changed',
 'order.stage':'Shoot progress updated',
 'order.delivery':'Photos and films delivered',
 'receipt.manual.recorded':'Manual payment and receipt recorded',
 'bill.payment.recorded':'Payment received',
 'bill.cancelled':'Bill cancelled',
 'booking.admin-exception':'Shoot rescheduled or cancelled',
 'legal.profile.updated':'Business contact details updated',
};
const dateLabel=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Time unavailable':date.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});};
export default function UsageActivity({designOnly=false}:{designOnly?:boolean}){
 const [usage,setUsage]=useState<RecordData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const pending=useRef(false);
 async function load(){
  if(pending.current||designOnly)return;
  pending.current=true;setLoading(true);setError('');
  try{setUsage(await call<unknown,RecordData>('getStudioUsage',{}));}catch(e){setError(failureText(e));}finally{pending.current=false;setLoading(false);}
 }
 // Deliberately no mount, visibility, realtime or scroll-triggered request.
 return <section className="billing-card" aria-labelledby="usage-activity-heading"><div className="studio-row"><div><h2 id="usage-activity-heading">Usage & recent activity</h2><p>Load a snapshot when you need it. Opening Settings or scrolling here does not fetch this activity.</p></div><button type="button" className="billing-primary" disabled={loading||designOnly} onClick={()=>void load()}>{loading?'Loading activity…':usage?'Refresh activity':'Load activity'}</button></div>
  {error&&<p className="studio-warning" role="alert">{error}</p>}
  {!usage&&!loading&&<p>Activity has not been loaded.</p>}
  {usage&&<><p>Google lookup attempts: {usage.mapsDay} today · {usage.mapsMonth} this month. These are app reservations, not Google’s billing statement.</p><p className="studio-hint">Snapshot loaded {dateLabel(usage.loadedAtISO)}. Press Refresh activity to see anything created afterward. A booking request becomes a confirmed shoot only after the studio accepts it.</p>
   {usage.audit?.map((entry:RecordData)=><article className="studio-row" key={entry.auditId??entry.id}><div><strong>{labels[entry.action]??String(entry.action??'Studio activity').split(/[._-]/).join(' ')}</strong>{(entry.clientName||entry.title||entry.service)&&<p>{[entry.clientName,entry.title||entry.service].filter(Boolean).join(' · ')}</p>}{entry.publicId&&<small>{entry.publicId}</small>}<time dateTime={entry.atISO}>{dateLabel(entry.atISO)}</time>{entry.action==='enquiry.created'&&<small>Request received · awaiting studio confirmation</small>}</div><details><summary>Reference</summary><small>Event: {entry.action}<br/>Record: {entry.entityId||entry.orderId||entry.enquiryId||'—'}<br/>Account: {entry.actor||'—'}</small></details></article>)}
   {!usage.audit?.length&&<p>No recent activity was found.</p>}
  </>}
 </section>;
}
