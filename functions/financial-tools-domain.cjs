const {integer,string}=require('./operations-domain.cjs');
const {dateSlot,indiaDay}=require('./studio-domain.cjs');
function day(value,label){dateSlot(value,'morning');if(value<'2000-01-01'||value>indiaDay())throw new Error(`Choose a past or current ${label}`);return value;}
function manualInput(data){
 if(data.confirmReceived!==true)throw new Error('Confirm that this money was actually received');
 const amountPaise=integer(data.amountPaise,1,100000000,'received amount');
 const method=string(data.method,'payment method',10,true);if(!['cash','upi','bank'].includes(method))throw new Error('Choose cash, UPI or bank transfer');
 const reference=string(data.reference??'','payment reference',150,method!=='cash');
 const value={existingOrderId:string(data.existingOrderId??'','existing order',128),clientId:string(data.clientId??'','client',128),title:string(data.title??'','shoot description',200),shootDate:data.shootDate??'',location:string(data.location??'','location',700),totalPaise:data.totalPaise??0,amountPaise,method,reference,receivedDate:day(data.receivedDate,'payment date'),notes:string(data.notes??'','notes',1000)};
 if(!value.existingOrderId){if(!value.clientId||!value.title)throw new Error('Choose a client and enter the completed shoot description');day(value.shootDate,'shoot date');integer(value.totalPaise,amountPaise,100000000,'shoot total');}
 return value;
}
function filters(data={}){
 const value={search:string(data.search??'','search',150).toLowerCase(),from:data.from??'',to:data.to??'',clientId:string(data.clientId??'','client',128),dateField:data.dateField??'issued',documentType:data.documentType??'all'};
 for(const date of[value.from,value.to])if(date)dateSlot(date,'morning');
 if(value.from&&value.to&&value.from>value.to)throw new Error('Start date must precede end date');
 if(!['issued','shoot'].includes(value.dateField)||!['all','invoice','receipt','refund','payment_request','cancellation'].includes(value.documentType))throw new Error('Invalid document filter');
 return value;
}
function matches(d,f){const day=f.dateField==='shoot'?d.shootDate:d.issuedAt?indiaDay(Date.parse(d.issuedAt)):'';return(!f.from||day>=f.from)&&(!f.to||day&&day<=f.to)&&(!f.clientId||d.contactId===f.clientId||d.clientUid===f.clientId)&& (f.documentType==='all'||d.documentType===f.documentType)&&(!f.search||[d.number,d.orderId,d.orderPublicId,d.project,d.client?.name,d.client?.email,d.client?.phone].some(v=>String(v??'').toLowerCase().includes(f.search)));}
function canRead(record,uid,role){return!!record&&(record.clientUid===uid||!!(role?.active&&(role.owner||role.invoiceManage||role.paymentsManage)));}
module.exports={manualInput,filters,matches,canRead};
