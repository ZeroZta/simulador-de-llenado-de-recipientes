import { VesselProfile, validateProfileJSON } from './profile.js';

/** Sort and validate a traced boundary; equal-height conflicts are rejected. */
export function traceToBoundary(trace,tolerance=1e-9){
  if(!Array.isArray(trace)||trace.length<2)throw new TypeError('El trazo requiere al menos dos puntos');
  if(!Number.isFinite(tolerance)||tolerance<0)throw new RangeError('Tolerancia inválida');
  const pts=trace.map(p=>({x:Number(p.x),y:Number(p.y),...(p.slope===undefined?{}:{slope:Number(p.slope)})}));
  if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||(p.slope!==undefined&&!Number.isFinite(p.slope))))throw new TypeError('El trazo contiene coordenadas o pendientes no finitas');
  pts.sort((a,b)=>a.y-b.y);const out=[];
  for(const p of pts){const prev=out.at(-1);if(prev&&Math.abs(prev.y-p.y)<=tolerance){if(Math.abs(prev.x-p.x)>tolerance)throw new RangeError('El trazo no es una función x(y): hay dos x para una altura');continue;}out.push(p);}
  if(out.length<2)throw new RangeError('El trazo debe cubrir un intervalo vertical');return out;
}

/** Create a canonical model from aligned sampled/traced left and right walls. */
export function profileFromTraces({leftTrace,rightTrace,depth=1,segments}){
  const left=traceToBoundary(leftTrace),right=traceToBoundary(rightTrace);
  if(left.length!==right.length||left.some((p,i)=>Math.abs(p.y-right[i].y)>1e-9))throw new RangeError('Los trazos deben compartir alturas de muestreo');
  return new VesselProfile({depth,left,right,segments});
}
/** Create from canonical knot arrays; `segments[i]` applies to interval i→i+1. */
export function createProfile({left,right,depth=1,segments}){return new VesselProfile({depth,left,right,segments});}

/** Return a new profile with one interval kind changed; knots/slopes are preserved. */
export function setSegmentKind(profile,index,kind){
  if(!(profile instanceof VesselProfile))throw new TypeError('Se esperaba VesselProfile');
  if(!Number.isInteger(index)||index<0||index>=profile.segments.length)throw new RangeError('Índice de tramo inválido');
  if(kind!=='linear'&&kind!=='hermite')throw new TypeError('Tipo de tramo inválido');
  const segments=profile.segments.slice();segments[index]=kind;
  return new VesselProfile({depth:profile.depth,left:profile.left,right:profile.right,segments});
}

/** Convert a profile to its validated, versioned JSON representation. */
export function exportGeometry(profile){
  if(!(profile instanceof VesselProfile))throw new TypeError('Se esperaba VesselProfile');
  profile.validate();return JSON.stringify(profile.toJSON(),null,2);
}
/** Parse and validate v1 or v2 geometry; preserves interpolation kinds. */
export function importGeometry(json){const data=typeof json==='string'?JSON.parse(json):json;validateProfileJSON(data);return VesselProfile.fromJSON(data);}

/** Closed contour polyline suitable for SVG/canvas export; curves are sampled from the canonical model. */
export function profileOutline(profile,{samplesPerSegment=16}={}){
  if(!(profile instanceof VesselProfile))throw new TypeError('Se esperaba VesselProfile');
  return [...profile.sampleContour('left',{samplesPerSegment}),...profile.sampleContour('right',{samplesPerSegment}).reverse()];
}
/** Sample one canonical wall for SVG/canvas rendering. */
export function sampleProfileContour(profile,side='left',options={}){
  if(!(profile instanceof VesselProfile))throw new TypeError('Se esperaba VesselProfile');
  return profile.sampleContour(side,options);
}
