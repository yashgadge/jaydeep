const {integer}=require('./operations-domain.cjs');
function customRequest(selections,products,fallback={}){
 if(!Array.isArray(selections)||selections.length>20)throw new Error('Choose up to 20 products');
 if(!selections.length){const reels=integer(fallback.reels??0,0,1000,'reels'),images=integer(fallback.images??0,0,10000,'photos');if(!reels&&!images)throw new Error('Choose at least one reel or photo');return{kind:'custom',reels,images,items:[],estimatePaise:null,quoteRequired:true};}
 const seen=new Set(),items=[];let reels=0,images=0,total=0,quoteRequired=false;
 for(const v of selections){if(seen.has(v.productId))throw new Error('Choose each product once');seen.add(v.productId);const p=products.get(v.productId);if(!p?.published||p.archived)throw new Error('This product is unavailable');const quantity=integer(v.quantity,p.minimumQuantity,p.maximumQuantity,'quantity');const unitPaise=integer(p.unitPricePaise,0,10000000,'unit price');if(p.quoteOnly)quoteRequired=true;total+=quantity*unitPaise;if(p.kind==='reel')reels+=quantity;if(p.kind==='photo')images+=quantity;items.push({productId:v.productId,title:p.title,quantity,unitPaise:p.quoteOnly?null:unitPaise});}
 integer(total,0,100000000,'estimated total');return{kind:'custom',items,reels,images,quoteRequired,estimatePaise:quoteRequired?null:total};
}
module.exports={customRequest};
