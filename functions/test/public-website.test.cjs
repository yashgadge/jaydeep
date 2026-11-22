const {test}=require('node:test');
const assert=require('node:assert/strict');
const {publicWebsite,websiteHandler}=require('../public-website.cjs');
const response=()=>({headers:{},code:200,body:null,set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},send(body){this.body=body;return this;},json(body){this.body=body;return this;},end(){return this;}});
test('public cache exposes published fields only, never private or draft data',()=>{
 const result=publicWebsite({services:[{id:'ok',published:true,title:'Public',internalNotes:'PRIVATE',clientUid:'PRIVATE'},{id:'draft',published:false},{id:'old',published:true,archived:true}],content:[{id:'reel',published:true,kind:'portfolio',videoUrl:'https://example.test/video.mp4',privateNotes:'PRIVATE'}],contacts:{phone:'123',bankAccount:'PRIVATE'},secret:'PRIVATE'});
 assert.equal(result.services.length,1);assert.equal(result.content.length,1);assert.equal(result.content[0].videoUrl,'https://example.test/video.mp4');assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('publication responds with shared CDN caching and conditional ETag',async()=>{
 let reads=0;const handler=websiteHandler({doc:path=>{assert.equal(path,'publicWebsite/live');return{get:async()=>{reads++;return{exists:true,data:()=>({services:[],content:[],contacts:{}})};}};}});
 const first=response();await handler({method:'GET',get:()=>null},first);assert.equal(first.code,200);assert.match(first.headers['Cache-Control'],/s-maxage=300/);
 const second=response();await handler({method:'GET',get:()=>first.headers.ETag},second);assert.equal(second.code,304);assert.equal(second.body,null);
 const denied=response();await handler({method:'POST'},denied);assert.equal(denied.code,405);assert.equal(reads,2);
});
test('publication errors are not cached as successful empty content',async()=>{
 const handler=websiteHandler({doc:()=>({get:async()=>{throw new Error('database unavailable');}})}),out=response();await handler({method:'GET'},out);assert.equal(out.code,503);assert.equal(out.headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(out.body).includes('database'));
});
