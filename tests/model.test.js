import test from 'node:test';
import assert from 'node:assert/strict';
import { VesselProfile } from '../src/geometry/profile.js';
import { fillState, volumeAtHeight, heightAtVolume, timeToFill } from '../src/physics/model.js';
import { parseExpression } from '../src/math/parser.js';
import { evaluateExpression } from '../src/math/expressions.js';
import { profileFromTraces, importGeometry, exportGeometry } from '../src/geometry/editor.js';
import { saveDesign, listDesigns, DesignStorageError } from '../src/storage.js';

const profile=()=>new VesselProfile({depth:2,left:[{x:0,y:0},{x:0,y:2}],right:[{x:1,y:0},{x:1,y:2}]});
test('perfil extruido: área, capacidad y serialización',()=>{
  const p=profile();assert.equal(p.width(1),1);assert.equal(p.area(1),2);assert.equal(p.capacity,4);
  assert.deepEqual(VesselProfile.fromJSON(p.toJSON()).toJSON(),p.toJSON());
});
test('perfil rechaza anchos no positivos y alturas desalineadas',()=>{
  assert.throws(()=>new VesselProfile({depth:1,left:[{x:0,y:0},{x:1,y:1}],right:[{x:0,y:0},{x:1,y:1}]}),/Anchura/);
  assert.throws(()=>new VesselProfile({depth:1,left:[{x:0,y:0},{x:0,y:1}],right:[{x:1,y:0},{x:1,y:2}]}),/compartir alturas/);
});
test('integración, inversión y llenado respetan unidades y capacidad',()=>{
  const p=profile(),v=volumeAtHeight(p,1);assert.equal(v.value,2);assert.equal(v.method,'piecewise-polynomial-antiderivative');
  const h=heightAtVolume(p,3);assert.ok(Math.abs(h.value-1.5)<1e-8);assert.equal(timeToFill(p,.5),8);
  const s=fillState(p,{flowRate:.5,time:2});assert.equal(s.volume,1);assert.ok(Math.abs(s.height-.5)<1e-8);assert.equal(s.isOverflowing,false);
  const full=fillState(p,{flowRate:1,time:5});assert.equal(full.volume,4);assert.equal(full.overflowVolume,1);
});
test('parser evalúa expresiones aritméticas y bloquea sintaxis ejecutable',()=>{
  assert.equal(evaluateExpression(parseExpression('2*y + sqrt(9)'),3),9);
  assert.throws(()=>parseExpression('globalThis.process.exit()'));
});
test('perfil lineal variable coincide con integral trapezoidal y trazos exportan/importan',()=>{
  const p=new VesselProfile({depth:2,left:[{x:0,y:0},{x:0,y:2}],right:[{x:1,y:0},{x:3,y:2}]});
  assert.equal(p.capacity,8);assert.ok(Math.abs(volumeAtHeight(p,1).value-3)<1e-10);
  const traced=profileFromTraces({depth:2,leftTrace:[{x:0,y:0},{x:0,y:2}],rightTrace:[{x:1,y:0},{x:3,y:2}]});
  assert.deepEqual(importGeometry(JSON.stringify(traced.toJSON())).toJSON(),traced.toJSON());
  assert.throws(()=>importGeometry('{"version":99}'));
});
test('caudal cero mantiene volumen inicial y el parser rechaza división por cero',()=>{
  const p=profile(),state=fillState(p,{flowRate:0,initialVolume:2,time:100});
  assert.equal(state.volume,2);assert.equal(state.height,1);assert.equal(state.heightRate,0);
  assert.throws(()=>evaluateExpression(parseExpression('1/(y-y)'),1),/División por cero/);
});
test('Hermite cúbico usa antiderivada exacta y serializa segmentos mixtos',()=>{
  const curved=new VesselProfile({depth:1,left:[{x:0,y:0,slope:0},{x:0,y:1,slope:0}],right:[{x:1,y:0,slope:0},{x:2,y:1,slope:0}],segments:['hermite']});
  assert.equal(curved.capacity,1.5);assert.ok(Math.abs(curved.volumeTo(.5)-.59375)<1e-14);
  const measured=volumeAtHeight(curved,.5);assert.equal(measured.method,'piecewise-polynomial-antiderivative');assert.ok(Math.abs(measured.value-.59375)<1e-14);
  const mixed=new VesselProfile({depth:2,left:[{x:0,y:0,slope:0},{x:0,y:1,slope:0},{x:0,y:2}],right:[{x:1,y:0,slope:0},{x:2,y:1,slope:0},{x:2,y:2}],segments:['hermite','linear']});
  const restored=importGeometry(exportGeometry(mixed));assert.deepEqual(restored.segments,['hermite','linear']);assert.equal(restored.capacity,mixed.capacity);assert.equal(restored.xRight(.5),mixed.xRight(.5));
});
test('perfil Hermite rechaza cruce interior aunque los extremos tengan ancho positivo',()=>{
  assert.throws(()=>new VesselProfile({depth:1,left:[{x:0,y:0,slope:0},{x:0,y:1,slope:0}],right:[{x:1,y:0,slope:-10},{x:1,y:1,slope:10}],segments:['hermite']}),/Anchura no finita o no positiva dentro del tramo/);
});
test('biblioteca valida contenido antes de acceder a IndexedDB y reporta su ausencia',async()=>{
  const original=globalThis.indexedDB;
  try {
    delete globalThis.indexedDB;
    await assert.rejects(saveDesign({name:'Inválido',design:{format:'otro',version:1}}),e=>e instanceof DesignStorageError&&e.code==='INVALID_DESIGN');
    await assert.rejects(saveDesign({name:'Prueba',design:{format:'llenado-design',version:1,profile:profile().toJSON()}}),e=>e instanceof DesignStorageError&&e.code==='INDEXEDDB_UNAVAILABLE');
    await assert.rejects(saveDesign({name:'Caudal detenido',design:{format:'llenado-design',version:1,profile:profile().toJSON(),flowRate:0}}),e=>e instanceof DesignStorageError&&e.code==='INDEXEDDB_UNAVAILABLE');
    await assert.rejects(listDesigns(),e=>e instanceof DesignStorageError&&e.code==='INDEXEDDB_UNAVAILABLE');
  } finally { if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original; }
});

test('perfil triangular con punta (anchura cero en extremos) es admitido y calcula volumen correctamente',()=>{
  // Triángulo con vértice inferior en y=0 (punta hacia abajo)
  const triangleDown = new VesselProfile({
    depth: 1,
    left: [{ x: 0, y: 0 }, { x: -0.5, y: 1 }],
    right: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }]
  });
  assert.equal(triangleDown.width(0), 0);
  assert.equal(triangleDown.width(1), 1);
  // Área en la base: 0; en la boca: 1*1 = 1 m²; volumen total = base * h / 2 = 1 * 1 / 2 = 0.5 m³
  assert.ok(Math.abs(triangleDown.capacity - 0.5) < 1e-10);
  assert.ok(Math.abs(volumeAtHeight(triangleDown, 1).value - 0.5) < 1e-10);
  assert.ok(Math.abs(volumeAtHeight(triangleDown, 0.5).value - 0.125) < 1e-10);

  // Triángulo con vértice superior en y=1 (punta hacia arriba)
  const triangleUp = new VesselProfile({
    depth: 1,
    left: [{ x: -0.5, y: 0 }, { x: 0, y: 1 }],
    right: [{ x: 0.5, y: 0 }, { x: 0, y: 1 }]
  });
  assert.equal(triangleUp.width(0), 1);
  assert.equal(triangleUp.width(1), 0);
  assert.ok(Math.abs(triangleUp.capacity - 0.5) < 1e-10);

  // Pellizco interior (w=0 en el medio) sigue estando prohibido
  assert.throws(() => new VesselProfile({
    depth: 1,
    left: [{ x: -0.5, y: 0 }, { x: 0, y: 0.5 }, { x: -0.5, y: 1 }],
    right: [{ x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0.5, y: 1 }]
  }), /Anchura/);
});
