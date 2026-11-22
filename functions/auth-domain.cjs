function validateSignIn(auth,member){
 if(!auth)throw new Error('Sign in to continue.');
 const provider=auth.token?.firebase?.sign_in_provider;
 if(provider==='password'){
  if(!member?.active)throw new Error('Staff access is inactive or has not been granted by the owner.');
 }else if(provider==='google.com'){
  if(auth.token.email_verified!==true)throw new Error('Use your verified Google account.');
  if(member?.active)throw new Error('Studio members must sign in with their staff email and password.');
 }else throw new Error('Use Google for the client portal, or your staff email and password for studio access.');
 return true;
}
function dashboardAllowed(member,onGo){return Boolean(member?.active&&(member.owner||member[onGo?'goAccess':'adminAccess']!==false));}
module.exports={validateSignIn,dashboardAllowed};
