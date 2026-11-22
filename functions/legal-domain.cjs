const {createHash}=require('node:crypto');
const policy=require('./legal-policy.json');
const {string,integer}=require('./operations-domain.cjs');
function cleanProfile(input={}){
 const p={};for(const [key,max]of Object.entries({legalName:200,businessAddress:700,supportEmail:150,grievanceName:150,grievanceEmail:150,grievancePhone:40,registrationDetails:200}))p[key]=string(input[key]??'',key,max);
 for(const key of ['supportEmail','grievanceEmail'])if(p[key]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p[key]))throw new Error('Enter a valid public contact email');
 return p;
}
function publication(profile={},studio={}){
 const business=cleanProfile(profile),rules={cancellationHours:integer(studio.cancellationHours??24,0,720,'cancellation notice'),cancellationFeePaise:integer(studio.cancellationFeePaise??0,0,100000000,'cancellation fee'),rescheduleHours:integer(studio.rescheduleHours??24,0,720,'reschedule notice'),maximumReschedules:integer(studio.maximumReschedules??2,0,10,'reschedules')};
 const contacts={phone:string(studio.phone??'','phone',40),secondaryPhone:string(studio.secondaryPhone??'','second phone',40)};
 const body={...policy,business,rules,contacts};const hash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 return {...body,revision:`${policy.version}-${hash.slice(0,16)}`,sha256:hash,profileComplete:['legalName','businessAddress','supportEmail','grievanceName','grievanceEmail'].every(k=>Boolean(business[k]))&&[business.grievancePhone,contacts.phone].some(phone=>{const digits=String(phone??'').replace(/\D/g,'');return digits.length>=10&&digits.length<=15;})};
}
function acceptance(data,current,uid,atISO=new Date().toISOString()){
 if(data.legalAccepted!==true)throw new Error('Accept the booking terms and privacy notice');
 if(data.policyRevision!==current.revision)throw new Error('The booking terms have changed. Refresh and review the latest policy before continuing');
 return {policyRevision:current.revision,policyVersion:current.version,policySha256:current.sha256,acceptedAtISO:atISO,acceptedBy:uid,source:'client-checkbox',adultConfirmed:data.adultConfirmed===true,termsAccepted:true,privacyNoticeAcknowledged:true,policyPath:`/policies/terms?version=${current.revision}`};
}
module.exports={policy,cleanProfile,publication,acceptance};
