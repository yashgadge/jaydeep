const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {createHash,createHmac,timingSafeEqual}=require('node:crypto');
const {FieldValue}=require('firebase-admin/firestore');
const ledger=require('./payment-requests-domain.cjs');
const hash=v=>createHash('sha256').update(v).digest('hex');
const cleanId=v=>{if(typeof v!=='string'||!/^[-\w]{1,128}$/.test(v))throw new HttpsError('invalid-argument','Invalid payment reference');return v;};
function verifySignature(raw,timestamp,signature,secret){
 if(!Buffer.isBuffer(raw)||!timestamp||!signature)return false;
 const wanted=Buffer.from(createHmac('sha256',secret.trim()).update(timestamp).update(raw).digest('base64')),actual=Buffer.from(signature);
 return actual.length===wanted.length&&timingSafeEqual(actual,wanted);
}
function providerMatches(value,record){return value.order_id===record.gatewayOrderId&&value.order_currency==='INR'&&Math.round(Number(value.order_amount)*100)===record.amountPaise;}
module.exports=function({db,identity,rateLimit,options,appId,secret,fetcher=fetch,environment=()=>process.env.CASHFREE_ENVIRONMENT||'sandbox'}){
 const api={},bound={...options,secrets:[appId,secret],timeoutSeconds:45},finance=require('./financial-documents.cjs')(db);
 function mode(){const m=environment();if(!['sandbox','production'].includes(m))throw new HttpsError('failed-precondition','Payment gateway environment needs configuration');return m;}
 async function request(path,{method='GET',body,key,env=mode()}={}){
  const id=appId.value().trim(),keyValue=secret.value().trim();
  if(env==='production'&&(id.startsWith('TEST')||keyValue.includes('_test_')))throw new HttpsError('failed-precondition','Live payments require production Cashfree credentials');
  const response=await fetcher((env==='sandbox'?'https://sandbox.cashfree.com/pg':'https://api.cashfree.com/pg')+path,{method,signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','x-api-version':'2025-01-01','x-client-id':id,'x-client-secret':keyValue,...(key?{'x-idempotency-key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let value;try{value=await response.json();}catch{throw new HttpsError('unavailable','The payment gateway could not respond. Please try again.');}
  if(!response.ok)throw new HttpsError(response.status===401?'failed-precondition':'unavailable',response.status===401?'The payment gateway credentials need attention.':'The payment gateway is unavailable. Please try again shortly.');
  return value;
 }
 function endpoint(name,fn){api[name]=onCall(bound,async r=>{const actor=await identity(r);await rateLimit(actor.uid,name,12);return fn(r.data??{},actor);});}
 async function owned(id,actor){const snap=await db.doc(`cashfreeCheckouts/${cleanId(id)}`).get(),record=snap.data();if(!record||record.clientUid!==actor.uid)throw new HttpsError('permission-denied','This checkout belongs to another client');return record;}
 async function reconcile(id){
  const ref=db.doc(`cashfreeCheckouts/${cleanId(id)}`),snapshot=await ref.get(),record=snapshot.data();
  if(!record)throw new HttpsError('not-found','Checkout not found');
  // A credential/environment switch must not reconcile a sandbox order as live.
  if(record.environment!==mode())throw new HttpsError('failed-precondition','This checkout belongs to the previous gateway environment');
  const provider=await request('/orders/'+id);
  if(!providerMatches(provider,record))throw new HttpsError('failed-precondition','Gateway order or amount does not match the invoice checkout');
  if(provider.order_status!=='PAID')return{status:provider.order_status,environment:record.environment,recorded:false};
  const payments=await request('/orders/'+id+'/payments');
  const success=Array.isArray(payments)&&payments.find(p=>p.payment_status==='SUCCESS'&&p.payment_currency==='INR'&&Math.round(Number(p.payment_amount)*100)===record.amountPaise&&/^\d{1,40}$/.test(String(p.cf_payment_id)));
  if(!success)throw new HttpsError('unavailable','Payment confirmation is still pending. Check again shortly.');
  const paymentId='cashfree-'+record.environment+'-'+success.cf_payment_id;
  await db.runTransaction(async tx=>{
   const current=await tx.get(ref),checkout=current.data();if(checkout.status==='PAID')return;
   if(checkout.environment==='sandbox'){tx.update(ref,{status:'PAID',cfPaymentId:String(success.cf_payment_id),verifiedAtISO:new Date().toISOString()});return;}
   const orderRef=db.doc(`orders/${checkout.orderId}`),paymentRef=db.doc(`payments/${paymentId}`);
   const [os,previous]=await Promise.all([tx.get(orderRef),tx.get(paymentRef)]);
   if(previous.exists){if(previous.data().orderId!==checkout.orderId)throw new Error('Payment reference conflict');tx.update(ref,{status:'PAID',paymentId});return;}
   const order=os.data();if(!order||order.clientUid!==checkout.clientUid)throw new Error('Payment order requires owner review');
   const b=ledger.balance(order),late=order.billingStatus==='cancelled'||order.status==='cancelled',paid=Math.min(b.totalPaise,b.paidPaise+checkout.amountPaise),excess=Math.max(0,b.paidPaise+checkout.amountPaise-b.totalPaise),now=new Date().toISOString();
   tx.create(paymentRef,{orderId:checkout.orderId,clientUid:order.clientUid,contactId:order.contactId??order.clientUid,clientName:order.client?.name??'',amountPaise:checkout.amountPaise,cumulativePaidPaise:paid,provider:'cashfree',environment:'production',status:'captured',method:'Cashfree',reference:String(success.cf_payment_id),gatewayOrderId:id,recordedBy:'cashfree-verified',receivedAtISO:success.payment_completion_time||now,createdAtISO:now,latePayment:late,unappliedPaise:excess});
   tx.update(orderRef,{paidPaise:paid,balancePaise:late?0:b.totalPaise-paid,paymentMode:'online',paymentStatus:late?'Received after cancellation':paid===b.totalPaise?'Paid':'Partially paid',financialStatus:late?'cancelled-refund-review':paid===b.totalPaise?'settled':'part-paid',refundReviewRequired:late||excess>0||!!order.refundReviewRequired,unappliedPaymentPaise:(order.unappliedPaymentPaise??0)+excess,updatedAtISO:now});
   tx.update(ref,{status:'PAID',paymentId,cfPaymentId:String(success.cf_payment_id),verifiedAtISO:now});
   for(const key of ['payments','orders','studio'])tx.set(db.doc(`operationsState/${key}`),{updatedAt:FieldValue.serverTimestamp()});
   tx.create(db.collection('operationsAudit').doc(),{action:'payment.cashfree.verified',actor:'cashfree',orderId:checkout.orderId,paymentId,amountPaise:checkout.amountPaise,atISO:now,at:FieldValue.serverTimestamp()});
  });
  if(record.environment==='production')await finance.forPayment(paymentId);
  return{status:'PAID',environment:record.environment,recorded:record.environment==='production',receiptId:record.environment==='production'?'receipt-'+paymentId:null};
 }
 endpoint('createCashfreeCheckout',async(data,actor)=>{
  if(typeof data.requestId!=='string'||!/^[-a-f0-9]{36}$/i.test(data.requestId))throw new HttpsError('invalid-argument','Invalid checkout request');
  const orderId=cleanId(data.id);if(!['advance','balance'].includes(data.portion))throw new HttpsError('invalid-argument','Choose advance or balance payment');
  const env=mode(),orderRef=db.doc(`orders/${orderId}`),os=await orderRef.get(),order=os.data();
  if(!order||order.clientUid!==actor.uid)throw new HttpsError('permission-denied','Only the client can pay this invoice');
  const b=ledger.balance(order);if(order.status==='cancelled'||b.billingStatus==='cancelled'||b.balancePaise<=0)throw new HttpsError('failed-precondition','This bill is not open for payment');
  if(!(await db.doc(`invoices/${orderId}`).get()).exists)throw new HttpsError('failed-precondition','The studio must issue the invoice before online payment');
  const advance=Math.max(0,Math.min(b.balancePaise,(order.advancePaise??0)-b.paidPaise)),amountPaise=data.portion==='advance'&&advance?advance:b.balancePaise;
  if(amountPaise<100)throw new HttpsError('failed-precondition','Cashfree requires a minimum payment of ₹1');
  const phone=String(order.client?.phone??'').replace(/\D/g,'').slice(-10);if(!/^[6-9]\d{9}$/.test(phone))throw new HttpsError('failed-precondition','Add a valid Indian contact number to the invoice');
  // Same invoice balance + portion shares one provider order across repeated clicks/tabs.
  const digest=hash([env,orderId,actor.uid,b.totalPaise,b.paidPaise,amountPaise,data.portion,data.requestId].join(':')),gatewayOrderId='mvm_'+digest.slice(0,40),ref=db.doc(`cashfreeCheckouts/${gatewayOrderId}`);
  await db.runTransaction(async tx=>{const [fresh,old]=await Promise.all([tx.get(orderRef),tx.get(ref)]);const o=fresh.data(),current=ledger.balance(o);if(o.clientUid!==actor.uid||o.status==='cancelled'||current.billingStatus==='cancelled'||current.paidPaise!==b.paidPaise||current.totalPaise!==b.totalPaise)throw new HttpsError('failed-precondition','The bill changed. Refresh payment details.');if(!old.exists)tx.create(ref,{gatewayOrderId,orderId,clientUid:actor.uid,amountPaise,environment:env,status:'CREATING',createdAtISO:new Date().toISOString()});});
  const uuid=digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-a'+digest.slice(17,20)+'-'+digest.slice(20,32);
  // GET existing orders on retries so expired/paid attempts cannot create duplicate collections.
  const saved=(await ref.get()).data();
  const provider=saved.cfOrderId?await request('/orders/'+gatewayOrderId):await request('/orders',{method:'POST',key:uuid,body:{order_id:gatewayOrderId,order_amount:amountPaise/100,order_currency:'INR',customer_details:{customer_id:'mvm_'+hash(actor.uid).slice(0,32),customer_phone:phone,customer_name:String(order.client?.name??'Client').slice(0,100)},order_meta:{return_url:'https://m-v-ml.web.app/billing?cashfree_order='+gatewayOrderId,notify_url:'https://asia-south1-m-v-ml.cloudfunctions.net/cashfreeWebhook'},order_note:'Invoice '+String(order.publicId??orderId).slice(0,100)}});
  if(!providerMatches(provider,{gatewayOrderId,amountPaise})||typeof provider.payment_session_id!=='string')throw new HttpsError('failed-precondition','Gateway checkout details do not match');
  if(provider.order_status==='PAID'){await reconcile(gatewayOrderId);return{gatewayOrderId,paymentSessionId:null,amountPaise,environment:env,alreadyPaid:true};}
  if(provider.order_status!=='ACTIVE')throw new HttpsError('failed-precondition','This checkout is '+provider.order_status.toLowerCase()+'. Check its payment status before retrying.');
  await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.data().status!=='PAID')tx.update(ref,{cfOrderId:String(provider.cf_order_id),status:'ACTIVE'});});
  return{gatewayOrderId,paymentSessionId:provider.payment_session_id,amountPaise,environment:env};
 });
 endpoint('verifyCashfreeCheckout',async(data,actor)=>{const record=await owned(data.id,actor);return reconcile(record.gatewayOrderId);});
 api.cashfreeWebhook=onRequest({...bound,enforceAppCheck:false,cors:false},async(req,res)=>{
  res.set('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();if(!req.rawBody||req.rawBody.length>131072)return res.status(413).end();
  if(!verifySignature(req.rawBody,req.get('x-webhook-timestamp'),req.get('x-webhook-signature'),secret.value()))return res.status(401).end();
  try{const payload=JSON.parse(req.rawBody.toString('utf8')),id=payload.data?.order?.order_id;if(payload.type!=='PAYMENT_SUCCESS_WEBHOOK'||typeof id!=='string'||!/^mvm_[a-f0-9]{40}$/.test(id))return res.status(200).json({ignored:true});await reconcile(id);return res.status(200).json({received:true});}catch(e){return res.status(e.code==='not-found'?200:503).json({received:false});}
 });
 return api;
};
module.exports.verifySignature=verifySignature;module.exports.providerMatches=providerMatches;
