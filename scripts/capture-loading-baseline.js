async page=>{
 await page.waitForFunction(()=>document.querySelectorAll('.managed-brand-logo-card').length===5);
 await page.evaluate(()=>{
  const resources=performance.getEntriesByType('resource');
  window.__mvmBaseline={
   firebaseRequests:resources.filter(r=>/firestore.googleapis|firebaseappcheck|recaptcha/.test(r.name)).length,
   jsBytes:resources.filter(r=>r.name.includes('.js')).reduce((n,r)=>n+r.encodedBodySize,0),
   js:resources.filter(r=>r.name.includes('.js')).map(r=>({url:r.name,bytes:r.encodedBodySize})),
   videoDownloads:resources.filter(r=>r.name.includes('.mp4')).length
  };
 });
}
