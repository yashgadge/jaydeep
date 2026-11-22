import type {RecordData} from './types';

export default function PendingBookings({items,admin,onReview}:{items:RecordData[];admin:boolean;onReview:()=>void}){
 const pending=items.filter(item=>!item.orderId&&['new','contacted'].includes(item.status));
 if(!pending.length)return null;
 return <section className="billing-card pending-booking-summary" aria-label="Booking requests awaiting acceptance"><div className="studio-row"><div><span className="studio-eyebrow">SAVED CLIENT REQUESTS</span><h2>{pending.length} booking request{pending.length===1?'':'s'} awaiting acceptance</h2><p>{admin?'Review and accept a request to reserve its shoot, issue the invoice and add the amount due.':'The studio has your request. Once accepted, your scheduled shoot, invoice and payment balance appear here.'}</p><small>{pending.slice(0,3).map(item=>item.publicId||item.service||'Booking request').join(' · ')}</small></div><button className="billing-primary" type="button" onClick={onReview}>{admin?'Review & accept requests':'View your requests'} ↗</button></div></section>;
}
