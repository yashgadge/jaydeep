async page=>{
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>window.dispatchEvent(new Event('mvm-replay-intro')));
 await page.waitForFunction(()=>document.querySelector('[data-opening-beat="2"]'));
 await page.waitForTimeout(650);await page.screenshot({path:'output/playwright/live-intro-name.png'});
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.locator('.agency-header-book').click();await page.waitForSelector('.page-transition');
 if(await page.locator('.page-transition img,.page-transition-wall').count())throw Error('Unexpected gallery transition');
 await page.waitForURL('**/billing?intent=shoot');await page.waitForSelector('.page-transition',{state:'detached'});
 await page.screenshot({path:'output/playwright/live-client-entry.png'});
 await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.setViewportSize({width:390,height:844});
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,brands:document.querySelectorAll('.managed-brand-logo-card').length}));
 await page.screenshot({path:'output/playwright/live-mobile-home.png'});
 await page.evaluate(r=>window.__liveCheck=r,result);
 if(result.overflow||result.brokenImages)throw Error('Live layout failed');
}
