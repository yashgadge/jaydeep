async page=>{
 await page.route('**/src/operations/api.ts',route=>route.fulfill({contentType:'application/javascript',body:`export const failureText=e=>e.message;export async function call(name,input){window.__calls??=[];window.__calls.push({name,input});if(name==='createCashfreeCheckout')return {gatewayOrderId:'mvm_'+'a'.repeat(40),paymentSessionId:'fixture-session',environment:'production'};return {status:window.__paymentState||'ACTIVE',environment:'production',recorded:window.__paymentState==='PAID'};}`}));
 await page.route('https://sdk.cashfree.com/js/v3/cashfree.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Cashfree=options=>{window.__sdkMode=options.mode;return {checkout:async opts=>{window.__sdkOptions=opts;return window.__sdkFailure?{error:{message:"Website domain not approved"}}:undefined;}};};`}));
 await page.goto('http://127.0.0.1:4175/output/cashfree-ui.html');await page.getByRole('button',{name:'Pay with Cashfree'}).waitFor();
 if(await page.evaluate(()=>window.__calls?.length||0))throw Error('Unexpected eager API request');
 await page.getByRole('button',{name:'Pay with Cashfree'}).click();await page.getByRole('status').filter({hasText:'not been confirmed'}).waitFor();
 await page.evaluate(()=>window.__paymentState='PAID');await page.getByRole('button',{name:'Check payment status'}).click();await page.getByRole('status').filter({hasText:'Payment verified'}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/playwright/cashfree-normal-payment-ui.png'});
 const result=await page.evaluate(()=>({calls:window.__calls,sdkMode:window.__sdkMode,sdkOptions:window.__sdkOptions,overflow:document.documentElement.scrollWidth>innerWidth}));
 if(result.overflow||result.sdkOptions.paymentSessionId!=='fixture-session'||result.calls[0].input.portion!=='advance')throw Error('Payment UI check failed');
 await page.reload();await page.getByRole('button',{name:'Pay with Cashfree'}).waitFor();await page.evaluate(()=>window.__sdkFailure=true);await page.getByRole('button',{name:'Pay with Cashfree'}).click();await page.getByRole('alert').filter({hasText:'Website domain not approved'}).waitFor();
 await page.evaluate(r=>window.__cashfreeUI={...r,checkoutErrorVisible:true},result);
}
