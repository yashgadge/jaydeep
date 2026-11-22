import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import './page-transition.css';

const ReadyContext=createContext(()=>{});
export function RouteReady({routeKey,children}:{routeKey:string;children:ReactNode}){
 const ready=useContext(ReadyContext);
 useLayoutEffect(()=>{ready();},[routeKey,ready]);
 return <>{children}</>;
}
type Flight={origin:{x:number;y:number;radius:number;start:number;width:number;height:number};url:URL;label:string;abort:AbortController;cover:()=>void;ready:()=>void};
const EASE='cubic-bezier(.22,1,.36,1)';
export default function PageTransition({children,light,navigate,prepare}:{children:ReactNode;light:boolean;navigate:(url:URL)=>void;prepare:()=>Promise<unknown>}){
 const shell=useRef<HTMLDivElement>(null),surface=useRef<SVGCircleElement>(null),overlay=useRef<HTMLDivElement>(null);
 const [flight,setFlight]=useState<Flight|null>(null),[covered,setCovered]=useState(false),[failed,setFailed]=useState(false);
 const active=useRef<Flight|null>(null);
 const native=useRef<ViewTransition|null>(null);
 const routeReady=useCallback(()=>active.current?.ready(),[]);
 const cancel=useCallback(()=>{const current=active.current;if(!current)return;current.abort.abort();native.current?.skipTransition();native.current=null;document.documentElement.classList.remove('mvm-route-handoff');current.cover();current.ready();shell.current?.getAnimations().forEach(animation=>animation.cancel());overlay.current?.getAnimations().forEach(animation=>animation.cancel());active.current=null;setFlight(null);setCovered(false);},[]);

 useEffect(()=>{
  document.documentElement.dataset.routeTheme=light?'light':'dark';
 },[light]);

 useEffect(()=>{
  const click=(event:MouseEvent)=>{
   if(light||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!anchor||anchor.hasAttribute('download')||anchor.dataset.noTransition!==undefined||anchor.target&&anchor.target!=='_self')return;
   const url=new URL(anchor.href,location.href);
   if(url.origin!==location.origin||!['/billing','/portal','/admin','/go'].includes(url.pathname))return;
   event.preventDefault();if(active.current)return;
   setFailed(false);
   if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){navigate(url);return;}
   let cover!:()=>void,ready!:()=>void;
   const coverDone=new Promise<void>(resolve=>{cover=resolve;}),routeDone=new Promise<void>(resolve=>{ready=resolve;});
   const rect=anchor.getBoundingClientRect(),width=innerWidth,height=innerHeight,x=rect.left+rect.width/2,y=rect.top+rect.height/2;
   const origin={x,y,width,height,start:Math.max(8,Math.min(rect.width,rect.height)/2),radius:Math.hypot(Math.max(x,width-x),Math.max(y,height-y))*1.8};
   const current:Flight={origin,url,label:url.searchParams.has('intent')?'Opening your booking…':'Opening your client space…',abort:new AbortController(),cover,ready};
   active.current=current;setCovered(false);setFlight(current);
   void(async()=>{
    try{
     // Keep the current content visible while the destination loads beneath a soft light wash.
     await Promise.all([prepare(),coverDone]);if(current.abort.signal.aborted)return;
     let nativeReady=false;
     if(typeof document.startViewTransition==='function'){
      document.documentElement.classList.add('mvm-route-handoff');
      const transition=document.startViewTransition(async()=>{if(current.abort.signal.aborted)return;navigate(url);await routeDone;});
      native.current=transition;
      nativeReady=await transition.ready.then(()=>true,()=>false);
     }else{navigate(url);await routeDone;}
     if(current.abort.signal.aborted)return;
     await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
     if(current.abort.signal.aborted)return;
     const reveal=overlay.current?.animate([{opacity:1},{opacity:0}],{duration:700,easing:EASE,fill:'forwards'});
     const arrival=!nativeReady?shell.current?.animate([{opacity:.3},{opacity:1}],{duration:700,easing:EASE}):undefined;
     await Promise.all([reveal?.finished,arrival?.finished,nativeReady?native.current?.finished:undefined]);if(current.abort.signal.aborted)return;
     native.current=null;document.documentElement.classList.remove('mvm-route-handoff');
     active.current=null;if(shell.current)shell.current.inert=false;setFlight(null);setCovered(false);
     const heading=shell.current?.querySelector<HTMLElement>('main h1, main h2, main');
     if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
    }catch{
     if(current.abort.signal.aborted)return;
     // A stale chunk or failed import falls back to the anchor's normal navigation.
     try{window.location.assign(url.href);}catch{cancel();setFailed(true);}
    }
   })();
  };
  document.addEventListener('click',click);window.addEventListener('popstate',cancel);
  return()=>{document.removeEventListener('click',click);window.removeEventListener('popstate',cancel);};
 },[light,navigate,prepare,cancel]);

 useEffect(()=>{
  if(!flight||!surface.current||!shell.current)return;
  const page=shell.current,previousInert=page.inert,overflow=document.documentElement.style.overflow;
  page.inert=true;document.documentElement.style.overflow='hidden';
  const animations:Animation[]=[];
  const animate=(element:Element,keyframes:Keyframe[],options:KeyframeAnimationOptions)=>{const animation=element.animate(keyframes,options);animations.push(animation);return animation;};
  // The circle's exact center is the clicked button, including keyboard activation.
  // SVG clips the feathered light to the viewport instead of allocating an oversized layer.
  const finish=animate(surface.current,[
   {r:`${flight.origin.start}px`,opacity:0},
   {r:`${flight.origin.radius*.45}px`,opacity:.64,offset:.5},
   {r:`${flight.origin.radius}px`,opacity:.9}
  ],{duration:850,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  const loadingTimer=window.setTimeout(()=>{if(!flight.abort.signal.aborted)setCovered(true);},1800);
  void finish.finished.then(()=>{if(!flight.abort.signal.aborted)flight.cover();}).catch(()=>{});
  return()=>{
   clearTimeout(loadingTimer);animations.forEach(animation=>animation.cancel());page.inert=previousInert;document.documentElement.style.overflow=overflow;
  };
 },[flight]);

 useEffect(()=>()=>{const current=active.current;if(current){current.abort.abort();native.current?.skipTransition();document.documentElement.classList.remove('mvm-route-handoff');current.cover();current.ready();}},[]);
 return <ReadyContext.Provider value={routeReady}><div ref={shell} className="route-page" data-theme={light?'light':'dark'}>{children}</div>{flight&&<div className="page-transition" ref={overlay} role="status" aria-live="polite" aria-label={flight.label}>
  <svg className="page-transition-surface" viewBox={`0 0 ${flight.origin.width} ${flight.origin.height}`} preserveAspectRatio="none" aria-hidden="true"><defs><radialGradient id="mvm-route-light"><stop offset="0%" stopColor="#f5f5f8"/><stop offset="45%" stopColor="#f5f5f8" stopOpacity=".98"/><stop offset="70%" stopColor="#b9b7bd" stopOpacity=".8"/><stop offset="86%" stopColor="#29282e" stopOpacity=".4"/><stop offset="100%" stopColor="#070709" stopOpacity="0"/></radialGradient></defs><circle ref={surface} cx={flight.origin.x} cy={flight.origin.y} r={flight.origin.start} fill="url(#mvm-route-light)" opacity="0"/></svg>
  <div className={`page-transition-caption${covered?' is-visible':''}`} aria-hidden="true"><span>{flight.label}</span><i/></div>
 </div>}{failed&&<p role="alert" className="page-transition-error">The page could not open. Please try the link again.</p>}</ReadyContext.Provider>;
}
