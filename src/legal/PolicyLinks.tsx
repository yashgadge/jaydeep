import './policy-links.css';
import policy from '../../functions/legal-policy.json';
export default function PolicyLinks({className=''}:{className?:string}){return <nav className={`mvm-policy-links ${className}`} aria-label="Policies and legal information">{policy.pages.map(page=><a key={page.id} href={`/policies/${page.id}`}>{page.id==='terms'?'Terms':page.id==='privacy'?'Privacy':page.id==='cancellations'?'Cancellations & refunds':page.id==='delivery'?'Delivery & rights':page.id==='cookies'?'Cookies':'Contact & grievances'}</a>)}</nav>;}
