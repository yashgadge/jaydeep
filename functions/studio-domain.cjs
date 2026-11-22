const { string, integer } = require('./operations-domain.cjs');
const SLOTS=['morning','afternoon','evening','night'];
const DEFAULT_STUDIO={
  bookingsEnabled:false,addressMode:'both',defaultAddressMode:'manual',showMap:false,mapSelectionEnabled:false,mapsEnabled:false,
  baseLat:null,baseLng:null,radiusKm:30,maximumTravelKm:30,distancePricingEnabled:false,distanceRules:[],slotCapacity:1,travelBufferSlots:0,holdMinutes:10,
  maxAdvanceDays:180,minimumNoticeHours:12,allowClientBypass:false,phone:'',secondaryPhone:'',phoneLabel:'MVM',secondaryPhoneLabel:'MVM · line 2',instagram:'https://www.instagram.com/maharashtra_vision_media/',
  customPlansEnabled:true,customAdvancePercent:30,customCrewUnits:1,customRevisions:1,customDeliveryEstimate:'',
  clientIdleMinutes:30,adminIdleMinutes:15,sessionMaxHours:24,rateCooldownMinutes:1,
  mapsMonthlyLimit:5000,mapsDailyLimit:500,mapsSearchPerMinute:15,
  cancellationHours:24,cancellationFeePaise:0,rescheduleHours:24,maximumReschedules:2,
};
const PREFIX={client:'CLI',order:'ORD',payment:'PAY',invoice:'INV',receipt:'RCP',credit:'CRN',refund:'REF',paymentRequest:'PQR',enquiry:'ENQ',delivery:'DEL',task:'TSK',service:'SVC',content:'PUB'};
function publicIds(counts,kinds,now=new Date()) {
  const year=new Intl.DateTimeFormat('en',{timeZone:'Asia/Kolkata',year:'numeric'}).format(now);
  const next={...counts},ids={};
  for(const kind of kinds){if(!PREFIX[kind])throw new Error('Invalid ID type');next[kind]=integer((next[kind]??0)+1,1,999999999,'sequence');ids[kind]=`MVM-${PREFIX[kind]}-${year}-${String(next[kind]).padStart(6,'0')}`;}
  return{ids,next,year};
}
function validateStudio(input){
  const s={...DEFAULT_STUDIO};
  for(const key of ['bookingsEnabled','showMap','mapsEnabled','allowClientBypass','mapSelectionEnabled']){if(typeof (input[key]??s[key])!=='boolean')throw new Error(`Specify ${key}`);s[key]=input[key]??s[key];}
  if(!['manual','suggestions','both'].includes(input.addressMode))throw new Error('Invalid address mode');s.addressMode=input.addressMode;
  if(!['manual','suggestions'].includes(input.defaultAddressMode))throw new Error('Invalid default address mode');s.defaultAddressMode=input.defaultAddressMode;
  const ranges={radiusKm:[1,1000],slotCapacity:[1,20],travelBufferSlots:[0,2],holdMinutes:[3,30],maxAdvanceDays:[1,365],minimumNoticeHours:[0,168],clientIdleMinutes:[5,240],adminIdleMinutes:[5,120],sessionMaxHours:[1,48],rateCooldownMinutes:[1,60],mapsMonthlyLimit:[0,60000],mapsDailyLimit:[0,2000],mapsSearchPerMinute:[1,60],cancellationHours:[0,720],cancellationFeePaise:[0,100000000],rescheduleHours:[0,720],maximumReschedules:[0,10]};
  for(const [key,[min,max]]of Object.entries(ranges))s[key]=integer(input[key],min,max,key);
  for(const key of ['baseLat','baseLng']){const val=input[key];if(val!==null&&(!Number.isFinite(val)||Math.abs(val)>(key==='baseLat'?90:180)))throw new Error('Invalid base coordinates');s[key]=val;}
  s.phone=string(input.phone??'','contact phone',40);s.instagram=safeUrl(input.instagram??DEFAULT_STUDIO.instagram,['www.instagram.com','instagram.com']);
  for(const key of ['distancePricingEnabled','customPlansEnabled']){if(typeof(input[key]??s[key])!=='boolean')throw new Error(`Specify ${key}`);s[key]=input[key]??s[key];}
  s.maximumTravelKm=integer(input.maximumTravelKm??Math.max(30,s.radiusKm),s.radiusKm,1000,'maximum travel distance');
  s.distanceRules=require('./catalog-domain.cjs').cleanDistanceRules(input.distanceRules??[]);
  if(s.distanceRules.some(r=>r.afterKm>=s.maximumTravelKm))throw new Error('Distance rules must begin below the maximum shoot distance');
  s.secondaryPhone=string(input.secondaryPhone??'','second phone',40);s.phoneLabel=string(input.phoneLabel??'MVM','first phone label',40);s.secondaryPhoneLabel=string(input.secondaryPhoneLabel??'MVM · line 2','second phone label',40);
  s.customAdvancePercent=integer(input.customAdvancePercent??30,0,100,'custom advance percent');
  s.customCrewUnits=integer(input.customCrewUnits??1,1,s.slotCapacity,'custom plan team capacity');
  s.customRevisions=integer(input.customRevisions??1,0,20,'custom revisions');
  s.customDeliveryEstimate=string(input.customDeliveryEstimate??'','custom delivery estimate',150);
  return s;
}
function safeUrl(value,hosts){if(!value)return'';const url=new URL(string(value,'URL',1000,true));if(url.protocol!=='https:'||(hosts&&!hosts.includes(url.hostname)))throw new Error('Use an approved HTTPS URL');return url.href;}
function dateSlot(date,slot){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!SLOTS.includes(slot)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error('Choose a valid date and slot');return`${date}_${slot}`;}
function indiaDay(now=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
function slotStart(date,slot){return Date.parse(`${date}T${{morning:'08',afternoon:'12',evening:'16',night:'20'}[slot]}:00:00+05:30`);}
function slotEnd(date,slot){dateSlot(date,slot);return slotStart(date,slot)+(slot==='night'?5:4)*3600000;}
function capacity(allocations={},now=Date.now()){return Object.values(allocations).filter(a=>!a.expiresAtMs||a.expiresAtMs>now).reduce((n,a)=>n+a.units,0);}
function validBookingWindow(date,slot,settings,now=Date.now()){dateSlot(date,slot);const start=slotStart(date,slot);if(start<now+settings.minimumNoticeHours*3600000||start>now+settings.maxAdvanceDays*86400000)throw new Error('This date/slot is outside the booking window');}
function distanceKm(a,b){const r=Math.PI/180;const dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;const x=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function covered(location,settings){return settings.baseLat!==null&&settings.baseLng!==null&&distanceKm({lat:settings.baseLat,lng:settings.baseLng},location)<=settings.radiusKm;}
function cleanService(input){
  const flow=input.flow;if(!['shoot','management','callback','quote'].includes(flow))throw new Error('Choose a service flow');
  if(!['camera','film','social','calendar'].includes(input.icon))throw new Error('Choose an icon');
  const published=input.published===true;
  const pricePaise=integer(input.pricePaise,0,100000000,'package price');const advancePaise=integer(input.advancePaise,0,pricePaise,'advance');
  return{title:string(input.title,'service/package title',150,true),description:string(input.description??'','description',1000),flow,icon:input.icon,published,
    pricePaise,advancePaise,crewUnits:integer(input.crewUnits??1,1,20,'crew capacity'),sortOrder:integer(input.sortOrder??0,0,9999,'display order'),
    inclusions:string(input.inclusions??'','inclusions',2500),deliveryEstimate:string(input.deliveryEstimate??'','delivery estimate',150),
    reels:integer(input.reels??0,0,1000,'reels'),images:integer(input.images??0,0,10000,'images'),revisions:integer(input.revisions??1,0,20,'revisions'),
    occasions:Array.isArray(input.occasions)?input.occasions.slice(0,30).map(v=>string(v,'occasion',80,true)):[],
    addOns:Array.isArray(input.addOns)?input.addOns.slice(0,20).map(a=>({name:string(a.name,'add-on',100,true),pricePaise:integer(a.pricePaise,0,10000000,'add-on price')})):[],
    quoteOnly:input.quoteOnly===true,archived:false};
}
function policySnapshot(s){return{cancellationHours:s.cancellationHours,cancellationFeePaise:s.cancellationFeePaise,rescheduleHours:s.rescheduleHours,maximumReschedules:s.maximumReschedules};}
function policyCheck(order,kind,now=Date.now()){
  const hours=order.policy?.[kind==='cancel'?'cancellationHours':'rescheduleHours']??24;
  if(!['confirmed','assigned'].includes(order.status))throw new Error('This booking cannot be changed at its current stage');
  if(slotStart(order.shootDate,order.slot)-now<hours*3600000)throw new Error('Please contact the studio; this request is inside the change deadline');
  if(kind==='reschedule'&&(order.rescheduleCount??0)>=(order.policy?.maximumReschedules??2))throw new Error('Reschedule allowance used; contact the studio');
}
module.exports={SLOTS,DEFAULT_STUDIO,publicIds,validateStudio,safeUrl,dateSlot,indiaDay,slotStart,slotEnd,capacity,validBookingWindow,distanceKm,covered,cleanService,policySnapshot,policyCheck};
