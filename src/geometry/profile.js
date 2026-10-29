/** Canonical piecewise extruded vessel profile; all coordinates/depths are SI metres. */
export class VesselProfile {
  /** @param {{depth?:number,left:Array,right:Array,segments?:Array<'linear'|'hermite'>}} options */
  constructor({ depth = 1, left, right, segments } = {}) {
    this.depth=Number(depth);
    this.left=normalizePoints(left,'límite izquierdo',segments);
    this.right=normalizePoints(right,'límite derecho',segments);
    this.yMin=this.left[0]?.y; this.yMax=this.left.at(-1)?.y;
    const n=Math.max(0,this.left.length-1);
    this.segments=segments===undefined?Array(n).fill('linear'):segments.slice();
    this.validate();
  }
  xLeft(y){return this._x(this.left,y);}
  xRight(y){return this._x(this.right,y);}
  width(y){return this.xRight(y)-this.xLeft(y);}
  area(y){return this.depth*this.width(y);}
  /** Return the active interval and normalized position at y. */
  segmentAt(y){
    assertY(y,this.yMin,this.yMax);
    let i;
    if(y===this.yMax)i=this.segments.length-1;
    else {let lo=0,hi=this.left.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(this.left[m].y<=y)lo=m;else hi=m;}i=lo;}
    return {index:i,kind:this.segments[i],y0:this.left[i].y,y1:this.left[i+1].y,t:(y-this.left[i].y)/(this.left[i+1].y-this.left[i].y)};
  }
  _x(points,y){
    const s=this.segmentAt(y),a=points[s.index],b=points[s.index+1];
    if(y===this.yMax)return b.x;
    if(s.kind==='linear')return a.x+(b.x-a.x)*s.t;
    return polynomial(hermiteCoefficients(a,b,b.y-a.y),s.t);
  }
  /** Exact antiderivative per linear or cubic Hermite interval, up to FP rounding. */
  volumeTo(y){
    assertY(y,this.yMin,this.yMax);let total=0;
    for(let i=0;i<this.segments.length;i++){
      const a=this.left[i],b=this.left[i+1],dy=b.y-a.y,end=Math.min(y,b.y);
      if(end<=a.y)continue;
      const t=(end-a.y)/dy;
      const wr=widthCoefficients(this.left[i],this.left[i+1],this.right[i],this.right[i+1],this.segments[i],dy);
      total += this.depth*dy*integralPolynomial(wr,t);
      if(y<=b.y)break;
    }
    return total;
  }
  get capacity(){return this.volumeTo(this.yMax);}
  /** Invert volume by bisection. Returned height is approximate (64 iterations). */
  heightAtVolume(volume){
    if(!Number.isFinite(volume)||volume<0||volume>this.capacity)throw new RangeError('Volumen fuera de la capacidad');
    if(volume===0)return this.yMin;if(volume===this.capacity)return this.yMax;
    let lo=this.yMin,hi=this.yMax;
    for(let n=0;n<64;n++){const m=(lo+hi)/2;if(this.volumeTo(m)<volume)lo=m;else hi=m;}
    return (lo+hi)/2;
  }
  /** Validate knots and prove positive width by checking every cubic's interior extrema (w=0 allowed only at yMin/yMax). */
  validate(){
    if(!(this.depth>0)||!Number.isFinite(this.depth))throw new RangeError('La profundidad debe ser finita y positiva');
    const n=this.left.length;
    if(n<2||this.right.length!==n)throw new RangeError('Cada límite requiere la misma cantidad de dos o más puntos');
    if(this.segments.length!==n-1||this.segments.some(k=>k!=='linear'&&k!=='hermite'))throw new RangeError('Segmentos inválidos');
    if(!(this.yMax>this.yMin))throw new RangeError('Se requiere yMin < yMax');
    for(let i=0;i<n;i++){
      const l=this.left[i],r=this.right[i];
      if(l.y!==r.y)throw new RangeError('Los dos límites deben compartir alturas');
      if(i&&!(l.y>this.left[i-1].y))throw new RangeError('Las alturas deben ser estrictamente crecientes');
      const knotWidth=r.x-l.x,isEnd=i===0||i===n-1;
      // Width 0 is allowed only at the base or the mouth (apex of a triangle/cone); an interior pinch would split the vessel.
      if(!Number.isFinite(knotWidth)||knotWidth<0||(knotWidth===0&&!isEnd))throw new RangeError(`Anchura no finita o no positiva en y=${l.y}`);
      if(this.segments[i-1]==='hermite'||this.segments[i]==='hermite')
        for(const s of [l,r])if(!Number.isFinite(s.slope))throw new RangeError(`Falta pendiente en nudo Hermite y=${s.y}`);
    }
    for(let i=0;i<this.segments.length;i++){
      const c=widthCoefficients(this.left[i],this.left[i+1],this.right[i],this.right[i+1],this.segments[i],this.left[i+1].y-this.left[i].y);
      for(const t of [...extrema(c),.5])if(t>0&&t<1){const w=polynomial(c,t);if(!Number.isFinite(w)||w<=0)throw new RangeError(`Anchura no finita o no positiva dentro del tramo ${i+1}`);}
    }
    const capacity=this.capacity;
    if(!Number.isFinite(capacity)||capacity<=0)throw new RangeError('La capacidad debe ser finita y positiva');
    return {valid:true,yMin:this.yMin,yMax:this.yMax,capacity};
  }
  /** JSON v1 retained for linear profiles; Hermite profiles use v2. */
  toJSON(){
    const hermite=this.segments.includes('hermite');
    // v2 always carries a finite slope at every knot; unused linear-only knot slopes are 0.
    const points=p=>p.map(q=>hermite?{x:q.x,y:q.y,slope:Number.isFinite(q.slope)?q.slope:0}:{x:q.x,y:q.y});
    return hermite?{version:2,type:'piecewise-hermite-extruded',depth:this.depth,left:points(this.left),right:points(this.right),segments:this.segments.slice()}:
      {version:1,type:'piecewise-linear-extruded',depth:this.depth,left:points(this.left),right:points(this.right)};
  }
  static fromJSON(data){validateProfileJSON(data);return new VesselProfile(data);}
  /** Render samples for one boundary; defaults to 16 samples per curved segment. */
  sampleContour(side='left',{samplesPerSegment=16}={}){
    if(side!=='left'&&side!=='right')throw new TypeError('side debe ser left o right');
    if(!Number.isInteger(samplesPerSegment)||samplesPerSegment<1)throw new RangeError('samplesPerSegment debe ser entero positivo');
    const points=this[side],out=[];
    for(let i=0;i<this.segments.length;i++){
      const count=this.segments[i]==='hermite'?samplesPerSegment:1, a=points[i],b=points[i+1];
      for(let j=0;j<count;j++){const t=j/count;out.push({x:this.segments[i]==='linear'?a.x+(b.x-a.x)*t:polynomial(hermiteCoefficients(a,b,b.y-a.y),t),y:a.y+(b.y-a.y)*t});}
    }
    out.push({...points.at(-1)});return out;
  }
}

function normalizePoints(points,label,segments){
  if(!Array.isArray(points))throw new TypeError(`${label}: se esperaba una lista de puntos`);
  return points.map((p,i)=>{const x=Number(p?.x),y=Number(p?.y);const q={x,y};if(p?.slope!==undefined)q.slope=Number(p.slope);if(!Number.isFinite(x)||!Number.isFinite(y)||(q.slope!==undefined&&!Number.isFinite(q.slope)))throw new TypeError(`${label}: punto ${i} no finito`);return q;});
}
function assertY(y,min,max){if(!Number.isFinite(y)||y<min||y>max)throw new RangeError('Altura fuera del dominio del perfil');}
function hermiteCoefficients(a,b,dy){const m0=a.slope*dy,m1=b.slope*dy;return [2*a.x-2*b.x+m0+m1,-3*a.x+3*b.x-2*m0-m1,m0,a.x];}
function polynomial(c,t){return ((c[0]*t+c[1])*t+c[2])*t+c[3];}
function integralPolynomial(c,t){return c[0]*t**4/4+c[1]*t**3/3+c[2]*t**2/2+c[3]*t;}
function widthCoefficients(l0,l1,r0,r1,kind,dy){const l=kind==='hermite'?hermiteCoefficients(l0,l1,dy):[0,0,l1.x-l0.x,l0.x],r=kind==='hermite'?hermiteCoefficients(r0,r1,dy):[0,0,r1.x-r0.x,r0.x];return l.map((v,i)=>r[i]-v);}
function extrema(c){const [a,b,d]=[3*c[0],2*c[1],c[2]];if(Math.abs(a)<1e-15)return Math.abs(b)<1e-15?[]:[-d/b];const disc=b*b-4*a*d;if(disc<0)return[];const s=Math.sqrt(disc);return [(-b-s)/(2*a),(-b+s)/(2*a)];}

/** Validate either supported versioned geometry object. */
export function validateProfileJSON(data){
  if(!data||typeof data!=='object')throw new TypeError('JSON de perfil inválido');
  if(data.version===1&&data.type==='piecewise-linear-extruded'){
    if(data.segments!==undefined)throw new TypeError('El formato v1 no admite segmentos');
    return new VesselProfile({depth:data.depth,left:data.left,right:data.right}).validate();
  }
  if(data.version===2&&data.type==='piecewise-hermite-extruded'){
    if(!Array.isArray(data.segments)||data.segments.length!==data.left?.length-1)throw new TypeError('Cantidad de segmentos v2 inválida');
    for(const side of ['left','right']) if(!Array.isArray(data[side])||data[side].some(p=>!Number.isFinite(p?.slope)))throw new TypeError(`El esquema v2 requiere pendientes finitas en ${side}`);
    return new VesselProfile(data).validate();
  }
  throw new TypeError('Formato de perfil o versión no admitidos');
}
