async page=>{
 await page.waitForSelector('#usage-activity-heading');
 const initial=await page.evaluate(()=>window.__activityCalls);
 await page.mouse.wheel(0,1200);await page.waitForTimeout(400);
 const scrolled=await page.evaluate(()=>window.__activityCalls);
 if(initial!==0||scrolled!==0)throw new Error('Activity loaded before explicit button press');
 await page.getByRole('button',{name:'Load activity',exact:true}).click();
 await page.getByRole('button',{name:'Refresh activity',exact:true}).waitFor();
 const loaded=await page.evaluate(()=>window.__activityCalls);
 if(loaded!==1)throw new Error('First activity load made duplicate calls');
 await page.getByText('Booking request received',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Refresh activity',exact:true}).click();
 await page.getByRole('button',{name:'Refresh activity',exact:true}).waitFor();
 const refreshed=await page.evaluate(()=>window.__activityCalls);
 if(refreshed!==2)throw new Error('Manual refresh did not make exactly one request');
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
 await page.screenshot({path:'output/playwright/activity-on-demand-mobile.png',fullPage:true});
 if(mobile.overflow)throw new Error('Activity panel has horizontal overflow');
 await page.evaluate(result=>{window.__activityVerification=result;},{initial,scrolled,loaded,refreshed,mobile});
}
