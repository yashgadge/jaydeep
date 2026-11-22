import { httpsCallable } from 'firebase/functions';
import { signOut } from 'firebase/auth';
import { auth, functions } from '../firebase/client';
export async function call<Input, Output>(name:string, input:Input):Promise<Output> {
  try { return (await httpsCallable<Input,Output>(functions,name)(input)).data; }
  catch(error) {
    if((error as {code?:string})?.code==='functions/unauthenticated'&&auth.currentUser) await signOut(auth);
    throw error;
  }
}
export const failureText = (error:unknown) => error instanceof Error ? error.message : 'Unable to complete this action. Please retry.';
