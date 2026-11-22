const {test}=require('node:test'),assert=require('node:assert/strict');
const {database}=require('./helpers/memory-db.cjs');
const S=require('../studio-domain.cjs');
const profile={legalName:'Test operator',businessAddress:'Test address',supportEmail:'test@example.invalid',grievanceName:'Test officer',grievanceEmail:'privacy@example.invalid',grievancePhone:'+919999999999'};
const date=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
const draft={title:'Signature Shoot',clientName:'Test Client',phone:'+919999999999',date,slot:'morning',location:'Test venue, Pune',occasion:'Brand',pricePaise:200000,advancePaise:50000,reels:3,images:50,crewUnits:1,revisions:1,inclusions:'3 reels and 50 photos',deliveryEstimate:'7 days'};
function setup(){
 const {db,values}=database({'members/manager':{active:true,ordersManage:true,email:'manager@example.test'},'members/accounts':{active:true,paymentsManage:true},'members/worker_a':{active:true,tasksManage:true,name:'Test photographer'},'contacts/client':{name:'Test Client',source:'registered',clientUid:'client',publicId:'TEST-CLIENT',email:'client@example.test'},'enquiries/request':{clientUid:'client',clientName:'Test Client',phone:draft.phone,publicId:'TEST-REQUEST',status:'contacted',revision:0,createdAtISO:'2026-11-19T00:00:00Z',requestedPlan:{kind:'package',title:'Signature Shoot'}},'settings/studio':{...S.DEFAULT_STUDIO,slotCapacity:2},'settings/legal':profile,'settings/invoicing':{businessName:'Test Studio',address:'Pune',phone:'Test phone',prefix:'TEST',accent:'#c81d38',documentTitle:'Invoice',bypassEnabled:false},'settings/paymentReceiving':{upiEnabled:true,upiId:'test@upi',payeeName:'Test Studio',bankEnabled:false}});
 const deps={db,identity:async r=>r.auth,rateLimit:async()=>{},options:{region:'asia-south1'}},api=require('../booking-workflow.cjs')(deps),pay=require('../payment-requests.cjs')(deps),request=(uid,data)=>({auth:{uid,token:{}},data});
 return{db,values,api,pay,request,accept:()=>api.acceptBookingRequest.run(request('manager',{id:'request',revision:0,details:draft,assignees:['worker_a'],clientAgreed:true}))};
}
test('accepted request atomically creates one scheduled shoot, reservation, assignment and invoice; retries do not duplicate',async()=>{
 const x=setup(),first=await x.accept(),again=await x.accept();assert.equal(first.id,again.id);
 const order=x.values.get('orders/'+first.id);assert.equal(order.clientUid,'client');assert.equal(order.billedTotalPaise,200000);assert.equal(order.paidPaise,0);assert.equal(order.status,'assigned');assert.equal(order.assignedTeam[0].name,'Test photographer');assert.equal(order.policyDisclosure.clientAccepted,false);assert.equal(x.values.get('enquiries/request').orderId,first.id);
 assert.equal(x.values.get(`calendar/${date}_morning`).allocations[first.id].units,1);assert.ok(x.values.get(`teamSlots/worker_a_${date}_morning`).orders[first.id]);assert.ok(x.values.get('financialDocuments/invoice-'+first.id));assert.equal([...x.values.keys()].filter(k=>k.startsWith('invoices/')).length,1);assert.equal([...x.values.keys()].filter(k=>k.startsWith('payments/')).length,0);
});
test('request edits are versioned, accepted details cannot be overwritten, and clients cannot accept requests',async()=>{
 const x=setup();await assert.rejects(x.api.acceptBookingRequest.run(x.request('client',{id:'request',details:draft,clientAgreed:true})),{code:'permission-denied'});
 await x.api.saveBookingRequest.run(x.request('manager',{id:'request',revision:0,details:{...draft,pricePaise:250000}}));
 await assert.rejects(x.accept(),/changed/);await assert.rejects(x.api.acceptBookingRequest.run(x.request('manager',{id:'request',revision:1,details:draft,clientAgreed:true})),/Save the latest/);
 await x.api.acceptBookingRequest.run(x.request('manager',{id:'request',revision:1,details:{...draft,pricePaise:250000},clientAgreed:true}));await assert.rejects(x.api.saveBookingRequest.run(x.request('manager',{id:'request',revision:2,details:draft})),/already accepted/);
});
test('full slots, conflicting or inactive team members and missing staff agreement leave no partial financial records',async()=>{
 for(const failure of ['capacity','conflict','inactive','agreement']){const x=setup();if(failure==='capacity')x.values.set(`calendar/${date}_morning`,{allocations:{busy:{units:2}}});if(failure==='conflict')x.values.set(`teamSlots/worker_a_${date}_morning`,{orders:{another:true}});if(failure==='inactive')x.values.set('members/worker_a',{active:false,tasksManage:true});await assert.rejects(x.api.acceptBookingRequest.run(x.request('manager',{id:'request',revision:0,details:draft,assignees:['worker_a'],clientAgreed:failure!=='agreement'})));assert.equal([...x.values.keys()].filter(k=>k.startsWith('orders/')||k.startsWith('invoices/')||k.startsWith('financialDocuments/')).length,0);assert.equal(x.values.get('enquiries/request').orderId,undefined);}
});
test('manual payment updates the same order and client-visible timeline; UPI amount is derived on server and access stays scoped',async()=>{
 const x=setup(),order=await x.accept();const before=await x.api.getOrderPaymentDetails.run(x.request('client',{id:order.id,portion:'advance',amountPaise:1}));assert.equal(before.amountPaise,50000);assert.equal(new URL(before.receiving.upiUri).searchParams.get('am'),'500.00');
 await assert.rejects(x.api.getOrderPaymentDetails.run(x.request('other-client',{id:order.id})),{code:'permission-denied'});await assert.rejects(x.api.getStudioOrder.run(x.request('other-client',{id:order.id})),{code:'permission-denied'});
 const payment={orderId:order.id,requestId:'advance',amountPaise:50000,method:'cash',reference:'',receivedDate:S.indiaDay(),confirmReceived:true};await x.pay.recordBillPayment.run(x.request('accounts',payment));await x.pay.recordBillPayment.run(x.request('accounts',payment));
 const updated=(await x.api.getStudioOrder.run(x.request('client',{id:order.id}))).order;assert.equal(updated.currentLedger.balancePaise,150000);assert.equal(updated.agreedTotalPaise,undefined);assert.equal(updated.timeline.filter(e=>e.kind==='payment').length,1);assert.equal([...x.values.keys()].filter(k=>k.startsWith('payments/')).length,1);assert.ok([...x.values.keys()].some(k=>k.startsWith('financialDocuments/receipt-')));
 const after=await x.api.getOrderPaymentDetails.run(x.request('client',{id:order.id,portion:'advance'}));assert.equal(after.advanceDuePaise,0);assert.equal(after.amountPaise,150000);assert.equal(after.onlinePaymentsEnabled,true);assert.equal(after.paymentEnvironment,'sandbox');
});
test('reassignment releases old team reservations and protects current-slot conflicts',async()=>{
 const x=setup(),order=await x.accept();await x.api.assignStudioTeam.run(x.request('manager',{id:order.id,assignees:[]}));assert.equal(x.values.get('orders/'+order.id).status,'confirmed');assert.deepEqual(x.values.get(`teamSlots/worker_a_${date}_morning`).orders,{});assert.equal(x.values.get(`teamSlots/worker_a_${date}_morning`).uid,'worker_a');
 await x.api.assignStudioTeam.run(x.request('manager',{id:order.id,assignees:['worker_a']}));assert.equal(x.values.get('orders/'+order.id).assignedTeam[0].name,'Test photographer');
});
