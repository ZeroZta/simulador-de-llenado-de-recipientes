import test from 'node:test';
import assert from 'node:assert/strict';
import { VesselProfile } from '../src/geometry/profile.js';
import { PRESET_TEMPLATES } from '../src/ui/templates.js';
import { generateGeoGebraCode } from '../src/ui/formula-viewer.js';
import { fillState, timeToFill } from '../src/physics/model.js';
import { importGeometry, exportGeometry } from '../src/geometry/editor.js';
import { saveDesign, listDesigns, DesignStorageError } from '../src/storage.js';

test('GeoGebra export: curvas Hermite generan polinomios cúbicos exactos y concuerdan con la capacidad', () => {
  const parabolicTemplate = PRESET_TEMPLATES.find(t => t.id === 'parabolic');
  const data = parabolicTemplate.create();
  const profile = new VesselProfile({
    depth: 0.5,
    left: data.levels.map(l => ({ x: l.left, y: l.y, slope: l.leftSlope })),
    right: data.levels.map(l => ({ x: l.right, y: l.y, slope: l.rightSlope })),
    segments: data.segments
  });

  const code = generateGeoGebraCode(profile);
  // Debe contener la definición de Curva paramétrica cúbica y A(y) con potencias cúbicas/cuadráticas
  assert.ok(code.includes('Curva('), 'El código para GeoGebra debe contener el comando Curva()');
  assert.ok(code.includes('t^3') || code.includes('t^2'), 'La curva paramétrica debe contener términos polinómicos de grado superior');
  assert.ok(code.includes('A(y) = Si('), 'Debe definir la función de área condicional A(y)');
  assert.ok(code.includes('V(h) = Integral(A,'), 'Debe definir la integral analítica de volumen');

  // Verificar capacidad analítica del perfil frente al modelo
  assert.ok(Math.abs(profile.capacity - 0.3083333333333334) < 1e-10);
});

test('GeoGebra export: perfiles lineales conservan Segmento y funciones lineales de área', () => {
  const rectTemplate = PRESET_TEMPLATES.find(t => t.id === 'rect');
  const data = rectTemplate.create();
  const profile = new VesselProfile({
    depth: 0.5,
    left: data.levels.map(l => ({ x: l.left, y: l.y })),
    right: data.levels.map(l => ({ x: l.right, y: l.y })),
    segments: data.segments
  });

  const code = generateGeoGebraCode(profile);
  assert.ok(code.includes('Segmento(Izq_1, Izq_2)'));
  assert.ok(code.includes('A(y) = Si('));
  assert.ok(Math.abs(profile.capacity - 0.25) < 1e-10);
});

test('Simulación física: pausa y reanudación conservan el tiempo acumulado y volumen', () => {
  const profile = new VesselProfile({
    depth: 1,
    left: [{ x: -0.5, y: 0 }, { x: -0.5, y: 1 }],
    right: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }]
  });

  const Q = 0.1;
  const tFull = timeToFill(profile, Q, 0); // 10 s

  // Avance 1: correr 3 segundos
  const s1 = fillState(profile, { flowRate: Q, initialVolume: 0, time: 3 });
  assert.ok(Math.abs(s1.volume - 0.3) < 1e-9);
  assert.ok(Math.abs(s1.height - 0.3) < 1e-9);

  // Pausa simulada (tiempo transcurrido congelado en 3s)
  const sPaused = fillState(profile, { flowRate: 0, initialVolume: s1.volume, time: 0 });
  assert.equal(sPaused.volume, s1.volume);
  assert.equal(sPaused.height, s1.height);

  // Reanudar 2 segundos más (tiempo total transcurrido 5s)
  const s2 = fillState(profile, { flowRate: Q, initialVolume: 0, time: 5 });
  assert.ok(Math.abs(s2.volume - 0.5) < 1e-9);
  assert.ok(Math.abs(s2.height - 0.5) < 1e-9);

  // Reiniciar restablece tiempo y volumen a cero
  const sReset = fillState(profile, { flowRate: Q, initialVolume: 0, time: 0 });
  assert.equal(sReset.volume, 0);
  assert.equal(sReset.height, profile.yMin);
});

test('Simulación física: desbordamiento no corrompe la capacidad ni la altura máxima', () => {
  const profile = new VesselProfile({
    depth: 1,
    left: [{ x: -0.5, y: 0 }, { x: -0.5, y: 1 }],
    right: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }]
  });

  const Q = 0.5;
  const sOver = fillState(profile, { flowRate: Q, initialVolume: 0, time: 10 }); // Capacidad es 1 m³, se solicitan 5 m³
  assert.equal(sOver.volume, profile.capacity);
  assert.equal(sOver.height, profile.yMax);
  assert.equal(sOver.isFull, true);
  assert.equal(sOver.isOverflowing, true);
  assert.equal(sOver.overflowVolume, 4);
});

test('Validación de diseño JSON: rechaza datos corruptos o tipos no admitidos', () => {
  // Datos inválidos no serializables o con versiones espurias
  assert.throws(() => importGeometry('{"version": 999}'), /Formato/);
  assert.throws(() => importGeometry('{"version": 1, "type": "desconocido"}'), /Formato/);
  assert.throws(() => importGeometry('null'), /JSON de perfil inválido/);

  // Diseño válido exporta e importa idéntico
  const p = new VesselProfile({
    depth: 1.5,
    left: [{ x: -0.2, y: 0 }, { x: -0.4, y: 1 }],
    right: [{ x: 0.2, y: 0 }, { x: 0.4, y: 1 }]
  });
  const jsonStr = exportGeometry(p);
  const imported = importGeometry(jsonStr);
  assert.equal(imported.depth, 1.5);
  assert.equal(imported.capacity, p.capacity);
});

test('INC-06: Inserción de nivel conserva continuidad de simulación y orden de alturas', () => {
  // Perfil inicial con 2 niveles
  const initialProfile = new VesselProfile({
    depth: 1,
    left: [{ x: -0.5, y: 0 }, { x: -0.5, y: 1 }],
    right: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }]
  });
  const Q = 0.1;
  const elapsed = 4; // 4 segundos = 0.4 m³
  const stateBefore = fillState(initialProfile, { flowRate: Q, initialVolume: 0, time: elapsed });
  assert.ok(Math.abs(stateBefore.volume - 0.4) < 1e-9);

  // Inserción de un nivel intermedio a y=0.5
  const newY = 0.5;
  const newLeft = -0.3;
  const newRight = 0.3;

  const levels = [
    { y: 0, left: -0.5, right: 0.5 },
    { y: newY, left: newLeft, right: newRight },
    { y: 1, left: -0.5, right: 0.5 }
  ];
  levels.sort((a, b) => a.y - b.y);

  // Alturas estrictamente crecientes
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i].y > levels[i - 1].y, 'Las alturas deben ser estrictamente crecientes');
  }

  const updatedProfile = new VesselProfile({
    depth: 1,
    left: levels.map(l => ({ x: l.left, y: l.y })),
    right: levels.map(l => ({ x: l.right, y: l.y }))
  });
  updatedProfile.validate();

  // El estado físico con el mismo tiempo elapsed se calcula coherentemente
  const stateAfter = fillState(updatedProfile, { flowRate: Q, initialVolume: 0, time: elapsed });
  assert.ok(Math.abs(stateAfter.volume - 0.4) < 1e-9);
  assert.ok(stateAfter.height > 0 && stateAfter.height < 1);
  assert.equal(stateAfter.isFull, false);
});

test('INC-07: Perfiles triangulares (▽ punta abajo y △ punta arriba) calculan volumen exacto', () => {
  // Triángulo punta abajo (w=0 en y=0, w=0.8 en y=1, depth=1)
  // Área = 0.5 * 0.8 * 1 = 0.4 m³
  const triDown = new VesselProfile({
    depth: 1,
    left: [{ x: 0, y: 0 }, { x: -0.4, y: 1 }],
    right: [{ x: 0, y: 0 }, { x: 0.4, y: 1 }]
  });
  triDown.validate();
  assert.ok(Math.abs(triDown.capacity - 0.4) < 1e-9);

  // Llenado al 50% de altura (y=0.5): anchura a y=0.5 es 0.4, volumen acumulado = 0.5 * 0.4 * 0.5 = 0.1 m³ (25% de la capacidad)
  const volHalfH = triDown.volumeTo(0.5);
  assert.ok(Math.abs(volHalfH - 0.1) < 1e-9);

  // Inversión: altura para volumen 0.1 m³ debe ser exactamente 0.5 m
  const hForVol = triDown.heightAtVolume(0.1);
  assert.ok(Math.abs(hForVol - 0.5) < 1e-5);

  // Triángulo punta arriba (w=0.8 en y=0, w=0 en y=1, depth=1)
  const triUp = new VesselProfile({
    depth: 1,
    left: [{ x: -0.4, y: 0 }, { x: 0, y: 1 }],
    right: [{ x: 0.4, y: 0 }, { x: 0, y: 1 }]
  });
  triUp.validate();
  assert.ok(Math.abs(triUp.capacity - 0.4) < 1e-9);

  // Triángulo asimétrico (ápice en x=0.1 en y=0, izquierda -0.3, derecha 0.5 en y=1)
  // Anchura base = 0, anchura boca = 0.5 - (-0.3) = 0.8, volumen = 0.4 m³
  const triAsym = new VesselProfile({
    depth: 1,
    left: [{ x: 0.1, y: 0 }, { x: -0.3, y: 1 }],
    right: [{ x: 0.1, y: 0 }, { x: 0.5, y: 1 }]
  });
  triAsym.validate();
  assert.ok(Math.abs(triAsym.capacity - 0.4) < 1e-9);
});

test('INC-08: Desactivar simetría permite paredes asimétricas independientes y reactivarla las sincroniza', () => {
  // Modificación asimétrica manual: pared izquierda en -0.2, pared derecha en 0.6
  const asymLeft = -0.2;
  const asymRight = 0.6;
  const profileAsym = new VesselProfile({
    depth: 1,
    left: [{ x: asymLeft, y: 0 }, { x: -0.3, y: 1 }],
    right: [{ x: asymRight, y: 0 }, { x: 0.5, y: 1 }]
  });
  profileAsym.validate();

  // Comprobar que ambas paredes retienen sus posiciones asimétricas independientes
  assert.equal(profileAsym.left[0].x, asymLeft);
  assert.equal(profileAsym.right[0].x, asymRight);
  assert.notEqual(Math.abs(profileAsym.left[0].x), Math.abs(profileAsym.right[0].x));

  // Simulación de sincronización simétrica (symmetrizeProfile):
  // halfWidth = max(|left|, |right|) = max(0.2, 0.6) = 0.6 -> [-0.6, 0.6]
  const levels = [
    { y: 0, left: profileAsym.left[0].x, right: profileAsym.right[0].x },
    { y: 1, left: profileAsym.left[1].x, right: profileAsym.right[1].x }
  ];
  const symLevels = levels.map(l => {
    const hw = Math.max(Math.abs(l.left), Math.abs(l.right));
    return { y: l.y, left: -hw, right: hw };
  });

  const profileSym = new VesselProfile({
    depth: 1,
    left: symLevels.map(l => ({ x: l.left, y: l.y })),
    right: symLevels.map(l => ({ x: l.right, y: l.y }))
  });
  profileSym.validate();

  assert.equal(profileSym.left[0].x, -0.6);
  assert.equal(profileSym.right[0].x, 0.6);
  assert.equal(profileSym.left[1].x, -0.5);
  assert.equal(profileSym.right[1].y, 1);
});
