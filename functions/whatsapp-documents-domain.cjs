function templateInfo(template){
 const components=template.components??[],header=components.find(c=>c.type==='HEADER'),body=components.find(c=>c.type==='BODY');
 if(template.status!=='APPROVED'||!['UTILITY','MARKETING'].includes(template.category)||components.some(c=>!['BODY','FOOTER','HEADER'].includes(c.type)))return null;
 if(header&&header.format!=='DOCUMENT')return null;
 if(header&&template.category!=='UTILITY')return null;
 const parameters=[...(body?.text??'').matchAll(/\{\{(\d+)\}\}/g)].map(m=>Number(m[1]));
 const parameterCount=parameters.length?Math.max(...parameters):0;
 if(parameterCount>20||/\{\{[a-zA-Z_]/.test(body?.text??'')||(header&&parameterCount!==3))return null;
 return{name:template.name,language:template.language,category:template.category.toLowerCase(),body:body?.text??'',status:'APPROVED',verifiedFromMeta:true,parameterCount,headerFormat:header?'DOCUMENT':''};
}
function documentComponents(message,mediaId){return[{type:'header',parameters:[{type:'document',document:{id:mediaId,filename:message.document.filename}}]},{type:'body',parameters:message.parameters.map(text=>({type:'text',text}))}];}
module.exports={templateInfo,documentComponents};
