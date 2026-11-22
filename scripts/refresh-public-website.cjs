// Explicit pre-deploy refresh. Ordinary builds remain offline and deterministic.
const fs=require('node:fs');
const {publicWebsite}=require('../functions/public-website.cjs');
const decode=v=>'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields??{}).map(([k,v])=>[k,decode(v)])):'arrayValue'in v?(v.arrayValue.values??[]).map(decode):'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'nullValue'in v?null:v.stringValue??'';
(async()=>{
 const response=await fetch('https://firestore.googleapis.com/v1/projects/m-v-ml/databases/(default)/documents/publicWebsite/live',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Unable to refresh public website snapshot: '+response.status);
 const doc=await response.json(),publication=publicWebsite(decode({mapValue:{fields:doc.fields}}));
 fs.mkdirSync('public/content',{recursive:true});fs.writeFileSync('public/content/website.json',JSON.stringify(publication));
 console.log(JSON.stringify({services:publication.services.length,brands:publication.content.filter(v=>v.kind==='handle').length,reels:publication.content.filter(v=>v.kind==='portfolio').length,bytes:Buffer.byteLength(JSON.stringify(publication))}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
