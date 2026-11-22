import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './client-navigation.css';

export type ClientTab = 'home' | 'book' | 'orders' | 'documents' | 'social' | 'preferences';
export function ClientIcon({name,className=''}:{name:string;className?:string}) {
 const paths:Record<string,React.ReactNode>={
  home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
  book:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-9 3v4m-2-2h4"/></>,
  orders:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m3 17 5-4 4 3 4-5 5 6"/></>,
  documents:<><path d="M6 3h8l4 4v14l-3-2-3 2-3-2-3 2Z"/><path d="M14 3v5h4M9 12h6m-6 4h4"/></>,
  social:<><path d="m4 10 13-5v14L4 14Zm0 0H2v4h2m3 1 2 6h3l-2-5m10-8 2-1m-2 9 2 1"/></>,
  preferences:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,
 };
 return <svg className={`client-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.home}</svg>;
}
const items:Array<[ClientTab,string,string]>=[['home','Home','Your next steps'],['book','Book a shoot','Packages & enquiries'],['orders','My shoots','Bookings, photos & films'],['documents','Bills & receipts','Your payment documents'],['social','Social media','Your content & approvals'],['preferences','My profile','Details & preferences']];
export default function ClientNavigation({selected,onNavigate}:{selected:string;onNavigate:(tab:ClientTab)=>void}){
 const [more,setMore]=useState(false);
 const moreButton=useRef<HTMLButtonElement>(null),menu=useRef<HTMLElement>(null);
 const dismiss=useCallback(()=>{setMore(false);moreButton.current?.focus({preventScroll:true});},[]);
 useEffect(()=>{setMore(false);},[selected]);
 useEffect(()=>{
  if(!more)return;
  const htmlOverflow=document.documentElement.style.overflow,bodyOverflow=document.body.style.overflow;
  document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
  const frame=requestAnimationFrame(()=>menu.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();dismiss();return;}
   if(event.key!=='Tab')return;
   const nodes=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button')??[]),first=nodes[0],last=nodes[nodes.length-1];
   if(document.activeElement===moreButton.current){event.preventDefault();(event.shiftKey?last:first)?.focus();}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();moreButton.current?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();moreButton.current?.focus();}
  };
  const mobile=window.matchMedia('(max-width:760px)'),resize=()=>{if(!mobile.matches)dismiss();};
  window.addEventListener('keydown',keyboard);mobile.addEventListener('change',resize);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',keyboard);mobile.removeEventListener('change',resize);document.documentElement.style.overflow=htmlOverflow;document.body.style.overflow=bodyOverflow;};
 },[more,dismiss]);
 const choose=(id:ClientTab)=>{if(more)dismiss();else setMore(false);onNavigate(id);};
 return <><nav className="client-desktop-navigation" aria-label="Client navigation">{items.map(([id,label,help])=><button key={id} className={selected===id?'active':''} aria-current={selected===id?'page':undefined} onClick={()=>choose(id)}><ClientIcon name={id}/><span><strong>{label}</strong><small>{help}</small></span>{selected===id&&<i/>}</button>)}</nav>
 {more&&createPortal(<div className="client-menu-layer"><button type="button" className="client-menu-backdrop" aria-label="Close more options" onClick={dismiss}/><nav ref={menu} id="client-more-menu" className="client-more-menu" aria-label="More client options"><p>YOUR SPACE</p>{items.filter(([id])=>['social','preferences'].includes(id)).map(([id,label,help])=><button type="button" key={id} aria-current={selected===id?'page':undefined} onClick={()=>choose(id)}><ClientIcon name={id}/><span className="client-more-copy"><strong>{label}</strong><small>{help}</small></span><span className="client-more-arrow" aria-hidden>↗</span></button>)}</nav></div>,document.body)}
 <nav className="client-mobile-dock" aria-label="Client navigation">{(['home','orders','book','documents'] as ClientTab[]).map(id=><button key={id} className={`${selected===id?'active':''} ${id==='book'?'client-dock-book':''}`} aria-current={selected===id?'page':undefined} onClick={()=>choose(id)}><span><ClientIcon name={id}/></span><strong>{{home:'Home',orders:'My shoots',book:'Book',documents:'Bills',social:'Social',preferences:'Profile'}[id]}</strong></button>)}<button ref={moreButton} className={more||['social','preferences'].includes(selected)?'active':''} aria-expanded={more} aria-controls="client-more-menu" onClick={()=>more?dismiss():setMore(true)}><span><ClientIcon name="more"/></span><strong>More</strong></button></nav></>;
}
