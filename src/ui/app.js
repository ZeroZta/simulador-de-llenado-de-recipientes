/**
 * Llenado - Simulador de Recipientes Extruidos
 * Orquestador principal modularizado y limpio.
 */

import { VesselProfile } from '../geometry/profile.js';
import { setSegmentKind } from '../geometry/editor.js';
import { listDesigns, getDesign, saveDesign, renameDesign, deleteDesign } from '../storage.js';
import { fillState, volumeAtHeight, timeToFill } from '../physics/model.js';
import { parseExpression, evaluateExpression } from '../math/parser.js';
import { drawLineChart } from './charts.js';
import { CartesianEditor } from './cartesian-editor.js';
import { renderCleanView } from './clean-view.js';
import { renderFormulas } from './formula-viewer.js';
import { PRESET_TEMPLATES } from './templates.js';

const $ = id => document.getElementById(id);

// Estado de la aplicación
let profile = null;
let state = null;
let running = false;
let playState = 'idle'; // 'idle' | 'running' | 'paused' | 'finished'
let elapsed = 0;
let lastFrame = 0;
let raf = 0;
let activeDesignId = null;
let history = [];
let historyIndex = -1;
let historyTimer = 0;
let rowSequence = 0;

// Componentes
let cartesianEditor = null;

const rows = $('pointRows');

function num(id) {
  return Number($(id).value);
}

function say(message, good = false) {
  const n = $('notice');
  if (!n) return;
  n.textContent = message;
  n.className = `notice${good ? ' good' : ''}`;
}

function fmt(v, d = 4) {
  return Number.isFinite(v) ? Number(v).toLocaleString('es-MX', { maximumFractionDigits: d }) : '—';
}

function getLevelsFromTable() {
  return [...rows.querySelectorAll('tr')].map(tr => ({
    y: Number(tr.querySelector('[data-y]').value),
    left: Number(tr.querySelector('[data-left]').value),
    right: Number(tr.querySelector('[data-right]').value),
    leftSlope: tr.querySelector('[data-left-slope]').value === '' ? undefined : Number(tr.querySelector('[data-left-slope]').value),
    rightSlope: tr.querySelector('[data-right-slope]').value === '' ? undefined : Number(tr.querySelector('[data-right-slope]').value)
  }));
}

function addRow(p = { y: 1, left: -0.4, right: 0.4 }) {
  const tr = document.createElement('tr');
  tr.dataset.rowId = String(++rowSequence);
  tr.innerHTML = `
    <td><input data-y type="number" step="any" value="${p.y}" aria-label="Altura y"></td>
    <td><input data-left type="number" step="any" value="${p.left}" aria-label="Límite izquierdo x"></td>
    <td><input data-right type="number" step="any" value="${p.right}" aria-label="Límite derecho x"></td>
    <td><input data-left-slope type="number" step="any" value="${Number.isFinite(p.leftSlope) ? p.leftSlope : ''}" aria-label="Pendiente izq"></td>
    <td><input data-right-slope type="number" step="any" value="${Number.isFinite(p.rightSlope) ? p.rightSlope : ''}" aria-label="Pendiente der"></td>
    <td><button type="button" aria-label="Eliminar nivel">×</button></td>
  `;

  tr.querySelector('button').addEventListener('click', () => {
    if (rows.children.length <= 2) return say('El perfil requiere al menos dos niveles.');
    const ordered = [...rows.children].sort((a, b) => Number(a.querySelector('[data-y]').value) - Number(b.querySelector('[data-y]').value));
    const index = ordered.indexOf(tr);
    if (profile?.segments?.length === ordered.length - 1) {
      const kinds = profile.segments.slice();
      if (index === 0) kinds.splice(0, 1);
      else if (index === ordered.length - 1) kinds.splice(index - 1, 1);
      else kinds.splice(index - 1, 2, 'linear');
      profile.segments = kinds;
    }
    tr.remove();
    refresh();
    commitHistory();
  });

  // Mantener las filas del DOM ordenadas estrictamente por y
  const existingRows = [...rows.querySelectorAll('tr')];
  const nextRow = existingRows.find(r => Number(r.querySelector('[data-y]').value) > p.y);
  if (nextRow) {
    rows.insertBefore(tr, nextRow);
  } else {
    rows.append(tr);
  }
}

function buildProfileFromTable() {
  const p = getLevelsFromTable().sort((a, b) => a.y - b.y);
  const segments = profile?.segments?.length === p.length - 1 ? profile.segments.slice() : Array(Math.max(0, p.length - 1)).fill('linear');
  const withSlope = (x, y, value, source) => Number.isFinite(value) ? { x, y, slope: value } : (Number.isFinite(source?.slope) ? { x, y, slope: source.slope } : { x, y });

  return new VesselProfile({
    depth: num('depth'),
    left: p.map((q, i) => withSlope(q.left, q.y, q.leftSlope, profile?.left?.[i])),
    right: p.map((q, i) => withSlope(q.right, q.y, q.rightSlope, profile?.right?.[i])),
    segments
  });
}

function refresh({ charts = true, full = true } = {}) {
  try {
    const nextProfile = buildProfileFromTable();
    nextProfile.validate();
    profile = nextProfile; // Sólo sustituir si la validación geométrica es exitosa

    const Q = num('flow');
    const V0 = num('initialVolume');
    state = fillState(profile, { flowRate: Q, initialVolume: V0, time: elapsed });

    // Actualizar métricas numéricas
    $('capacityValue').textContent = fmt(profile.capacity);
    $('volumeValue').textContent = fmt(state.volume);
    $('heightValue').textContent = fmt(state.height);
    $('fillTimeValue').textContent = fmt(timeToFill(profile, Q, V0));
    $('timeReadout').textContent = `${fmt(elapsed, 2)} s`;

    const fullTime = timeToFill(profile, Q, V0);
    $('timeRange').max = String(Number.isFinite(fullTime) && fullTime > 0 ? fullTime : 100);
    $('timeRange').value = String(Math.min(elapsed, Number($('timeRange').max)));

    // 1. Actualizar Editor Cartesiano
    if (cartesianEditor) {
      cartesianEditor.updateData({ profile, state, levelsData: full ? getLevelsFromTable() : null });
    }

    // 2. Actualizar Vista Limpia del Recipiente
    const cleanSvg = $('cleanVesselSvg');
    if (cleanSvg) {
      renderCleanView({ svg: cleanSvg, profile, state, showDimensions: true });
    }

    // 3. Actualizar Visualizador de Fórmulas Analíticas Reales (solo en actualización completa)
    if (full) {
      const formulaContainer = $('formulaBreakdownContainer');
      if (formulaContainer) {
        renderFormulas({ container: formulaContainer, profile, flowRate: Q });
      }
    }

    // 4. Actualizar Gráficas de Análisis
    if (charts) renderCharts();

    $('notice').textContent = '';
    $('notice').className = 'notice';
    return true;
  } catch (e) {
    say(e.message);
    return false;
  }
}

function renderCharts() {
  const n = 60;
  const heights = Array.from({ length: n + 1 }, (_, i) => profile.yMin + (profile.yMax - profile.yMin) * i / n);
  const Q = num('flow');
  const V0 = num('initialVolume');
  const full = timeToFill(profile, Q, V0);

  const ht = Q > 0 ? heights.map(h => {
    const v = volumeAtHeight(profile, h).value;
    return [Math.max(0, (v - V0) / Q), h];
  }) : [[0, fillState(profile, { flowRate: 0, initialVolume: V0, time: 0 }).height], [1, fillState(profile, { flowRate: 0, initialVolume: V0, time: 0 }).height]];

  const vt = Q > 0 ? [[0, V0], [Number.isFinite(full) ? full : 1, profile.capacity]] : [[0, V0], [1, V0]];

  drawLineChart($('heightChart'), ht, { xLabel: 'tiempo (s)', yLabel: 'altura (m)' });
  drawLineChart($('volumeChart'), vt, { xLabel: 'tiempo (s)', yLabel: 'volumen (m³)' });
  drawLineChart($('areaChart'), heights.map(h => [h, profile.area(h)]), { xLabel: 'altura (m)', yLabel: 'área (m²)' });
  drawLineChart($('widthChart'), heights.map(h => [h, profile.width(h)]), { xLabel: 'altura (m)', yLabel: 'ancho (m)' });
}

// Control de Historial (Deshacer/Rehacer)
function captureState() {
  return {
    points: getLevelsFromTable(),
    segments: profile?.segments?.slice() || [],
    depth: $('depth').value,
    flow: $('flow').value,
    initialVolume: $('initialVolume').value,
    elapsed
  };
}

function updateHistoryButtons() {
  $('undoBtn').disabled = historyIndex <= 0;
  $('redoBtn').disabled = historyIndex < 0 || historyIndex >= history.length - 1;
}

function commitHistory() {
  clearTimeout(historyTimer);
  const next = captureState();
  if (historyIndex < 0) {
    history = [next];
    historyIndex = 0;
  } else if (JSON.stringify(history[historyIndex]) !== JSON.stringify(next)) {
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    historyIndex++;
  }
  updateHistoryButtons();
}

function restoreHistory(index) {
  if (index < 0 || index >= history.length) return;
  historyIndex = index;
  const s = history[index];
  rows.replaceChildren();
  s.points.forEach(addRow);
  $('depth').value = s.depth;
  $('flow').value = s.flow;
  $('initialVolume').value = s.initialVolume;
  elapsed = s.elapsed;
  try {
    profile = new VesselProfile({
      depth: Number(s.depth),
      left: s.points.map(p => Number.isFinite(p.leftSlope) ? { x: p.left, y: p.y, slope: p.leftSlope } : { x: p.left, y: p.y }),
      right: s.points.map(p => Number.isFinite(p.rightSlope) ? { x: p.right, y: p.y, slope: p.rightSlope } : { x: p.right, y: p.y }),
      segments: s.segments
    });
    refresh();
  } catch (e) {
    say(`No se pudo restaurar: ${e.message}`);
  }
  updateHistoryButtons();
}

// Estado y control unificado de reproducción (INC-04 e INC-06)
function updatePlayButton() {
  const btn = $('startBtn');
  if (!btn) return;
  if (playState === 'running') {
    btn.textContent = '⏸ Pausar';
    btn.setAttribute('aria-label', 'Pausar simulación');
  } else if (playState === 'paused') {
    btn.textContent = '▶ Continuar';
    btn.setAttribute('aria-label', 'Continuar simulación');
  } else if (playState === 'finished') {
    btn.textContent = '↺ Repetir';
    btn.setAttribute('aria-label', 'Repetir simulación desde el inicio');
  } else {
    btn.textContent = '▶ Iniciar';
    btn.setAttribute('aria-label', 'Iniciar simulación');
  }
}

function startSimulation() {
  if (!refresh({ charts: false, full: false })) return;
  // Cancelar cualquier animación previa para evitar bucles concurrentes (ERR-01)
  cancelAnimationFrame(raf);
  running = true;
  playState = 'running';
  lastFrame = 0;
  updatePlayButton();
  raf = requestAnimationFrame(frame);
}

function pauseSimulation() {
  running = false;
  playState = 'paused';
  cancelAnimationFrame(raf);
  updatePlayButton();
}

function resetSimulation() {
  running = false;
  playState = 'idle';
  cancelAnimationFrame(raf);
  elapsed = 0;
  refresh({ charts: true, full: true });
  updatePlayButton();
}

function togglePlayPause() {
  if (playState === 'running') {
    pauseSimulation();
  } else if (playState === 'finished') {
    resetSimulation();
    startSimulation();
  } else {
    startSimulation();
  }
}

// Bucle de Simulación Física en Tiempo Real
function frame(ts) {
  if (!running) return;
  if (!lastFrame) lastFrame = ts;
  elapsed += (ts - lastFrame) / 1000;
  lastFrame = ts;

  try {
    state = fillState(profile, { flowRate: num('flow'), initialVolume: num('initialVolume'), time: elapsed });
    $('volumeValue').textContent = fmt(state.volume);
    $('heightValue').textContent = fmt(state.height);
    $('timeReadout').textContent = `${fmt(elapsed, 2)} s`;
    $('timeRange').value = String(Math.min(elapsed, Number($('timeRange').max)));

    // INC-02: Actualizar ambas vistas sincronizadas con el estado físico real
    if (cartesianEditor) cartesianEditor.updateState(state);
    const cleanSvg = $('cleanVesselSvg');
    if (cleanSvg) renderCleanView({ svg: cleanSvg, profile, state, showDimensions: true });

    if (state.isFull) {
      running = false;
      playState = 'finished';
      cancelAnimationFrame(raf);
      updatePlayButton();
      say('Recipiente lleno.', true);
      return;
    }
  } catch (e) {
    running = false;
    playState = 'idle';
    cancelAnimationFrame(raf);
    updatePlayButton();
    say(e.message);
    return;
  }
  raf = requestAnimationFrame(frame);
}

// Aplicar Plantilla
function applyTemplate(templateId) {
  const tpl = PRESET_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return;
  const data = tpl.create();
  rows.replaceChildren();
  data.levels.forEach(addRow);
  if (profile) profile.segments = data.segments.slice();
  refresh({ charts: true, full: true });
  commitHistory();
  say(`Plantilla "${tpl.name}" aplicada.`, true);
}

// Gestión de biblioteca IndexedDB y exportación/importación JSON (ERR-04)
async function refreshSavedDesignsList() {
  const sel = $('savedDesignsSelect');
  const delBtn = $('deleteDesignBtn');
  if (!sel) return;
  try {
    const list = await listDesigns();
    sel.replaceChildren();
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = list.length ? `📂 Biblioteca local (${list.length})…` : '📂 Biblioteca local (vacía)…';
    sel.append(defaultOpt);
    for (const item of list) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.name} (${new Date(item.updatedAt).toLocaleDateString()})`;
      if (item.id === activeDesignId) opt.selected = true;
      sel.append(opt);
    }
    if (delBtn) delBtn.style.display = activeDesignId ? 'inline-block' : 'none';
  } catch {
    sel.replaceChildren();
    const errOpt = document.createElement('option');
    errOpt.value = '';
    errOpt.textContent = '📂 Biblioteca (no disponible)';
    sel.append(errOpt);
    if (delBtn) delBtn.style.display = 'none';
  }
}

async function saveCurrentDesign() {
  try {
    if (!refresh()) return;
    const name = window.prompt('Nombre del diseño para guardar en la biblioteca local:', 'Mi Recipiente');
    if (!name || !name.trim()) return;
    const design = {
      format: 'llenado-design',
      version: 1,
      profile: profile.toJSON(),
      flowRate: num('flow'),
      initialVolume: num('initialVolume')
    };
    const saved = await saveDesign({ name: name.trim(), design });
    activeDesignId = saved.id;
    say(`Diseño "${saved.name}" guardado en la biblioteca.`, true);
    await refreshSavedDesignsList();
  } catch (e) {
    say(`No se pudo guardar: ${e.message}`);
  }
}

async function loadSelectedDesign(id) {
  if (!id) {
    activeDesignId = null;
    const delBtn = $('deleteDesignBtn');
    if (delBtn) delBtn.style.display = 'none';
    return;
  }
  try {
    const record = await getDesign(id);
    if (!record || !record.design) throw new Error('Diseño no encontrado');
    applyDesignData(record.design);
    activeDesignId = record.id;
    say(`Diseño "${record.name}" cargado.`, true);
    await refreshSavedDesignsList();
  } catch (e) {
    say(`Error al abrir diseño: ${e.message}`);
  }
}

async function deleteSelectedDesign() {
  if (!activeDesignId) return;
  if (!window.confirm('¿Deseas eliminar este diseño de la biblioteca?')) return;
  try {
    await deleteDesign(activeDesignId);
    activeDesignId = null;
    say('Diseño eliminado de la biblioteca.', true);
    await refreshSavedDesignsList();
  } catch (e) {
    say(`Error al eliminar: ${e.message}`);
  }
}

function applyDesignData(design) {
  if (!design || design.format !== 'llenado-design') {
    throw new Error('Formato de diseño inválido. Se requiere "llenado-design".');
  }
  const prof = VesselProfile.fromJSON(design.profile);
  rows.replaceChildren();
  for (let i = 0; i < prof.left.length; i++) {
    addRow({
      y: prof.left[i].y,
      left: prof.left[i].x,
      right: prof.right[i].x,
      leftSlope: prof.left[i].slope,
      rightSlope: prof.right[i].slope
    });
  }
  $('depth').value = String(prof.depth);
  if (Number.isFinite(design.flowRate)) $('flow').value = String(design.flowRate);
  if (Number.isFinite(design.initialVolume)) $('initialVolume').value = String(design.initialVolume);
  elapsed = 0;
  profile = prof;
  refresh({ charts: true, full: true });
  commitHistory();
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    applyDesignData(data);
    say(`Diseño importado correctamente desde "${file.name}".`, true);
  } catch (e) {
    say(`Error al importar archivo JSON: ${e.message}`);
  }
}

// Inicialización
function init() {
  // Inicializar editor cartesiano
  cartesianEditor = new CartesianEditor({
    svg: $('profileSvg'),
    onProfileChange: update => {
      if (update.action === 'insertLevel') {
        const wasRunning = running;
        addRow({ y: update.y, left: update.leftX, right: update.rightX });
        const ok = refresh({ charts: true, full: true });
        if (ok && wasRunning) {
          running = true;
          playState = 'running';
          updatePlayButton();
        }
        commitHistory();
        return;
      }
      if (update.action === 'deleteLevel') {
        const trs = [...rows.children].sort((a, b) => Number(a.querySelector('[data-y]').value) - Number(b.querySelector('[data-y]').value));
        const tr = trs[update.index];
        if (tr) {
          const btn = tr.querySelector('button');
          if (btn) btn.click();
        }
        return;
      }
      if (update.index !== undefined) {
        const trs = [...rows.children].sort((a, b) => Number(a.querySelector('[data-y]').value) - Number(b.querySelector('[data-y]').value));
        const tr = trs[update.index];
        if (tr) {
          if (update.y !== undefined) tr.querySelector('[data-y]').value = String(update.y);
          if (update.leftX !== undefined) tr.querySelector('[data-left]').value = String(update.leftX);
          if (update.rightX !== undefined) tr.querySelector('[data-right]').value = String(update.rightX);
        }
        // INC-05: Durante arrastre continuo, omitir recálculo de fórmulas y gráficas pesadas
        if (update.isFinished) {
          refresh({ charts: true, full: true });
          commitHistory();
        } else {
          refresh({ charts: false, full: false });
        }
      }
    },
    onStatusMessage: msg => say(msg)
  });

  // Sincronizar estado inicial del checkbox de simetría con el editor
  const symCheckbox = $('symmetryMode');
  if (symCheckbox) {
    cartesianEditor.setSymmetric(symCheckbox.checked);
  }

  // Herramientas del plano cartesiano
  $('toolEdit').addEventListener('click', () => {
    cartesianEditor.setTool('edit');
    $('toolEdit').setAttribute('aria-pressed', 'true');
    $('toolInsert').setAttribute('aria-pressed', 'false');
    $('toolPan').setAttribute('aria-pressed', 'false');
  });

  $('toolInsert').addEventListener('click', () => {
    cartesianEditor.setTool('insert');
    $('toolEdit').setAttribute('aria-pressed', 'false');
    $('toolInsert').setAttribute('aria-pressed', 'true');
    $('toolPan').setAttribute('aria-pressed', 'false');
  });

  $('toolPan').addEventListener('click', () => {
    cartesianEditor.setTool('pan');
    $('toolEdit').setAttribute('aria-pressed', 'false');
    $('toolInsert').setAttribute('aria-pressed', 'false');
    $('toolPan').setAttribute('aria-pressed', 'true');
  });

  $('snapGrid').addEventListener('change', e => {
    cartesianEditor.setSnap(e.target.checked);
  });

  if ($('lockViewMode')) {
    $('lockViewMode').addEventListener('change', e => {
      cartesianEditor.setViewLocked(e.target.checked);
      say(e.target.checked ? 'Vista fija activada (el plano no saltará al editar).' : 'Vista dinámica activada.', true);
    });
  }
  $('symmetryMode').addEventListener('change', e => {
    const isSym = e.target.checked;
    cartesianEditor.setSymmetric(isSym);
    if (isSym) {
      cartesianEditor.symmetrizeProfile();
      say('Modo simétrico activado (las dos paredes se sincronizan simétricamente).', true);
    } else {
      say('Modo simétrico desactivado (edición libre e independiente por pared).', true);
    }
  });

  $('zoomIn').addEventListener('click', () => cartesianEditor.zoomAt(210, 180, 1.25));
  $('zoomOut').addEventListener('click', () => cartesianEditor.zoomAt(210, 180, 0.8));
  $('resetView').addEventListener('click', () => cartesianEditor.resetView());

  $('undoBtn').addEventListener('click', () => restoreHistory(historyIndex - 1));
  $('redoBtn').addEventListener('click', () => restoreHistory(historyIndex + 1));

  // Selector de plantillas
  const templateSelect = $('templateSelect');
  if (templateSelect) {
    PRESET_TEMPLATES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      templateSelect.append(opt);
    });
    templateSelect.addEventListener('change', e => {
      if (e.target.value) {
        applyTemplate(e.target.value);
        e.target.value = '';
      }
    });
  }

  // Controles de simulación unificados (INC-04)
  $('startBtn').addEventListener('click', () => {
    togglePlayPause();
  });

  $('resetBtn').addEventListener('click', () => {
    resetSimulation();
  });

  $('timeRange').addEventListener('input', () => {
    if (running) {
      pauseSimulation();
    } else {
      playState = 'paused';
      updatePlayButton();
    }
    elapsed = Number($('timeRange').value);
    refresh({ charts: false, full: false });
  });

  $('timeRange').addEventListener('change', () => {
    refresh({ charts: true, full: true });
  });

  // Inputs de parámetros
  for (const id of ['depth', 'flow', 'initialVolume']) {
    $(id).addEventListener('input', () => {
      refresh({ charts: true, full: true });
      commitHistory();
    });
  }

  // Agregar fila
  $('addRowBtn').addEventListener('click', () => {
    const wasRunning = running;
    const p = getLevelsFromTable().sort((a, b) => a.y - b.y).at(-1) || { y: 0, left: -0.2, right: 0.2 };
    addRow({ y: p.y + 0.5, left: p.left - 0.1, right: p.right + 0.1 });
    const ok = refresh({ charts: true, full: true });
    if (ok && wasRunning) {
      running = true;
      playState = 'running';
      updatePlayButton();
    }
    commitHistory();
  });

  rows.addEventListener('input', () => {
    refresh({ charts: false, full: false });
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      refresh({ charts: true, full: true });
      commitHistory();
    }, 450);
  });

  // Exportar JSON
  $('exportBtn').addEventListener('click', () => {
    try {
      if (refresh()) {
        const json = { format: 'llenado-design', version: 1, profile: profile.toJSON(), flowRate: num('flow'), initialVolume: num('initialVolume') };
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'llenado-diseno.json';
        a.click();
      }
    } catch (e) {
      say(e.message);
    }
  });

  // Importar JSON (ERR-04)
  const importBtn = $('importBtn');
  const importInput = $('importInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) handleImportFile(file);
      importInput.value = '';
    });
  }

  // Biblioteca IndexedDB (ERR-04)
  const saveDesignBtn = $('saveDesignBtn');
  if (saveDesignBtn) {
    saveDesignBtn.addEventListener('click', () => saveCurrentDesign());
  }

  const savedDesignsSelect = $('savedDesignsSelect');
  if (savedDesignsSelect) {
    savedDesignsSelect.addEventListener('change', e => {
      if (e.target.value) {
        loadSelectedDesign(e.target.value);
      }
    });
  }

  const deleteDesignBtn = $('deleteDesignBtn');
  if (deleteDesignBtn) {
    deleteDesignBtn.addEventListener('click', () => deleteSelectedDesign());
  }

  // Niveles iniciales por defecto (un embudo/trapecio simétrico elegante)
  const initial = [
    { y: 0, left: -0.2, right: 0.2 },
    { y: 1, left: -0.4, right: 0.4 }
  ];
  initial.forEach(addRow);
  refresh({ charts: true, full: true });
  commitHistory();
  refreshSavedDesignsList();
}

window.addEventListener('DOMContentLoaded', init);
