/** Recursive-descent parser for safe arithmetic in y. No eval or dynamic compilation. */
const FUNCS = new Set(['sin','cos','tan','asin','acos','atan','sqrt','abs','exp','ln','log','floor','ceil','round']);
const TOKEN = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:([eE][+-]?\d+))?|([A-Za-z_][A-Za-z_0-9]*)|([()+\-*/^,]))/gy;

export function parseExpression(source) {
  if (typeof source !== 'string' || source.length > 512) throw new SyntaxError('Expresión inválida o demasiado larga');
  const tokens=[]; let i=0;
  while (i < source.length) {
    TOKEN.lastIndex=i; const m=TOKEN.exec(source);
    if (!m) { if (/^\s*$/.test(source.slice(i))) { i=source.length; break; } throw new SyntaxError(`Carácter no permitido en posición ${i}`); }
    i=TOKEN.lastIndex;
    if (m[1] !== undefined) { const n=Number(m[1]+(m[2]||'')); if(!Number.isFinite(n)) throw new SyntaxError('Constante no finita'); tokens.push({k:'num',v:n}); }
    else if(m[3]) tokens.push({k:'id',v:m[3]}); else tokens.push({k:m[4],v:m[4]});
    if(tokens.length>256) throw new SyntaxError('Demasiados elementos');
  }
  let p=0; const peek=()=>tokens[p]; const take=()=>tokens[p++];
  function primary() {
    const t=take(); if(!t) throw new SyntaxError('Falta un operando');
    if(t.k==='num') return {type:'number',value:t.v};
    if(t.k==='(') { const n=add(); if(take()?.k!==')') throw new SyntaxError('Falta )'); return n; }
    if(t.k==='+'||t.k==='-') return {type:'unary',op:t.k,arg:primary()};
    if(t.k==='id') {
      if(t.v==='y') return {type:'variable',name:'y'};
      if(t.v==='pi') return {type:'number',value:Math.PI};
      if(t.v==='e') return {type:'number',value:Math.E};
      if(FUNCS.has(t.v)&&peek()?.k==='(') { take(); const arg=add(); if(take()?.k!==')') throw new SyntaxError('Falta ) en función'); return {type:'call',name:t.v,args:[arg]}; }
      throw new SyntaxError(`Identificador no permitido: ${t.v}`);
    }
    throw new SyntaxError('Se esperaba un número, y o paréntesis');
  }
  function power(){ let n=primary(); if(peek()?.k==='^'){take(); n={type:'binary',op:'^',left:n,right:unary()};} return n; }
  function unary(){ if(peek()?.k==='+'||peek()?.k==='-'){const op=take().k; return {type:'unary',op,arg:unary()};} return power(); }
  function mul(){let n=unary(); while(peek()?.k==='*'||peek()?.k==='/'){const op=take().k;n={type:'binary',op,left:n,right:unary()};}return n;}
  function add(){let n=mul();while(peek()?.k==='+'||peek()?.k==='-'){const op=take().k;n={type:'binary',op,left:n,right:mul()};}return n;}
  const ast=add(); if(p!==tokens.length) throw new SyntaxError(`Token inesperado: ${tokens[p].v}`); return ast;
}

export { evaluateExpression, expressionToString } from './expressions.js';
