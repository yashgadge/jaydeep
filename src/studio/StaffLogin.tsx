import {useState,type FormEvent} from 'react';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {auth} from '../firebase/client';
export default function StaffLogin(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false);
 async function submit(event:FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');try{await signInWithEmailAndPassword(auth,email.trim(),password);setPassword('');}catch{setError('Unable to sign in. Check your staff email and password, or ask the owner to check your access.');}finally{setBusy(false);}}
 return <form className="studio-staff-login" onSubmit={event=>void submit(event)}><label>Staff email<input type="email" required autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Password<span className="studio-password-field"><input required type={show?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(v=>!v)}>{show?'Hide':'Show'}</button></span></label>{error&&<p role="alert" className="studio-warning">{error}</p>}<button className="billing-primary" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in to the studio'} <span>↗</span></button><p>Staff accounts are created by the owner. Client bookings use Google sign-in in the <a href="/billing">client portal</a>.</p></form>;
}
