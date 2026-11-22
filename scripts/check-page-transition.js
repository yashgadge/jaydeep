async page=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.waitForFunction(()=>!document.querySelector('[data-opening-active="true"]'));
 const before=await page.evaluate(()=>performance.timeOrigin);
 await page.locator('.agency-header-book').click();
 await page.waitForSelector('.page-transition');
 if(await page.locator('.page-transition img, .page-transition-wall').count())throw new Error('Transition contains an unwanted photo grid');
 await page.waitForTimeout(180);await page.screenshot({path:'output/playwright/page-transition-early.png'});
 await page.waitForTimeout(180);await page.screenshot({path:'output/playwright/page-transition-expansion.png'});
 await page.waitForTimeout(200);await page.screenshot({path:'output/playwright/page-transition-ivory.png'});
 await page.waitForURL('**/billing?intent=shoot');
 await page.waitForSelector('.page-transition',{state:'detached',timeout:20000});
 const arrival=await page.evaluate(()=>({url:location.pathname+location.search,timeOrigin:performance.timeOrigin,unlocked:document.documentElement.style.overflow!=='hidden',inert:document.querySelector('.route-page').inert,focused:document.activeElement?.tagName,theme:document.documentElement.dataset.routeTheme}));
 if(arrival.timeOrigin!==before||!arrival.unlocked||arrival.inert||arrival.theme!=='light')throw new Error('Transition arrival did not finish correctly: '+JSON.stringify(arrival));
 await page.screenshot({path:'output/playwright/page-transition-arrival.png'});
 await page.goBack();await page.waitForURL('http://127.0.0.1:4173/');
 await page.waitForFunction(()=>!document.querySelector('[data-opening-active="true"]'));
 await page.locator('.agency-prominent-login').click();await page.waitForURL('**/billing');await page.waitForSelector('.page-transition',{state:'detached'});
 const login=await page.evaluate(()=>({path:location.pathname,intent:new URLSearchParams(location.search).get('intent'),unlocked:document.documentElement.style.overflow!=='hidden'}));
 await page.goBack();await page.waitForURL('http://127.0.0.1:4173/');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.agency-header-book').click();await page.waitForURL('**/billing?intent=shoot');
 const reduced=await page.evaluate(()=>({animated:!!document.querySelector('.page-transition'),theme:document.documentElement.dataset.routeTheme}));
 if(reduced.animated)throw new Error('Reduced motion unexpectedly animated');
 await page.evaluate(result=>{window.__pageTransitionResult=result;},{sameDocument:true,arrival,login,reduced});
}
