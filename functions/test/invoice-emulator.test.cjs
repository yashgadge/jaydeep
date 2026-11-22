const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Firestore emulator: access isolation and concurrent invoice issuance', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async t => {
  if (process.env.GCLOUD_PROJECT !== 'demo-mvm-invoices') throw new Error('Integration tests require the isolated demo-mvm-invoices project.');
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
  const { doc, getDoc, setDoc, collection, query, where, getDocs } = require('firebase/firestore');
  const { getFirestore } = require('firebase-admin/firestore');
  const handlers = require('../index.cjs');
  const { validateSettings } = require('../invoice-domain.cjs');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  const environment = await initializeTestEnvironment({ projectId: 'demo-mvm-invoices', firestore: {
    host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
  } });
  await environment.clearFirestore();
  const admin = getFirestore();
  const ownerAuth = { uid: 'test-owner', token: { email_verified: true, email: 'test-owner@example.invalid', firebase: { sign_in_provider: 'password' } } };
  const clientAuth = { uid: 'test-client-a', token: { email_verified: true, email: 'test-client@example.invalid', firebase: { sign_in_provider: 'google.com' } } };
  const settings = validateSettings({ businessName: 'Test issuer', address: 'Test address', phone: 'Test phone', prefix: 'MVM', accent: '#c81d38', documentTitle: 'Invoice', bypassEnabled: true });
  const source = { clientUid: 'test-client-a', client: { name: 'Test client A' }, title: 'Test order', items: [{ description: 'Test deliverable', quantity: 2, unitPaise: 10000 }], paymentMode: 'bypass', paidPaise: 0 };
  try {
    await admin.doc('members/test-owner').set({ active: true, owner: true, invoiceManage: true });
    await admin.doc('settings/invoicing').set(settings);
    for (const id of ['order-a', 'order-b', 'order-c']) await admin.doc(`orders/${id}`).set(source);
    await t.test('concurrent different orders receive unique sequence numbers', async () => {
      const results = await Promise.all(['order-a', 'order-b', 'order-c'].map(orderId => handlers.issueInvoice.run({ auth: ownerAuth, data: { orderId } })));
      assert.equal(new Set(results.map(value => value.number)).size, 3);
      const sequences = results.map(value => Number(value.number.split('/').at(-1))).sort();
      assert.deepEqual(sequences, [1, 2, 3]);
    });
    await t.test('concurrent repeats return one immutable invoice and do not advance the counter', async () => {
      const results = await Promise.all(Array.from({ length: 3 }, () => handlers.issueInvoice.run({ auth: ownerAuth, data: { orderId: 'order-a' } })));
      assert.equal(new Set(results.map(value => value.number)).size, 1);
      const invoices = await admin.collection('invoices').get();
      const counters = await admin.collection('invoiceCounters').get();
      assert.equal(invoices.size, 3);
      assert.equal(counters.docs[0].data().sequence, 3);
      const value = (await admin.doc('invoices/order-a').get()).data();
      assert.equal(value.totalPaise, 0);
      assert.equal(value.paymentStatus, 'No charge');
      assert.equal('agreedTotalPaise' in value, false);
    });
    await t.test('client can read only own invoices, not other clients or private counters', async () => {
      const authTime=Math.floor(Date.now()/1000);
      await admin.doc('sessions/test-client-a').set({authTime:authTime*1000,expiresAtMs:Date.now()+600000});
      const a = environment.authenticatedContext('test-client-a',{auth_time:authTime,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
      const b = environment.authenticatedContext('test-client-b').firestore();
      const anonymous = environment.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(a, 'invoices/order-a')));
      await assertFails(getDoc(doc(b, 'invoices/order-a')));
      await assertFails(getDoc(doc(anonymous, 'invoices/order-a')));
      await assertFails(getDocs(collection(a, 'invoices')));
      await assertSucceeds(getDocs(query(collection(a, 'invoices'), where('clientUid', '==', 'test-client-a'))));
      await assertFails(getDocs(collection(a, 'invoiceCounters')));
      await assertFails(setDoc(doc(a, 'members/test-client-a'), { active: true, owner: true, invoiceManage: true }));
      await assertFails(setDoc(doc(a, 'invoices/forged'), { clientUid: 'test-client-a', totalPaise: 0 }));
    });
    await t.test('unauthorised and revoked members cannot issue invoices', async () => {
      await assert.rejects(handlers.issueInvoice.run({ auth: clientAuth, data: { orderId: 'order-a' } }), error => error.code === 'permission-denied');
      await admin.doc('members/test-owner').update({ active: false });
      await assert.rejects(handlers.issueInvoice.run({ auth: ownerAuth, data: { orderId: 'order-a' } }), error => ['permission-denied','unauthenticated'].includes(error.code));
    });
  } finally { await environment.cleanup(); }
});
