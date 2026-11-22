const {lookup}=require('node:dns/promises');
const https=require('node:https');
const {isIP}=require('node:net');
function publicAddress(address){if(isIP(address)===4){const p=address.split('.').map(Number);return !(p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===198&&[18,19].includes(p[1]));}return isIP(address)===6&&/^[23]/i.test(address);}
// Fetch only a small raster logo, with DNS pinned to a public address. Chromium itself has no network access.
async function logoData(url){
 if(!url)return'';try{const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||target.port&&target.port!=='443')return'';
 const addresses=await lookup(target.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return'';const chosen=addresses[0];
 return await new Promise(resolve=>{const req=https.get(target,{lookup:(_host,opts,callback)=>opts.all?callback(null,[chosen]):callback(null,chosen.address,chosen.family),timeout:5000},response=>{const type=String(response.headers['content-type']??'').split(';')[0];if(response.statusCode!==200||!['image/png','image/jpeg','image/webp'].includes(type)){response.resume();resolve('');return;}const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>1000000){req.destroy();resolve('');}else chunks.push(chunk);});response.on('end',()=>resolve(`data:${type};base64,${Buffer.concat(chunks).toString('base64')}`));response.on('error',()=>resolve(''));});req.on('timeout',()=>{req.destroy();resolve('');});req.on('error',()=>resolve(''));});
 }catch{return'';}
}
async function renderMany(records){
 const {default:puppeteer}=await import('puppeteer-core');
 const local=process.env.MVM_PDF_CHROME_PATH;
 if(process.platform!=='linux'&&!local)throw new Error('Set MVM_PDF_CHROME_PATH to a local Chrome executable for PDF tests');
 const {default:chromium}=local?{default:null}:await import('@sparticuz/chromium');if(chromium)chromium.setGraphicsMode=false;
 const browser=await puppeteer.launch({executablePath:local||await chromium.executablePath(),headless:local?true:'shell',args:local?['--disable-gpu']:chromium.args,defaultViewport:{width:900,height:1200,deviceScaleFactor:1}});
 try{
  const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setRequestInterception(true);
  page.on('request',request=>{if(request.url().startsWith('data:')||request.url()==='about:blank')void request.continue();else void request.abort();});
  await page.emulateMediaType('print');const output=[],logos=new Map();
  for(const record of records){const url=record.business.logoUrl??'';if(!logos.has(url))logos.set(url,await logoData(url));const printable={...record,business:{...record.business,logoUrl:logos.get(url)}};
   await page.setContent(require('./generated/invoice-html.cjs').invoiceHtml(printable),{waitUntil:'load',timeout:15000});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));});
   output.push(Buffer.from(await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,tagged:true,timeout:30000})));
  }return output;
 }finally{await browser.close();}
}
module.exports=async record=>(await renderMany([record]))[0];
module.exports.renderMany=renderMany;
module.exports.publicAddress=publicAddress;
