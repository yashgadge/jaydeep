import {useEffect,useId,useRef,useState} from 'react';
import {call,failureText} from '../operations/api';
import type {RecordData} from './types';
import './registered-client-select.css';

export default function RegisteredClientSelect({value,onChange,designOnly=false,billing=false}:{value:string;onChange:(value:string)=>void;designOnly?:boolean;billing?:boolean}) {
 const [clients,setClients]=useState<RecordData[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[limit,setLimit]=useState(20),[active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),pending=useRef(false),alive=useRef(true);
 const id=useId(),selected=clients.find(client=>client.id===value);
 const normalized=query.trim().toLocaleLowerCase();
 const matches=clients.filter(client=>`${client.name??''} ${client.email??''} ${client.publicId??''}`.toLocaleLowerCase().includes(normalized)).sort((a,b)=>String(a.name??'').localeCompare(String(b.name??''))||a.id.localeCompare(b.id));
 const visible=matches.slice(0,limit);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load(after?:string) {
  if(pending.current||designOnly)return;
  pending.current=true;setLoading(true);setError('');
  try {
   const result=await call<unknown,{clients:RecordData[];cursor:string|null}>(billing?'getBillingClients':'getRegisteredClients',{cursor:after});
   if(!alive.current)return;
   setClients(previous=>[...new Map([...previous,...result.clients].map(client=>[client.id,client])).values()]);
   setCursor(result.cursor);setLoaded(true);
  } catch(error) {if(alive.current)setError(failureText(error));}
  finally {pending.current=false;if(alive.current)setLoading(false);}
 }
 useEffect(()=>{if(open&&!loaded&&!error&&!designOnly)void load();},[open,loaded,error,designOnly]);
 // Search continues through the existing paginated directory. Pages stay cached:
 // typing again filters locally instead of rereading already fetched contacts.
 useEffect(()=>{
  if(!open||!normalized||!cursor||loading||error||designOnly)return;
  const timer=window.setTimeout(()=>void load(cursor),350);
  return()=>window.clearTimeout(timer);
 },[open,normalized,cursor,loading,error,designOnly]);
 useEffect(()=>{if(open)input.current?.focus();},[open]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 useEffect(()=>{setActive(0);setLimit(20);},[query]);
 function choose(client:RecordData){onChange(client.id);setOpen(false);setQuery('');trigger.current?.focus();}
 function close(){setOpen(false);trigger.current?.focus();}
 return <div className="mvm-client-picker" ref={root}>
  <label id={`${id}-label`}>{billing?'Client':'Registered Google client'}</label>
  <button ref={trigger} type="button" className={`mvm-client-trigger ${selected?'has-client':''}`} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-panel`} onClick={()=>setOpen(previous=>!previous)}>
   <span className="mvm-client-avatar" aria-hidden="true">{selected?String(selected.name||selected.email||'?').slice(0,1).toUpperCase():<SearchIcon/>}</span>
   <span id={`${id}-value`} className="mvm-client-copy"><strong>{selected?.name||selected?.email||'Find a client'}</strong><small>{selected?`${selected.publicId||'Registered client'} · ${selected.email}`:'Search by name, email or client ID'}</small></span>
   <span className="mvm-client-trigger-action">{selected?'Change':'Choose'} <span aria-hidden="true">⌄</span></span>
  </button>
  {open&&<div id={`${id}-panel`} className="mvm-client-panel" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
   <div className="mvm-client-search"><SearchIcon/><input ref={input} role="combobox" aria-label="Search registered clients" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-results`} aria-activedescendant={visible[active]?`${id}-option-${visible[active].id}`:undefined} autoComplete="off" placeholder="Type a name, email or client ID…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=Math.max(0,Math.min(visible.length-1,active+(event.key==='ArrowDown'?1:-1)));setActive(next);document.getElementById(`${id}-option-${visible[next]?.id}`)?.scrollIntoView({block:'nearest'});}
    if(event.key==='Enter'){event.preventDefault();if(visible[active])choose(visible[active]);}
   }}/>{query&&<button type="button" aria-label="Clear client search" onClick={()=>{setQuery('');input.current?.focus();}}>×</button>}</div>
   <div className="mvm-client-results-meta" role="status">{loading?(normalized?'Searching registered clients…':'Loading clients…'):`${matches.length} ${normalized?'matching':'loaded'} client${matches.length===1?'':'s'}`}{cursor&&!loading&&<span>More available</span>}</div>
   <div id={`${id}-results`} role="listbox" aria-label="Registered clients" aria-busy={loading} className="mvm-client-results">
    {visible.map((client,index)=><button type="button" role="option" aria-selected={client.id===value} id={`${id}-option-${client.id}`} key={client.id} className={`mvm-client-option ${index===active?'is-active':''}`} onPointerMove={()=>setActive(index)} onClick={()=>choose(client)}>
     <span className="mvm-client-avatar" aria-hidden="true">{String(client.name||client.email||'?').slice(0,1).toUpperCase()}</span><span className="mvm-client-copy"><strong>{client.name||client.email}</strong><small>{client.email}</small><span className="mvm-client-id">{client.publicId||'Registered Google account'}</span></span><span aria-hidden="true">{client.id===value?'✓':'↗'}</span>
    </button>)}
   </div>
   {!matches.length&&!loading&&<div className="mvm-client-no-results"><strong>{normalized?'No matching clients found':'No registered clients yet'}</strong><p>{cursor?'Search continues through the remaining clients.':billing?'Add a client in Clients before issuing a receipt.':'Clients must sign in with Google before you can book for them.'}</p></div>}
   {error&&<div className="mvm-client-error" role="alert">{error}<button type="button" onClick={()=>void load(cursor??undefined)}>Try again</button></div>}
   <div className="mvm-client-picker-footer">{matches.length>limit?<button type="button" onClick={()=>setLimit(previous=>previous+20)}>Show more matches</button>:cursor&&!normalized?<button type="button" disabled={loading} onClick={()=>void load(cursor)}>Load more clients</button>:<span>{billing?'Registered and manually added clients':'Google-registered accounts only'}</span>}<button type="button" onClick={close}>Done</button></div>
  </div>}
 </div>;
}
function SearchIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;}
