const NS='http://www.w3.org/2000/svg';
function el(name,attrs={}){const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
/** Draw a labeled native SVG line chart. Points are [x,y] numeric pairs. */
export function drawLineChart(svg,points,{xLabel='',yLabel='',color='#087e8b'}={}){
  svg.replaceChildren();const W=360,H=190,L=42,R=10,T=12,B=32,pw=W-L-R,ph=H-T-B;
  const valid=points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(!valid.length){svg.append(el('text',{x:W/2,y:H/2,'text-anchor':'middle'}));svg.lastChild.textContent='Sin datos';return;}
  let xmin=Math.min(...valid.map(p=>p[0])),xmax=Math.max(...valid.map(p=>p[0])),ymin=Math.min(...valid.map(p=>p[1])),ymax=Math.max(...valid.map(p=>p[1]));
  if(xmin===xmax){xmin-=.5;xmax+=.5;}if(ymin===ymax){const pad=Math.abs(ymin)*.1||.5;ymin-=pad;ymax+=pad;}
  const X=x=>L+(x-xmin)/(xmax-xmin)*pw,Y=y=>T+ph-(y-ymin)/(ymax-ymin)*ph;
  for(let i=0;i<3;i++){const y=T+i*ph/2;svg.append(el('line',{x1:L,y1:y,x2:W-R,y2:y,class:'gridline'}));}
  svg.append(el('line',{x1:L,y1:T,x2:L,y2:T+ph,class:'axis'}),el('line',{x1:L,y1:T+ph,x2:W-R,y2:T+ph,class:'axis'}));
  svg.append(el('text',{x:L,y:H-7}));svg.lastChild.textContent=xLabel;
  svg.append(el('text',{x:4,y:12}));svg.lastChild.textContent=yLabel;
  const path=el('path',{d:valid.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(2)},${Y(p[1]).toFixed(2)}`).join(' '),class:'series',stroke:color});svg.append(path);
}
export function profilePath(points, xMin, xMax, yMin, yMax, {left=true}={}){
  const x0=90,x1=330,top=28,bottom=320;
  const X=x=>x0+(x-xMin)/(xMax-xMin)*(x1-x0),Y=y=>bottom-(y-yMin)/(yMax-yMin)*(bottom-top);
  return points.map((p,i)=>`${i?'L':'M'}${X(p.x)},${Y(p.y)}`).join(' ');
}
