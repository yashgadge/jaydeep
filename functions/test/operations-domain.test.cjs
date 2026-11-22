const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../operations-domain.cjs');
const settings=()=>({...D.DEFAULT_WHATSAPP_SETTINGS,enabled:true,marketingEnabled:true});
const contact={phone:'+919999999999',updatesOptIn:true,marketingOptIn:false};
const now=Date.parse('2026-11-18T09:00:00.000Z');
test('separate consent prevents promotion to clients who only requested order updates',()=>{
  assert.equal(D.recipientReason(contact,{category:'marketing'},settings(),{},now),'Consent not given');
  assert.equal(D.recipientReason(contact,{category:'utility'},settings(),{},now),'');
  assert.equal(D.recipientReason({...contact,marketingOptIn:true},{category:'marketing'},settings(),{blocked:true},now),'WhatsApp opted out');
});
test('service replies require a verified recent inbound message, not merely a login',()=>{
  assert.equal(D.recipientReason(contact,{category:'service'},settings(),{},now),'Customer-service window closed');
  assert.equal(D.recipientReason(contact,{category:'service'},settings(),{lastInboundAtMs:now-1000},now),'');
  assert.equal(D.recipientReason(contact,{category:'service'},settings(),{lastInboundAtMs:now-86400000},now),'Customer-service window closed');
});
test('frequency limits and zero per-client daily allowance apply to new and returning numbers',()=>{
  assert.equal(D.recipientReason(contact,{category:'utility'},{...settings(),perClientDailyLimit:0},{},now),'Client daily limit');
  assert.equal(D.recipientReason(contact,{category:'utility'},settings(),{lastSentAtMs:now-1000},now),'Update frequency limit');
  assert.equal(D.recipientReason({...contact,marketingOptIn:true},{category:'marketing'},settings(),{lastMarketingAtMs:now-86400000},now),'Promotional frequency limit');
  assert.equal(D.recipientReason(contact,{category:'utility'},settings(),{day:'2026-11-18',count:2},now),'Client daily limit');
});
test('filters use India dates and do not reinterpret a user search as a regular expression',()=>{
  const row={name:'A [Studio]',source:'registered',updatesOptIn:true,marketingOptIn:false,createdAtISO:'2026-11-17T20:00:00.000Z'};
  assert.equal(D.matches(row,D.validateFilters({search:'[Studio]',from:'2026-11-18',to:'2026-11-18',consent:'updates'})),true);
  assert.equal(D.matches(row,D.validateFilters({to:'2026-11-17'})),false);
  assert.throws(()=>D.validateFilters({from:'2026-12-01',to:'2026-11-01'}));
});
test('payment balances do not count bypass orders as income and reject corrupt amounts',()=>{
  const order={items:[{quantity:2,unitPaise:10000}],paymentMode:'offline',paidPaise:5000};
  assert.deepEqual(D.orderBalance(order),{totalPaise:20000,paidPaise:5000,balancePaise:15000});
  assert.deepEqual(D.orderBalance({...order,paymentMode:'bypass',paidPaise:0}),{totalPaise:0,paidPaise:0,balancePaise:0});
  assert.throws(()=>D.orderBalance({...order,paidPaise:20001}));
  assert.throws(()=>D.validateWhatsAppSettings({...settings(),monthlyBudgetPaise:-1}));
});
test('contact creation validates numbers and never infers consent',()=>{
  assert.equal(D.phone('99999 99999'),'+919999999999');
  assert.throws(()=>D.phone('not-a-phone'));
  assert.throws(()=>D.consent({}));
  assert.deepEqual(D.consent({updatesOptIn:false,marketingOptIn:false}),{updatesOptIn:false,marketingOptIn:false});
});
