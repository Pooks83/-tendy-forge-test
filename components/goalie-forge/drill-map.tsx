import {useId} from 'react';
// Functional floor-layout diagrams, not demonstrations of body mechanics.
export function DrillMap({kind,name}:{kind:string;name:string}) {
 const arrow=useId().replace(/:/g,'');
 const wall=kind==='wall'||kind==='support';
 return <figure className="tf-map"><svg viewBox="0 0 440 170" role="img" aria-label={`${name}: floor setup diagram. ${wall?'Wall above, starting position below.':kind==='sight'?'Start below, obstacle in the middle, target above.':'Markers show the start and target; arrows show travel direction.'}`}>
  <defs><marker id={arrow} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8" fill="#cc1736"/></marker></defs>
  <rect x="8" y="8" width="424" height="154" rx="16" fill="#f5f7fa" stroke="#dce3eb"/>
  {wall?<><path d="M80 34 H360" stroke="#718096" strokeWidth="7"/><text x="220" y="25" textAnchor="middle">Solid wall</text><circle cx="220" cy="130" r="13" fill="#cc1736"/><text x="250" y="136">Start here</text>{kind==='wall'?<><path d="M198 110 L190 56 L235 109" fill="none" stroke="#cc1736" strokeWidth="3" markerEnd={`url(#${arrow})`}/><text x="80" y="92">Soft ball</text></>:<text x="220" y="81" textAnchor="middle">Stay within easy reach</text>}</>:
  kind==='chair'?<><path d="M80 34 H360" stroke="#718096" strokeWidth="7"/><text x="220" y="25" textAnchor="middle">Wall</text><rect x="182" y="40" width="76" height="45" rx="4" fill="#94a3b8"/><text x="275" y="69">Stable chair</text><circle cx="204" cy="122" r="9" fill="#cc1736"/><circle cx="236" cy="122" r="9" fill="#cc1736"/><text x="90" y="143">Feet in front of the seat</text></>:
  kind==='sight'?<><circle cx="220" cy="131" r="12" fill="#cc1736"/><rect x="178" y="73" width="84" height="20" rx="4" fill="#94a3b8"/><circle cx="220" cy="35" r="10" fill="#137f82"/><path d="M211 118 L163 72 L208 39 M229 118 L277 72 L232 39" fill="none" stroke="#cc1736" strokeWidth="2" strokeDasharray="5 5"/><text x="291" y="84">Chair</text><text x="243" y="40">Target</text></>:
  <><circle cx="93" cy="80" r="17" fill="#cc1736"/><circle cx="342" cy="80" r="17" fill="#137f82"/><path d="M126 80 H306" fill="none" stroke="#cc1736" strokeWidth="3" markerEnd={`url(#${arrow})`}/><text x="93" y="121" textAnchor="middle">Start</text><text x="342" y="121" textAnchor="middle">Target</text><text x="220" y="52" textAnchor="middle">Clear, non-slip space</text></>}
 </svg><figcaption>Setup view • not to scale. Follow the steps below for movement.</figcaption></figure>;
}
