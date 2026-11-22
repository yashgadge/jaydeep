const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const deadline=setTimeout(()=>{console.error('Invoice browser check timed out');process.exit(1);},90000);deadline.unref();
 console.log('Bundling browser invoice');
 const esbuild=require('esbuild');
 const build=await esbuild.build({entryPoints:['src/invoicing/invoiceHtml.tsx'],bundle:true,write:false,platform:'browser',format:'iife',globalName:'MVMInvoice',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},plugins:[{name:'raw-css',setup(b){b.onResolve({filter:/\.css\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.replace(/\?raw$/,'')),namespace:'raw-css'}));b.onLoad({filter:/.*/,namespace:'raw-css'},async args=>({contents:`export default ${JSON.stringify(fs.readFileSync(args.path,'utf8'))}`,loader:'js'}));}}]});
 const {default:puppeteer}=await import('../functions/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
 const browser=await puppeteer.launch({executablePath:process.env.MVM_PDF_CHROME_PATH,headless:true});
 console.log('Browser launched');
 const business={businessName:'Maharashtra Vision Media',address:'Test studio, Pune',phone:'+91 90000 00000',prefix:'TEST',accent:'#c81d38',documentTitle:'Invoice',footer:'TEST ONLY — NOT A VALID INVOICE',terms:'Sample terms'};
 const record={...require('../functions/invoice-domain.cjs').buildInvoice({clientUid:'test',client:{name:'Sample Client · नमुना ग्राहक',email:'test@example.test'},title:'Portraits · छायाचित्रण',shootDate:'2026-11-01',location:'Pune',plan:'3 reels · 50 photos',items:[{description:'3 reels and 50 edited photographs',quantity:1,unitPaise:200000}],paymentMode:'offline',paidPaise:50000},business,'TEST/2026-27/000001','2026-11-19T06:00:00Z'),orderId:'TEST-ORDER'};
 try{
  const page=await browser.newPage();await page.bringToFront();page.setDefaultTimeout(15000);await page.setViewport({width:900,height:1200,deviceScaleFactor:1});
  fs.writeFileSync('dist/__font-check.html','<!doctype html><html><body></body></html>');
  await page.goto('http://127.0.0.1:4173/__font-check.html');await page.addScriptTag({content:build.outputFiles[0].text});
  const html=await page.evaluate(record=>window.MVMInvoice.invoiceHtml(record),record);
  console.log('Browser HTML prepared');
  if(html.includes('data:font/'))throw new Error('Browser still embeds fonts');
  await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  console.log('External fonts ready');
  const fontState=await page.evaluate(()=>({inter:document.fonts.check('12px Inter'),devanagari:document.fonts.check('12px MVMDevanagari'),faces:[...document.fonts].map(f=>({family:f.family,status:f.status}))}));
  if(!fontState.inter||!fontState.devanagari||fontState.faces.length!==2||fontState.faces.some(f=>f.status!=='loaded'))throw new Error('Browser invoice fonts did not load: '+JSON.stringify(fontState));
  const measure=()=>[...document.querySelectorAll('.invoice-sheet, .invoice-sheet *')].map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height};});
  const actual=await page.evaluate(measure);console.log('External font layout measured');
  if(actual.length<30)throw new Error('Invoice document did not render');
  await page.setContent(require('../functions/generated/invoice-html.cjs').invoiceHtml(record));await page.evaluate(()=>document.fonts.ready);
  const embedded=await page.evaluate(measure);
  if(JSON.stringify(actual)!==JSON.stringify(embedded))throw new Error('Browser and embedded-font invoice layouts differ');
  const result={fontState,comparedElements:actual.length,layoutMatches:true};fs.writeFileSync('output/invoice-font-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();if(fs.existsSync('dist/__font-check.html'))fs.unlinkSync('dist/__font-check.html');}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
