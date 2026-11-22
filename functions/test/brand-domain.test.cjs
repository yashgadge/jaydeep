const test=require('node:test'),assert=require('node:assert/strict'),{brandFields,imageBytes}=require('../brand-domain.cjs');
test('Managed brand fields accept usernames and reject paths or unsupported display modes',()=>{
 assert.equal(brandFields({instagramHandle:'@our_brand.1',displayMode:'image'}).instagramHandle,'our_brand.1');
 assert.equal(brandFields({}).displayMode,'logo');assert.equal(brandFields({}).followers,null);
 for(const instagramHandle of ['https://instagram.com/brand','../other','brand?x=1','x'.repeat(32)])assert.throws(()=>brandFields({instagramHandle}));
 assert.throws(()=>brandFields({displayMode:'script'}));
});
test('Public image uploads reject scripts, malformed base64 and oversized payloads',()=>{
 assert.throws(()=>imageBytes({base64:Buffer.from('<svg onload="evil()"/>').toString('base64')}));
 assert.throws(()=>imageBytes({base64:'not base64!'}));
 assert.throws(()=>imageBytes({base64:Buffer.alloc(1048577).toString('base64')}));
 const png=Buffer.from([137,80,78,71,13,10,26,10,0]);assert.equal(imageBytes({base64:png.toString('base64')}).contentType,'image/png');
});

test('Brand metrics require honest dates and reporting periods and preserve missing values',()=>{
 assert.equal(brandFields({followers:0,followersAsOf:'2026-11-19'}).followers,0);
 assert.throws(()=>brandFields({followers:1200}));
 assert.throws(()=>brandFields({followers:-1,followersAsOf:'2026-11-19'}));
 assert.throws(()=>brandFields({followers:12,followersAsOf:'2026-02-30'}));
 assert.throws(()=>brandFields({accountViews:10000,viewsAsOf:'2026-11-19'}));
 assert.equal(brandFields({accountViews:10000,viewsAsOf:'2026-11-19',viewsPeriod:'1-18 Nov 2026'}).accountViews,10000);
});
