// Bounded, read-only diagnosis; no credentials or client contact details are exported.
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../.npm-cache/_npx/ada49d693ef58c83/node_modules/firebase-tools/lib');
(async()=>{
 const auth=require(path.join(root,'auth.js')),options={project:'m-v-ml',nonInteractive:true},account=auth.getProjectDefaultAccount(path.resolve(__dirname,'..'));
 if(!account)throw new Error('No existing Firebase CLI login');auth.setActiveAccount(options,account);await require(path.join(root,'requireAuth.js')).requireAuth(options);
 const {Client}=require(path.join(root,'apiv2.js')),client=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'}),result={};
 for(const [kind,field,limit,fields]of[['operationsAudit','atISO',5,['action','atISO','publicId']],['orders','createdAtISO',2,['publicId','createdAtISO','status']],['enquiries','createdAtISO',2,['publicId','createdAtISO','status','orderId']]]){
  const response=await client.post('/projects/m-v-ml/databases/(default)/documents:runQuery',{structuredQuery:{from:[{collectionId:kind}],select:{fields:fields.map(fieldPath=>({fieldPath}))},orderBy:[{field:{fieldPath:field},direction:'DESCENDING'}],limit}});
  result[kind]=response.body.filter(row=>row.document).map(row=>Object.fromEntries(Object.entries(row.document.fields??{}).map(([key,value])=>[key,value.stringValue??value.integerValue??value.booleanValue??null])));
 }
 const report={checkedAt:new Date().toISOString(),...result};fs.writeFileSync(path.resolve(__dirname,'../output/recent-booking-activity-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
