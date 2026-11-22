const {onDocumentWritten,onDocumentCreated}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {createHash}=require('node:crypto');
const {indiaDay}=require('./studio-domain.cjs');
const EVENTS=['bookingConfirmation','paymentUpdate','deliveryReady','shootReminder','balanceReminder','renewalReminder'];
const VALUES=['clientName','orderId','date','slot','amount','balance','portalUrl','plan'];
module.exports=({db,identity,rateLimit,options})=>{
 const api={};
 async function queue(eventType,key,clientUid,values){
  const settings=(await db.doc('settings/whatsapp').get()).data();if(!settings?.enabled||!settings.automatedEnabled||!settings[eventType])return;
  const mapping=(await db.doc('settings/whatsappAutomation').get()).data()?.[eventType];if(!mapping?.templateId)return;
  const [templateSnap,ownerSnap]=await Promise.all([db.doc(`whatsappTemplates/${mapping.templateId}`).get(),db.collection('members').where('owner','==',true).limit(1).get()]);
  const template=templateSnap.data(),owner=ownerSnap.docs.find(d=>d.data().active);if(!owner||!template?.verifiedFromMeta||template.category!=='utility'||template.headerFormat==='DOCUMENT'||template.status!=='APPROVED'||template.parameterCount!==mapping.parameterKeys.length)return;
  const message={category:'utility',templateId:mapping.templateId,template:{name:template.name,language:template.language},parameters:mapping.parameterKeys.map(k=>String(values[k]??'')),text:''};if(message.parameters.some(v=>!v))return;
  const id=createHash('sha256').update(`${eventType}:${key}`).digest('hex'),ref=db.doc(`whatsappJobs/auto-${id}`);
  await db.runTransaction(async tx=>{if((await tx.get(ref)).exists)return;tx.create(ref,{contactId:clientUid,message,state:'queued',actor:owner.id,automated:true,eventType,stopEpoch:settings.stopEpoch??0,createdAtISO:new Date().toISOString()});});
 }
 const values=o=>({clientName:o.client?.name??o.clientName??'',orderId:o.publicId??'',date:o.shootDate??o.renewalDate??'',slot:o.slot??'',amount:((o.billedTotalPaise??o.monthlyPaise??0)/100).toFixed(2),balance:(Math.max(0,(o.billedTotalPaise??0)-(o.paidPaise??0))/100).toFixed(2),portalUrl:'https://m-v-ml.web.app/billing',plan:o.plan??o.title??''});
 api.getWhatsAppAutomation=onCall(options,async r=>{const a=await identity(r),m=(await require('./request-member.cjs').memberSnapshot(db,a)).data();if(!m?.active||!m.owner)throw new HttpsError('permission-denied','Owner access required');return{mappings:(await db.doc('settings/whatsappAutomation').get()).data()??{},events:EVENTS,values:VALUES};});
 api.saveWhatsAppAutomation=onCall(options,async r=>{const a=await identity(r),m=(await require('./request-member.cjs').memberSnapshot(db,a)).data();if(!m?.active||!m.owner)throw new HttpsError('permission-denied','Owner access required');await rateLimit(a.uid,'automation-settings',10);const result={};for(const event of EVENTS){const v=r.data?.[event];if(!v?.templateId)continue;if(!/^[\w-]{1,128}$/.test(v.templateId)||!Array.isArray(v.parameterKeys)||v.parameterKeys.some(k=>!VALUES.includes(k)))throw new HttpsError('invalid-argument','Choose a template and valid message fields');const template=(await db.doc(`whatsappTemplates/${v.templateId}`).get()).data();if(!template?.verifiedFromMeta||template.category!=='utility'||template.headerFormat==='DOCUMENT'||template.status!=='APPROVED'||template.parameterCount!==v.parameterKeys.length)throw new HttpsError('failed-precondition','Map every parameter of an approved utility template');result[event]={templateId:v.templateId,parameterKeys:v.parameterKeys};}await db.doc('settings/whatsappAutomation').set(result);return{saved:true};});
 if(process.env.MVM_ENABLE_WHATSAPP_PROVIDER!=='true'&&!process.env.FIRESTORE_EMULATOR_HOST)return api;
 api.notifyStudioOrder=onDocumentWritten({document:'orders/{id}',region:options.region,maxInstances:2,retry:true},async e=>{const before=e.data?.before.data(),after=e.data?.after.data();if(!after)return;if(!before&&after.status==='confirmed')await queue('bookingConfirmation',e.params.id,after.clientUid,values(after));if(after.status==='delivered'&&before?.status!=='delivered')await queue('deliveryReady',e.params.id,after.clientUid,values(after));});
 api.notifyStudioPayment=onDocumentCreated({document:'payments/{id}',region:options.region,maxInstances:2,retry:true},async e=>{const p=e.data?.data();if(!p)return;const o=(await db.doc(`orders/${p.orderId}`).get()).data();if(o)await queue('paymentUpdate',e.params.id,p.clientUid,{...values(o),amount:(p.amountPaise/100).toFixed(2)});});
 api.studioDailyReminders=onSchedule({schedule:'0 7 * * *',timeZone:'Asia/Kolkata',region:options.region,maxInstances:1,retryCount:1},async()=>{
  const s=(await db.doc('settings/whatsapp').get()).data();if(!s?.enabled||!s.automatedEnabled)return;
  const day=indiaDay();if(s.shootReminder){const orders=await db.collection('orders').where('shootDate','==',day).limit(100).get();for(const d of orders.docs){const o=d.data();if(['confirmed','assigned'].includes(o.status))await queue('shootReminder',`${d.id}-${day}`,o.clientUid,values(o));}}
  if(s.renewalReminder){const plans=await db.collection('socialPlans').where('renewalDate','==',day).limit(100).get();for(const d of plans.docs){const p=d.data();if(p.status==='active')await queue('renewalReminder',`${d.id}-${day}`,p.clientUid,values(p));}}
  // One weekly check avoids daily balance chasing. Per-client cooldowns and global caps still apply.
  if(s.balanceReminder&&new Date(`${day}T00:00:00Z`).getUTCDay()===1){const orders=await db.collection('orders').where('status','==','delivered').limit(100).get();for(const d of orders.docs){const o=d.data();if((o.billedTotalPaise??0)>(o.paidPaise??0))await queue('balanceReminder',`${d.id}-${day}`,o.clientUid,values(o));}}
 });return api;
};
