const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {FieldValue,FieldPath}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {createHash}=require('node:crypto');
const D=require('./financial-tools-domain.cjs'),S=require('./studio-domain.cjs');
module.exports=({db,identity,rateLimit,options,pdfCache=require('./financial-pdf-cache.cjs')})=>{
 const out={},finance=require('./financial-documents.cjs')(db);
 const id=v=>{if(typeof v!=='string'||!/^[-\w]{1,100}$/.test(v))throw new Error('Invalid record ID');return v;};
 function endpoint(name,fn){out[name]=onCall({...options,timeoutSeconds:120,memory:name==='downloadFinancialPDFs'?'2GiB':'512MiB',concurrency:1},async r=>{const a=await identity(r),member=(await require('./request-member.cjs').memberSnapshot(db,a)).data(),role=member?.active?member:null;await rateLimit(a.uid,name,10);try{return await fn(r.data??{},{a,role});}catch(e){if(e instanceof HttpsError)throw e;throw new HttpsError('failed-precondition',e.message);}});}
 const manage=role=>{if(!(role?.owner||role?.invoiceManage||role?.paymentsManage))throw new HttpsError('permission-denied','Billing or payment management access required');};
 endpoint('getBillingClients',async(data,{role})=>{manage(role);let q=db.collection('contacts').orderBy(FieldPath.documentId());if(data.cursor)q=q.startAfter(id(data.cursor));const snap=await q.limit(100).get();return{clients:snap.docs.map(d=>({id:d.id,...Object.fromEntries(['name','email','phone','publicId'].map(k=>[k,d.data()[k]??'']))})),cursor:snap.size===100?snap.docs.at(-1).id:null};});
 endpoint('getReceiptOrders',async(data,{role})=>{manage(role);let q=db.collection('orders').orderBy(FieldPath.documentId());if(data.cursor)q=q.startAfter(id(data.cursor));const snap=await q.limit(100).get();return{orders:snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>['completed','preparing','delivered'].includes(o.status)&&o.paymentMode!=='bypass'&&(o.billedTotalPaise??0)>(o.paidPaise??0)).map(o=>({id:o.id,publicId:o.publicId??o.id,title:o.title,clientName:o.client?.name??'',balancePaise:o.billedTotalPaise-o.paidPaise})),cursor:snap.size===100?snap.docs.at(-1).id:null};});
 endpoint('createManualReceipt',async(data,{a,role})=>{
  manage(role);if(!(role?.owner||role?.paymentsManage))throw new HttpsError('permission-denied','Payment management access required');
  const v=D.manualInput(data),requestId=id(data.requestId),paymentId=`manual-${requestId}`,orderId=v.existingOrderId?id(v.existingOrderId):`historical-${requestId}`,now=new Date(),fingerprint=createHash('sha256').update(JSON.stringify(v)).digest('hex');
  await db.runTransaction(async tx=>{
   const request=db.doc(`manualReceiptRequests/${requestId}`),orderRef=db.doc(`orders/${orderId}`),refKey=v.method!=='cash'&&v.reference?createHash('sha256').update(`${v.method}:${v.reference.toUpperCase()}`).digest('hex'):null;
   const [previous,oldOrder,clientSnap,reference]=await Promise.all([tx.get(request),tx.get(orderRef),v.existingOrderId?null:tx.get(db.doc(`contacts/${id(v.clientId)}`)),refKey?tx.get(db.doc(`paymentReferences/${refKey}`)):null]);
   if(previous.exists){if(previous.data().actor!==a.uid||previous.data().fingerprint!==fingerprint)throw new Error('This receipt request was already used with different details');return;}
   if(reference?.exists)throw new Error('This transaction reference has already been recorded');
   const fin=await finance.read(tx,orderId,now);if(!fin.settings)throw new Error('Save invoice business details in Settings first');
   let order=oldOrder.data();
   if(v.existingOrderId){if(!order||order.billingStatus==='cancelled'||!['completed','preparing','delivered'].includes(order.status)||order.paymentMode==='bypass')throw new Error('Choose an existing completed, chargeable shoot');if(v.amountPaise>(order.billedTotalPaise??0)-(order.paidPaise??0))throw new Error('Payment exceeds the remaining balance');}
   else{if(oldOrder.exists)throw new Error('Historical order already exists');const client=clientSnap?.data();if(!client)throw new Error('Client not found. Add the client in Clients first');const allocated=S.publicIds(fin.counts,['order'],now);fin.counts=allocated.next;
    order={publicId:allocated.ids.order,contactId:v.clientId,clientUid:client.source==='registered'&&client.clientUid===v.clientId?v.clientId:`manual-${v.clientId}`,client:{name:client.name,email:client.email??'',phone:client.phone??'',address:client.address??''},title:v.title,plan:'Completed shoot · manual entry',shootDate:v.shootDate,slot:'',location:v.location,items:[{description:v.title,quantity:1,unitPaise:v.totalPaise}],agreedTotalPaise:v.totalPaise,billedTotalPaise:v.totalPaise,paidPaise:0,advancePaise:0,paymentMode:'offline',status:'completed',assignees:[],crewUnits:0,reels:0,images:0,delivery:{photos:'',videos:''},revisionRequests:[],revisionLimit:0,inclusions:v.notes,deliveryEstimate:'',createdAtISO:now.toISOString(),createdBy:a.uid,historicalEntry:true,policyDisclosure:{source:'staff-recorded-historical',clientAccepted:false},financialStatus:'unpaid'};
    tx.set(fin.refs.publicCounter,allocated.next);
   }
   finance.invoice(tx,orderId,order,fin);
   const cumulative=(order.paidPaise??0)+v.amountPaise,balance=order.billedTotalPaise-cumulative;
   tx.set(orderRef,{...order,invoiceId:orderId,paidPaise:cumulative,balancePaise:balance,paymentStatus:balance===0?'Paid':'Partially paid',financialStatus:balance===0?'settled':'part-paid'});
   tx.create(db.doc(`payments/${paymentId}`),{orderId,clientUid:order.clientUid,clientName:order.client.name,amountPaise:v.amountPaise,cumulativePaidPaise:cumulative,method:v.method,reference:v.reference,notes:v.notes,status:'recorded',provider:'offline',receivedAtISO:`${v.receivedDate}T12:00:00+05:30`,createdAtISO:now.toISOString(),recordedBy:a.uid});
   if(refKey)tx.create(db.doc(`paymentReferences/${refKey}`),{paymentId,orderId});
   tx.create(request,{actor:a.uid,fingerprint,paymentId,orderId,createdAtISO:now.toISOString()});
   tx.create(db.collection('operationsAudit').doc(),{actor:a.uid,action:'receipt.manual.recorded',orderId,paymentId,amountPaise:v.amountPaise,atISO:now.toISOString()});
   for(const kind of['studio','orders','payments'])tx.set(db.doc(`operationsState/${kind}`),{updatedAt:FieldValue.serverTimestamp()});
  });
  await finance.forPayment(paymentId);return{orderId,id:`receipt-${paymentId}`};
 });
 endpoint('downloadFinancialPDFs',async(data,{a,role})=>{
  let records=[];
  if(data.ids){if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>50)throw new Error('Choose 1–50 documents');const snaps=await db.getAll(...[...new Set(data.ids.map(id))].map(k=>db.doc(`financialDocuments/${k}`)));for(const s of snaps){if(!D.canRead(s.data(),a.uid,role))throw new HttpsError('permission-denied','Document access denied');records.push({id:s.id,...s.data()});}}
  else{const f=D.filters(data);let q=db.collection('financialDocuments');if(!(data.admin&&(role?.owner||role?.invoiceManage||role?.paymentsManage)))q=q.where('clientUid','==',a.uid);q=q.orderBy(FieldPath.documentId());let last=null,scanned=0;while(true){const page=await(last?q.startAfter(last):q).limit(100).get();scanned+=page.size;records.push(...page.docs.map(d=>({id:d.id,...d.data()})).filter(d=>D.matches(d,f)));if(records.length>50)throw new Error('More than 50 matching documents. Narrow the client/date/type filters');if(page.size<100)break;if(scanned>=5000)throw new Error('Too many records to scan. Select documents from the list instead');last=page.docs.at(-1);}}
  if(!records.length)throw new Error('No matching documents');records.sort((a,b)=>a.issuedAt.localeCompare(b.issuedAt)||a.number.localeCompare(b.number));
  const {PDFDocument}=require('pdf-lib'),merged=await PDFDocument.create();let total=0;
  const buffers=await pdfCache.ensureMany(records.map(record=>({ref:db.doc(`financialDocuments/${record.id}`),record})));
  for(const bytes of buffers){total+=bytes.length;if(total>14000000)throw new Error('PDF collection is too large. Choose fewer documents');const source=await PDFDocument.load(bytes);for(const page of await merged.copyPages(source,source.getPageIndices()))merged.addPage(page);}
  merged.setTitle('Maharashtra Vision Media · Financial documents');const bytes=await merged.save();if(bytes.length>7000000)throw new Error('PDF collection exceeds download limit. Choose fewer documents');return{base64:Buffer.from(bytes).toString('base64'),filename:`MVM-${records.length}-documents-${S.indiaDay()}.pdf`,count:records.length};
 });
 return out;
};
