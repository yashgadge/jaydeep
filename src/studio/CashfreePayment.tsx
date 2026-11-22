import {useEffect,useRef,useState} from 'react';
import {call,failureText} from '../operations/api';
type SDK={checkout:(options:{paymentSessionId:string;redirectTarget:string})=>Promise<{error?:{message?:string}}|undefined>};
let sdkPromise:Promise<(mode:'sandbox'|'production')=>SDK>|undefined;
function loadSDK(){
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://sdk.cashfree.com/js/v3/cashfree.js';script.async=true;
  const fail=()=>{clearTimeout(timeout);script.remove();sdkPromise=undefined;reject(new Error('Payment checkout could not load. Please try again.'));};
  const timeout=window.setTimeout(fail,15000);script.onerror=fail;
  script.onload=()=>{clearTimeout(timeout);const factory=(window as Window&{Cashfree?:(options:{mode:string})=>SDK}).Cashfree;if(!factory){fail();return;}resolve(mode=>factory({mode}));};
  document.head.appendChild(script);
 });return sdkPromise;
}
type Verified={status:string;environment:string;recorded:boolean;receiptId?:string};
export default function CashfreePayment({orderId,portion,environment}:{orderId:string;portion:'advance'|'balance';environment:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const storageKey='mvm-checkout-'+orderId,[checkoutId,setCheckoutId]=useState(()=>sessionStorage.getItem(storageKey)??'');
 const request=useRef(crypto.randomUUID());
 const verify=async(id:string)=>{
  const result=await call<unknown,Verified>('verifyCashfreeCheckout',{id});
  if(result.status==='PAID'){
   setMessage(result.recorded?'Payment verified. Your invoice, receipt and shoot timeline have been updated.':'Cashfree confirmed this sandbox payment. No real money was collected, so the invoice remains unpaid.');
   sessionStorage.removeItem(storageKey);setCheckoutId('');request.current=crypto.randomUUID();
  }else{setMessage(result.status==='ACTIVE'?'Payment has not been confirmed yet. You can check again or retry.':`Checkout ${result.status.toLowerCase()}. No payment has been confirmed.`);request.current=crypto.randomUUID();}
  return result;
 };
 const start=async()=>{
  setBusy(true);setError('');setMessage('');
  try{
   const factory=await loadSDK();
   const session=await call<unknown,{gatewayOrderId:string;paymentSessionId:string;alreadyPaid?:boolean;environment:'sandbox'|'production'}>('createCashfreeCheckout',{id:orderId,portion,requestId:request.current});
   setCheckoutId(session.gatewayOrderId);sessionStorage.setItem(storageKey,session.gatewayOrderId);
   if(session.alreadyPaid){await verify(session.gatewayOrderId);return;}
   const outcome=await factory(session.environment).checkout({paymentSessionId:session.paymentSessionId,redirectTarget:'_modal'});
   const confirmed=await verify(session.gatewayOrderId);
   if(outcome?.error&&confirmed.status!=='PAID')setError(outcome.error.message?.slice(0,300)||'Cashfree checkout was closed or could not complete. You can check status or retry.');
  }catch(e){const message=failureText(e);setError(message);if(/expired|terminated/i.test(message))request.current=crypto.randomUUID();}finally{setBusy(false);}
 };
 return <div className="order-cashfree-payment"><h3>Pay securely online</h3>{environment==='sandbox'&&<p className="studio-warning">Cashfree is in sandbox mode. Test transactions do not collect money or settle this invoice.</p>}<div className="studio-inline"><button className="billing-primary" disabled={busy} onClick={()=>void start()}>{busy?'Confirming payment…':'Pay with Cashfree ↗'}</button>{checkoutId&&<button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await verify(checkoutId);}catch(e){setError(failureText(e));}finally{setBusy(false);}}}>Check payment status</button>}</div>{message&&<p role="status">{message}</p>}{error&&<p className="studio-warning" role="alert">{error}</p>}<p className="studio-hint">A payment is confirmed only after the server verifies it with Cashfree. Closing checkout or returning to this page does not mark a payment received.</p></div>;
}

// Cashfree may redirect instead of using the modal in an in-app browser.
export function CashfreeReturn(){
 const [id]=useState(()=>new URLSearchParams(location.search).get('cashfree_order')??'');
 const [busy,setBusy]=useState(true),[result,setResult]=useState<Verified|null>(null),[error,setError]=useState('');
 const pending=useRef<Promise<Verified>>();
 const valid=/^mvm_[a-f0-9]{40}$/.test(id);
 useEffect(()=>{
  if(!valid)return;let active=true;
  pending.current??=call<unknown,Verified>('verifyCashfreeCheckout',{id});
  void pending.current.then(value=>{if(active)setResult(value);}).catch(e=>{if(active)setError(failureText(e));}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[id,valid]);
 if(!valid)return null;
 return <section className="billing-card" aria-label="Payment confirmation"><h2>Payment confirmation</h2>{busy?<p role="status">Verifying your payment with Cashfree…</p>:result?.status==='PAID'?<p role="status">{result.recorded?'Your payment is verified. Your bill, receipt and shoot timeline have been updated.':'Cashfree confirmed a sandbox transaction. No real payment was collected and the invoice remains unpaid.'}</p>:<p role="status">Payment has not yet been confirmed. Your bill will update only after verification.</p>}{error&&<p className="studio-warning" role="alert">{error}</p>}{!busy&&result?.status!=='PAID'&&<button onClick={async()=>{setBusy(true);setError('');try{setResult(await call<unknown,Verified>('verifyCashfreeCheckout',{id}));}catch(e){setError(failureText(e));}finally{setBusy(false);}}}>Check payment again</button>}</section>;
}
