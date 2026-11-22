import { lazy, StrictMode, Suspense,useCallback,useEffect,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './index.css';
import PageTransition,{RouteReady} from './components/PageTransition';

const BillingWorkspace = lazy(() => import('./invoicing/BillingWorkspace'));
const InvoiceLayoutPreview = lazy(() => import('./invoicing/BillingWorkspace').then(module => ({ default: module.InvoiceLayoutPreview })));
let studioModule:Promise<typeof import('./studio/StudioWorkspace')>|undefined;
const prepareStudio=()=>studioModule??=import('./studio/StudioWorkspace');
const StudioWorkspace = lazy(prepareStudio);

const LegalPages=lazy(()=>import('./legal/LegalPages'));
function Router(){
 const [route,setRoute]=useState(()=>new URL(window.location.href));
 const navigate=useCallback((url:URL)=>{
  history.replaceState({...history.state,mvmScrollY:window.scrollY,mvmVisited:true},'',location.href);
  history.pushState({mvmScrollY:0},'',url.href);window.scrollTo({top:0,left:0,behavior:'instant'});setRoute(url);
 },[]);
 useEffect(()=>{const pop=(event:PopStateEvent)=>{setRoute(new URL(location.href));if(Number.isFinite(event.state?.mvmScrollY))requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:event.state.mvmScrollY,behavior:'instant'})));};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 const path=route.pathname,policies=path==='/policies'||path.startsWith('/policies/'),billing=path==='/billing';
 const layout=import.meta.env.DEV&&path==='/billing/layout',operationsLayout=import.meta.env.DEV&&path==='/admin/layout',operations=path==='/admin';
 const light=policies||path.startsWith('/billing')||path.startsWith('/admin')||path.startsWith('/go')||path.startsWith('/portal');
 return <PageTransition light={light} navigate={navigate} prepare={prepareStudio}><Suspense fallback={<div className="route-loading" role="status">Opening your client space…</div>}><RouteReady routeKey={path+route.search}>
  {policies?<LegalPages/>:operationsLayout?<StudioWorkspace admin designOnly/>:path==='/go/layout'&&import.meta.env.DEV?<StudioWorkspace admin onGo designOnly/>:operations?<StudioWorkspace admin/>:path==='/go'?<StudioWorkspace admin onGo/>:path==='/portal/layout'&&import.meta.env.DEV?<StudioWorkspace designOnly/>:path==='/portal'?<StudioWorkspace/>:path==='/billing/legacy'?<BillingWorkspace/>:path==='/admin/contacts'?<StudioWorkspace admin/>:layout?<InvoiceLayoutPreview/>:billing?<StudioWorkspace/>:<App/>}
 </RouteReady></Suspense></PageTransition>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Router/>
    </MotionConfig>
  </StrictMode>,
);
