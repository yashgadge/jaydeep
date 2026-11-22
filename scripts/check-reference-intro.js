async page=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>window.dispatchEvent(new Event('mvm-replay-intro')));
 await page.waitForFunction(()=>document.querySelector('[data-opening-beat="2"]'));
 await page.waitForTimeout(650);
 await page.screenshot({path:'output/playwright/reference-intro-name.png'});
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.waitForTimeout(500);
 await page.screenshot({path:'output/playwright/reference-intro-desktop.png'});
 const desktop=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,title:document.querySelector('.agency-title-word').textContent,skip:!!document.querySelector('.agency-opening-skip')}));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.dispatchEvent(new Event('mvm-replay-intro')));
 await page.waitForFunction(()=>document.querySelector('[data-opening-beat="3"]'));
 await page.screenshot({path:'output/playwright/reference-intro-mobile-title.png'});
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.waitForTimeout(500);
 const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,titleWidth:document.querySelector('.agency-title-word').getBoundingClientRect().width}));
 await page.screenshot({path:'output/playwright/reference-intro-mobile.png'});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>window.dispatchEvent(new Event('mvm-replay-intro')));
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.evaluate(result=>window.__introCheck=result,{desktop,mobile,reduced:true});
 if(desktop.overflow||mobile.overflow||desktop.skip)throw new Error('Intro layout failed');
}
