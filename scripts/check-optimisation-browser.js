async (page) => {
  await page.waitForFunction(() => document.querySelectorAll('.managed-brand-logo-card').length === 5);
  const result = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    return {
      brands: document.querySelectorAll('.managed-brand-logo-card').length,
      reelImages: document.querySelectorAll('.mvm-reel-depth img').length,
      firebaseRequests: resources.map(r=>r.name).filter(n=>/firestore.googleapis|firebaseappcheck|recaptcha|firebase-auth/.test(n)),
      videoDownloads: resources.map(r=>r.name).filter(n=>/\.mp4/.test(n)),
      contentRequests: resources.map(r=>r.name).filter(n=>/public-website|website.json/.test(n)),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      scripts: resources.filter(r=>r.initiatorType==='script').map(r=>({url:r.name,bytes:r.encodedBodySize})),
    };
  });
  await page.evaluate(result=>{window.__mvmPerformance=result;},result);
  await page.screenshot({path:'output/playwright/optimised-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'output/playwright/optimised-mobile.png',fullPage:false});
  await page.evaluate(()=>{window.__mvmPerformance.mobile={width:innerWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,brokenLoadedImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)};});
}
