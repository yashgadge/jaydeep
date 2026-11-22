const test=require('node:test'),assert=require('node:assert/strict'),{validateSignIn,dashboardAllowed}=require('../auth-domain.cjs');
const auth=(provider,verified=true)=>({token:{email_verified:verified,firebase:{sign_in_provider:provider}}});
test('clients require verified Google and staff require an active password account',()=>{
 assert.equal(validateSignIn(auth('google.com'),null),true);
 assert.throws(()=>validateSignIn(auth('google.com',false),null));
 assert.throws(()=>validateSignIn(auth('google.com'),{active:true,owner:true}));
 assert.equal(validateSignIn(auth('password',false),{active:true}),true);
 assert.throws(()=>validateSignIn(auth('password'),null));assert.throws(()=>validateSignIn(auth('password'),{active:false}));assert.throws(()=>validateSignIn(null,null));assert.throws(()=>validateSignIn(auth('anonymous'),{active:true}));
});
test('dashboard grants remain separate and owners retain both dashboards',()=>{
 const role={active:true,adminAccess:false,goAccess:true};assert.equal(dashboardAllowed(role,true),true);assert.equal(dashboardAllowed(role,false),false);assert.equal(dashboardAllowed({...role,active:false},true),false);assert.equal(dashboardAllowed({...role,owner:true},false),true);
});
