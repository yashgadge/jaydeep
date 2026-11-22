// Fresh membership is loaded by identity on every request. Reuse it only within
// the newly-created auth context; never keep a user/UID cache across requests.
const snapshots=new WeakMap();
function rememberMember(auth,snapshot){snapshots.set(auth,snapshot);return auth;}
function memberSnapshot(db,auth){return snapshots.has(auth)?Promise.resolve(snapshots.get(auth)):db.doc(`members/${auth.uid}`).get();}
module.exports={rememberMember,memberSnapshot};
