const test = require('node:test');
const assert = require('node:assert/strict');
const { financialYear, validateSettings, buildInvoice } = require('../invoice-domain.cjs');

// Isolated unit fixtures only; never imported by the application or written to Firebase.
const settings = () => validateSettings({
  businessName: 'Test issuer', address: 'Test address', phone: 'Test phone',
  prefix: 'MVM', accent: '#c81d38', documentTitle: 'Invoice', bypassEnabled: true,
});
const order = () => ({
  clientUid: 'test-client', client: { name: 'Test client' }, title: 'Test order',
  items: [{ description: 'Reels', quantity: 3, unitPaise: 125050 }, { description: 'Images', quantity: 7, unitPaise: 1050 }],
  paymentMode: 'online', paidPaise: 100000,
});
const issue = (value, config = settings()) => buildInvoice(value, config, 'test-number', '2026-11-18T12:00:00.000Z');

test('integer-paise totals retain exact amounts and account for actual advance', () => {
  const result = issue(order());
  assert.equal(result.totalPaise, 382500);
  assert.equal(result.balancePaise, 282500);
  assert.equal(result.paymentStatus, 'Partially paid');
});
test('bypass produces zero billed values without fabricating a payment or destroying agreed value', () => {
  const value = { ...order(), paymentMode: 'bypass', paidPaise: 0 };
  const result = issue(value);
  assert.equal(result.totalPaise, 0);
  assert.equal(result.paidPaise, 0);
  assert.equal(result.balancePaise, 0);
  assert.equal(result.agreedTotalPaise, 382500);
  assert.equal(result.paymentStatus, 'No charge');
  assert.ok(result.items.every(line => line.unitPaise === 0 && line.linePaise === 0));
  assert.equal(value.items[0].unitPaise, 125050);
});
test('disabled bypass and bypass of already-paid orders are rejected', () => {
  assert.throws(() => issue({ ...order(), paymentMode: 'bypass', paidPaise: 0 }, { ...settings(), bypassEnabled: false }), /disabled/);
  assert.throws(() => issue({ ...order(), paymentMode: 'bypass' }), /recorded payments/);
});
test('missing payment does not silently become a paid order', () => {
  const value = order(); delete value.paidPaise;
  assert.equal(issue(value).paymentStatus, 'Unpaid');
  assert.equal(issue(value).balancePaise, 382500);
});
test('reject invalid, negative, fractional, overflowing and excessive values', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, 100_000_001]) {
    assert.throws(() => issue({ ...order(), items: [{ description: 'x', quantity: 1, unitPaise: invalid }] }));
  }
  for (const quantity of [0, -1, 1.5, 10001]) {
    assert.throws(() => issue({ ...order(), items: [{ description: 'x', quantity, unitPaise: 100 }] }));
  }
  assert.throws(() => issue({ ...order(), paidPaise: 382501 }), /exceed/);
});
test('financial-year rollover uses India time including UTC boundary', () => {
  assert.equal(financialYear('2026-03-31T18:29:59.000Z'), '2025-26');
  assert.equal(financialYear('2026-03-31T18:30:00.000Z'), '2026-27');
});
test('business identity is snapshotted and prefix cannot inject document separators', () => {
  const config = settings(); const result = issue(order(), config);
  config.address = 'Changed address';
  assert.equal(result.business.address, 'Test address');
  assert.throws(() => validateSettings({ ...settings(), prefix: '../MVM' }));
  assert.throws(() => validateSettings({ ...settings(), logoUrl: 'javascript:alert(1)' }));
});
