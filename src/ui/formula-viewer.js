/**
 * Generador y visor de fórmulas analíticas exactas para el recipiente.
 * Muestra tanto las ecuaciones de las paredes x_izq(y), x_der(y),
 * el ancho w(y), área de la sección A(y), volumen acumulado V(h)
 * y genera las FÓRMULAS LISTAS PARA COPIAR Y PEGAR EN GEOGEBRA:
 * - Curvas o funciones Si(condición, ...) en GeoGebra.
 * - Superficie de revolución o extrusión 3D en GeoGebra.
 */

function round(num, decimals = 4) {
  if (!Number.isFinite(num)) return '0';
  const factor = 10 ** decimals;
  const res = Math.round(num * factor) / factor;
  return res.toString();
}

/**
 * Retorna m y b para la recta x(y) = m*y + b
 */
function lineParams(y0, x0, y1, x1) {
  const dy = y1 - y0;
  if (Math.abs(dy) < 1e-9) return { m: 0, b: x0 };
  const m = (x1 - x0) / dy;
  const b = x0 - m * y0;
  return { m, b };
}

function lineEquation(y0, x0, y1, x1) {
  const { m, b } = lineParams(y0, x0, y1, x1);
  if (Math.abs(m) < 1e-6) return `${round(b)}`;
  
  let str = '';
  if (Math.abs(m - 1) < 1e-6) str = 'y';
  else if (Math.abs(m + 1) < 1e-6) str = '-y';
  else str = `${round(m)}·y`;

  if (Math.abs(b) > 1e-6) {
    str += b > 0 ? ` + ${round(b)}` : ` - ${round(Math.abs(b))}`;
  }
  return str;
}

function hermiteCoefficientsInT(p0, p1, dy) {
  const m0 = (Number.isFinite(p0.slope) ? p0.slope : 0) * dy;
  const m1 = (Number.isFinite(p1.slope) ? p1.slope : 0) * dy;
  return [
    2 * p0.x - 2 * p1.x + m0 + m1,
    -3 * p0.x + 3 * p1.x - 2 * m0 - m1,
    m0,
    p0.x
  ];
}

/**
 * Transforma coeficientes de Hermite en t in [0, 1] a coeficientes polinómicos en y: [k3, k2, k1, k0]
 */
function hermitePolyInY(c, y0, dy) {
  const a = 1 / dy;
  const b = -y0 / dy;
  const k3 = c[0] * a ** 3;
  const k2 = 3 * c[0] * a ** 2 * b + c[1] * a ** 2;
  const k1 = 3 * c[0] * a * b ** 2 + 2 * c[1] * a * b + c[2] * a;
  const k0 = c[0] * b ** 3 + c[1] * b ** 2 + c[2] * b + c[3];
  return [k3, k2, k1, k0];
}

function formatPolynomial(coeffs, variable = 'y', decimals = 4) {
  const terms = [];
  const powers = [3, 2, 1, 0];
  for (let i = 0; i < coeffs.length; i++) {
    const k = coeffs[i];
    if (Math.abs(k) < 1e-7) continue;
    const p = powers[i];
    const absK = Math.abs(k);
    let coeffStr = round(absK, decimals);
    let term = '';
    if (p === 0) {
      term = coeffStr;
    } else if (p === 1) {
      term = Math.abs(absK - 1) < 1e-6 ? variable : `${coeffStr}*${variable}`;
    } else {
      term = Math.abs(absK - 1) < 1e-6 ? `${variable}^${p}` : `${coeffStr}*${variable}^${p}`;
    }

    if (terms.length === 0) {
      terms.push(k < 0 ? `-${term}` : term);
    } else {
      terms.push(k < 0 ? `- ${term}` : `+ ${term}`);
    }
  }
  return terms.length ? terms.join(' ') : '0';
}

/**
 * Genera la representación textual para GeoGebra.
 * En GeoGebra se puede graficar directamente x(y) o segmentos:
 * Por ejemplo:
 * Segmento((x0, y0), (x1, y1))
 * O como curvas paramétricas:
 * Curva(m*t + b, t, t, y0, y1)
 * O función por partes Si(...):
 * f(y) = Si(y0 <= y <= y1, m*y + b, ...)
 */
export function generateGeoGebraCode(profile) {
  if (!profile || !profile.left || profile.left.length < 2) return '';
  const n = profile.left.length;
  const lines = [];

  lines.push('// === CÓDIGO PARA GEOGEBRA (COPIA Y PEGA EN LA BARRA DE ENTRADA) ===');
  lines.push(`// Recipiente Extruido (Profundidad d = ${round(profile.depth, 3)} m)`);
  lines.push('');

  // 1. Puntos clave
  lines.push('// 1. Puntos de los vértices:');
  for (let i = 0; i < n; i++) {
    const y = round(profile.left[i].y, 3);
    const xl = round(profile.left[i].x, 3);
    const xr = round(profile.right[i].x, 3);
    lines.push(`Izq_${i + 1} = (${xl}, ${y})`);
    lines.push(`Der_${i + 1} = (${xr}, ${y})`);
  }
  lines.push('');

  // 2. Trazado de paredes y base en 2D
  lines.push('// 2. Paredes y base del recipiente (Plano 2D):');
  for (let i = 0; i < n - 1; i++) {
    const kind = profile.segments?.[i] || 'linear';
    const y0 = profile.left[i].y;
    const y1 = profile.left[i + 1].y;
    const dy = y1 - y0;
    if (kind === 'linear') {
      lines.push(`ParedIzq_${i + 1} = Segmento(Izq_${i + 1}, Izq_${i + 2})`);
      lines.push(`ParedDer_${i + 1} = Segmento(Der_${i + 1}, Der_${i + 2})`);
    } else {
      const cL = hermiteCoefficientsInT(profile.left[i], profile.left[i + 1], dy);
      const cR = hermiteCoefficientsInT(profile.right[i], profile.right[i + 1], dy);
      const polyL = hermitePolyInY(cL, y0, dy);
      const polyR = hermitePolyInY(cR, y0, dy);
      lines.push(`ParedIzq_${i + 1} = Curva(${formatPolynomial(polyL, 't')}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
      lines.push(`ParedDer_${i + 1} = Curva(${formatPolynomial(polyR, 't')}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
    }
  }
  // Base
  lines.push('Base = Segmento(Izq_1, Der_1)');
  lines.push('');

  // 3. Ecuaciones explícitas x(y) como Curva(x(t), y(t), t, min, max)
  lines.push('// 3. Curvas paramétricas (x(y), y) en GeoGebra:');
  for (let i = 0; i < n - 1; i++) {
    const kind = profile.segments?.[i] || 'linear';
    const y0 = profile.left[i].y;
    const y1 = profile.left[i + 1].y;
    const dy = y1 - y0;

    if (kind === 'linear') {
      const { m: ml, b: bl } = lineParams(y0, profile.left[i].x, y1, profile.left[i + 1].x);
      const { m: mr, b: br } = lineParams(y0, profile.right[i].x, y1, profile.right[i + 1].x);
      const termL = Math.abs(ml) < 1e-6 ? `${round(bl)}` : `${round(ml)}*t + ${round(bl)}`;
      const termR = Math.abs(mr) < 1e-6 ? `${round(br)}` : `${round(mr)}*t + ${round(br)}`;
      lines.push(`CurvaIzq_${i + 1} = Curva(${termL}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
      lines.push(`CurvaDer_${i + 1} = Curva(${termR}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
    } else {
      const cL = hermiteCoefficientsInT(profile.left[i], profile.left[i + 1], dy);
      const cR = hermiteCoefficientsInT(profile.right[i], profile.right[i + 1], dy);
      const polyL = hermitePolyInY(cL, y0, dy);
      const polyR = hermitePolyInY(cR, y0, dy);
      lines.push(`CurvaIzq_${i + 1} = Curva(${formatPolynomial(polyL, 't')}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
      lines.push(`CurvaDer_${i + 1} = Curva(${formatPolynomial(polyR, 't')}, t, t, ${round(y0, 3)}, ${round(y1, 3)})`);
    }
  }
  lines.push('');

  // 4. Funciones de ancho w(y) y área A(y)
  lines.push('// 4. Función de Área Transversal A(y) [m²] por tramos:');
  const pieceConditions = [];
  for (let i = 0; i < n - 1; i++) {
    const kind = profile.segments?.[i] || 'linear';
    const y0 = round(profile.left[i].y, 3);
    const y1 = round(profile.left[i + 1].y, 3);
    const dy = profile.left[i + 1].y - profile.left[i].y;

    if (kind === 'linear') {
      const { m: ml, b: bl } = lineParams(profile.left[i].y, profile.left[i].x, profile.left[i + 1].y, profile.left[i + 1].x);
      const { m: mr, b: br } = lineParams(profile.right[i].y, profile.right[i].x, profile.right[i + 1].y, profile.right[i + 1].x);
      const mW = mr - ml;
      const bW = br - bl;
      const mA = profile.depth * mW;
      const bA = profile.depth * bW;
      const eqA = Math.abs(mA) < 1e-6 ? `${round(bA)}` : `${round(mA)}*y + ${round(bA)}`;
      pieceConditions.push(`${y0} <= y <= ${y1}, ${eqA}`);
    } else {
      const cL = hermiteCoefficientsInT(profile.left[i], profile.left[i + 1], dy);
      const cR = hermiteCoefficientsInT(profile.right[i], profile.right[i + 1], dy);
      const polyL = hermitePolyInY(cL, profile.left[i].y, dy);
      const polyR = hermitePolyInY(cR, profile.left[i].y, dy);
      const polyW = [polyR[0] - polyL[0], polyR[1] - polyL[1], polyR[2] - polyL[2], polyR[3] - polyL[3]];
      const polyA = polyW.map(k => profile.depth * k);
      const eqA = formatPolynomial(polyA, 'y');
      pieceConditions.push(`${y0} <= y <= ${y1}, ${eqA}`);
    }
  }
  lines.push(`A(y) = Si(${pieceConditions.join(', ')})`);
  lines.push(`// Volumen de llenado:`);
  lines.push(`V(h) = Integral(A, ${round(profile.yMin, 3)}, h)`);

  return lines.join('\n');
}

export function renderFormulas({ container, profile, flowRate }) {
  if (!container || !profile) return;
  container.replaceChildren();

  const n = profile.left.length;
  const depth = profile.depth;
  const Q = flowRate ?? 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'formula-breakdown';

  // Resumen global con botón GeoGebra
  const summaryBox = document.createElement('div');
  summaryBox.className = 'formula-summary-box';
  summaryBox.innerHTML = `
    <div class="formula-title"><strong>Modelo Matemático del Recipiente</strong></div>
    <div class="formula-metric-pills">
      <span>Profundidad d = <strong>${round(depth, 3)} m</strong></span>
      <span>Dominio y: <strong>[${round(profile.yMin, 3)}, ${round(profile.yMax, 3)}] m</strong></span>
      <span>Capacidad V<sub>máx</sub> = <strong>${round(profile.capacity, 5)} m³</strong></span>
    </div>
  `;
  wrapper.append(summaryBox);

  // SECCIÓN ESPECIAL GEOGEBRA
  const geogebraCard = document.createElement('div');
  geogebraCard.className = 'formula-section-card geogebra-card';
  const ggbCode = generateGeoGebraCode(profile);

  geogebraCard.innerHTML = `
    <div class="formula-section-header geogebra-header">
      <span class="badge geogebra-badge">GeoGebra</span>
      <strong>Fórmulas y Comandos para GeoGebra</strong>
      <button type="button" class="copy-ggb-btn" id="copyGgbBtn">📋 Copiar para GeoGebra</button>
    </div>
    <div class="formula-section-body">
      <p class="hint" style="margin:0 0 6px;">Pega este texto directamente en la barra de entrada de GeoGebra (Classic, Suite o Web) para graficar el perfil, las paredes y la integral de volumen:</p>
      <pre class="geogebra-code-preview" id="ggbCodeArea"><code>${escapeHtml(ggbCode)}</code></pre>
    </div>
  `;
  wrapper.append(geogebraCard);

  // Detalle analítico por cada tramo de altura
  for (let i = 0; i < n - 1; i++) {
    const y0 = profile.left[i].y;
    const y1 = profile.left[i + 1].y;
    const l0 = profile.left[i].x;
    const l1 = profile.left[i + 1].x;
    const r0 = profile.right[i].x;
    const r1 = profile.right[i + 1].x;
    const kind = profile.segments[i];

    const tramoBox = document.createElement('div');
    tramoBox.className = 'formula-section-card';

    const header = document.createElement('div');
    header.className = 'formula-section-header';
    header.innerHTML = `
      <span class="badge">Tramo ${i + 1}</span>
      <strong>Intervalo: ${round(y0, 3)} m ≤ y ≤ ${round(y1, 3)} m</strong>
      <span class="kind-tag">${kind === 'hermite' ? 'Curva cúbica' : 'Segmento lineal'}</span>
    `;
    tramoBox.append(header);

    const body = document.createElement('div');
    body.className = 'formula-section-body';

    if (kind === 'linear') {
      const eqLeft = lineEquation(y0, l0, y1, l1);
      const eqRight = lineEquation(y0, r0, y1, r1);

      const { m: ml, b: bl } = lineParams(y0, l0, y1, l1);
      const { m: mr, b: br } = lineParams(y0, r0, y1, r1);
      const mW = mr - ml;
      const bW = br - bl;

      let eqW = '';
      if (Math.abs(mW) < 1e-6) eqW = `${round(bW)}`;
      else {
        eqW = `${round(mW)}·y`;
        if (Math.abs(bW) > 1e-6) eqW += bW > 0 ? ` + ${round(bW)}` : ` - ${round(Math.abs(bW))}`;
      }

      const mA = depth * mW;
      const bA = depth * bW;
      let eqA = '';
      if (Math.abs(mA) < 1e-6) eqA = `${round(bA)}`;
      else {
        eqA = `${round(mA)}·y`;
        if (Math.abs(bA) > 1e-6) eqA += bA > 0 ? ` + ${round(bA)}` : ` - ${round(Math.abs(bA))}`;
      }

      body.innerHTML = `
        <div class="formula-row"><span class="lbl">Pared izquierda:</span> <code>x<sub>i</sub>(y) = ${eqLeft}</code></div>
        <div class="formula-row"><span class="lbl">Pared derecha:</span> <code>x<sub>d</sub>(y) = ${eqRight}</code></div>
        <div class="formula-row"><span class="lbl">Ancho transversal:</span> <code>w(y) = x<sub>d</sub>(y) - x<sub>i</sub>(y) = ${eqW}</code></div>
        <div class="formula-row"><span class="lbl">Área sección:</span> <code>A(y) = d · w(y) = ${eqA}</code> [m²]</div>
        <div class="formula-row"><span class="lbl">Rapidez de subida:</span> <code>dh/dt = Q / A(h) = ${round(Q, 6)} / (${eqA})</code> [m/s]</div>
      `;
    } else {
      const dy = y1 - y0;
      const cL = hermiteCoefficientsInT(profile.left[i], profile.left[i + 1], dy);
      const cR = hermiteCoefficientsInT(profile.right[i], profile.right[i + 1], dy);
      const polyL = hermitePolyInY(cL, y0, dy);
      const polyR = hermitePolyInY(cR, y0, dy);
      const polyW = [polyR[0] - polyL[0], polyR[1] - polyL[1], polyR[2] - polyL[2], polyR[3] - polyL[3]];
      const polyA = polyW.map(k => depth * k);
      const eqLeft = formatPolynomial(polyL, 'y');
      const eqRight = formatPolynomial(polyR, 'y');
      const eqW = formatPolynomial(polyW, 'y');
      const eqA = formatPolynomial(polyA, 'y');

      body.innerHTML = `
        <div class="formula-row"><span class="lbl">Pared izquierda:</span> <code>x<sub>i</sub>(y) = ${eqLeft}</code></div>
        <div class="formula-row"><span class="lbl">Pared derecha:</span> <code>x<sub>d</sub>(y) = ${eqRight}</code></div>
        <div class="formula-row"><span class="lbl">Ancho transversal:</span> <code>w(y) = x<sub>d</sub>(y) - x<sub>i</sub>(y) = ${eqW}</code></div>
        <div class="formula-row"><span class="lbl">Área sección:</span> <code>A(y) = d · w(y) = ${eqA}</code> [m²]</div>
        <div class="formula-row"><span class="lbl">Rapidez de subida:</span> <code>dh/dt = Q / A(h) = ${round(Q, 6)} / (${eqA.replace(/y/g, 'h')})</code> [m/s]</div>
        <div class="formula-row"><span class="lbl">Integración:</span> Primitiva analítica exacta de 4º orden para V(h).</div>
      `;
    }

    tramoBox.append(body);
    wrapper.append(tramoBox);
  }

  container.append(wrapper);

  // Vincular botón de copiar código de GeoGebra
  const copyBtn = document.getElementById('copyGgbBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(ggbCode).then(() => {
        copyBtn.textContent = '✓ ¡Copiado!';
        setTimeout(() => { copyBtn.textContent = '📋 Copiar para GeoGebra'; }, 2000);
      }).catch(() => {
        const area = document.getElementById('ggbCodeArea');
        if (area) {
          const range = document.createRange();
          range.selectNodeContents(area);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
