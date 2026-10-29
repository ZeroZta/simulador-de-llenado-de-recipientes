/**
 * Renderizador de "Vista Limpia" del recipiente.
 * Muestra el recipiente físico de forma limpia, sin ejes, cuadrículas ni vértices de edición,
 * directamente dependiente del modelo geométrico canonical y del estado físico.
 */

const NS = 'http://www.w3.org/2000/svg';

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS(NS, name);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, String(val));
  }
  return el;
}

export function renderCleanView({ svg, profile, state, showDimensions = true }) {
  if (!svg || !profile) return;
  svg.replaceChildren();

  const width = 360;
  const height = 300;
  const paddingX = 40;
  const paddingY = 30;

  // Obtener contornos del perfil
  const leftContour = profile.sampleContour?.('left', { samplesPerSegment: 24 }) || profile.left;
  const rightContour = profile.sampleContour?.('right', { samplesPerSegment: 24 }) || profile.right;

  // Delimitadores de la geometría
  const allX = [...leftContour, ...rightContour].map(p => p.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = profile.yMin;
  const maxY = profile.yMax;

  const spanX = Math.max(maxX - minX, 1e-4);
  const spanY = Math.max(maxY - minY, 1e-4);

  // Escala uniforme para mantener proporción 1:1 física sin deformación
  const availableW = width - 2 * paddingX;
  const availableH = height - 2 * paddingY;
  const scale = Math.min(availableW / spanX, availableH / spanY);

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const centerX = width / 2;
  const centerY = height / 2;

  // Funciones de proyección mundo -> SVG
  const mapX = x => centerX + (x - midX) * scale;
  const mapY = y => centerY - (y - midY) * scale;

  // Crear defs para sombras, gradientes o patrones de líquido
  const defs = createSvgElement('defs');
  
  // Gradiente para el líquido
  const liquidGrad = createSvgElement('linearGradient', {
    id: 'cleanLiquidGrad',
    x1: '0%', y1: '0%', x2: '0%', y2: '100%'
  });
  const stop1 = createSvgElement('stop', { offset: '0%', 'stop-color': '#38bdf8', 'stop-opacity': '0.85' });
  const stop2 = createSvgElement('stop', { offset: '100%', 'stop-color': '#0284c7', 'stop-opacity': '0.95' });
  liquidGrad.append(stop1, stop2);
  defs.append(liquidGrad);
  svg.append(defs);

  // Contenedor principal con fondo sutil
  const bg = createSvgElement('rect', {
    width, height, rx: 12, ry: 12, fill: '#f8fafc'
  });
  svg.append(bg);

  // Grupo del recipiente
  const group = createSvgElement('g', { class: 'clean-vessel' });

  // 1. DIBUJAR LÍQUIDO
  const currentHeight = state ? Math.min(Math.max(state.height, minY), maxY) : minY;
  if (currentHeight > minY) {
    const yLiquid = currentHeight;
    const leftXAtY = profile.xLeft(yLiquid);
    const rightXAtY = profile.xRight(yLiquid);

    // Muestreo de las paredes sumergidas
    const leftSubmerged = leftContour.filter(p => p.y < yLiquid);
    leftSubmerged.push({ x: leftXAtY, y: yLiquid });

    const rightSubmerged = rightContour.filter(p => p.y < yLiquid);
    rightSubmerged.push({ x: rightXAtY, y: yLiquid });

    // Construcción del polígono cerrado del líquido
    // Comienza en superficie derecha -> baja por pared derecha -> fondo -> sube por pared izquierda -> superficie izq -> cierra
    let liquidPathD = `M ${mapX(rightXAtY)},${mapY(yLiquid)}`;
    for (let i = rightSubmerged.length - 1; i >= 0; i--) {
      liquidPathD += ` L ${mapX(rightSubmerged[i].x)},${mapY(rightSubmerged[i].y)}`;
    }
    // Si la base no es puntual, traza el fondo hacia la izquierda
    for (let i = 0; i < leftSubmerged.length; i++) {
      liquidPathD += ` L ${mapX(leftSubmerged[i].x)},${mapY(leftSubmerged[i].y)}`;
    }
    liquidPathD += ' Z';

    const liquidPolygon = createSvgElement('path', {
      d: liquidPathD,
      fill: 'url(#cleanLiquidGrad)',
      stroke: 'none'
    });
    group.append(liquidPolygon);

    // Línea de la superficie del agua (menisco)
    const surfaceLine = createSvgElement('line', {
      x1: mapX(leftXAtY),
      y1: mapY(yLiquid),
      x2: mapX(rightXAtY),
      y2: mapY(yLiquid),
      stroke: '#0369a1',
      'stroke-width': 2.5,
      'stroke-linecap': 'round'
    });
    group.append(surfaceLine);
  }

  // 2. DIBUJAR PAREDES Y FONDO DEL RECIPIENTE
  // Contorno completo exterior: pared izquierda -> fondo -> pared derecha
  let vesselOutlineD = `M ${mapX(leftContour[0].x)},${mapY(leftContour[0].y)}`;
  for (let i = 1; i < leftContour.length; i++) {
    vesselOutlineD += ` L ${mapX(leftContour[i].x)},${mapY(leftContour[i].y)}`;
  }
  // No cerramos la boca (para que quede abierto arriba)
  // Trazamos el recorrido continuo: boca izq -> fondo izq -> fondo der -> boca der
  let continuousWallD = `M ${mapX(leftContour[leftContour.length - 1].x)},${mapY(leftContour[leftContour.length - 1].y)}`;
  for (let i = leftContour.length - 2; i >= 0; i--) {
    continuousWallD += ` L ${mapX(leftContour[i].x)},${mapY(leftContour[i].y)}`;
  }
  // Fondo
  continuousWallD += ` L ${mapX(rightContour[0].x)},${mapY(rightContour[0].y)}`;
  for (let i = 1; i < rightContour.length; i++) {
    continuousWallD += ` L ${mapX(rightContour[i].x)},${mapY(rightContour[i].y)}`;
  }

  // Trazado de pared con grosor visible de cristal/acrílico
  const vesselWall = createSvgElement('path', {
    d: continuousWallD,
    fill: 'none',
    stroke: '#1e293b',
    'stroke-width': 5,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round'
  });
  group.append(vesselWall);

  // Boca del recipiente (línea tenue superior discontinua para ver el borde superior de llenado)
  const topOpening = createSvgElement('line', {
    x1: mapX(leftContour[leftContour.length - 1].x),
    y1: mapY(leftContour[leftContour.length - 1].y),
    x2: mapX(rightContour[rightContour.length - 1].x),
    y2: mapY(rightContour[rightContour.length - 1].y),
    stroke: '#94a3b8',
    'stroke-width': 1.5,
    'stroke-dasharray': '4 3'
  });
  group.append(topOpening);

  // 3. COTAS O ETIQUETAS ELEGANTES (opcional)
  if (showDimensions) {
    // Cota de nivel actual a la derecha
    if (state && currentHeight > minY) {
      const yL = mapY(currentHeight);
      const rightIndicator = createSvgElement('text', {
        x: width - 12,
        y: yL + 4,
        'text-anchor': 'end',
        'font-family': 'monospace',
        'font-size': '11px',
        fill: '#0284c7',
        'font-weight': 'bold'
      });
      rightIndicator.textContent = `h = ${currentHeight.toFixed(3)} m`;
      group.append(rightIndicator);
    }
  }

  svg.append(group);
}
