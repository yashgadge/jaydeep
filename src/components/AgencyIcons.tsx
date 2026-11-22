export function AgencyIcon({ name, className = '' }: { name: 'camera'|'film'|'social'|'arrow'|'instagram'; className?:string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {name==='camera'&&<><path d="M7 14h9l4-5h9l4 5h8v25H7z"/><circle cx="24" cy="26" r="8"/><circle cx="24" cy="26" r="4"/><path d="M36 19h1"/></>}
    {name==='film'&&<><rect x="7" y="11" width="34" height="27" rx="3"/><path d="m21 19 10 6-10 6zM7 17h34M14 11l5 6m6-6 5 6m5-6 5 6"/></>}
    {name==='social'&&<><path d="M7 23h9l22-11v26L16 29H7zM13 29l4 11h7l-4-10M38 20l5-3m-5 13 5 3"/><path d="M16 23v6"/></>}
    {name==='arrow'&&<path d="M10 38 38 10M13 10h25v25"/>}
    {name==='instagram'&&<><rect x="8" y="8" width="32" height="32" rx="10"/><circle cx="24" cy="24" r="8"/><circle cx="34" cy="14" r="1.3" fill="currentColor" stroke="none"/></>}
  </svg>;
}

export function LensArtwork() {
  return <svg viewBox="0 0 700 700" fill="none" aria-hidden className="agency-lens-svg">
    <defs><radialGradient id="lens-glass"><stop stopColor="#34121f"/><stop offset=".35" stopColor="#090a12"/><stop offset=".65" stopColor="#190e19"/><stop offset="1" stopColor="#08090d"/></radialGradient><radialGradient id="lens-rim"><stop offset=".65" stopColor="#0c0b10"/><stop offset=".85" stopColor="#252129"/><stop offset=".94" stopColor="#0b0a0e"/><stop offset="1" stopColor="#38101a"/></radialGradient><linearGradient id="lens-edge" x1="100" y1="100" x2="600" y2="600"><stop stopColor="#ff5c73"/><stop offset=".4" stopColor="#612637"/><stop offset=".7" stopColor="#171219"/><stop offset="1" stopColor="#e5132b"/></linearGradient></defs>
    <circle cx="350" cy="350" r="269" fill="url(#lens-rim)" stroke="url(#lens-edge)" strokeWidth="2"/>
    {Array.from({length:72},(_,index)=><path key={index} d="M350 87v16" stroke="#76606a" strokeOpacity=".32" strokeWidth="1.3" transform={`rotate(${index*5} 350 350)`}/>)}
    {[247,233,223,208,193].map((r,index)=><circle key={r} cx="350" cy="350" r={r} stroke={index%2?'#4e2636':'#756170'} strokeOpacity={index%2?'.5':'.18'} strokeWidth={index===0?5:1}/>)}
    <circle cx="350" cy="350" r="183" fill="url(#lens-glass)" stroke="url(#lens-edge)" strokeWidth="2"/>
    <g className="agency-aperture">{Array.from({length:6},(_,index)=><path key={index} d="M350 177 497 263 413 314 350 243 283 243z" fill={index%2?'#23101c':'#130f19'} stroke="#7d344d" strokeOpacity=".45" transform={`rotate(${index*60} 350 350)`}/>)}</g>
    <circle cx="350" cy="350" r="104" stroke="#b84867" strokeOpacity=".28"/><circle cx="350" cy="350" r="60" fill="#07070c" stroke="#68283f" strokeOpacity=".6"/>
    <ellipse cx="307" cy="295" rx="38" ry="17" transform="rotate(-40 307 295)" fill="#e97695" fillOpacity=".09"/>
    <path d="M119 205a270 270 0 0 1 160-116M569 504a270 270 0 0 1-128 100" stroke="#ff4968" strokeOpacity=".5" strokeWidth="3"/>
    <path d="M36 160v-80h80M584 80h80v80M664 540v80h-80M116 620H36v-80" stroke="#b65568" strokeOpacity=".35"/>
    <path d="M350 23v25M350 652v25M23 350h25M652 350h25" stroke="#ff4e70" strokeOpacity=".45"/>
  </svg>;
}
