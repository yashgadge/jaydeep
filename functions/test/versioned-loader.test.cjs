const {test}=require('node:test'),assert=require('node:assert/strict');
const {versionedLoader}=require('../versioned-loader.cjs');
test('ledger loader shares concurrent scans and reloads after database invalidation or TTL',async()=>{
 let version='first',time=0,scans=0,checks=0;
 const load=versionedLoader(async()=>{checks++;return version;},async()=>({scan:++scans}),{maxAgeMs:30,now:()=>time});
 const first=await Promise.all([load(),load(),load()]);assert.equal(scans,1);assert.deepEqual(first.map(v=>v.scan),[1,1,1]);
 version='payment-recorded';assert.equal((await load()).scan,2);
 time=31;assert.equal((await load()).scan,3);assert.equal(checks,5);
});
test('failed scans are not cached',async()=>{
 let scans=0;const load=versionedLoader(async()=>'same',async()=>{if(++scans===1)throw new Error('temporary');return'valid';});
 await assert.rejects(load(),/temporary/);assert.equal(await load(),'valid');assert.equal(scans,2);
});
