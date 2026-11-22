const {createHash}=require('node:crypto');
// Only the existing public publication is exposed. Never query private collections.
function publicWebsite(value={}) {
 const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
 const published=(rows,keys)=>Array.isArray(rows)?rows.filter(row=>row&&row.published===true&&!row.archived).map(row=>pick(row,keys)):[];
 return {
  services:published(value.services,['id','title','description','flow','sortOrder','quoteOnly','pricePaise','advancePaise','inclusions','deliveryEstimate']),
  content:published(value.content,['id','kind','title','body','url','imageUrl','videoUrl','sortOrder','instagramHandle','displayMode','followers','followersAsOf','accountViews','viewsPeriod','viewsAsOf']),
  contacts:pick(value.contacts??{},['phone','secondaryPhone','instagram']),
  publishedAtISO:typeof value.publishedAtISO==='string'?value.publishedAtISO:''
 };
}
function websiteHandler(db) {
 return async (request,response)=>{
  if(!['GET','HEAD'].includes(request.method))return response.set('Allow','GET, HEAD').set('Cache-Control','no-store').status(405).end();
  try {
   const snapshot=await db.doc('publicWebsite/live').get();
   if(!snapshot.exists)return response.set('Cache-Control','no-store').status(503).json({error:'Publication unavailable'});
   const body=JSON.stringify(publicWebsite(snapshot.data())),etag='"'+createHash('sha256').update(body).digest('hex')+'"';
   response.set('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=60');
   response.set('ETag',etag).set('Content-Type','application/json; charset=utf-8').set('X-Content-Type-Options','nosniff');
   if(request.get('If-None-Match')===etag)return response.status(304).end();
   return response.status(200).send(request.method==='HEAD'?'':body);
  } catch {
   return response.set('Cache-Control','no-store').status(503).json({error:'Publication temporarily unavailable'});
  }
 };
}
module.exports={publicWebsite,websiteHandler};
