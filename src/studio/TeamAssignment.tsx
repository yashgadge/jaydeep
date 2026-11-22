import {useState} from 'react';
import {call} from '../operations/api';
import {TeamChoices} from './BookingRequests';
import type {Order,RecordData} from './types';
export default function TeamAssignment({order,members,run,busy}:{order:Order;members:RecordData[];run:(work:()=>Promise<void>)=>Promise<void>;busy:boolean}){
 const [selected,setSelected]=useState<string[]>(order.assignees??[]);
 return <details className="studio-panel"><summary>Assign / change shoot team</summary><p>The selected members receive this shoot in their schedule. Conflicting assignments are checked before saving.</p><TeamChoices members={members} value={selected} onChange={setSelected} max={order.crewUnits??1} disabled={busy}/><button className="billing-primary" disabled={busy} onClick={()=>void run(async()=>{await call('assignStudioTeam',{id:order.id,assignees:selected});})}>Save team assignment</button></details>;
}
