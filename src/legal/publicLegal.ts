import {useEffect,useState} from 'react';
import {doc,onSnapshot} from 'firebase/firestore';
import {db} from '../firebase/client';
import policy from '../../functions/legal-policy.json';
export type LegalPublication=typeof policy&{revision:string;sha256:string;profileComplete:boolean;business:Record<string,string>;contacts:{phone:string;secondaryPhone:string};rules:{cancellationHours:number;cancellationFeePaise:number;rescheduleHours:number;maximumReschedules:number}};
export const draftPolicy:LegalPublication={...policy,revision:'',sha256:'',profileComplete:false,business:{},contacts:{phone:'',secondaryPhone:''},rules:{cancellationHours:24,cancellationFeePaise:0,rescheduleHours:24,maximumReschedules:2}};
export function usePublicLegal(revision?:string){
 const [data,setData]=useState<LegalPublication>(draftPolicy),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{setLoading(true);setError('');if(revision&&!/^[\w-]{1,128}$/.test(revision)){setError('This policy version is invalid.');setLoading(false);return;}
  return onSnapshot(revision?doc(db,'publicLegalVersions',revision):doc(db,'publicWebsite','legal'),snapshot=>{if(snapshot.exists()){setData(snapshot.data() as LegalPublication);setError('');}else setError(revision?'This policy version was not found.':'The studio is completing its policy contact details.');setLoading(false);},()=>{setError('Unable to load the published policy version. Please retry.');setLoading(false);});
 },[revision]);return{data,loading,error};
}
