import { agency } from '../data/agency';
import { AgencyIcon } from './AgencyIcons';
import './studio-socials.css';

export function StudioInstagram({compact=false}:{compact?:boolean}){
 return <a className={`studio-instagram-link ${compact?'is-compact':'has-handle'}`} href={agency.instagram} target="_blank" rel="noopener noreferrer" aria-label="Open Maharashtra Vision Media on Instagram" title={agency.instagramHandle}><span className="studio-instagram-icon"><AgencyIcon name="instagram"/></span>{!compact&&<><span className="studio-instagram-handle">{agency.instagramHandle}</span><span className="studio-instagram-arrow" aria-hidden>↗</span></>}</a>;
}
export function PartnerSignatures({className='',enabled=true}:{className?:string;enabled?:boolean}){
 return <div className={`partner-signatures ${className}`}>{agency.partners.map((partner,index)=><span className="partner-signature-wrap" key={partner.name}>{index>0&&<i className="partner-signature-divider" aria-hidden>×</i>}<a className="partner-instagram-link" tabIndex={enabled?0:-1} style={{pointerEvents:enabled?'auto':'none'}} href={partner.instagram} target="_blank" rel="noopener noreferrer" aria-label={`Open ${partner.name} on Instagram`} title={partner.handle}><span className="partner-instagram-icon"><AgencyIcon name="instagram"/></span><span className="partner-instagram-copy"><strong>{partner.name}</strong><small>View Instagram <i aria-hidden>↗</i></small></span></a></span>)}</div>;
}
