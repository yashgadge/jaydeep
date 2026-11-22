import {useCallback,useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useInView} from 'framer-motion';
import {createPortal} from 'react-dom';
import {AgencyIcon} from './AgencyIcons';
import {useReducedMotionPref} from '../hooks/useMedia';
import {useScrollLock,useSmoothScroll} from '../hooks/smoothScroll';
import {agency} from '../data/agency';
import {loadPublicWebsite} from '../data/publicWebsite';
import './reel-showcase.css';
import {createReelWheelState,routeReelWheel} from './reelWheel';

let instagramAllowedForVisit=false;
export type Reel={id:string;title:string;body?:string;url?:string;videoUrl?:string;imageUrl?:string;sortOrder?:number};
export function instagramEmbed(url=''){
 try{const u=new URL(url);if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname))return null;const match=u.pathname.match(/^\/(reel|reels|p)\/([\w-]+)\/?$/);return match?`https://www.instagram.com/${match[1]==='reels'?'reel':match[1]}/${match[2]}/embed/`:null;}catch{return null;}
}
export default function ReelShowcase({previewItems}:{previewItems?:Reel[]}={}){
 const [reels,setReels]=useState<Reel[]>([]),[hasMore,setHasMore]=useState(false),[pageSize,setPageSize]=useState(24),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [index,setIndex]=useState(0),[watch,setWatch]=useState<Reel|null>(null),[playing,setPlaying]=useState(true),[hover,setHover]=useState(false);
 const root=useRef<HTMLElement>(null),room=useRef<HTMLDivElement>(null),touchX=useRef(0);const reduced=useReducedMotionPref(),inView=useInView(root,{amount:.35});
 useEffect(()=>{if(previewItems){setReels(previewItems);setHasMore(false);setLoading(false);return;}let active=true;
  void loadPublicWebsite().then(result=>{if(!active)return;const all=result.content.filter(item=>item.kind==='portfolio').sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)||a.id.localeCompare(b.id)) as Reel[];setReels(all.slice(0,pageSize));setHasMore(all.length>pageSize);setLoading(false);setError('');}).catch(()=>{if(active){setLoading(false);setError('The reel collection is temporarily unavailable.');}});return()=>{active=false;};},[previewItems,pageSize]);
 function loadMore(){if(loading)return;setLoading(true);setPageSize(previous=>previous+24);}
 const items=[...reels].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)||a.id.localeCompare(b.id));
 const current=Math.min(index,Math.max(0,items.length-1));
 const step=(direction:number)=>setIndex(previous=>(Math.min(previous,items.length-1)+direction+items.length)%items.length);
 useEffect(()=>{if(!inView||!playing||hover||watch||reduced||items.length<2)return;const timer=window.setInterval(()=>setIndex(previous=>(previous+1)%items.length),4800);return()=>clearInterval(timer);},[inView,playing,hover,watch,reduced,items.length]);
 // Gentle wheel = browse; a vertical flick and its momentum pass through to Lenis/the page.
 const wheelState=useRef(createReelWheelState());
 useEffect(()=>{
  const element=room.current;if(!element||items.length<2||watch)return;
  wheelState.current=createReelWheelState();
  const wheel=(event:WheelEvent)=>{
   const action=routeReelWheel(wheelState.current,event,performance.now(),window.innerHeight);
   if(action.route==='ignore')return;
   setPlaying(false);
   // Do not cancel or stop a page gesture: the existing smooth scroll handles it once.
   if(action.route==='page')return;
   event.preventDefault();event.stopPropagation();
   if(action.step)setIndex(previous=>(Math.min(previous,items.length-1)+action.step+items.length)%items.length);
  };
  element.addEventListener('wheel',wheel,{passive:false});
  return()=>element.removeEventListener('wheel',wheel);
 },[items.length,watch]);
 useHeroGlide(root,Boolean(previewItems));
 const closeViewer=useCallback(()=>setWatch(null),[]);
 return <section ref={root} id="work" className="mvm-reel-showcase" aria-label="Our reels and selected work">
  <motion.div className="mvm-reel-heading" initial={reduced?false:{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.3}} transition={{duration:.9}}><div><p className="agency-kicker">01 / INSIDE THE FRAME</p><h2>REAL MOMENTS.<br/><em>Made to move.</em></h2></div><a href={agency.instagram} target="_blank" rel="noopener noreferrer"><AgencyIcon name="instagram"/>@maharashtra_vision_media <span>↗</span></a></motion.div>
  {items.length>0?<><motion.div ref={room} className="mvm-reel-room" initial={reduced?false:{opacity:0,scale:.94,y:55}} whileInView={{opacity:1,scale:1,y:0}} viewport={{once:true,amount:.2}} transition={{duration:1.2,ease:[.22,1,.36,1]}} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setHover(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setHover(false);}} onTouchStart={event=>{touchX.current=event.touches[0].clientX;setPlaying(false);}} onTouchEnd={event=>{const delta=event.changedTouches[0].clientX-touchX.current;if(Math.abs(delta)>45)step(delta<0?1:-1);}}>
   <div className="mvm-reel-orbit" aria-hidden="true"/><span className="mvm-reel-room-label" aria-hidden="true"><i/>THE MVM REEL ROOM</span>
   <div className="mvm-reel-depth">
    {items.map((reel,i)=>{let distance=i-current;if(distance>items.length/2)distance-=items.length;if(distance< -items.length/2)distance+=items.length;if(Math.abs(distance)>3)return null;const active=distance===0;
     return <motion.button key={reel.id} type="button" className={`mvm-reel-card ${active?'is-current':''}`} aria-label={`Watch ${reel.title}`} tabIndex={active?0:-1} initial={false} animate={{x:distance*198,y:Math.abs(distance)*12,z:-Math.abs(distance)*125,rotateY:distance*-22,rotateZ:distance*1.8,opacity:Math.abs(distance)>2?.2:1,scale:active?1:.94}} transition={{duration:reduced?0:1.05,ease:[.22,1,.36,1]}} style={{zIndex:10-Math.abs(distance)}} onClick={()=>{setPlaying(false);setIndex(i);setWatch(reel);}}>
      {reel.imageUrl?<img src={reel.imageUrl} alt="" loading="lazy" decoding="async"/>:<div className="mvm-reel-no-cover"><AgencyIcon name="film"/><span>MAHARASHTRA<br/>VISION MEDIA</span><b>{reel.title}</b></div>}
      <span className="mvm-reel-card-shade"/><span className="mvm-reel-card-number">{String(i+1).padStart(2,'0')} / IN FRAME</span><span className="mvm-reel-play" aria-hidden="true">▶</span><span className="mvm-reel-card-copy"><strong>{reel.title}</strong><small>{instagramEmbed(reel.url)?'WATCH REEL':'VIEW PROJECT'} ↗</small></span>
     </motion.button>;
    })}
   </div>
  </motion.div><div className="mvm-reel-controls"><div className="mvm-reel-transport"><button type="button" aria-label="Previous reel" onClick={()=>{setPlaying(false);step(-1);}}>←</button><span aria-live="polite">{String(current+1).padStart(2,'0')} <i>/ {String(items.length).padStart(2,'0')}</i></span><button type="button" aria-label="Next reel" onClick={()=>{setPlaying(false);step(1);}}>→</button>{!reduced&&items.length>1&&<button type="button" className="mvm-reel-pause" aria-label={playing?'Pause reel rotation':'Resume reel rotation'} onClick={()=>setPlaying(p=>!p)}>{playing?'Ⅱ':'▷'}</button>}</div><p>GENTLE SCROLL: REELS · FAST SCROLL: PAGE <span>↕</span></p>{hasMore&&<button type="button" className="mvm-reel-more" disabled={loading} onClick={()=>void loadMore()}>{loading?'Loading…':'Load more work ↗'}</button>}</div></>:<div className="mvm-reel-empty"><AgencyIcon name="film"/><h3>Our next frame starts here.</h3><p>{loading?'Bringing the collection into focus…':'Explore our latest shoots and films on Instagram.'}</p><a href={agency.instagram} target="_blank" rel="noopener noreferrer">Explore the studio feed ↗</a>{hasMore&&<button type="button" disabled={loading} onClick={()=>void loadMore()}>Load portfolio ↗</button>}</div>}
  {error&&<p className="mvm-reel-error" role="status">{error}</p>}
  <a className="mvm-reel-continue" href="#services">THE BRANDS, BEHIND THE GROWTH <span>↓</span></a>
  <AnimatePresence>{watch&&<ReelViewer reel={watch} onClose={closeViewer}/>}</AnimatePresence>
 </section>;
}
function ReelViewer({reel,onClose}:{reel:Reel;onClose:()=>void}){
 const panel=useRef<HTMLDivElement>(null),[mediaAllowed,setMediaAllowed]=useState(instagramAllowedForVisit);useScrollLock(true);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const page=document.querySelector<HTMLElement>('[data-studio-page]');const previousInert=page?.inert;if(page)page.inert=true;panel.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();if(event.key==='Tab'){const elements=panel.current?.querySelectorAll<HTMLElement>('button,a,iframe,video');if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(page)page.inert=previousInert??false;previous?.focus({preventScroll:true});};},[onClose]);
 const embed=instagramEmbed(reel.url);
 return createPortal(<motion.div className="mvm-reel-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={reel.title} className="mvm-reel-viewer" data-lenis-prevent initial={{y:25,scale:.96}} animate={{y:0,scale:1}} exit={{y:15,opacity:0}}><header><h3>{reel.title}</h3><button type="button" onClick={onClose} aria-label="Close reel">×</button></header>{reel.videoUrl?<DirectReelPlayer reel={reel}/>:embed?mediaAllowed?<iframe title={reel.title} src={embed} allow="autoplay; encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin"/>:<div className="mvm-embed-choice"><AgencyIcon name="instagram"/><h4>Watch with Instagram</h4><p>Loading this player connects to Meta/Instagram and may share your IP address, device information and cookie or account state under its policies.</p><button type="button" onClick={()=>{instagramAllowedForVisit=true;setMediaAllowed(true);}}>Allow Instagram for this visit</button><a href="/policies/cookies" target="_blank" rel="noopener noreferrer">Read about external media ↗</a><small>You can keep browsing without loading it.</small></div>:reel.imageUrl?<img src={reel.imageUrl} alt={reel.title}/>:<AgencyIcon name="film"/>}{reel.body&&<p>{reel.body}</p>}{reel.url&&<a href={reel.url} target="_blank" rel="noopener noreferrer">{embed?'Open on Instagram':'Open project'} ↗</a>}{!reel.videoUrl&&<small>Instagram controls this embedded player. For native on-site playback, the studio can attach the original video.</small>}</motion.div></motion.div>,document.body);
}
function DirectReelPlayer({reel}:{reel:Reel}){
 const video=useRef<HTMLVideoElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const media=video.current;if(media&&!media.getAttribute('src')&&reel.videoUrl)media.src=reel.videoUrl;return()=>{if(media){media.pause();media.removeAttribute('src');media.load();}};},[reel.videoUrl]);
 return <div className="mvm-direct-player"><video ref={video} src={reel.videoUrl} poster={reel.imageUrl} controls playsInline autoPlay preload="none" onError={()=>setFailed(true)} aria-label={reel.title}/>{failed&&<div role="alert"><p>This video file is unavailable or unsupported. Please try again or contact the studio.</p><button onClick={()=>{setFailed(false);const media=video.current;if(media){media.load();void media.play().catch(()=>setFailed(true));}}}>Retry video</button></div>}</div>;
}
function useHeroGlide(target:React.RefObject<HTMLElement>,disabled=false){
 const {scrollTo}=useSmoothScroll(),reduced=useReducedMotionPref();
 useEffect(()=>{if(reduced||disabled)return;let used=false,timer=0,startY=0;
  const glide=()=>{const hero=document.getElementById('top');if(used||!hero||!target.current||document.querySelector('[data-opening-active="true"]')||document.querySelector('.mvm-reel-backdrop'))return;const box=hero.getBoundingClientRect();if(box.top>5||box.bottom<innerHeight*.35||scrollY>hero.offsetHeight*.65)return;used=true;clearTimeout(timer);timer=window.setTimeout(()=>scrollTo(target.current!,{offset:-((document.querySelector('.agency-header-inner')?.getBoundingClientRect().height??78)+12)}),130);};
  const wheel=(event:WheelEvent)=>{if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||(event.target as Element).closest('a,button,iframe,input'))return;if(event.deltaY>25)glide();else if(event.deltaY<0)clearTimeout(timer);};
  const touchStart=(event:TouchEvent)=>{startY=event.touches[0].clientY;};const touchEnd=(event:TouchEvent)=>{if(startY-event.changedTouches[0].clientY>65)glide();};
  const reset=()=>{if(scrollY<5)used=false;};window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchstart',touchStart,{passive:true});window.addEventListener('touchend',touchEnd,{passive:true});window.addEventListener('scroll',reset,{passive:true});
  return()=>{clearTimeout(timer);window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',touchStart);window.removeEventListener('touchend',touchEnd);window.removeEventListener('scroll',reset);};
 },[reduced,scrollTo,target,disabled]);
}
