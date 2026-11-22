export type PublicEntry={id:string;[key:string]:any};
export type PublicWebsite={services:PublicEntry[];content:PublicEntry[];contacts:Record<string,string>;publishedAtISO:string};
let pending:Promise<PublicWebsite>|undefined;
let loadedAt=0;
// A single shared request replaces three independent Firestore subscriptions.
// HTTP cache handles repeat visits; an open tab refreshes only after five minutes.
export function loadPublicWebsite():Promise<PublicWebsite>{
 if(pending&&Date.now()-loadedAt<300000)return pending;
 loadedAt=Date.now();
 const read=async(url:string)=>{
  const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Published website unavailable');
  const value=await response.json();
  if(!Array.isArray(value.services)||!Array.isArray(value.content)||!value.contacts)throw new Error('Invalid publication');
  return value as PublicWebsite;
 };
 pending=read('/api/public-website').catch(()=>read('/content/website.json')).catch(error=>{pending=undefined;throw error;});
 return pending;
}
