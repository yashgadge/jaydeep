async page=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:4173/#top');await page.waitForFunction(()=>!document.querySelector('[data-opening-active="true"]'));
 const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 await page.locator('.agency-hero-buttons .agency-button-light').click();await page.waitForSelector('.page-transition');
 await page.waitForTimeout(330);await page.screenshot({path:'output/playwright/page-transition-mobile-expansion.png'});
 await page.waitForURL('**/billing?intent=shoot');await page.waitForSelector('.page-transition',{state:'detached'});
 const mobile=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,unlocked:document.documentElement.style.overflow!=='hidden',sameTimeOrigin:performance.timeOrigin}));
 if(mobile.overflow||!mobile.unlocked||mobile.sameTimeOrigin!==timeOrigin)throw new Error('Mobile transition failed');
 await page.screenshot({path:'output/playwright/page-transition-mobile-arrival.png'});
 await page.goBack();await page.waitForURL('**/#top');
 await page.locator('.agency-hero-buttons .agency-button-outline').click();await page.waitForSelector('.page-transition');
 // Back during the outgoing animation must cancel the pending destination.
 await page.goBack();const interruptedURL=page.url();await page.waitForTimeout(1700);
 const interrupted=await page.evaluate(()=>({overlay:!!document.querySelector('.page-transition'),inert:document.querySelector('.route-page').inert,unlocked:document.documentElement.style.overflow!=='hidden'}));
 if(page.url()!==interruptedURL||interrupted.overlay||interrupted.inert||!interrupted.unlocked)throw new Error('Interrupted navigation left a stuck overlay');
 await page.evaluate(result=>{window.__pageTransitionMobile=result;},{mobile,interrupted});
}
