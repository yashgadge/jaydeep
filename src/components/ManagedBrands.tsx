import {useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {useReducedMotionPref} from '../hooks/useMedia';
import {AgencyIcon} from './AgencyIcons';
import './managed-brands.css';
import {loadPublicWebsite} from '../data/publicWebsite';
export type ManagedBrand={id:string;title:string;body?:string;imageUrl?:string;url?:string;instagramHandle?:string;displayMode?:string;sortOrder?:number;followers?:number|null;followersAsOf?:string;accountViews?:number|null;viewsPeriod?:string;viewsAsOf?:string};
export default function ManagedBrands({previewItems}:{previewItems?:ManagedBrand[]}={}){
 const [items,setItems]=useState<ManagedBrand[]>([]),[limit,setLimit]=useState(24),[more,setMore]=useState(false),[error,setError]=useState(false),[loaded,setLoaded]=useState(false);
 const root=useRef<HTMLElement>(null);const reduced=useReducedMotionPref();
 useEffect(()=>{if(previewItems){setItems([...previewItems].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)));setLoaded(true);return;}let active=true;
  void loadPublicWebsite().then(result=>{if(!active)return;const all=result.content.filter(item=>item.kind==='handle').sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)||a.id.localeCompare(b.id)) as ManagedBrand[];setItems(all.slice(0,limit));setMore(all.length>limit);setLoaded(true);setError(false);}).catch(()=>{if(active){setError(true);setLoaded(true);}});return()=>{active=false;};
 },[previewItems,limit]);
 const stage=useRef<HTMLDivElement>(null),[selectedId,setSelectedId]=useState('');
 const cardRefs=useRef<(HTMLButtonElement|null)[]>([]),scrollFrame=useRef(0),selectionRef=useRef(selectedId);selectionRef.current=selectedId;
 const selectedIndex=Math.max(0,items.findIndex(item=>item.id===selectedId)),selected=items[selectedIndex];
 const select=(index:number,align=false)=>{
  if(!items.length)return;
  const next=(index+items.length)%items.length;setSelectedId(items[next].id);
  if(align&&stage.current&&cardRefs.current[next]){
   const rail=stage.current;
   rail.scrollTo({left:items.length>1?(rail.scrollWidth-rail.clientWidth)*next/(items.length-1):0,behavior:reduced?'auto':'smooth'});
  }
 };
 const trackSelection=()=>{
  if(scrollFrame.current)return;
  scrollFrame.current=requestAnimationFrame(()=>{
   scrollFrame.current=0;const rail=stage.current;if(!rail)return;
   const range=rail.scrollWidth-rail.clientWidth;if(range<=1)return;
   // Follow the collection from start to end without empty centring spacers.
   const nearest=Math.round(Math.max(0,Math.min(1,rail.scrollLeft/range))*(items.length-1));
   if(items[nearest])setSelectedId(items[nearest].id);
  });
 };
 useEffect(()=>()=>cancelAnimationFrame(scrollFrame.current),[]);
 // Keep the selected record visible after live Admin reordering or resizing.
 useEffect(()=>{
  const rail=stage.current;if(!rail)return;
  const observer=new ResizeObserver(()=>{const index=Math.max(0,items.findIndex(item=>item.id===selectionRef.current));rail.scrollTo({left:items.length>1?(rail.scrollWidth-rail.clientWidth)*index/(items.length-1):0,behavior:'auto'});});
  observer.observe(rail);return()=>observer.disconnect();
 },[items]);
 const handle=selected?.instagramHandle?.replace(/^@/,'');
 return <section id="services" ref={root} className="managed-brands managed-brands-bounce" aria-label="Businesses and pages we manage">
  <motion.div className="managed-brand-entry-line" aria-hidden="true" initial={reduced?false:{scaleX:0,opacity:0}} whileInView={{scaleX:1,opacity:1}} viewport={{once:true,amount:.8}} transition={{duration:reduced?0:1,ease:[.22,1,.36,1]}}/>
  <motion.header initial={reduced?false:{opacity:0,y:25}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.8}}><div><p className="agency-kicker">02 / BRANDS IN OUR CARE</p><h2>THEIR BRAND.<br/><em>Our shared vision.</em></h2></div><p>Businesses. People. Pages.<br/>A presence made to stand out.</p></motion.header>
  {selected?<motion.div className="managed-brand-bounce-showcase managed-brand-unified" role="group" aria-label="Managed brands and account details" initial={reduced?false:{opacity:0,y:28,clipPath:'inset(0 0 70% 0 round 18px)'}} whileInView={{opacity:1,y:0,clipPath:'inset(0 0 0% 0 round 0px)'}} viewport={{once:true,amount:.12}} transition={{duration:reduced?0:.85,ease:[.22,1,.36,1]}}>
   <div className="managed-brand-bounce-controls"><p>Our client collection</p><div><button type="button" aria-label="Previous brand" disabled={items.length<2} onClick={()=>select(selectedIndex-1,true)}><span aria-hidden>←</span></button><span aria-label={`Brand ${selectedIndex+1} of ${items.length}`}>{selectedIndex+1} / {items.length}</span><button type="button" aria-label="Next brand" disabled={items.length<2} onClick={()=>select(selectedIndex+1,true)}><span aria-hidden>→</span></button></div></div>
   <div className="managed-brand-rail-frame">
    <div className="managed-brand-bounce-stage managed-brand-logo-rail" ref={stage} role="region" aria-label="Managed client logos" onScroll={trackSelection}
     onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=(selectedIndex+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;cardRefs.current[next]?.focus({preventScroll:true});select(next,true);}}}>
     {items.map((brand,i)=><motion.button type="button" key={brand.id} ref={element=>{cardRefs.current[i]=element;}} className="managed-brand-logo-card"
      aria-label={`View ${brand.title}`} aria-pressed={selectedIndex===i} aria-controls="managed-brand-detail"
      initial={reduced?false:{opacity:0,y:20,rotate:-3}} whileInView={{opacity:1,y:0,rotate:0}} viewport={{once:true,amount:.2}}
      transition={reduced?{duration:0}:{type:'spring',stiffness:140,damping:20,delay:(i%5)*.04}}
      onMouseEnter={()=>select(i)} onFocus={()=>select(i)} onClick={()=>select(i,true)}>
      <span className={`managed-brand-logo-mat ${brand.displayMode==='image'?'is-image':''}`}>{brand.imageUrl?<img src={brand.imageUrl} alt="" loading="lazy" draggable={false}/>:<b aria-hidden>{brand.title.slice(0,2)}</b>}</span>
      <span className="managed-brand-logo-name">{brand.title}</span><span className="managed-brand-logo-indicator" aria-hidden/>
     </motion.button>)}
    </div>
   </div>

   <div className="managed-brand-detail-anchor" id="managed-brand-detail" aria-live="polite" aria-atomic="true">
    <AnimatePresence mode="popLayout" initial={false}><motion.article className="managed-brand-bounce-detail" key={selected.id}
     initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-3}} transition={{duration:reduced?0:.18,ease:[.22,1,.36,1]}}>
     <div className="managed-brand-bounce-copy"><p className="managed-brand-label">SELECTED BRAND</p><div className="managed-brand-selected-heading">{selected.imageUrl&&<img className="managed-brand-selected-logo" src={selected.imageUrl} alt=""/>}<h3>{selected.title}</h3></div>{selected.body&&<p className="managed-brand-description">{selected.body}</p>}
      <div className="managed-brand-links">{handle&&<a href={'https://www.instagram.com/'+handle+'/'} target="_blank" rel="noopener noreferrer"><AgencyIcon name="instagram"/><span className="managed-brand-handle">@{handle}</span><span aria-hidden>↗</span></a>}{selected.url&&<a href={selected.url} target="_blank" rel="noopener noreferrer">Explore the brand <span aria-hidden>↗</span></a>}</div>
     </div>
     {(selected.followers!=null||selected.accountViews!=null)&&<div className="managed-brand-statistics">{selected.followers!=null&&<div><strong>{new Intl.NumberFormat('en-IN').format(selected.followers)}</strong><span>Instagram followers</span>{selected.followersAsOf&&<small>Checked {new Date(selected.followersAsOf+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} · snapshot</small>}</div>}{selected.accountViews!=null&&<div><strong>{new Intl.NumberFormat('en-IN').format(selected.accountViews)}</strong><span>Account views</span><small>{selected.viewsPeriod}</small><small>Studio-reported Insights · {selected.viewsAsOf}</small></div>}</div>}
    </motion.article></AnimatePresence>
   </div>
   {more&&<button className="managed-brands-load" onClick={()=>setLimit(n=>n+24)}>Discover more brands</button>}
  </motion.div>:<div className="managed-brands-invite"><span aria-hidden>✦</span><p>{!loaded?'Bringing the brands into focus…':error?'Explore what we can create together.':'Your brand’s next chapter starts here.'}</p><a href="/billing?intent=management">Let’s build your presence <span>↗</span></a></div>}
 </section>;
}
