export const SHOOT_SLOTS = [
 {id:'morning',label:'Morning',time:'8 AM – 12 PM',icon:'☀'},
 {id:'afternoon',label:'Afternoon',time:'12 PM – 4 PM',icon:'☀'},
 {id:'evening',label:'Evening',time:'4 PM – 8 PM',icon:'◒'},
 {id:'night',label:'Night',time:'8 PM – 1 AM',icon:'☾'},
] as const;
export const slotOptions:Array<[string,string]>=SHOOT_SLOTS.map(s=>[s.id,`${s.label} · ${s.time}`]);
