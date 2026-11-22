async page=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:4173/#top');await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 const results=[];
 for(const [label,selector,width,height] of [['desktop-header-book','.agency-header-book',1440,1000],['desktop-hero-login','.agency-hero-buttons .agency-button-outline',1440,1000],['mobile-header-login','.agency-prominent-login',390,844],['mobile-hero-book','.agency-hero-buttons .agency-button-light',390,844]]){
  await page.setViewportSize({width,height});const button=page.locator(selector);await button.scrollIntoViewIfNeeded();
  const box=await button.boundingBox(),timeOrigin=await page.evaluate(()=>performance.timeOrigin);
  await button.click();await page.waitForSelector('.page-transition circle');
  const origin=await page.evaluate(()=>{const circle=document.querySelector('.page-transition circle');const a=circle.getAnimations()[0];a.pause();a.currentTime=280;return {x:Number(circle.getAttribute('cx')),y:Number(circle.getAttribute('cy')),radius:parseFloat(getComputedStyle(circle).r),pageTransform:getComputedStyle(document.querySelector('.route-page')).transform};});
  if(Math.abs(origin.x-(box.x+box.width/2))>1||Math.abs(origin.y-(box.y+box.height/2))>1||origin.radius<40||origin.pageTransform!=='none')throw Error('Incorrect transition origin or page shift: '+JSON.stringify(origin));
  await page.screenshot({path:'output/playwright/origin-'+label+'.png'});
  await page.evaluate(()=>document.querySelector('.page-transition circle').getAnimations()[0].play());
  await page.waitForURL('**/billing*');await page.waitForSelector('.page-transition',{state:'detached'});
  const arrival=await page.evaluate(()=>({sameDocument:performance.timeOrigin,unlocked:document.documentElement.style.overflow!=='hidden',inert:document.querySelector('.route-page').inert,handoffClass:document.documentElement.classList.contains('mvm-route-handoff'),overflow:document.documentElement.scrollWidth>innerWidth}));
  if(arrival.sameDocument!==timeOrigin||!arrival.unlocked||arrival.inert||arrival.handoffClass||arrival.overflow)throw Error('Arrival cleanup failed');
  results.push({label,origin,arrival});await page.goBack();await page.waitForFunction(()=>document.querySelector('[data-opening-active="false"]'));
 }
 await page.evaluate(r=>window.__buttonOrigin=r,results);
}
