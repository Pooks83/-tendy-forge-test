import {useId} from 'react';

const labels=['1. Get ready','2. Do the move','3. Finish steady'];

function Goalie({x,y,lean=0,ball=false}:{x:number;y:number;lean?:number;ball?:boolean}) {
 return <g transform={`translate(${x} ${y}) rotate(${lean})`} stroke="#263b52" strokeWidth="4" strokeLinecap="round" fill="none">
  <circle cx="0" cy="-28" r="9" fill="#fff"/>
  <path d="M0 -18 V16 M0 -4 L-19 9 M0 -4 L19 7 M0 16 L-16 40 M0 16 L16 40"/>
  {ball&&<circle cx="24" cy="3" r="5" fill="#cc1736" stroke="#cc1736"/>}
 </g>;
}

export function DrillMap({kind,name}:{kind:string;name:string}) {
 const arrow=useId().replace(/:/g,'');
 const isWall=kind==='wall'||kind==='support';
 const isChair=kind==='chair'||kind==='sight';
 return <figure className="tf-map">
  <div className="tf-map-steps" role="img" aria-label={`Instruction picture for ${name}. Three steps show how to get ready, do the movement, and finish steady.`}>
   {labels.map((label,index)=><svg className="tf-map-step" key={label} viewBox="0 0 220 220" aria-hidden="true">
    <defs><marker id={`${arrow}-${index}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#cc1736"/></marker></defs>
    <rect x="6" y="6" width="208" height="208" rx="18" fill={index===1?'#fff3f5':'#f7f9fc'} stroke={index===1?'#efb8c3':'#dce3eb'}/>
    <text x="110" y="31" textAnchor="middle" fontWeight="750">{label}</text>
    {isWall&&<><path d="M34 62 H186" stroke="#718096" strokeWidth="6"/><text x="110" y="55" textAnchor="middle">wall</text></>}
    {isChair&&<><rect x="88" y="72" width="44" height="35" rx="4" fill="#b3bdc9"/><text x="110" y="125" textAnchor="middle">chair</text></>}
    <Goalie x={index===1&&kind==='lane'?82:110} y={index===2?151:145} lean={index===1&&kind==='lane'?-8:0} ball={isWall&&index<2}/>
    {index===1&&kind==='lane'&&<path d="M112 170 H166" stroke="#cc1736" strokeWidth="4" markerEnd={`url(#${arrow}-${index})`}/>}
    {index===1&&isWall&&<path d="M136 142 Q165 92 124 67" stroke="#cc1736" strokeWidth="3" strokeDasharray="5 5" fill="none" markerEnd={`url(#${arrow}-${index})`}/>}
    {index===1&&kind==='target'&&<><path d="M132 146 H174" stroke="#cc1736" strokeWidth="3" markerEnd={`url(#${arrow}-${index})`}/><circle cx="184" cy="146" r="7" fill="#cc1736"/></>}
    {index===1&&kind==='sight'&&<path d="M120 111 Q155 87 177 72" stroke="#cc1736" strokeWidth="3" strokeDasharray="4 4" fill="none"/>}
    {index===2&&<><path d="M77 193 H143" stroke="#2f8a63" strokeWidth="4"/><text x="110" y="207" textAnchor="middle" fill="#287453">hold control</text></>}
   </svg>)}
  </div>
  <figcaption>Instruction picture • move slowly while learning. Use the written steps for the exact reps.</figcaption>
 </figure>;
}
