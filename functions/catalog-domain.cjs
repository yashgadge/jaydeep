const {string,integer}=require('./operations-domain.cjs');
function cleanProduct(input){
 if(!['reel','photo','video','other'].includes(input.kind))throw new Error('Choose a product type');
 const minimumQuantity=integer(input.minimumQuantity??1,1,10000,'minimum quantity');
 return{title:string(input.title,'product name',120,true),description:string(input.description??'','product description',1000),kind:input.kind,unitPricePaise:integer(input.unitPricePaise,0,10000000,'unit price'),minimumQuantity,maximumQuantity:integer(input.maximumQuantity??100,minimumQuantity,10000,'maximum quantity'),published:input.published===true,quoteOnly:input.quoteOnly===true,sortOrder:integer(input.sortOrder??0,0,9999,'display order'),archived:false};
}
function buildCustomSelection(selections,products,settings){
 if(!settings.customPlansEnabled)throw new Error('Custom shoots are currently unavailable');
 if(!Array.isArray(selections)||!selections.length||selections.length>20)throw new Error('Choose between 1 and 20 products');
 const seen=new Set(),items=[];let reels=0,images=0;
 for(const selected of selections){if(seen.has(selected.productId))throw new Error('Choose each product once');seen.add(selected.productId);const p=products.get(selected.productId);if(!p?.published||p.archived||p.quoteOnly)throw new Error('This product needs a studio quote');const quantity=integer(selected.quantity,p.minimumQuantity,p.maximumQuantity,'product quantity');integer(p.unitPricePaise,0,10000000,'product price');integer(p.unitPricePaise*quantity,0,100000000,'line total');items.push({productId:selected.productId,description:p.title,quantity,unitPaise:p.unitPricePaise});if(p.kind==='reel')reels+=quantity;if(p.kind==='photo')images+=quantity;}
 const total=integer(items.reduce((n,i)=>n+i.quantity*i.unitPaise,0),0,100000000,'order total');
 return{title:'Custom shoot',published:true,archived:false,quoteOnly:false,flow:'shoot',icon:'camera',pricePaise:total,advancePaise:Math.ceil(total*(settings.customAdvancePercent??30)/100),crewUnits:settings.customCrewUnits??1,reels,images,revisions:settings.customRevisions??1,inclusions:items.map(i=>`${i.quantity} × ${i.description}`).join('\n'),deliveryEstimate:settings.customDeliveryEstimate??'',addOns:[],customItems:items};
}
function cleanDistanceRules(input){if(!Array.isArray(input)||input.length>12)throw new Error('Use up to 12 distance rules');const rules=input.map(r=>({afterKm:integer(r.afterKm,0,1000,'distance threshold'),minimumPaise:integer(r.minimumPaise,0,100000000,'minimum order value')})).sort((a,b)=>a.afterKm-b.afterKm);if(new Set(rules.map(r=>r.afterKm)).size!==rules.length)throw new Error('Distance thresholds must be unique');for(let i=1;i<rules.length;i++)if(rules[i].minimumPaise<rules[i-1].minimumPaise)throw new Error('Minimum value cannot decrease for a greater distance');return rules;}
function travelQuote(location,settings,pricePaise=0){
 if(settings.baseLat===null||settings.baseLng===null)return{eligible:false,eligibleArea:false,distanceKm:null,minimumPaise:0,reason:'Studio location is not configured. Request a callback.'};
 const distance=require('./studio-domain.cjs').distanceKm({lat:settings.baseLat,lng:settings.baseLng},location);
 const max=settings.distancePricingEnabled?Math.max(settings.radiusKm,settings.maximumTravelKm??settings.radiusKm):settings.radiusKm;
 const matched=settings.distancePricingEnabled?[...(settings.distanceRules??[])].sort((a,b)=>b.afterKm-a.afterKm).find(r=>distance>r.afterKm):null;
 const eligibleArea=distance<=max&&(distance<=settings.radiusKm||!!matched),minimumPaise=matched?.minimumPaise??0;
 return{eligible:eligibleArea&&pricePaise>=minimumPaise,eligibleArea,distanceKm:Math.round(distance*100)/100,minimumPaise,reason:!eligibleArea?'Outside our shoot area. Call the studio for approval.':pricePaise<minimumPaise?`This distance requires a minimum order of INR ${(minimumPaise/100).toFixed(2)}.`:''};
}
module.exports={cleanProduct,buildCustomSelection,cleanDistanceRules,travelQuote};
