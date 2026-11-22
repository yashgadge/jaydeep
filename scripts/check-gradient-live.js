async page=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 await page.locator('.agency-header-book').click();await page.waitForSelector('.page-transition-surface');
 const result=await page.evaluate(()=>{const e=document.querySelector('.page-transition-surface'),s=getComputedStyle(e);return {gradient:s.backgroundImage.includes('linear-gradient'),transform:s.transform,backgroundSize:s.backgroundSize};});
 if(!result.gradient||result.transform!=='none')throw Error('Old box transition still deployed');
 await page.waitForURL('**/billing?intent=shoot');await page.waitForSelector('.page-transition',{state:'detached'});
 await page.evaluate(r=>window.__gradientLive=r,result);
}
