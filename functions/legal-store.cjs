const L=require('./legal-domain.cjs');
module.exports=db=>({
 async read(tx){const [profile,studio]=await Promise.all([tx.get(db.doc('settings/legal')),tx.get(db.doc('settings/studio'))]);const value=L.publication(profile.data()??{},studio.data()??{});const existing=await tx.get(db.doc(`publicLegalVersions/${value.revision}`));return{value,exists:existing.exists};},
 write(tx,result){const value={...result.value,publishedAtISO:new Date().toISOString()};if(!result.exists)tx.create(db.doc(`publicLegalVersions/${value.revision}`),value);tx.set(db.doc('publicWebsite/legal'),value);},
 async publish(){return db.runTransaction(async tx=>{const [profile,studio]=await Promise.all([tx.get(db.doc('settings/legal')),tx.get(db.doc('settings/studio'))]);const value=L.publication(profile.data()??{},studio.data()??{});const existing=await tx.get(db.doc(`publicLegalVersions/${value.revision}`));const record={...value,publishedAtISO:new Date().toISOString()};if(!existing.exists)tx.create(db.doc(`publicLegalVersions/${value.revision}`),record);tx.set(db.doc('publicWebsite/legal'),record);return value.revision;});}
});
