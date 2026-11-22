const { initializeApp } = require('firebase-admin/app');

const { getAuth } = require('firebase-admin/auth');

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { defineString } = require('firebase-functions/params');

const { createHash } = require('node:crypto');

const { validateSettings, financialYear, buildInvoice } = require('./invoice-domain.cjs');

const { PERMISSIONS } = require('./operations-domain.cjs');



initializeApp({ storageBucket: 'm-v-ml.firebasestorage.app' });

const db = getFirestore();

const region = defineString('MVM_FUNCTIONS_REGION', { default: 'asia-south1' });

const options = { region, enforceAppCheck: true, maxInstances: 2, minInstances: 0, timeoutSeconds: 30, memory: '256MiB' };

// Hosting caches this deliberately public, read-only publication at its CDN edge.
exports.publicWebsite = require('firebase-functions/v2/https').onRequest({region,minInstances:0,maxInstances:2,memory:'256MiB',timeoutSeconds:15},require('./public-website.cjs').websiteHandler(db));



async function identity(request) {

  const memberRecord=request.auth?await db.doc(`members/${request.auth.uid}`).get():null;
  const authMember=memberRecord?.data();

  try { require('./auth-domain.cjs').validateSignIn(request.auth,authMember); }

  catch(error){ throw new HttpsError('unauthenticated',error.message); }

  if (request.rawRequest) {

    const now=Date.now(),uid=request.auth.uid,authTime=Number(request.auth.token.auth_time)*1000;

    const settingsSnap=await db.doc('settings/studio').get();

    const s=settingsSnap.data()??{},member=authMember;

    const idle=(member?.active?(s.adminIdleMinutes??15):(s.clientIdleMinutes??30))*60000,max=(s.sessionMaxHours??24)*3600000;

    if(!Number.isFinite(authTime)||now-authTime>max)throw new HttpsError('unauthenticated','Your session has ended. Sign in with Google again.');

    await db.runTransaction(async tx=>{const ref=db.doc(`sessions/${uid}`),previous=(await tx.get(ref)).data();if(previous?.authTime===authTime&&now-previous.lastActivityMs>idle)throw new HttpsError('unauthenticated','Your session timed out. Sign in with Google again.');tx.set(ref,{authTime,lastActivityMs:now,expiresAtMs:Math.min(now+idle,authTime+max)});});

  }

  return require('./request-member.cjs').rememberMember({...request.auth},memberRecord);

}



async function permission(request, ownerOnly = false) {

  const auth = await identity(request);

  const member = await require('./request-member.cjs').memberSnapshot(db,auth);

  const role = member.data();

  if (!role?.active || !(role.owner || (!ownerOnly && role.invoiceManage))) {

    throw new HttpsError('permission-denied', 'You do not have permission for this action.');

  }

  return auth;

}



async function rateLimit(uid, action, max) {

  const id = createHash('sha256').update(`${uid}:${action}`).digest('hex');

  const ref = db.doc(`invoiceRateLimits/${id}`);

  const window = Math.floor(Date.now() / 60000);

  await db.runTransaction(async tx => {

    const existing = (await tx.get(ref)).data();

    const count = existing?.window === window ? existing.count : 0;

    if (count >= max) throw new HttpsError('resource-exhausted', 'Too many requests. Please wait a minute.');

    tx.set(ref, { window, count: count + 1 });

  });

}



exports.syncInvoiceIdentity = onCall(options, async request => {

  const auth = await identity(request);

  await rateLimit(auth.uid, 'identity', 10);

  const ref = db.doc(`members/${auth.uid}`);

  // Role records are server-controlled. A normal login never creates an admin role.

  const member = (await ref.get()).data();

  const contactRef = db.doc(`contacts/${auth.uid}`);

  await db.runTransaction(async tx => {

    const existing = await tx.get(contactRef);

    if (!existing.exists) {

      tx.create(contactRef, {

      name: auth.token.name || auth.token.email || '', email: auth.token.email || '', phone: '',

      source: auth.token.firebase?.sign_in_provider==='password'?'staff':'registered', clientUid: auth.uid, updatesOptIn: false, marketingOptIn: false,

      consentSource: 'not-given', createdAtISO: new Date().toISOString(), createdAt: FieldValue.serverTimestamp(),

      });

      tx.set(db.doc('operationsState/contacts'), { updatedAt: FieldValue.serverTimestamp() });

    }

  });

  return { owner: !!member?.active && !!member?.owner,

    ...Object.fromEntries(PERMISSIONS.map(key => [key, !!member?.active && (!!member?.owner || !!member?.[key])])) };

});



exports.saveInvoiceSettings = onCall(options, async request => {

  const auth = await permission(request, true);

  await rateLimit(auth.uid, 'settings', 15);

  let settings;

  try { settings = validateSettings(request.data); }

  catch (error) { throw new HttpsError('invalid-argument', error.message); }

  await db.runTransaction(async tx => {

    const studioRef=db.doc('settings/studio');const studio=(await tx.get(studioRef)).data();

    tx.set(studioRef,{...studio,phone:settings.phone,secondaryPhone:settings.secondaryPhone},{merge:true});

    tx.set(db.doc('settings/invoicing'), { ...settings, updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.uid });

    tx.create(db.collection('invoiceAudit').doc(), { action: 'settings.updated', actor: auth.uid, at: FieldValue.serverTimestamp() });

  });

  return { saved: true };

});



exports.setInvoiceMember = onCall(options, async request => {

  const auth = await permission(request, true);

  await rateLimit(auth.uid, 'members', 10);

  const { email, invoiceManage, active, password, adminAccess=true, goAccess=true } = request.data ?? {};

  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email.trim())||typeof invoiceManage!=='boolean'||typeof active!=='boolean'||typeof adminAccess!=='boolean'||typeof goAccess!=='boolean'||active&&!adminAccess&&!goAccess)throw new HttpsError('invalid-argument','Specify a valid staff email, dashboard access and permissions.');

  if(password!==undefined&&(typeof password!=='string'||password.length<8||password.length>128))throw new HttpsError('invalid-argument','Use a password of 8–128 characters.');

  for(const key of PERMISSIONS)if(request.data[key]!==undefined&&typeof request.data[key]!=='boolean')throw new HttpsError('invalid-argument','Invalid member permission.');

  let user;try{user=await getAuth().getUserByEmail(email.trim());}catch(error){if(error.code!=='auth/user-not-found')throw error;}

  const previous=user?(await db.doc(`members/${user.uid}`).get()).data():null;

  if(previous?.owner||user?.uid===auth.uid)throw new HttpsError('failed-precondition','Owner access cannot be changed here.');

  if(!user){if(!password)throw new HttpsError('invalid-argument','Set an initial password for the new staff account.');user=await getAuth().createUser({email:email.trim(),password});}

  else if(password)await getAuth().updateUser(user.uid,{password});

  else if(!user.providerData.some(provider=>provider.providerId==='password'))throw new HttpsError('failed-precondition','Set an initial staff password for this existing account.');



  await db.runTransaction(async tx => {

    const ref = db.doc(`members/${user.uid}`);

    const existing = (await tx.get(ref)).data();

    if (existing?.owner) throw new HttpsError('failed-precondition', 'Owner access cannot be changed here.');

    const permissions = {};

    for (const key of PERMISSIONS) {

      if (request.data[key] !== undefined && typeof request.data[key] !== 'boolean') throw new HttpsError('invalid-argument', `Invalid ${key} permission.`);

      permissions[key] = request.data[key] ?? existing?.[key] ?? false;

    }

    tx.set(ref, { owner: false, email: user.email, ...permissions, active, adminAccess, goAccess, updatedAt: FieldValue.serverTimestamp() });

    tx.set(db.doc('operationsState/studio'),{updatedAt:FieldValue.serverTimestamp()});

    tx.create(db.collection('invoiceAudit').doc(), { action: 'member.updated', actor: auth.uid, memberUid: user.uid, at: FieldValue.serverTimestamp() });

  });

  if(password||!active)await getAuth().revokeRefreshTokens(user.uid);

  return { saved: true };

});



Object.assign(exports, require('./operations.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./studio.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./studio-extras.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./whatsapp-automation.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./studio-ledger.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./catalog.cjs')({ db, identity, rateLimit, options }));



exports.issueInvoice = onCall(options, async request => {

  const auth = await permission(request);

  await rateLimit(auth.uid, 'issue', 10);

  const orderId = request.data?.orderId;

  if (typeof orderId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {

    throw new HttpsError('invalid-argument', 'Select a valid order.');

  }

  const issuedAt = new Date().toISOString();

  const year = financialYear(issuedAt);

  return db.runTransaction(async tx => {

    const orderRef = db.doc(`orders/${orderId}`);

    const invoiceRef = db.doc(`invoices/${orderId}`);

    const counterRef = db.doc(`invoiceCounters/${year}`);

    const [orderSnap, settingsSnap, invoiceSnap, counterSnap] = await Promise.all([

      tx.get(orderRef), tx.get(db.doc('settings/invoicing')), tx.get(invoiceRef), tx.get(counterRef),

    ]);

    // Deterministic invoice ID makes retries and concurrent issuance for one order idempotent.

    if (invoiceSnap.exists) return { invoiceId: orderId, number: invoiceSnap.data().number };

    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');

    if (!settingsSnap.exists) throw new HttpsError('failed-precondition', 'Save your business invoice settings first.');

    const sequence = (counterSnap.data()?.sequence ?? 0) + 1;

    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999) throw new HttpsError('resource-exhausted', 'Invoice sequence requires owner attention.');

    let invoice;

    try {

      const settings = validateSettings(settingsSnap.data());

      invoice = buildInvoice(orderSnap.data(), settings, `${settings.prefix}/${year}/${String(sequence).padStart(6, '0')}`, issuedAt);

    } catch (error) { throw new HttpsError('failed-precondition', error.message); }

    const { agreedTotalPaise, ...clientInvoice } = invoice;

    tx.create(invoiceRef, { ...clientInvoice, id: orderId, orderId, issuedBy: auth.uid, createdAt: FieldValue.serverTimestamp() });

    tx.set(counterRef, { sequence });

    tx.update(orderRef, { invoiceId: orderId, billedTotalPaise: invoice.totalPaise });

    tx.set(db.doc('operationsState/orders'), { updatedAt: FieldValue.serverTimestamp() });

    tx.create(db.collection('invoiceAudit').doc(), { action: 'invoice.issued', actor: auth.uid, orderId, number: invoice.number, agreedTotalPaise, billedTotalPaise: invoice.totalPaise, at: FieldValue.serverTimestamp() });

    return { invoiceId: orderId, number: invoice.number };

  });

});


Object.assign(exports, require('./financial-tools.cjs')({ db, identity, rateLimit, options }));

Object.assign(exports, require('./payment-requests.cjs')({db,identity,rateLimit,options}));
Object.assign(exports, require('./booking-workflow.cjs')({db,identity,rateLimit,options}));

const {defineSecret}=require('firebase-functions/params');
Object.assign(exports,require('./cashfree.cjs')({db,identity,rateLimit,options,appId:defineSecret('CASHFREE_APP_ID'),secret:defineSecret('CASHFREE_SECRET')}));
