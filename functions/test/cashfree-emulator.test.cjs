const {test}=require('node:test'),assert=require('node:assert/strict');
test('Cashfree concurrent verification uses one payment, receipt and timeline in Firestore',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async()=>{
 if(process.env.GCLOUD_PROJECT!=='demo-mvm-invoices')throw Error('Use isolated demo-mvm-invoices only');
 const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
 const app=initializeApp({projectId:'demo-mvm-invoices'},'cashfree-concurrency'),db=getFirestore(app);
 const orderId='cashfree-concurrency',order={clientUid:'cashfree-client',contactId:'cashfree-client',publicId:'TEST-CF',client:{name:'Isolated Test',phone:'+919999999999'},status:'confirmed',paymentMode:'offline',billedTotalPaise:200000,advancePaise:50000,paidPaise:0,items:[{description:'Test',quantity:1,unitPaise:200000}]};
 const providerOrders=new Map();let paid=false;
 const api=require('../cashfree.cjs')({db,identity:async r=>r.auth,rateLimit:async()=>{},options:{},environment:()=> 'production',appId:{value:()=> 'mock-live'},secret:{value:()=> 'mock-secret'},fetcher:async(url,options)=>{
  const body=options.body&&JSON.parse(options.body),key=body?.order_id??(url.endsWith('/payments')?url.split('/').at(-2):url.split('/').at(-1));if(body)providerOrders.set(key,body);
  const record=providerOrders.get(key);return{ok:true,json:async()=>url.endsWith('/payments')?[{cf_payment_id:'445566',payment_status:'SUCCESS',payment_currency:'INR',payment_amount:record.order_amount}]:{...record,cf_order_id:'123',order_status:paid?'PAID':'ACTIVE',payment_session_id:'mock-session'}};
 }});
 const req=data=>({auth:{uid:'cashfree-client'},data});
 try{
  await db.doc('orders/'+orderId).set(order);await db.doc('invoices/'+orderId).set({number:'TEST-CF/1',totalPaise:200000,client:order.client,orderId,contactId:order.clientUid});await db.doc('settings/invoicing').set({businessName:'Isolated Test',address:'Pune',phone:'Test phone',prefix:'TEST',accent:'#c81d38',documentTitle:'Invoice',bypassEnabled:false});
  const input={id:orderId,portion:'advance',requestId:'12345678-1234-4123-8123-123456789abc'},sessions=await Promise.all([api.createCashfreeCheckout.run(req(input)),api.createCashfreeCheckout.run(req(input))]);assert.equal(sessions[0].gatewayOrderId,sessions[1].gatewayOrderId);
  paid=true;const results=await Promise.all(Array.from({length:4},()=>api.verifyCashfreeCheckout.run(req({id:sessions[0].gatewayOrderId}))));assert.ok(results.every(r=>r.recorded));
  const updated=(await db.doc('orders/'+orderId).get()).data();assert.equal(updated.paidPaise,50000);assert.equal(updated.balancePaise,150000);assert.equal(updated.timeline.filter(e=>e.kind==='payment').length,1);
  assert.equal((await db.collection('payments').where('orderId','==',orderId).get()).size,1);assert.equal((await db.collection('financialDocuments').where('orderId','==',orderId).get()).size,1);
  assert.equal((await db.doc('financialDocuments/receipt-cashfree-production-445566').get()).data().receiptAmountPaise,50000);
 }finally{await db.terminate();await deleteApp(app);}
});
