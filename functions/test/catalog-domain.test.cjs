const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../catalog-domain.cjs');const {DEFAULT_STUDIO}=require('../studio-domain.cjs');
test('highest matching travel tier applies and never exceeds the absolute shoot range',()=>{
 const s={...DEFAULT_STUDIO,baseLat:19,baseLng:73,radiusKm:5,maximumTravelKm:30,distancePricingEnabled:true,distanceRules:[{afterKm:5,minimumPaise:200000},{afterKm:10,minimumPaise:400000}]};
 assert.equal(C.travelQuote({lat:19.02,lng:73},s,0).eligible,true);
 assert.equal(C.travelQuote({lat:19.06,lng:73},s,199999).eligible,false);
 assert.equal(C.travelQuote({lat:19.06,lng:73},s,200000).eligible,true);
 assert.equal(C.travelQuote({lat:19.12,lng:73},s,200000).minimumPaise,400000);
 assert.equal(C.travelQuote({lat:19.12,lng:73},s,400000).eligible,true);
 assert.equal(C.travelQuote({lat:19.4,lng:73},s,10000000).eligible,false);
 assert.equal(C.travelQuote({lat:19.06,lng:73},{...s,distancePricingEnabled:false},10000000).eligible,false);
 assert.throws(()=>C.cleanDistanceRules([{afterKm:5,minimumPaise:200000},{afterKm:5,minimumPaise:300000}]));
 assert.throws(()=>C.cleanDistanceRules([{afterKm:5,minimumPaise:200000},{afterKm:10,minimumPaise:100000}]));
});
test('custom products use server unit prices, quantity bounds, and exact totals',()=>{
 const reel=C.cleanProduct({title:'Edited reel',kind:'reel',unitPricePaise:150000,minimumQuantity:1,maximumQuantity:10,published:true});
 const photos=C.cleanProduct({title:'Edited photo',kind:'photo',unitPricePaise:5000,minimumQuantity:5,maximumQuantity:100,published:true});
 const catalog=new Map([['reel',reel],['photo',photos]]);
 const result=C.buildCustomSelection([{productId:'reel',quantity:2,unitPricePaise:1},{productId:'photo',quantity:10}],catalog,DEFAULT_STUDIO);
 assert.equal(result.pricePaise,350000);assert.equal(result.advancePaise,105000);assert.equal(result.reels,2);assert.equal(result.images,10);assert.equal(result.customItems.length,2);
 for(const selections of [[{productId:'photo',quantity:1}],[{productId:'reel',quantity:1.5}],[{productId:'reel',quantity:11}],[{productId:'missing',quantity:1}],[{productId:'reel',quantity:1},{productId:'reel',quantity:2}]])assert.throws(()=>C.buildCustomSelection(selections,catalog,DEFAULT_STUDIO));
 assert.throws(()=>C.buildCustomSelection([{productId:'reel',quantity:1}],new Map([['reel',{...reel,quoteOnly:true}]]),DEFAULT_STUDIO));
 assert.throws(()=>C.buildCustomSelection([{productId:'reel',quantity:1}],catalog,{...DEFAULT_STUDIO,customPlansEnabled:false}));
});
