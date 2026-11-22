const assert=require('node:assert/strict');
function database(seed={}){
 const values=new Map(Object.entries(seed));let sequence=0;
 const snap=ref=>({ref,id:ref.id,exists:values.has(ref.path),data:()=>values.get(ref.path)});
 const doc=path=>({path,id:path.split('/').at(-1),get:async()=>snap(doc(path))});
 const query=(path,after=null,max=100,conditions=[])=>({where:(field,op,value)=>{assert.equal(op,'==');return query(path,after,max,[...conditions,[field,value]]);},doc:()=>doc(`${path}/auto-${++sequence}`),orderBy:()=>query(path,after,max,conditions),startAfter:v=>query(path,typeof v==='string'?v:v.id,max,conditions),limit:n=>query(path,after,n,conditions),get:async()=>{const docs=[...values.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===2&&conditions.every(([field,value])=>values.get(k)?.[field]===value)).sort().filter(k=>!after||k.split('/').at(-1)>after).slice(0,max).map(k=>snap(doc(k)));return{docs,size:docs.length};}});
 const db={doc,collection:path=>query(path),getAll:async(...refs)=>refs.map(snap),runTransaction:async fn=>{const pending=[];let wrote=false;const tx={get:async ref=>{assert.equal(wrote,false,'Firestore reads must precede writes');return snap(ref);},create:(ref,v)=>{wrote=true;assert.ok(!values.has(ref.path));pending.push([ref.path,v]);},set:(ref,v)=>{wrote=true;pending.push([ref.path,v]);},update:(ref,v)=>{wrote=true;assert.ok(values.has(ref.path));pending.push([ref.path,{...values.get(ref.path),...v}]);}};const result=await fn(tx);for(const [key,value]of pending)values.set(key,value);return result;}};return{db,values};
}
module.exports={database};
