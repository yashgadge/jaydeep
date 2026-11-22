const test=require('node:test'),assert=require('node:assert/strict'),L=require('../legal-domain.cjs');
const profile={legalName:'Isolated test operator',businessAddress:'Test address',supportEmail:'support@example.invalid',grievanceName:'Test officer',grievanceEmail:'privacy@example.invalid',grievancePhone:'+919999999999'};
test('policy revisions change with contract rules and identity, and are stable for identical input',()=>{
 const first=L.publication(profile,{});assert.equal(first.profileComplete,true);assert.equal(first.revision,L.publication(profile,{}).revision);assert.notEqual(first.revision,L.publication(profile,{cancellationHours:48}).revision);assert.notEqual(first.revision,L.publication({...profile,legalName:'Changed operator'},{}).revision);assert.equal(first.sha256.length,64);assert.equal(L.publication({},{}).profileComplete,false);assert.equal(L.publication({...profile,grievancePhone:'invalid'},{}).profileComplete,false);
});
test('acceptance requires affirmative terms acknowledgement of the exact revision',()=>{
 const publication=L.publication(profile,{}),valid={adultConfirmed:true,legalAccepted:true,policyRevision:publication.revision};for(const data of [{},{...valid,legalAccepted:false},{...valid,policyRevision:'old'}])assert.throws(()=>L.acceptance(data,publication,'test-client'));
 const acceptance=L.acceptance(valid,publication,'test-client','2026-11-19T00:00:00Z');assert.equal(acceptance.acceptedBy,'test-client');assert.equal(acceptance.policySha256,publication.sha256);assert.match(acceptance.policyPath,/version=/);assert.equal(acceptance.marketingOptIn,undefined);assert.equal(acceptance.portfolioConsent,undefined);
});
test('public contact fields are validated and unknown/private fields are excluded',()=>{
 assert.throws(()=>L.cleanProfile({...profile,supportEmail:'invalid'}));const cleaned=L.cleanProfile({...profile,password:'never publish',internalNote:'private'});assert.equal(cleaned.password,undefined);assert.equal(cleaned.internalNote,undefined);
});

test('Removing the separate age checkbox does not fabricate an adult confirmation',()=>{const current=L.publication(profile,{});assert.equal(L.acceptance({legalAccepted:true,policyRevision:current.revision},current,'test-client').adultConfirmed,false);});
