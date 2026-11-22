const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

test('Firestore emulator: consent, campaign controls, exports, and payment records',{skip:!process.env.FIRESTORE_EMULATOR_HOST},async t=>{
  if(process.env.GCLOUD_PROJECT!=='demo-mvm-invoices')throw new Error('Use the isolated demo-mvm-invoices project.');
  process.env.MVM_WHATSAPP_PHONE_ID='123456';process.env.MVM_WHATSAPP_ACCOUNT_ID='654321';process.env.MVM_WHATSAPP_API_VERSION='v27.0';process.env.MVM_WHATSAPP_ACCESS_TOKEN='isolated-test-only';
  const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
  const {doc,setDoc,getDoc}=require('firebase/firestore');
  const {getFirestore}=require('firebase-admin/firestore');
  const handlers=require('../index.cjs');
  const D=require('../operations-domain.cjs');
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const env=await initializeTestEnvironment({projectId:'demo-mvm-invoices',firestore:{host,port:Number(port),rules:fs.readFileSync(path.resolve(__dirname,'../../firestore.rules'),'utf8')}});
  await env.clearFirestore();const db=getFirestore();
  const auth=uid=>({uid,token:{email_verified:true,email:`${uid}@example.invalid`,firebase:{sign_in_provider:'google.com'}}});
  const owner=auth('ops-owner'),client=auth('ops-client'),sender=auth('ops-sender');
  const request=(auth,data)=>({auth,data});
  const originalFetch=global.fetch;let sends=0;
  global.fetch=async(url,options)=>String(url).startsWith('https://graph.facebook.com/')?(sends++,new Response(JSON.stringify({messages:[{id:`isolated-message-${sends}`}]}),{status:200,headers:{'Content-Type':'application/json'}})):originalFetch(url,options);
 for(const staff of [owner,sender])staff.token.firebase.sign_in_provider='password';
  try{
    await db.doc('members/ops-owner').set({active:true,owner:true});
    await db.doc('members/ops-sender').set({active:true,owner:false,whatsappSend:true});
    await t.test('registration creates no implied opt-in and clients cannot self-grant admin permissions',async()=>{
      const role=await handlers.syncInvoiceIdentity.run(request(client,{}));assert.equal(role.owner,false);
      const row=(await db.doc('contacts/ops-client').get()).data();assert.equal(row.updatesOptIn,false);assert.equal(row.marketingOptIn,false);
      const signed=env.authenticatedContext('ops-client').firestore();
      await assertFails(setDoc(doc(signed,'contacts/ops-client'),{marketingOptIn:true}));
      await assertFails(getDoc(doc(signed,'payments/anything')));
      await assert.rejects(handlers.saveWhatsAppSettings.run(request(client,{...D.DEFAULT_WHATSAPP_SETTINGS})),error=>error.code==='permission-denied');
    });
    await t.test('manual opt-in needs recorded evidence; private notes stay out of client preference responses',async()=>{
      await assert.rejects(handlers.saveAdminContact.run(request(owner,{name:'Test contact',phone:'+919999999999',updatesOptIn:true,marketingOptIn:false})),error=>error.code==='invalid-argument');
      await db.doc('contacts/ops-client').update({notes:'Internal-only test note'});
      await handlers.saveOwnContactPreferences.run(request(client,{name:'Test client',phone:'+919999999998',updatesOptIn:true,marketingOptIn:false}));
      const own=await handlers.getOwnContactPreferences.run(request(client,{}));assert.equal(own.updatesOptIn,true);assert.equal('notes'in own,false);
      const list=await handlers.listAdminRecords.run(request(sender,{kind:'contacts',forMessaging:true,filters:{}}));assert.equal('notes'in list.rows[0],false);
      await assert.rejects(handlers.listAdminRecords.run(request(sender,{kind:'contacts',forExport:true,filters:{}})),error=>error.code==='permission-denied');
    });
    await t.test('preview excludes missing marketing consent and repeated queue clicks produce one campaign',async()=>{
      await db.doc('settings/whatsapp').set({...D.DEFAULT_WHATSAPP_SETTINGS,enabled:true,marketingEnabled:true,version:1});
      await db.doc('whatsappTemplates/test-template').set({verifiedFromMeta:true,status:'APPROVED',category:'utility',parameterCount:0,name:'test_template',language:'en'});
      const preview=await handlers.previewWhatsAppCampaign.run(request(owner,{contactIds:['ops-client'],message:{category:'utility',templateId:'test-template',text:'',parameters:[]}}));
      assert.equal(preview.recipients[0].eligible,true);
      const a=await handlers.queueWhatsAppCampaign.run(request(owner,{previewId:preview.previewId}));
      const b=await handlers.queueWhatsAppCampaign.run(request(owner,{previewId:preview.previewId}));assert.equal(a.campaignId,b.campaignId);
      assert.equal((await db.collection('whatsappJobs').get()).size,1);
      await handlers.stopAllWhatsApp.run(request(owner,{}));
      const job=(await db.collection('whatsappJobs').get()).docs[0];
      await handlers.dispatchWhatsAppJob.run({data:{before:{data:()=>undefined},after:job},params:{jobId:job.id}});
      assert.equal((await job.ref.get()).data().state,'stopped');assert.equal(sends,0);
    });
    await t.test('budget is reserved atomically before concurrent provider requests; no real messages leave the test',async()=>{
      await db.doc('settings/whatsapp').set({...D.DEFAULT_WHATSAPP_SETTINGS,enabled:true,monthlyBudgetPaise:24,minimumUpdateHours:0,version:2});
      const jobs=[];
      for(let i=0;i<3;i++){
        const phone=`+91999999990${i}`;const contactId=`budget-client-${i}`;
        await db.doc(`contacts/${contactId}`).set({name:'Test budget client',phone,updatesOptIn:true,marketingOptIn:false});
        await db.doc(`whatsappPhones/${crypto.createHash('sha256').update(phone).digest('hex')}`).set({lastInboundAtMs:Date.now()});
        const ref=db.doc(`whatsappJobs/budget-job-${i}`);await ref.set({contactId,actor:owner.uid,state:'queued',message:{category:'service',text:'Isolated test',parameters:[],templateId:''},createdAtISO:new Date().toISOString()});jobs.push(await ref.get());
      }
      await Promise.all(jobs.map(job=>handlers.dispatchWhatsAppJob.run({data:{before:{data:()=>undefined},after:job},params:{jobId:job.id}})));
      assert.equal(sends,2);
      const states=await Promise.all(jobs.map(job=>job.ref.get()));assert.equal(states.filter(row=>row.data().state==='stopped').length,1);
      await handlers.dispatchWhatsAppJob.run({data:{before:{data:()=>undefined},after:jobs[0]},params:{jobId:jobs[0].id}});assert.equal(sends,2);
    });
    await t.test('offline payments are idempotent, reject duplicate references and cannot exceed the balance',async()=>{
      await db.doc('orders/pay-order').set({clientUid:'ops-client',client:{name:'Test client'},items:[{description:'Test order',quantity:1,unitPaise:10000}],paymentMode:'offline',paidPaise:0});
      const payment={orderId:'pay-order',requestId:'test-payment-key',amountPaise:4000,method:'upi',reference:'ISOLATED-REF-1',receivedAtISO:new Date().toISOString(),notes:''};
      await handlers.recordOfflinePayment.run(request(owner,payment));
      assert.equal((await handlers.recordOfflinePayment.run(request(owner,payment))).duplicate,true);
      assert.equal((await db.doc('orders/pay-order').get()).data().paidPaise,4000);
      await assert.rejects(handlers.recordOfflinePayment.run(request(owner,{...payment,requestId:'another-key'})),error=>error.code==='already-exists');
      await assert.rejects(handlers.recordOfflinePayment.run(request(owner,{...payment,requestId:'too-much',reference:'ISOLATED-REF-2',amountPaise:6001})),error=>error.code==='failed-precondition');
      assert.equal((await db.collection('payments').get()).size,1);
    });
    await t.test('filtered pagination can return later matches without silently truncating to the first page',async()=>{
      const batch=db.batch();for(let i=0;i<251;i++)batch.set(db.doc(`contacts/page-${String(i).padStart(3,'0')}`),{name:'Other test contact',createdAtISO:'2026-11-18T09:00:00Z'});
      batch.set(db.doc('contacts/zz-export-match'),{name:'Export match',city:'Test city',createdAtISO:'2026-11-18T09:00:00Z'});await batch.commit();
      let cursor=null;let found=[];do{const page=await handlers.listAdminRecords.run(request(owner,{kind:'contacts',forExport:true,filters:{city:'Test city'},cursor}));found.push(...page.rows);cursor=page.cursor;}while(cursor);
      assert.equal(found.length,1);assert.equal(found[0].id,'zz-export-match');
    });
  }finally{global.fetch=originalFetch;await env.cleanup();}
});
