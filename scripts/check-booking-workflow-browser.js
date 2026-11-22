async page=>{
 const mobile=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
 await page.screenshot({path:'output/playwright/booking-staff-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 const desktop=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
 await page.screenshot({path:'output/playwright/booking-staff-desktop.png',fullPage:true});
 await page.evaluate(result=>{window.__bookingLayout=result;},{mobile,desktop});
 if(mobile.overflow||desktop.overflow)throw new Error('Workflow page has horizontal overflow');
}
