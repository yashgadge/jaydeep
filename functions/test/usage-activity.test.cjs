const {test}=require('node:test'),assert=require('node:assert/strict');
const {activityRow}=require('../usage-activity-domain.cjs');
test('audit rows keep unique event IDs when several events refer to the same booking request',()=>{
 const rows=['event-1','event-2'].map(id=>activityRow({id,data:()=>({id:'same-request',action:'enquiry.updated',atISO:'2026-11-19T00:00:00Z'})}));
 assert.deepEqual(rows.map(r=>r.id),['event-1','event-2']);assert.equal(rows[0].entityId,'same-request');assert.equal(rows[1].entityId,'same-request');
});
test('usage is owner-only and explicitly returns a bounded fresh snapshot',async()=>{
 const reads=[];let role={active:true,owner:true};
 const docs={
  'mapsUsage/day-2026-11-19':{count:3},
 };
 const db={doc:key=>({get:async()=>{reads.push(key);return{data:()=>key.startsWith('members/')?role:key.startsWith('mapsUsage/day-')?{count:3}:key.startsWith('mapsUsage/month-')?{count:9}:docs[key]};}}),collection:key=>{assert.equal(key,'operationsAudit');return{orderBy:(field,direction)=>{assert.equal(field,'atISO');assert.equal(direction,'desc');return{limit:n=>{assert.equal(n,50);return{get:async()=>{reads.push(key);return{docs:[{id:'log-1',data:()=>({id:'request-1',action:'enquiry.created'})}]};}};}};}};}};
 const api=require('../studio-extras.cjs')({db,identity:async r=>r.auth,rateLimit:async()=>{},options:{region:'asia-south1'}});
 const before=Date.now(),result=await api.getStudioUsage.run({auth:{uid:'owner'},data:{}});assert.equal(result.mapsDay,3);assert.equal(result.mapsMonth,9);assert.equal(result.audit[0].id,'log-1');assert.ok(Date.parse(result.loadedAtISO)>=before);assert.equal(reads.filter(k=>k==='operationsAudit').length,1);
 role={active:true,ordersManage:true};const count=reads.length;await assert.rejects(api.getStudioUsage.run({auth:{uid:'staff'},data:{}}),{code:'permission-denied'});assert.deepEqual(reads.slice(count),['members/staff']);
});
