const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineString, defineSecret } = require('firebase-functions/params');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const { createHash, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const D = require('./operations-domain.cjs');

module.exports = function operations({ db, identity, rateLimit, options }) {
  const providerConnected = process.env.MVM_ENABLE_WHATSAPP_PROVIDER === 'true' || !!process.env.FIRESTORE_EMULATOR_HOST;
  const token = providerConnected ? defineSecret('MVM_WHATSAPP_ACCESS_TOKEN') : { value: () => '' };
  const appSecret = providerConnected ? defineSecret('MVM_WHATSAPP_APP_SECRET') : { value: () => '' };
  const verifyToken = providerConnected ? defineSecret('MVM_WHATSAPP_VERIFY_TOKEN') : { value: () => '' };
  const phoneId = defineString('MVM_WHATSAPP_PHONE_ID', { default: '' });
  const wabaId = defineString('MVM_WHATSAPP_ACCOUNT_ID', { default: '' });
  const apiVersion = defineString('MVM_WHATSAPP_API_VERSION', { default: 'v27.0' });
  const providerReady = () => providerConnected && /^\d+$/.test(phoneId.value()) && /^\d+$/.test(wabaId.value()) && /^v\d+\.\d+$/.test(apiVersion.value());
  const hash = value => createHash('sha256').update(value).digest('hex');
  const parse = fn => { try { return fn(); } catch (error) { throw new HttpsError('invalid-argument', error.message); } };
  const audit = (tx, actor, action, detail = {}) => tx.create(db.collection('operationsAudit').doc(), { actor, action, ...detail, createdAtISO: new Date().toISOString(), at: FieldValue.serverTimestamp() });
  const id = value => parse(() => { const result = D.string(value, 'record ID', 128, true); if (!/^[\w-]+$/.test(result)) throw new Error('Invalid record ID.'); return result; });

  async function access(request, permission) {
    const auth = await identity(request);
    const member = (await require('./request-member.cjs').memberSnapshot(db,auth)).data();
    const allowed = permission === 'contactsRead' ? member?.contactsManage || member?.clientsExport || member?.whatsappSend : permission !== 'owner' && member?.[permission] === true;
    if (!member?.active || !(member.owner || allowed)) throw new HttpsError('permission-denied', 'You do not have access to this action.');
    return auth;
  }
  async function getSettings() {
    const snapshot = await db.doc('settings/whatsapp').get();
    return { ...D.DEFAULT_WHATSAPP_SETTINGS, ...snapshot.data() };
  }
  const settingsResponse = settings => ({ ...settings, providerConfigured: providerReady() });

  const endpoints = {};
  endpoints.getOwnContactPreferences = onCall(options, async request => {
    const auth = await identity(request);
    await rateLimit(auth.uid, 'preferences-read', 20);
    const data = (await db.doc(`contacts/${auth.uid}`).get()).data() ?? {};
    return Object.fromEntries(['name','businessName','email','phone','city','address','instagram','serviceType','tags','updatesOptIn','marketingOptIn'].map(key => [key, data[key] ?? (key.endsWith('OptIn') ? false : '')]));
  });
  endpoints.saveOwnContactPreferences = onCall(options, async request => {
    const auth = await identity(request);
    await rateLimit(auth.uid, 'preferences', 10);
    const contact = parse(() => D.validateContact({ ...request.data, email: auth.token.email ?? '', notes: '' }));
    const preferences = parse(() => D.consent(request.data));
    if ((preferences.updatesOptIn || preferences.marketingOptIn) && !contact.phone) throw new HttpsError('invalid-argument', 'Add your WhatsApp number before opting in.');
    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const ref = db.doc(`contacts/${auth.uid}`);
      const previous = (await tx.get(ref)).data();
      tx.set(ref, { ...contact, notes: previous?.notes ?? '', ...preferences, source: 'registered', clientUid: auth.uid,
        consentSource: 'client-preferences', consentAtISO: now, updatedAtISO: now,
        createdAtISO: previous?.createdAtISO ?? now, createdAt: previous?.createdAt ?? FieldValue.serverTimestamp() }, { merge: true });
      audit(tx, auth.uid, 'client.preferences.changed', { contactId: auth.uid, ...preferences, phoneChanged: previous?.phone !== contact.phone });
      tx.set(db.doc('operationsState/contacts'), { updatedAt: FieldValue.serverTimestamp() });
    });
    return { saved: true };
  });

  endpoints.saveAdminContact = onCall(options, async request => {
    const auth = await access(request, 'contactsManage');
    await rateLimit(auth.uid, 'contacts', 20);
    const contact = parse(() => D.validateContact(request.data));
    const preferences = parse(() => D.consent(request.data));
    const evidence = parse(() => D.string(request.data.consentEvidence ?? '', 'consent evidence', 1000));
    const ref = request.data.id ? db.doc(`contacts/${id(request.data.id)}`) : db.collection('contacts').doc();
    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const previous = (await tx.get(ref)).data();
      const newlyOptingIn = (preferences.updatesOptIn && (!previous?.updatesOptIn || previous?.phone !== contact.phone)) || (preferences.marketingOptIn && (!previous?.marketingOptIn || previous?.phone !== contact.phone));
      if (newlyOptingIn && (!contact.phone || !evidence)) throw new HttpsError('invalid-argument', 'Record how and when this client consented before enabling messages.');
      tx.set(ref, { ...contact, ...preferences, source: previous?.source ?? 'manual', clientUid: previous?.clientUid ?? '',
        consentSource: newlyOptingIn ? 'admin-recorded-consent' : previous?.consentSource ?? 'not-given',
        consentEvidence: evidence || previous?.consentEvidence || '',
        consentAtISO: now, updatedAtISO: now, createdAtISO: previous?.createdAtISO ?? now,
        createdAt: previous?.createdAt ?? FieldValue.serverTimestamp() }, { merge: true });
      audit(tx, auth.uid, 'contact.saved', { contactId: ref.id, ...preferences });
      tx.set(db.doc('operationsState/contacts'), { updatedAt: FieldValue.serverTimestamp() });
    });
    return { id: ref.id };
  });

  endpoints.listAdminRecords = onCall(options, async request => {
    const kind = request.data?.kind;
    if (!['contacts', 'payments', 'orders', 'whatsappJobs'].includes(kind)) throw new HttpsError('invalid-argument', 'Invalid record type.');
    const permission = kind === 'contacts' ? request.data.forExport ? 'clientsExport' : request.data.forMessaging ? 'contactsRead' : 'contactsManage' : kind === 'payments' || kind === 'orders' ? 'paymentsManage' : 'whatsappSend';
    const auth = await access(request, permission);
    await rateLimit(auth.uid, 'list-records', 90);
    const filters = parse(() => D.validateFilters(request.data.filters));
    const cursor = request.data.cursor ? id(request.data.cursor) : '';
    let q = db.collection(kind).orderBy(FieldPath.documentId()).limit(250);
    if (cursor) q = q.startAfter(cursor);
    const snapshot = await q.get();
    const rows = snapshot.docs.map(row => ({ id: row.id, ...row.data() })).filter(row => D.matches(row, filters));
    const result = rows.map(row => {
      // Explicit export contract excludes provider secrets, internal queue payloads, and identity tokens.
      if (kind === 'contacts') {
        const keys = request.data.forMessaging && !request.data.forExport
          ? ['id','publicId','clientUid','name','businessName','email','phone','city','serviceType','tags','source','updatesOptIn','marketingOptIn','createdAtISO']
          : ['id','publicId','clientUid','name','businessName','email','phone','city','address','instagram','serviceType','tags','notes','source','updatesOptIn','marketingOptIn','consentSource','consentAtISO','consentEvidence','createdAtISO','updatedAtISO'];
        return Object.fromEntries(keys.map(key => [key, row[key] ?? '']));
      }
      if (kind === 'orders') {
        let balance;
        try { balance = D.orderBalance(row); } catch { balance = null; }
        return { id: row.id, publicId: row.publicId ?? '', title: row.title ?? '', clientName: row.client?.name ?? '', clientUid: row.clientUid ?? '', ...balance };
      }
      if (kind === 'whatsappJobs') return { id: row.id, contactId: row.contactId, category: row.message?.category, state: row.state, reason: row.reason ?? '', createdAtISO: row.createdAtISO, estimatePaise: row.estimatePaise ?? 0 };
      return Object.fromEntries(['id','publicId','receiptDocumentId','orderId','clientUid','clientName','amountPaise','method','reference','notes','status','provider','receivedAtISO','createdAtISO','recordedBy'].map(key => [key, row[key] ?? '']));
    });
    if (request.data.forExport) await db.collection('operationsAudit').add({ actor: auth.uid, action: 'clients.export.page', filters, rowCount: result.length, createdAtISO: new Date().toISOString() });
    return { rows: result, scanned: snapshot.size, cursor: snapshot.size === 250 ? snapshot.docs.at(-1).id : null };
  });

  endpoints.getWhatsAppAdmin = onCall(options, async request => {
    const auth = await access(request, 'whatsappSend');
    await rateLimit(auth.uid, 'whatsapp-read', 30);
    const now = new Date();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [settings, daily, monthly, templates] = await Promise.all([getSettings(), db.doc(`whatsappUsage/day-${day}`).get(), db.doc(`whatsappUsage/month-${day.slice(0, 7)}`).get(), db.collection('whatsappTemplates').limit(100).get()]);
    return { settings: settingsResponse(settings), dailyReserved: daily.data()?.count ?? 0, monthlyReservedPaise: monthly.data()?.costPaise ?? 0,
      templates: templates.docs.map(row => ({ id: row.id, ...row.data() })) };
  });

  endpoints.saveWhatsAppSettings = onCall(options, async request => {
    const auth = await access(request, 'owner');
    await rateLimit(auth.uid, 'whatsapp-settings', 15);
    const settings = parse(() => D.validateWhatsAppSettings(request.data));
    if (settings.enabled && !providerReady()) throw new HttpsError('failed-precondition', 'Connect the WhatsApp provider before enabling sends.');
    await db.runTransaction(async tx => {
      const previous = (await tx.get(db.doc('settings/whatsapp'))).data();
      tx.set(db.doc('settings/whatsapp'), { ...settings, stopEpoch:settings.enabled?(previous?.stopEpoch??0):randomUUID(), version: randomUUID(), updatedBy: auth.uid, updatedAtISO: new Date().toISOString() });
      audit(tx, auth.uid, settings.enabled ? 'whatsapp.settings.saved' : 'whatsapp.master.stopped');
    });
    return { saved: true };
  });

  endpoints.stopAllWhatsApp = onCall(options, async request => {
    const auth = await access(request, 'owner');
    await rateLimit(auth.uid, 'whatsapp-stop', 15);
    await db.runTransaction(async tx => {
      tx.set(db.doc('settings/whatsapp'), { enabled: false, stopEpoch:randomUUID(), version: randomUUID(), updatedBy: auth.uid, updatedAtISO: new Date().toISOString() }, { merge: true });
      audit(tx, auth.uid, 'whatsapp.master.stopped');
    });
    return { stopped: true };
  });

  endpoints.syncWhatsAppTemplates = onCall({ ...options, secrets: providerConnected ? [token] : [] }, async request => {
    const auth = await access(request, 'owner');
    await rateLimit(auth.uid, 'template-sync', 3);
    if (!providerReady()) throw new HttpsError('failed-precondition', 'WhatsApp provider is not configured.');
    const response = await fetch(`https://graph.facebook.com/${apiVersion.value()}/${wabaId.value()}/message_templates?fields=name,status,language,category,components&limit=100`, { headers: { Authorization: `Bearer ${token.value()}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new HttpsError('unavailable', 'WhatsApp template sync failed. Check provider configuration.');
    const data = await response.json();
    const existing = await db.collection('whatsappTemplates').get();
    const batch = db.batch();
    for (const row of existing.docs) batch.delete(row.ref);
    let count = 0;
    for (const template of data.data ?? []) {
      const value=require('./whatsapp-documents-domain.cjs').templateInfo(template);
      if(!value)continue;
      batch.set(db.doc(`whatsappTemplates/${id(template.id)}`),{...value,syncedAtISO:new Date().toISOString()});
      count++;
    }
    await batch.commit();
    return { count, moreAtProvider: !!data.paging?.next };
  });

  async function inspectRecipients(ids, message, settings) {
    const contacts = await db.getAll(...ids.map(value => db.doc(`contacts/${value}`)));
    const phoneHashes = [...new Set(contacts.map(snapshot => snapshot.data()?.phone).filter(Boolean).map(hash))];
    const phoneStates = phoneHashes.length ? await db.getAll(...phoneHashes.map(value => db.doc(`whatsappPhones/${value}`))) : [];
    const states = new Map(phoneStates.map(snapshot => [snapshot.id, snapshot.data() ?? {}]));
    const uniquePhones = new Set();
    const results = [];
    for (const snapshot of contacts) {
      const contact = snapshot.data();
      const state = contact?.phone ? states.get(hash(contact.phone)) ?? {} : {};
      let reason = D.recipientReason(contact, message, settings, state);
      if (!reason && uniquePhones.has(contact.phone)) reason = 'Duplicate phone number';
      if (!reason) uniquePhones.add(contact.phone);
      results.push({ contactId: snapshot.id, name: contact?.name ?? 'Contact unavailable', eligible: !reason, reason });
    }
    return results;
  }

  endpoints.previewWhatsAppCampaign = onCall(options, async request => {
    const auth = await access(request, 'whatsappSend');
    await rateLimit(auth.uid, 'campaign-preview', 10);
    const settings = await getSettings();
    const ids = request.data?.contactIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > settings.maxCampaignRecipients) throw new HttpsError('invalid-argument', `Select 1–${settings.maxCampaignRecipients} contacts.`);
    const contactIds = [...new Set(ids.map(id))];
    const message = parse(() => D.validateMessage(request.data.message));
    if (message.category !== 'service') {
      const template = (await db.doc(`whatsappTemplates/${id(message.templateId)}`).get()).data();
      if (!template?.verifiedFromMeta || template.status !== 'APPROVED' || template.category !== message.category || template.parameterCount !== message.parameters.length || template.headerFormat==='DOCUMENT') throw new HttpsError('failed-precondition', 'Select a synced approved template and supply all required parameters.');
      message.template = { name: template.name, language: template.language };
    }
    const recipients = await inspectRecipients(contactIds, message, settings);
    const cost = settings[`${message.category}CostPaise`];
    const estimatePaise = recipients.filter(row => row.eligible).length * cost;
    const preview = db.collection('whatsappPreviews').doc();
    await preview.set({ actor: auth.uid, contactIds, message, settingsVersion: settings.version ?? 0, estimatePaise, expiresAtMs: Date.now() + 300000, createdAtISO: new Date().toISOString() });
    return { previewId: preview.id, recipients, estimatePaise, masterEnabled: settings.enabled, providerConfigured: providerReady(), expiresAtMs: Date.now() + 300000 };
  });

  endpoints.queueWhatsAppCampaign = onCall(options, async request => {
    const auth = await access(request, 'whatsappSend');
    await rateLimit(auth.uid, 'campaign-queue', 5);
    const previewId = id(request.data.previewId);
    return db.runTransaction(async tx => {
      const previewRef = db.doc(`whatsappPreviews/${previewId}`);
      const [previewSnap, settingsSnap, campaignSnap] = await Promise.all([tx.get(previewRef), tx.get(db.doc('settings/whatsapp')), tx.get(db.doc(`whatsappCampaigns/${previewId}`))]);
      const preview = previewSnap.data();
      if (!preview || preview.actor !== auth.uid) throw new HttpsError('permission-denied', 'Preview not available.');
      if (campaignSnap.exists) return { campaignId: previewId, queued: campaignSnap.data().queued };
      if (preview.expiresAtMs < Date.now()) throw new HttpsError('failed-precondition', 'Preview expired. Review recipients again.');
      const settings = { ...D.DEFAULT_WHATSAPP_SETTINGS, ...settingsSnap.data() };
      if (!settings.enabled || !providerReady()) throw new HttpsError('failed-precondition', 'WhatsApp sending is stopped or not configured.');
      if ((settings.version ?? 0) !== preview.settingsVersion) throw new HttpsError('failed-precondition', 'Settings changed. Preview this message again.');
      const recipients = await inspectRecipients(preview.contactIds, preview.message, settings);
      const eligible = recipients.filter(row => row.eligible);
      if (!eligible.length) throw new HttpsError('failed-precondition', 'No eligible recipients.');
      const now = new Date().toISOString();
      for (const row of eligible) tx.create(db.doc(`whatsappJobs/${previewId}-${row.contactId}`), { campaignId: previewId, contactId: row.contactId, message: preview.message, stopEpoch:settings.stopEpoch??0, state: 'queued', actor: auth.uid, createdAtISO: now });
      tx.create(db.doc(`whatsappCampaigns/${previewId}`), { actor: auth.uid, queued: eligible.length, estimatePaise: eligible.length * settings[`${preview.message.category}CostPaise`], createdAtISO: now });
      tx.update(previewRef, { consumedAtISO: now });
      audit(tx, auth.uid, 'whatsapp.campaign.queued', { campaignId: previewId, count: eligible.length });
      return { campaignId: previewId, queued: eligible.length };
    });
  });

  endpoints.getFinancialWhatsAppStatus=onCall(options,async request=>{
    const auth=await access(request,'whatsappSend');await rateLimit(auth.uid,'receipt-status',30);
    const settings=await getSettings(),templates=await db.collection('whatsappTemplates').get();
    const record=request.data?.id?(await db.doc(`financialDocuments/${id(request.data.id)}`).get()).data():null;
    const member=(await require('./request-member.cjs').memberSnapshot(db,auth)).data();
    if(record&&!(member.owner||member.invoiceManage||member.paymentsManage))throw new HttpsError('permission-denied','Billing access required');
    const contact=record?(await db.doc(`contacts/${id(record.contactId??record.clientUid)}`).get()).data():null;
    const requestState=record?.documentType==='payment_request'?require('./payment-requests-domain.cjs').collectionStatus(record,(await db.doc(`orders/${id(record.orderId)}`).get()).data(),(await db.doc('settings/paymentReceiving').get()).data()??{}):'';
    return{collectionStatus:requestState,providerConfigured:providerReady(),enabled:settings.enabled,phone:contact?.phone??'',consent:!!contact?.updatesOptIn,templates:templates.docs.filter(d=>d.data().headerFormat==='DOCUMENT'&&d.data().category==='utility'&&d.data().parameterCount===3&&d.data().status==='APPROVED').map(d=>({id:d.id,name:d.data().name,body:d.data().body,language:d.data().language}))};
  });
  endpoints.sendFinancialWhatsApp=onCall(options,async request=>{
    const auth=await access(request,'whatsappSend');await rateLimit(auth.uid,'receipt-queue',10);
    const documentId=id(request.data.id),requestId=id(request.data.requestId),templateId=id(request.data.templateId);
    return db.runTransaction(async tx=>{
      const jobRef=db.doc(`whatsappJobs/financial-${requestId}`);
      const [old,docSnap,settingsSnap,templateSnap,memberSnap]=await Promise.all([tx.get(jobRef),tx.get(db.doc(`financialDocuments/${documentId}`)),tx.get(db.doc('settings/whatsapp')),tx.get(db.doc(`whatsappTemplates/${templateId}`)),tx.get(db.doc(`members/${auth.uid}`))]);
      const record=docSnap.data(),member=memberSnap.data();
      if(!(member?.active&&(member.owner||member.invoiceManage||member.paymentsManage)))throw new HttpsError('permission-denied','Billing access required');
      if(old.exists){if(old.data().actor!==auth.uid||old.data().message.document.id!==documentId||old.data().message.templateId!==templateId)throw new HttpsError('already-exists','Send request used for another document');return{jobId:jobRef.id,state:old.data().state};}
      if(!record||record.pdfStatus!=='stored'||!record.storagePath)throw new HttpsError('failed-precondition','Wait for PDF archiving before sending');
      if(record.documentType==='payment_request'){const order=(await tx.get(db.doc(`orders/${id(record.orderId)}`))).data();if(require('./payment-requests-domain.cjs').collectionStatus(record,order,(await tx.get(db.doc('settings/paymentReceiving'))).data()??{})!=='open')throw new HttpsError('failed-precondition','This payment request is no longer current. Create a new request from the invoice.');}
      const contactId=id(record.contactId??record.clientUid),contact=(await tx.get(db.doc(`contacts/${contactId}`))).data();
      const settings={...D.DEFAULT_WHATSAPP_SETTINGS,...settingsSnap.data()},template=templateSnap.data();
      if(!settings.enabled||!providerReady())throw new HttpsError('failed-precondition','Connect WhatsApp API and enable sending first');
      if(!template?.verifiedFromMeta||template.headerFormat!=='DOCUMENT'||template.category!=='utility'||template.status!=='APPROVED'||template.parameterCount!==3)throw new HttpsError('failed-precondition','Choose an approved utility document template with client name, document number and amount');
      const phoneState=contact?.phone?(await tx.get(db.doc(`whatsappPhones/${hash(contact.phone)}`))).data():{};
      const message={category:'utility',text:'',templateId,template:{name:template.name,language:template.language},parameters:[record.client.name,record.number,`INR ${((record.paymentRequestAmountPaise??record.receiptAmountPaise??record.totalPaise)/100).toFixed(2)}`],document:{id:documentId,storagePath:record.storagePath,filename:record.number.replace(/[^\w-]/g,'-')+'.pdf'}};
      const reason=D.recipientReason(contact,message,settings,phoneState);if(reason)throw new HttpsError('failed-precondition',reason);
      tx.create(jobRef,{contactId,message,state:'queued',actor:auth.uid,stopEpoch:settings.stopEpoch??0,createdAtISO:new Date().toISOString()});audit(tx,auth.uid,'financial.whatsapp.queued',{documentId,jobId:jobRef.id});return{jobId:jobRef.id,state:'queued'};
    });
  });

  endpoints.recordOfflinePayment = onCall(options, async request => {
    const auth = await access(request, 'paymentsManage');
    await rateLimit(auth.uid, 'offline-payment', 10);
    const orderId = id(request.data.orderId);
    const requestId = id(request.data.requestId);
    const amountPaise = parse(() => D.integer(request.data.amountPaise, 1, 100000000, 'payment amount'));
    const method = request.data.method;
    if (!['cash','upi','bank'].includes(method)) throw new HttpsError('invalid-argument', 'Select cash, UPI, or bank transfer.');
    const reference = parse(() => D.string(request.data.reference ?? '', 'payment reference', 150));
    if (method !== 'cash' && !reference) throw new HttpsError('invalid-argument', 'Add the UPI or bank transaction reference.');
    const notes = parse(() => D.string(request.data.notes ?? '', 'payment note', 1000));
    const receivedAtISO = parse(() => D.string(request.data.receivedAtISO, 'received date', 40, true));
    const receivedAt = Date.parse(receivedAtISO);
    if (!Number.isFinite(receivedAt) || receivedAt > Date.now() + 60000 || receivedAt < Date.UTC(2000, 0, 1)) throw new HttpsError('invalid-argument', 'Choose a valid date when this payment was received.');
    return db.runTransaction(async tx => {
      const paymentRef = db.doc(`payments/${requestId}`);
      const orderRef = db.doc(`orders/${orderId}`);
      const [existing, orderSnapshot] = await Promise.all([tx.get(paymentRef), tx.get(orderRef)]);
      if (existing.exists) {
        const previous = existing.data();
        if (previous.recordedBy !== auth.uid || previous.orderId !== orderId || previous.amountPaise !== amountPaise || previous.method !== method || previous.reference !== reference) throw new HttpsError('already-exists', 'This payment request was already used with different details.');
        return { paymentId: existing.id, duplicate: true };
      }
      if (!orderSnapshot.exists) throw new HttpsError('not-found', 'Order not found.');
      const referenceRef = method !== 'cash' ? db.doc(`paymentReferences/${hash(`${method}:${reference.toUpperCase()}`)}`) : null;
      if (referenceRef && (await tx.get(referenceRef)).exists) throw new HttpsError('already-exists', 'This payment reference has already been recorded.');
      const order = orderSnapshot.data();
      if(order.billingStatus==='cancelled')throw new HttpsError('failed-precondition','Use the bill payment action and confirm a late payment for a cancelled bill.');
      const balance = parse(() => D.orderBalance(order));
      if (amountPaise > balance.balancePaise) throw new HttpsError('failed-precondition', 'Amount exceeds the order balance.');
      const now = new Date().toISOString();
      tx.create(paymentRef, { orderId, clientUid: order.clientUid, clientName: order.client?.name ?? '', amountPaise, cumulativePaidPaise: (order.paidPaise ?? 0) + amountPaise, method, reference, notes, provider: 'offline', status: 'recorded', receivedAtISO, createdAtISO: now, recordedBy: auth.uid });
      if (referenceRef) tx.create(referenceRef, { paymentId: requestId, orderId });
      tx.update(orderRef, { financialStatus:amountPaise===balance.balancePaise?'settled':'part-paid',updatedAtISO:now,paidPaise: balance.paidPaise + amountPaise, balancePaise: balance.balancePaise - amountPaise, paymentStatus: amountPaise === balance.balancePaise ? 'Paid' : 'Partially paid' });
      audit(tx, auth.uid, 'payment.offline.recorded', { orderId, paymentId: requestId, amountPaise });
      tx.set(db.doc('operationsState/payments'), { updatedAt: FieldValue.serverTimestamp() });
      tx.set(db.doc('operationsState/orders'), { updatedAt: FieldValue.serverTimestamp() });
      return { paymentId: requestId, duplicate: false };
    });
  });

  endpoints.dispatchWhatsAppJob = onDocumentWritten({ document: 'whatsappJobs/{jobId}', region: options.region, maxInstances: 2, minInstances: 0, timeoutSeconds: 120, memory: '2GiB', concurrency:1, secrets: providerConnected ? [token] : [] }, async event => {
    const after = event.data?.after;
    if (!after?.exists || after.data().state !== 'queued' || event.data.before?.data()?.state === 'queued') return;
    const ref = after.ref;
    const reservation = await db.runTransaction(async tx => {
      const [jobSnapshot, settingsSnapshot] = await Promise.all([tx.get(ref), tx.get(db.doc('settings/whatsapp'))]);
      const job = jobSnapshot.data();
      if (job?.state !== 'queued') return null;
      const settings = { ...D.DEFAULT_WHATSAPP_SETTINGS, ...settingsSnapshot.data() };
      const contactSnapshot = await tx.get(db.doc(`contacts/${job.contactId}`));
      const contact = contactSnapshot.data();
      const memberSnapshot = job.actor ? await tx.get(db.doc(`members/${job.actor}`)) : null;
      const member = memberSnapshot?.data();
      const phoneRef = contact?.phone ? db.doc(`whatsappPhones/${hash(contact.phone)}`) : null;
      const phoneSnapshot = phoneRef ? await tx.get(phoneRef) : null;
      const state = phoneSnapshot?.data() ?? {};
      let reason = !settings.enabled ? 'Master switch is off' : !providerReady() ? 'Provider is not configured' : !member?.active || !(member.owner || member.whatsappSend) ? 'Sender permission revoked' : D.recipientReason(contact, job.message, settings, state);
      if ((job.stopEpoch??0)!==(settings.stopEpoch??0)) reason = 'Cancelled by a previous master stop';
      if (job.automated && (!settings.automatedEnabled || !settings[job.eventType])) reason = 'Automated event is disabled';
      if (job.message.category !== 'service') {
        const template = (await tx.get(db.doc(`whatsappTemplates/${job.message.templateId}`))).data();
        if (!template?.verifiedFromMeta || template.status !== 'APPROVED' || template.category !== job.message.category || Boolean(template.headerFormat==='DOCUMENT')!==Boolean(job.message.document)) reason = 'Template unavailable';
        if(job.message.document){const record=(await tx.get(db.doc(`financialDocuments/${id(job.message.document.id)}`))).data();if(record?.documentType==='payment_request'){const order=(await tx.get(db.doc(`orders/${id(record.orderId)}`))).data();if(require('./payment-requests-domain.cjs').collectionStatus(record,order,(await tx.get(db.doc('settings/paymentReceiving'))).data()??{})!=='open')reason='Payment request is no longer current';}if(!record||(record.contactId??record.clientUid)!==job.contactId||!(member.owner||member.invoiceManage||member.paymentsManage))reason='Document access changed';}
      }
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const dayRef = db.doc(`whatsappUsage/day-${day}`);
      const monthRef = db.doc(`whatsappUsage/month-${day.slice(0,7)}`);
      const [daily, monthly] = await Promise.all([tx.get(dayRef), tx.get(monthRef)]);
      const estimatePaise = settings[`${job.message.category}CostPaise`];
      if ((daily.data()?.count ?? 0) >= settings.dailyMessageLimit) reason ||= 'Daily limit reached';
      if ((monthly.data()?.costPaise ?? 0) + estimatePaise > settings.monthlyBudgetPaise) reason ||= 'Monthly budget reached';
      if (reason) { tx.update(ref, { state: 'stopped', reason, updatedAtISO: new Date().toISOString() }); return null; }
      const now = Date.now();
      tx.set(dayRef, { count: (daily.data()?.count ?? 0) + 1 });
      tx.set(monthRef, { costPaise: (monthly.data()?.costPaise ?? 0) + estimatePaise });
      tx.set(phoneRef, { ...state, day, count: (state.day === day ? state.count : 0) + 1, lastSentAtMs: now, ...(job.message.category === 'marketing' ? { lastMarketingAtMs: now } : {}) });
      tx.update(ref, { state: 'sending', estimatePaise, updatedAtISO: new Date().toISOString() });
      return { phone: contact.phone, job, settingsVersion: settings.version ?? 0 };
    });
    if (!reservation) return;
    // Check again immediately before the external request. An already accepted provider request cannot be recalled.
    const settings = await getSettings();
    const contact = (await db.doc(`contacts/${reservation.job.contactId}`).get()).data();
    const phoneState = (await db.doc(`whatsappPhones/${hash(reservation.phone)}`).get()).data();
    if (!settings.enabled || (reservation.job.stopEpoch??0)!==(settings.stopEpoch??0) || phoneState?.blocked || !contact || contact.phone !== reservation.phone || (reservation.job.automated && (!settings.automatedEnabled || !settings[reservation.job.eventType])) || (reservation.job.message.category === 'marketing' ? !contact.marketingOptIn || !settings.marketingEnabled : !contact.updatesOptIn) || (reservation.job.message.category === 'service' && Date.now() - (phoneState?.lastInboundAtMs ?? 0) >= 86400000)) {
      await ref.update({ state: 'stopped', reason: 'Sending stopped before provider request' }); return;
    }
    const message = reservation.job.message;
    const body = { messaging_product: 'whatsapp', to: reservation.phone.replace('+',''), type: message.category === 'service' ? 'text' : 'template' };
    if (message.category === 'service') body.text = { body: message.text, preview_url: false };
    else body.template = { name: message.template.name, language: { code: message.template.language }, ...(message.parameters.length ? { components: [{ type: 'body', parameters: message.parameters.map(text => ({ type: 'text', text })) }] } : {}) };
    try {
      if(message.document){
        const recordRef=db.doc(`financialDocuments/${message.document.id}`),record=(await recordRef.get()).data();if(!record||(record.contactId??record.clientUid)!==reservation.job.contactId)throw new Error('Document no longer available');
        if(record.documentType==='payment_request'){const order=(await db.doc(`orders/${id(record.orderId)}`).get()).data();if(require('./payment-requests-domain.cjs').collectionStatus(record,order,(await db.doc('settings/paymentReceiving').get()).data()??{})!=='open'){await ref.update({state:'stopped',reason:'Payment request is no longer current'});return;}}
        const bytes=await require('./financial-pdf-cache.cjs').ensure(recordRef,record);
        if(bytes.length>6000000)throw new Error('Document exceeds sending limit');
        const form=new FormData();form.append('messaging_product','whatsapp');form.append('type','application/pdf');form.append('file',new Blob([bytes],{type:'application/pdf'}),message.document.filename);
        const upload=await fetch(`https://graph.facebook.com/${apiVersion.value()}/${phoneId.value()}/media`,{method:'POST',headers:{Authorization:`Bearer ${token.value()}`},body:form,signal:AbortSignal.timeout(10000)});
        const media=await upload.json();if(!upload.ok||!media.id){await ref.update({state:'failed',reason:'PDF upload rejected by WhatsApp'});return;}
        body.template.components=require('./whatsapp-documents-domain.cjs').documentComponents(message,media.id);
        const latest=await getSettings();if(record.documentType==='payment_request'){const latestOrder=(await db.doc(`orders/${id(record.orderId)}`).get()).data();if(require('./payment-requests-domain.cjs').collectionStatus(record,latestOrder,(await db.doc('settings/paymentReceiving').get()).data()??{})!=='open'){await ref.update({state:'stopped',reason:'Payment request changed before sending'});return;}}if(!latest.enabled||(reservation.job.stopEpoch??0)!==(latest.stopEpoch??0)){await ref.update({state:'stopped',reason:'Sending stopped before PDF message'});return;}
      }
      const response = await fetch(`https://graph.facebook.com/${apiVersion.value()}/${phoneId.value()}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token.value()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok || !result.messages?.[0]?.id) { await ref.update({ state: 'failed', reason: `Provider rejected message (${result.error?.code ?? response.status})` }); return; }
      await ref.update({ state: 'accepted', providerMessageId: result.messages[0].id, updatedAtISO: new Date().toISOString() });
    } catch {
      // A timeout may follow provider acceptance. Do not retry blindly and create duplicate paid messages.
      await ref.update({ state: 'needs_review', reason: 'Provider outcome uncertain; inspect before retrying', updatedAtISO: new Date().toISOString() });
    }
  });

  endpoints.whatsAppWebhook = onRequest({ region: options.region, maxInstances: 2, minInstances: 0, timeoutSeconds: 30, secrets: providerConnected ? [appSecret, verifyToken] : [] }, async (request, response) => {
    if (!providerReady()) { response.sendStatus(503); return; }
    if (request.method === 'GET') {
      if (request.query['hub.mode'] === 'subscribe' && request.query['hub.verify_token'] === verifyToken.value()) { response.status(200).send(request.query['hub.challenge']); return; }
      response.sendStatus(403); return;
    }
    if (request.method !== 'POST') { response.sendStatus(405); return; }
    const signature = request.get('x-hub-signature-256') ?? '';
    const expected = `sha256=${createHmac('sha256', appSecret.value()).update(request.rawBody).digest('hex')}`;
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) { response.sendStatus(403); return; }
    for (const entry of request.body.entry ?? []) for (const change of entry.changes ?? []) {
      if (String(change.value?.metadata?.phone_number_id) !== phoneId.value()) continue;
      for (const message of change.value?.messages ?? []) {
        const number = D.phone(`+${message.from}`);
        const content = (message.text?.body ?? message.button?.text ?? '').trim().toLowerCase();
        const at = Number(message.timestamp) * 1000;
        if (!Number.isFinite(at) || at > Date.now() + 60000) continue;
        const appliedStop = await db.runTransaction(async tx => {
          const ref = db.doc(`whatsappPhones/${hash(number)}`);
          const previous = (await tx.get(ref)).data() ?? {};
          const update = { lastInboundAtMs: Math.max(previous.lastInboundAtMs ?? 0, at) };
          if (at >= (previous.preferenceEventAtMs ?? 0)) {
            if (['stop','unsubscribe','बंद'].includes(content)) { update.blocked = true; update.preferenceEventAtMs = at; }
            if (['start','resume'].includes(content) && (at > (previous.preferenceEventAtMs ?? 0) || !previous.blocked)) { update.blocked = false; update.preferenceEventAtMs = at; }
          }
          tx.set(ref, update, { merge: true });
          return update.blocked === true;
        });
        if (appliedStop) {
          const affected = await db.collection('contacts').where('phone','==',number).limit(100).get();
          const batch = db.batch();
          for (const contact of affected.docs) batch.update(contact.ref, { updatesOptIn:false, marketingOptIn:false, consentSource:'whatsapp-stop', consentAtISO:new Date(at).toISOString(), updatedAtISO:new Date().toISOString() });
          batch.set(db.doc('operationsState/contacts'), { updatedAt:FieldValue.serverTimestamp() });
          await batch.commit();
        }
      }
      for (const status of change.value?.statuses ?? []) {
        if (!['delivered','read','failed'].includes(status.status)) continue;
        const jobs = await db.collection('whatsappJobs').where('providerMessageId','==',status.id).limit(1).get();
        for (const job of jobs.docs) await job.ref.update({ state: status.status, updatedAtISO: new Date().toISOString() });
      }
    }
    response.sendStatus(200);
  });
  return endpoints;
};
