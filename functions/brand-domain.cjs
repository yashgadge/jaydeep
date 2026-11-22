const {string}=require('./operations-domain.cjs');
function brandFields(data){
 const instagramHandle=string(data.instagramHandle??'','Instagram username',31).trim().replace(/^@/,'');
 if(instagramHandle&&!/^[A-Za-z0-9._]{1,30}$/.test(instagramHandle))throw new Error('Enter an Instagram username, such as @yourbrand');
 const displayMode=data.displayMode??'logo';if(!['logo','image'].includes(displayMode))throw new Error('Choose logo or image presentation');
 const metric=(key)=>{const v=data[key];if(v===null||v===undefined||v==='')return null;if(!Number.isSafeInteger(v)||v<0||v>1000000000000)throw new Error('Enter a valid '+key+' count');return v;};
 const followers=metric('followers'),accountViews=metric('accountViews');
 const date=(key)=>{const value=data[key]??'';if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw new Error('Choose a valid statistics date');return value;};
 const followersAsOf=date('followersAsOf'),viewsAsOf=date('viewsAsOf'),viewsPeriod=string(data.viewsPeriod??'','views date range',100);
 if(followers!==null&&!followersAsOf)throw new Error('Add the date the follower count was checked');
 if(accountViews!==null&&(!viewsPeriod.trim()||!viewsAsOf))throw new Error('Account views need a reporting period and the date checked');
 return{instagramHandle,displayMode,followers,followersAsOf,accountViews,viewsPeriod,viewsAsOf};
}
function imageBytes(data){
 if(typeof data.base64!=='string'||data.base64.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))throw new Error('Choose an image up to 1 MB');
 const bytes=Buffer.from(data.base64,'base64');if(!bytes.length||bytes.length>1048576)throw new Error('Choose an image up to 1 MB');
 const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
 if(!type)throw new Error('Upload a PNG, JPEG or WebP image');
 return{bytes,type,contentType:'image/'+type};
}
module.exports={brandFields,imageBytes};
