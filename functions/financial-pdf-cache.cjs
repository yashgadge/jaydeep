const {getStorage}=require('firebase-admin/storage');
const {createHash}=require('node:crypto');
const VERSION='print-'+createHash('sha256').update(require('node:fs').readFileSync(require.resolve('./generated/invoice-html.cjs'))).digest('hex').slice(0,12);
async function store(ref,record,bytes,storage=getStorage()){const storagePath=`financial/${record.clientUid}/${ref.id}-${VERSION}.pdf`,file=storage.bucket().file(storagePath);try{await file.save(bytes,{resumable:false,contentType:'application/pdf',preconditionOpts:{ifGenerationMatch:0},metadata:{metadata:{sha256:createHash('sha256').update(bytes).digest('hex'),documentId:ref.id,renderer:VERSION}}});}catch(e){if(Number(e.code)!==412)throw e;}await ref.update({storagePath,pdfStatus:'stored',pdfVersion:VERSION,archivedAtISO:new Date().toISOString()});}
async function readCached(record,{storage}={}){if(record.pdfVersion!==VERSION||record.pdfStatus!=='stored'||!record.storagePath)return null;try{return(await(storage??getStorage()).bucket().file(record.storagePath).download())[0];}catch(e){if(Number(e.code)===404)return null;throw e;}}
async function ensureMany(entries,{storage,renderMany}={}){const buffers=new Array(entries.length),missing=[];for(let i=0;i<entries.length;i++){const bytes=await readCached(entries[i].record,{storage});if(bytes!==null){buffers[i]=bytes;continue;}missing.push(i);}
 if(missing.length){const rendered=await (renderMany??require('./pdf-document.cjs').renderMany)(missing.map(i=>entries[i].record));for(let n=0;n<missing.length;n++){const i=missing[n];buffers[i]=rendered[n];await store(entries[i].ref,entries[i].record,buffers[i],storage);}}
 return buffers;
}
async function ensure(ref,record){return(await ensureMany([{ref,record}]))[0];}
module.exports={VERSION,ensure,ensureMany,readCached};
