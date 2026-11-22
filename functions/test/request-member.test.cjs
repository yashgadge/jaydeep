const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rememberMember,memberSnapshot}=require('../request-member.cjs');
test('member reads are reused within a request, never between requests for the same UID',async()=>{
 let reads=0;const db={doc:()=>({get:async()=>{reads++;return{data:()=>({active:false})};}})};
 const first=rememberMember({uid:'same-user'},{data:()=>({active:true,owner:true})});
 assert.equal((await memberSnapshot(db,first)).data().owner,true);assert.equal((await memberSnapshot(db,first)).data().active,true);assert.equal(reads,0);
 assert.equal((await memberSnapshot(db,{uid:'same-user'})).data().active,false);assert.equal(reads,1);
 const next=rememberMember({uid:'same-user'},{data:()=>({active:false})});assert.equal((await memberSnapshot(db,next)).data().active,false);
});
