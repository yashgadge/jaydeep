// Read-only check through the same published-content query used by the site.
(async()=>{
 const url='https://firestore.googleapis.com/v1/projects/m-v-ml/databases/(default)/documents:runQuery';
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'publicContent'}],where:{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'published'},op:'EQUAL',value:{booleanValue:true}}},{fieldFilter:{field:{fieldPath:'kind'},op:'EQUAL',value:{stringValue:'handle'}}}]}},orderBy:[{field:{fieldPath:'sortOrder'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:24}})});
 if(!response.ok)throw new Error('Public query failed: '+response.status);
 const docs=(await response.json()).filter(row=>row.document).map(row=>row.document.fields);
 const summary=[];for(const f of docs){const image=await fetch(f.imageUrl.stringValue,{method:'HEAD'});if(!image.ok)throw new Error('Logo unavailable: '+f.title.stringValue);summary.push({name:f.title.stringValue,followers:f.followers?.integerValue??null,followersAsOf:f.followersAsOf?.stringValue??'',accountViews:f.accountViews?.integerValue??null,logoStatus:image.status});}
 console.log(JSON.stringify({publicBrands:summary.length,brands:summary},null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
