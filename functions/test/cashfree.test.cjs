const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const factory=require('../cashfree.cjs'),{database}=require('./helpers/memory-db.cjs');
function setup(environment='production'){
 const {db,values}=database({
  'orders/order':{clientUid:'client',contactId:'client',publicId:'TEST-ORDER',client:{name:'Test client',phone:'+919999999999'},status:'confirmed',paymentMode:'offline',billedTotalPaise:200000,advancePaise:50000,paidPaise:0,items:[{description:'Test',quantity:1,unitPaise:200000}]},
  'invoices/order':{number:'TEST/2026/1',totalPaise:200000,client:{name:'Test client'},orderId:'order',contactId:'client'},
  'settings/invoicing':{businessName:'Test Studio',address:'Pune',phone:'Test phone',prefix:'TEST',accent:'#c81d38',documentTitle:'Invoice',bypassEnabled:false}
 });
 const requests=[],orders=new Map();let state='ACTIVE',mismatch=false;
 const api=factory({db,identity:async r=>r.auth,rateLimit:async()=>{},options:{},environment:()=>environment,appId:{value:()=> 'LIVE-App'},secret:{value:()=> 'mock-secret'},fetcher:async(url,opts)=>{
  assert.ok(url.startsWith(environment==='sandbox'?'https://sandbox.cashfree.com/pg':'https://api.cashfree.com/pg'));requests.push({url,opts});
  if(opts.body){const value=JSON.parse(opts.body);orders.set(value.order_id,value);}
  const key=url.includes('/payments')?url.split('/').at(-2):opts.body?JSON.parse(opts.body).order_id:url.split('/').at(-1),order=orders.get(key);
  return{ok:true,json:async()=>url.endsWith('/payments')?[{payment_status:'SUCCESS',payment_currency:'INR',payment_amount:order.order_amount,cf_payment_id:111,payment_completion_time:'2026-11-20T12:00:00Z'}]:{...order,order_amount:mismatch?1:order.order_amount,cf_order_id:'123',order_status:state,payment_session_id:'mock-session'}};
 }});
 const request=(uid,data)=>({auth:{uid,token:{}},data}),input={id:'order',portion:'advance',requestId:'12345678-1234-4123-8123-123456789abc'};
 const create=()=>api.createCashfreeCheckout.run(request('client',input));const verify=id=>api.verifyCashfreeCheckout.run(request('client',{id}));
 return{api,values,requests,request,input,create,verify,setState:v=>state=v,mismatch:()=>mismatch=true};
}
test('Cashfree verifies exact signed webhook raw body, rejecting changed decimals, timestamps, missing headers and bad lengths',()=>{
 const raw=Buffer.from('{"amount":1.00}'),ts='123',secret='mock-secret',sig=createHmac('sha256',secret).update(ts).update(raw).digest('base64');
 assert.equal(factory.verifySignature(raw,ts,sig,secret),true);
 for(const args of [[Buffer.from('{"amount":1}'),ts,sig],[raw,'124',sig],[raw,undefined,sig],[raw,ts,'invalid']])assert.equal(factory.verifySignature(...args,secret),false);
});
test('only bill client can checkout, requested amount is calculated on server, retries reuse provider order',async()=>{
 const x=setup();for(const uid of ['other','owner'])await assert.rejects(x.api.createCashfreeCheckout.run(x.request(uid,x.input)),{code:'permission-denied'});assert.equal(x.requests.length,0);
 const a=await x.api.createCashfreeCheckout.run(x.request('client',{...x.input,amountPaise:1})),b=await x.create();assert.equal(a.gatewayOrderId,b.gatewayOrderId);assert.equal(a.amountPaise,50000);
 assert.equal(x.requests.filter(r=>r.opts.method==='POST').length,1);const body=JSON.parse(x.requests[0].opts.body);assert.equal(body.order_amount,500);assert.match(body.order_meta.notify_url,/cashfreeWebhook$/);
 assert.equal(JSON.stringify([...x.values]).includes('mock-secret'),false);assert.equal(JSON.stringify([...x.values]).includes('mock-session'),false);
});
test('cancelled, fully paid, unissued and invalid-portion bills cannot create a checkout',async()=>{
 for(const mutate of [x=>x.values.set('orders/order',{...x.values.get('orders/order'),billingStatus:'cancelled'}),x=>x.values.set('orders/order',{...x.values.get('orders/order'),paidPaise:200000}),x=>x.values.delete('invoices/order')]){const x=setup();mutate(x);await assert.rejects(x.create());assert.equal(x.requests.length,0);}
 const x=setup();await assert.rejects(x.api.createCashfreeCheckout.run(x.request('client',{...x.input,portion:'anything'})),{code:'invalid-argument'});
});
test('pending or mismatched gateway responses cannot mark invoice paid',async()=>{
 const x=setup(),checkout=await x.create();assert.equal((await x.verify(checkout.gatewayOrderId)).recorded,false);assert.equal(x.values.get('orders/order').paidPaise,0);
 x.setState('PAID');x.mismatch();await assert.rejects(x.verify(checkout.gatewayOrderId),/does not match/);assert.equal(x.values.get('orders/order').paidPaise,0);
});
test('verified live payment updates order, one receipt and shared state, repeats do not duplicate money or timeline',async()=>{
 const x=setup(),checkout=await x.create();x.setState('PAID');const first=await x.verify(checkout.gatewayOrderId);await x.verify(checkout.gatewayOrderId);
 assert.equal(first.recorded,true);assert.equal(x.values.get('orders/order').paidPaise,50000);assert.equal(x.values.get('orders/order').balancePaise,150000);
 assert.equal([...x.values.keys()].filter(k=>k.startsWith('payments/')).length,1);assert.equal([...x.values.keys()].filter(k=>k.startsWith('financialDocuments/receipt-')).length,1);
 assert.equal(x.values.get('orders/order').timeline.filter(e=>e.kind==='payment').length,1);assert.ok(x.values.get('operationsState/payments'));assert.ok(x.values.get('operationsState/studio'));assert.ok(x.values.get('operationsState/orders'));
});
test('sandbox success can never produce real income, paid bill, receipt or payment timeline',async()=>{
 const x=setup('sandbox'),checkout=await x.create();x.setState('PAID');const result=await x.verify(checkout.gatewayOrderId);assert.equal(result.status,'PAID');assert.equal(result.recorded,false);
 assert.equal(x.values.get('orders/order').paidPaise,0);assert.equal([...x.values.keys()].filter(k=>/^(payments|financialDocuments|operationsAudit)\//.test(k)).length,0);
});
test('money received after cancellation or an offline payment remains recorded with refund review',async()=>{
 const x=setup(),checkout=await x.create();x.values.set('orders/order',{...x.values.get('orders/order'),billingStatus:'cancelled',paidPaise:190000});x.setState('PAID');await x.verify(checkout.gatewayOrderId);
 const order=x.values.get('orders/order'),payment=x.values.get('payments/cashfree-production-111');assert.equal(order.paidPaise,200000);assert.equal(order.balancePaise,0);assert.equal(order.refundReviewRequired,true);assert.equal(payment.amountPaise,50000);assert.equal(payment.unappliedPaise,40000);assert.equal(payment.latePayment,true);
 assert.equal(x.values.get('financialDocuments/receipt-cashfree-production-111').receiptAmountPaise,50000);
});
test('other clients cannot inspect checkout status',async()=>{
 const x=setup(),checkout=await x.create();await assert.rejects(x.api.verifyCashfreeCheckout.run(x.request('other',{id:checkout.gatewayOrderId})),{code:'permission-denied'});
});
test('webhook rejects unsigned requests and only server-verified signed notifications can create one receipt',async()=>{
 const express=require('express'),app=express(),x=setup(),checkout=await x.create();x.setState('PAID');
 app.use(express.raw({type:'application/json'}));app.use((req,res,next)=>{req.rawBody=req.body;next();});app.post('/',x.api.cashfreeWebhook);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port,body=JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:checkout.gatewayOrderId}}}),timestamp=String(Date.now());
  const before=x.requests.length,unsigned=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(unsigned.status,401);assert.equal(x.requests.length,before);assert.equal(x.values.get('orders/order').paidPaise,0);
  const signature=createHmac('sha256','mock-secret').update(timestamp).update(body).digest('base64');
  for(let i=0;i<2;i++){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-webhook-timestamp':timestamp,'x-webhook-signature':signature},body});assert.equal(response.status,200);}
  assert.equal(x.values.get('orders/order').paidPaise,50000);assert.equal([...x.values.keys()].filter(k=>k.startsWith('payments/')).length,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
