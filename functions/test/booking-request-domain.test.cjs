const test=require('node:test'),assert=require('node:assert/strict'),{customRequest}=require('../booking-request-domain.cjs');
const products=new Map([['reel',{title:'Reels',kind:'reel',published:true,minimumQuantity:1,maximumQuantity:100,unitPricePaise:50000}],['photo',{title:'Photos',kind:'photo',published:true,minimumQuantity:1,maximumQuantity:5000,unitPricePaise:1000}]]);
test('Custom enquiry estimates use authoritative catalogue prices, preserving the requested mix',()=>{
 const result=customRequest([{productId:'reel',quantity:3,unitPricePaise:1},{productId:'photo',quantity:50,unitPricePaise:1}],products);assert.equal(result.estimatePaise,200000);assert.equal(result.reels,3);assert.equal(result.images,50);
 assert.throws(()=>customRequest([{productId:'reel',quantity:3},{productId:'reel',quantity:1}],products));assert.throws(()=>customRequest([{productId:'reel',quantity:101}],products));
});
test('Unpriced requirements stay a quote, never a free order',()=>{const result=customRequest([],new Map(),{reels:3,images:20});assert.equal(result.estimatePaise,null);assert.equal(result.quoteRequired,true);assert.throws(()=>customRequest([],new Map(),{}));});
