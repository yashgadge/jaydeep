const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {AggregateField,FieldPath,FieldValue}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {createHash}=require('node:crypto');
const {indiaDay}=require('./studio-domain.cjs');
module.exports=({db,identity,rateLimit,options})=>{
 const out={};
 const id=v=>{if(typeof v!=='string'||!/^[\w-]{1,128}$/.test(v))throw new HttpsError('invalid-argument','Invalid ID');return v;};
 async function context(r){const a=await identity(r),member=(await require('./request-member.cjs').memberSnapshot(db,a)).data();return{a,role:member?.active?member:null};}
 const allOrders=role=>role&&(role.owner||role.ordersManage||role.calendarManage||role.paymentsManage||role.invoiceManage);
 function endpoint(name,fn){out[name]=onCall({...options,...(name==='repairFinancialPDF'?{memory:'2GiB',concurrency:1,timeoutSeconds:120}:{})},async r=>{const c=await context(r);await rateLimit(c.a.uid,name,20);return fn(r.data??{},c);});}
 endpoint('getStudioOverview',async(data,{a,role})=>{
  if(data.admin&&!role)throw new HttpsError('permission-denied','Active team access required');const all=data.admin&&allOrders(role);let q=db.collection('orders');if(!all)q=q.where(data.admin?'assignees':'clientUid',data.admin?'array-contains':'==',a.uid);
  const active=q.where('status','in',['confirmed','assigned','completed','preparing']);
  const today=q.where('shootDate','==',indiaDay()).where('status','in',['confirmed','assigned','completed','preparing','delivered']);
  const pending=q.where('status','in',['completed','preparing']);
  const money=q.where('status','in',['confirmed','assigned','completed','preparing','delivered']);
  let enquiries=db.collection('enquiries').where('status','in',['new','contacted']);if(!all)enquiries=enquiries.where('clientUid','==',a.uid);
  const [open,shoots,deliveries,financial,callbacks]=await Promise.all([active.count().get(),today.count().get(),pending.count().get(),money.limit(5001).get(),enquiries.count().get()]);
  if(financial.size>5000)throw new HttpsError('resource-exhausted','Too many orders for the dashboard summary');
  return{active:open.data().count,today:shoots.data().count,pending:deliveries.data().count,balance:financial.docs.reduce((sum,s)=>sum+require('./payment-requests-domain.cjs').balance(s.data()).balancePaise,0),callbacks:callbacks.data().count};
 });
 endpoint('listFinancialDocuments',async(data,{a,role})=>{
  let q=db.collection('financialDocuments');if(!(data.admin&&(role?.owner||role?.invoiceManage||role?.paymentsManage)))q=q.where('clientUid','==',a.uid);
  q=q.orderBy(FieldPath.documentId());if(data.cursor)q=q.startAfter(id(data.cursor));const snapshot=await q.limit(100).get();
  const f=require('./financial-tools-domain.cjs').filters(data);
  const records=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(d=>require('./financial-tools-domain.cjs').matches(d,f));
  const receiving=records.some(d=>d.documentType==='payment_request')?(await db.doc('settings/paymentReceiving').get()).data()??{}:null;
  const orderIds=[...new Set(records.map(d=>d.orderId).filter(Boolean))],orders=orderIds.length?await db.getAll(...orderIds.map(k=>db.doc(`orders/${id(k)}`))):[],byId=new Map(orders.map(s=>[s.id,s.data()])),paymentDomain=require('./payment-requests-domain.cjs');
  return{documents:records.map(record=>{const order=byId.get(record.orderId);return{...record,currentLedger:order?paymentDomain.balance(order):null,collectionStatus:record.documentType==='payment_request'?paymentDomain.collectionStatus(record,order,receiving):''};}),cursor:snapshot.size===100?snapshot.docs.at(-1).id:null};
 });
 endpoint('repairFinancialPDF',async(data,{a,role})=>{
  if(!(role?.owner||role?.invoiceManage))throw new HttpsError('permission-denied','Billing management access required');
  const ref=db.doc(`financialDocuments/${id(data.id)}`),snap=await ref.get();if(!snap.exists)throw new HttpsError('not-found','Financial record not found');const record=snap.data();await require('./financial-pdf-cache.cjs').ensure(ref,record);
  await db.doc('operationsState/studio').set({updatedAt:FieldValue.serverTimestamp()});return{saved:true};
 });
 return out;
};
