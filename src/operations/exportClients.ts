import { call } from './api';
import type { Contact, Filters, Page } from './types';

export async function exportClients(filters:Filters, progress:(count:number)=>void, cancelled:()=>boolean) {
  const clients:Contact[] = [];
  let cursor:string|null = null;
  let scanned=0;
  do {
    if(cancelled()) throw new Error('Export cancelled. No file was downloaded.');
    const page:Page<Contact> = await call('listAdminRecords',{kind:'contacts',filters,cursor,forExport:true});
    scanned+=page.scanned;
    if(scanned>10000) throw new Error('This export exceeds 10,000 scanned records. Narrow the date range or filters; no partial file was downloaded.');
    clients.push(...page.rows); cursor=page.cursor; progress(clients.length);
  } while(cursor);
  if(cancelled()) throw new Error('Export cancelled.');
  const ExcelJS=await import('exceljs');
  const workbook=new ExcelJS.Workbook();
  workbook.creator='Maharashtra Vision Media'; workbook.created=new Date();
  const sheet=workbook.addWorksheet('Clients',{views:[{state:'frozen',ySplit:1}]});
  const columns:Array<[keyof Contact,string,number]>=[
    ['id','Client record ID',30],['clientUid','Registered user ID',30],['name','Name',25],['businessName','Business',25],['email','Email',32],['phone','WhatsApp number',20],['city','City',18],['address','Address',45],['instagram','Instagram',30],['serviceType','Service',24],['tags','Tags',28],['source','Source',15],['updatesOptIn','Order updates consent',22],['marketingOptIn','Promotional consent',22],['consentSource','Consent source',25],['consentAtISO','Consent last updated (UTC)',28],['consentEvidence','Recorded consent evidence',45],['createdAtISO','Added (UTC)',28],['updatedAtISO','Last updated (UTC)',28],['notes','Client notes',45],['publicId','Client tracking ID',27],
  ];
  sheet.columns=columns.map(([key,header,width])=>({key,header,width}));
  for(const client of clients) sheet.addRow(Object.fromEntries(columns.map(([key])=>[key,typeof client[key]==='boolean'?(client[key]?'Yes':'No'):String(client[key]??'')])));
  sheet.getRow(1).height=30;
  sheet.getRow(1).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF242A37'}};cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11};cell.alignment={vertical:'middle'};});
  sheet.eachRow((row,index)=>{if(index>1){row.alignment={vertical:'top',wrapText:true};row.eachCell(cell=>{cell.font={size:10};if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4F5F8'}};});}});
  sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:columns.length}};
  const scope=workbook.addWorksheet('Export scope');
  scope.columns=[{header:'Filter',key:'filter',width:30},{header:'Value',key:'value',width:65}];
  scope.addRow({filter:'Exported at (UTC)',value:new Date().toISOString()});
  scope.addRow({filter:'Matching clients',value:clients.length});
  for(const [filter,value]of Object.entries(filters))if(value)scope.addRow({filter,value});
  scope.addRow({filter:'Date filter',value:'Client added date, Asia/Kolkata. Message delivery and WhatsApp opt-out state are maintained separately.'});
  scope.getColumn(2).alignment={wrapText:true};scope.getRow(1).font={bold:true};
  const bytes=await workbook.xlsx.writeBuffer();
  if(cancelled())throw new Error('Export cancelled.');
  const blob=new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`MVM-clients-${new Date().toISOString().slice(0,10)}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  return clients.length;
}
