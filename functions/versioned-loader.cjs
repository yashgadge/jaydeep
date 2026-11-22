// Bounded, instance-local reuse. Every call checks database invalidation markers;
// permission checks must happen before invoking the loader.
function versionedLoader(readVersion,load,{maxAgeMs=30000,now=Date.now}={}){
 let cached;
 return async()=>{
  const version=await readVersion(),time=now();
  if(cached&&cached.version===version&&time<cached.until)return cached.promise;
  const entry={version,until:time+maxAgeMs,promise:Promise.resolve().then(load)};
  cached=entry;
  try{return await entry.promise;}catch(error){if(cached===entry)cached=undefined;throw error;}
 };
}
module.exports={versionedLoader};
