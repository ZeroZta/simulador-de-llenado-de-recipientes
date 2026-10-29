/**
 * Editor Cartesiano Interactivo del Perfil Geométrico.
 * Maneja el dibujo y edición de vértices en el plano cartesiano (x, y) en metros.
 * Garantiza:
 * 1. Proporción 1:1 física y cuadrícula limpia.
 * 2. Bloqueo de vista (Fixed Viewport) para que los ejes no se muevan de forma descontrolada.
 * 3. Restricciones geométricas para que las paredes no se crucen.
 * 4. Admisión de puntas (w=0 en la base o boca) sin que el agua se salga.
 * 5. Modo de simetría opcional.
 * 6. Cierre completo de polígono de paredes (pared izq + fondo + pared der).
 */

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export class CartesianEditor {
  constructor({
    svg,
    onProfileChange,
    onSelectVertex,
    onStatusMessage
  }) {
    this.svg = svg;
    this.onProfileChange = onProfileChange;
    this.onSelectVertex = onSelectVertex;
    this.onStatusMessage = onStatusMessage || (() => {});

    this.tool = 'edit'; // 'edit' | 'insert' | 'pan'
    this.symmetric = true; // Simetría activa por defecto para que sea muy fácil dibujar
    this.snap = true;
    this.snapStep = 0.05; // 5 cm de resolución

    // Bloqueo de vista durante el dibujo para evitar saltos
    this.viewLocked = true;
    this.fixedOriginY = 0.5; // Centro del plano cartesiano fijo en y=0.5m
    this.fixedScale = 220; // 220 px por metro constante

    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;

    this.dragTarget = null;
    this.selectedVertex = null;
    this.activePointers = new Map();
    this.lastGridKey = '';

    this.setupEvents();
  }

  setTool(tool) {
    this.tool = tool;
    this.svg.classList.toggle('pan-tool', tool === 'pan');
  }

  setSymmetric(val) {
    this.symmetric = Boolean(val);
  }

  setSnap(val) {
    this.snap = Boolean(val);
  }

  setViewLocked(val) {
    this.viewLocked = Boolean(val);
    this.render();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    if (this.profile) {
      this.fixedOriginY = (this.profile.yMin + this.profile.yMax) / 2;
    }
    this.render();
  }

  zoomAt(x, y, factor) {
    const nextZoom = Math.max(0.4, Math.min(10, this.zoom * factor));
    const ratio = nextZoom / this.zoom;
    this.panX = x - (x - this.panX) * ratio;
    this.panY = y - (y - this.panY) * ratio;
    this.zoom = nextZoom;
    this.render();
  }

  setupEvents() {
    this.svg.addEventListener('pointerdown', e => this.handlePointerDown(e));
    this.svg.addEventListener('pointermove', e => this.handlePointerMove(e));
    this.svg.addEventListener('pointerup', e => this.handlePointerUp(e));
    this.svg.addEventListener('pointercancel', e => this.handlePointerUp(e));
    this.svg.addEventListener('lostpointercapture', e => this.handlePointerUp(e));

    this.svg.addEventListener('wheel', e => {
      // INC-01: Sólo aplicar zoom con la rueda en modo desplazamiento ('pan') o con Ctrl pulsado.
      // Fuera de este modo, se permite el desplazamiento normal del documento sin interferir.
      if (this.tool !== 'pan' && !e.ctrlKey) {
        return;
      }
      e.preventDefault();
      const pt = this.svgCoords(e);
      const factor = e.deltaY < 0 ? 1.06 : 0.94;
      this.zoomAt(pt.x, pt.y, factor);
    }, { passive: false });

    this.svg.addEventListener('click', e => {
      if (this.tool === 'insert') {
        const w = this.worldCoords(e);
        this.insertLevelAt(w.x, w.y);
      }
    });

    // Atajo de teclado: Suprimir o Retroceso para eliminar nivel seleccionado
    window.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedVertex && this.tool === 'edit') {
        const targetTag = document.activeElement?.tagName?.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') return;
        if (this.profile && this.profile.left.length > 2) {
          const idx = this.selectedVertex.index;
          if (idx !== undefined) {
            e.preventDefault();
            this.deleteLevelAt(idx);
          }
        }
      }
    });
  }

  svgCoords(event) {
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  worldCoords(event) {
    const { x, y } = this.svgCoords(event);
    const viewBox = this.getViewBox();
    const centerX = viewBox.width / 2;
    const centerY = viewBox.height / 2;

    const scale = this.getScale() * this.zoom;
    const originYWorld = this.getOriginY();

    const wx = (x - centerX - this.panX) / scale;
    const wy = originYWorld - (y - centerY - this.panY) / scale;
    return { x: wx, y: wy };
  }

  snapValue(val, step = this.snapStep) {
    if (!this.snap) return val;
    return Math.round(val / step) * step;
  }

  getViewBox() {
    return { width: 420, height: 360 };
  }

  getOriginY() {
    // Si la vista está fija o estamos arrastrando, NO mover el centro del universo
    if (this.viewLocked || this.dragTarget) {
      return this.fixedOriginY;
    }
    return this.profile ? (this.profile.yMin + this.profile.yMax) / 2 : 0.5;
  }

  getScale() {
    // Escala constante fija en px/metro para que mover un punto no redimensione el plano
    if (this.viewLocked || this.dragTarget) {
      return this.fixedScale;
    }
    const { height } = this.getViewBox();
    if (!this.profile) return 220;
    const spanY = Math.max(this.profile.yMax - this.profile.yMin, 0.4);
    return Math.min(300, Math.max(120, (height * 0.72) / spanY));
  }

  worldToSvg(wx, wy) {
    const { width, height } = this.getViewBox();
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = this.getScale() * this.zoom;
    const originYWorld = this.getOriginY();

    return {
      x: centerX + wx * scale + this.panX,
      y: centerY - (wy - originYWorld) * scale + this.panY
    };
  }

  updateData({ profile, state, levelsData }) {
    this.profile = profile;
    this.state = state;
    this.levelsData = levelsData;
    this.render();
  }

  updateState(state) {
    this.state = state;
    this.renderLiquid();
  }

  render() {
    if (!this.profile) return;
    this.renderGrid();
    this.renderWalls();
    this.renderLiquid();
    this.renderHandles();
  }

  renderGrid() {
    const gridG = this.svg.getElementById('profileGrid');
    if (!gridG) return;
    const { width, height } = this.getViewBox();
    const currentKey = `${this.zoom.toFixed(3)}_${this.panX.toFixed(1)}_${this.panY.toFixed(1)}_${this.viewLocked}_${this.getOriginY().toFixed(3)}_${this.getScale().toFixed(1)}`;
    if (this.lastGridKey === currentKey && gridG.children.length > 0) {
      return;
    }
    this.lastGridKey = currentKey;
    gridG.replaceChildren();

    // Fondo del plano
    gridG.append(el('rect', {
      x: 0, y: 0, width, height, fill: '#fbfcfd'
    }));

    // Rango de la cuadrícula en coordenadas del mundo
    const gridInterval = this.zoom > 2 ? 0.05 : (this.zoom > 0.7 ? 0.1 : 0.2);
    const yMinRange = -1.5;
    const yMaxRange = 3.5;
    const xMinRange = -2.5;
    const xMaxRange = 2.5;

    // Líneas horizontales (y)
    for (let y = yMinRange; y <= yMaxRange; y += gridInterval) {
      const roundedY = Math.round(y * 1000) / 1000;
      const pt = this.worldToSvg(0, roundedY);
      if (pt.y < -10 || pt.y > height + 10) continue;

      const isAxis = Math.abs(roundedY) < 1e-6;
      gridG.append(el('line', {
        x1: 0, y1: pt.y, x2: width, y2: pt.y,
        stroke: isAxis ? '#64748b' : '#e2e8f0',
        'stroke-width': isAxis ? 1.5 : 1,
        'stroke-dasharray': isAxis ? 'none' : '3 3',
        style: 'pointer-events: none;'
      }));

      // Etiqueta de eje y (no interactiva, sin selección de texto)
      const txt = el('text', {
        x: 26, y: pt.y + 4,
        fill: isAxis ? '#0f172a' : '#64748b',
        'font-size': '10px',
        'font-family': 'monospace',
        'font-weight': isAxis ? 'bold' : 'normal',
        'text-anchor': 'end',
        style: 'pointer-events: none; user-select: none; -webkit-user-select: none;'
      });
      txt.textContent = roundedY.toFixed(roundedY % 1 === 0 ? 0 : 1);
      gridG.append(txt);
    }

    // Líneas verticales (x)
    for (let x = xMinRange; x <= xMaxRange; x += gridInterval) {
      const roundedX = Math.round(x * 1000) / 1000;
      const pt = this.worldToSvg(roundedX, 0);
      if (pt.x < -10 || pt.x > width + 10) continue;

      const isAxis = Math.abs(roundedX) < 1e-6;
      gridG.append(el('line', {
        x1: pt.x, y1: 0, x2: pt.x, y2: height,
        stroke: isAxis ? '#64748b' : '#e2e8f0',
        'stroke-width': isAxis ? 1.5 : 1,
        'stroke-dasharray': isAxis ? 'none' : '3 3',
        style: 'pointer-events: none;'
      }));

      // Etiqueta de eje x en la base (no interactiva, sin selección de texto)
      if (Math.abs(roundedX) > 1e-6) {
        const txt = el('text', {
          x: pt.x, y: height - 8,
          fill: '#64748b', 'font-size': '10px', 'font-family': 'monospace',
          'text-anchor': 'middle',
          style: 'pointer-events: none; user-select: none; -webkit-user-select: none;'
        });
        txt.textContent = roundedX.toFixed(roundedX % 1 === 0 ? 0 : 1);
        gridG.append(txt);
      }
    }
  }

  renderWalls() {
    if (!this.profile) return;
    const svg = this.svg;
    const leftWallPath = svg.getElementById('leftWall');
    const rightWallPath = svg.getElementById('rightWall');
    const handlesG = svg.getElementById('pointHandles');

    const leftContour = this.profile.sampleContour?.('left', { samplesPerSegment: 24 }) || this.profile.left;
    const rightContour = this.profile.sampleContour?.('right', { samplesPerSegment: 24 }) || this.profile.right;

    const toD = pts => pts.map((p, i) => {
      const s = this.worldToSvg(p.x, p.y);
      return `${i ? 'L' : 'M'}${s.x.toFixed(2)},${s.y.toFixed(2)}`;
    }).join(' ');

    if (leftWallPath) leftWallPath.setAttribute('d', toD(leftContour));
    if (rightWallPath) rightWallPath.setAttribute('d', toD(rightContour));

    let bottomPath = svg.getElementById('bottomWall');
    if (!bottomPath) {
      bottomPath = el('path', { id: 'bottomWall', stroke: '#0284c7', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' });
      svg.insertBefore(bottomPath, handlesG);
    }
    const b0 = this.worldToSvg(leftContour[0].x, leftContour[0].y);
    const b1 = this.worldToSvg(rightContour[0].x, rightContour[0].y);
    bottomPath.setAttribute('d', `M${b0.x.toFixed(2)},${b0.y.toFixed(2)} L${b1.x.toFixed(2)},${b1.y.toFixed(2)}`);
  }

  renderLiquid() {
    if (!this.profile) return;
    const svg = this.svg;
    const liquidShape = svg.getElementById('liquidShape');
    const liquidLine = svg.getElementById('liquidLine');
    if (!liquidShape || !liquidLine) return;

    const leftContour = this.profile.sampleContour?.('left', { samplesPerSegment: 24 }) || this.profile.left;
    const rightContour = this.profile.sampleContour?.('right', { samplesPerSegment: 24 }) || this.profile.right;
    const currentH = this.state ? Math.min(Math.max(this.state.height, this.profile.yMin), this.profile.yMax) : this.profile.yMin;

    if (currentH > this.profile.yMin) {
      const leftSub = leftContour.filter(p => p.y < currentH);
      leftSub.push({ x: this.profile.xLeft(currentH), y: currentH });

      const rightSub = rightContour.filter(p => p.y < currentH);
      rightSub.push({ x: this.profile.xRight(currentH), y: currentH });

      const surfaceLeft = this.worldToSvg(this.profile.xLeft(currentH), currentH);
      const surfaceRight = this.worldToSvg(this.profile.xRight(currentH), currentH);

      let d = `M${surfaceRight.x.toFixed(2)},${surfaceRight.y.toFixed(2)}`;
      for (let i = rightSub.length - 1; i >= 0; i--) {
        const s = this.worldToSvg(rightSub[i].x, rightSub[i].y);
        d += ` L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
      }
      for (let i = 0; i < leftSub.length; i++) {
        const s = this.worldToSvg(leftSub[i].x, leftSub[i].y);
        d += ` L${s.x.toFixed(2)},${s.y.toFixed(2)}`;
      }
      d += ' Z';

      liquidShape.setAttribute('d', d);
      liquidShape.setAttribute('fill', '#38bdf844');

      liquidLine.setAttribute('x1', surfaceLeft.x.toFixed(2));
      liquidLine.setAttribute('y1', surfaceLeft.y.toFixed(2));
      liquidLine.setAttribute('x2', surfaceRight.x.toFixed(2));
      liquidLine.setAttribute('y2', surfaceRight.y.toFixed(2));
      liquidLine.setAttribute('stroke', '#0284c7');
      liquidLine.setAttribute('stroke-width', '2');
    } else {
      liquidShape.setAttribute('d', '');
      liquidLine.setAttribute('x1', '0');
      liquidLine.setAttribute('x2', '0');
    }
  }

  renderHandles() {
    if (!this.profile) return;
    const handlesG = this.svg.getElementById('pointHandles');
    if (!handlesG) return;
    handlesG.replaceChildren();
    const n = this.profile.left.length;

    for (let i = 0; i < n; i++) {
      const yVal = this.profile.left[i].y;
      const leftP = this.profile.left[i];
      const rightP = this.profile.right[i];

      const sL = this.worldToSvg(leftP.x, yVal);
      const sR = this.worldToSvg(rightP.x, yVal);
      const isCoincident = Math.abs(sL.x - sR.x) < 8;

      // Desplazamiento visual de hitboxes si los vértices coinciden (ápice triangular w=0)
      const offsetL = isCoincident ? -5 : 0;
      const offsetR = isCoincident ? 5 : 0;

      const circleL = el('circle', {
        cx: (sL.x + offsetL).toFixed(2),
        cy: sL.y.toFixed(2),
        r: this.tool === 'edit' ? 7 : 5,
        class: `vertex left ${this.selectedVertex?.index === i && this.selectedVertex?.side === 'left' ? 'selected' : ''} ${isCoincident ? 'coincident' : ''}`,
        'data-index': i,
        'data-side': 'left',
        tabindex: '0'
      });
      const titleL = el('title');
      titleL.textContent = `Pared izquierda nivel ${i + 1} (x=${leftP.x.toFixed(2)}, y=${yVal.toFixed(2)})`;
      circleL.append(titleL);
      handlesG.append(circleL);

      const circleR = el('circle', {
        cx: (sR.x + offsetR).toFixed(2),
        cy: sR.y.toFixed(2),
        r: this.tool === 'edit' ? 7 : 5,
        class: `vertex right ${this.selectedVertex?.index === i && this.selectedVertex?.side === 'right' ? 'selected' : ''} ${isCoincident ? 'coincident' : ''}`,
        'data-index': i,
        'data-side': 'right',
        tabindex: '0'
      });
      const titleR = el('title');
      titleR.textContent = `Pared derecha nivel ${i + 1} (x=${rightP.x.toFixed(2)}, y=${yVal.toFixed(2)})`;
      circleR.append(titleR);
      handlesG.append(circleR);

      // Si es un ápice coincidente, dibujar un punto central sutil de anclaje
      if (isCoincident) {
        const apexDot = el('circle', {
          cx: sL.x.toFixed(2),
          cy: sL.y.toFixed(2),
          r: 3,
          fill: '#0284c7',
          style: 'pointer-events: none;'
        });
        handlesG.append(apexDot);
      }
    }
  }

  handlePointerDown(event) {
    const target = event.target.closest?.('.vertex');
    const pos = this.svgCoords(event);
    this.activePointers.set(event.pointerId, pos);

    try { this.svg.setPointerCapture(event.pointerId); } catch {}

    if (this.tool === 'edit' && target) {
      const idx = Number(target.dataset.index);
      let side = target.dataset.side;

      // En ápices coincidentes, resolver si el clic se orienta a izquierda o derecha
      const sL = this.worldToSvg(this.profile.left[idx].x, this.profile.left[idx].y);
      const sR = this.worldToSvg(this.profile.right[idx].x, this.profile.right[idx].y);
      if (Math.abs(sL.x - sR.x) < 8) {
        side = pos.x <= sL.x ? 'left' : 'right';
      }

      this.selectedVertex = { index: idx, side };
      this.dragTarget = {
        index: idx,
        side,
        pointerId: event.pointerId,
        startY: this.profile.left[idx].y,
        startX: (side === 'left' ? this.profile.left[idx] : this.profile.right[idx]).x
      };
      if (this.onSelectVertex) this.onSelectVertex(this.selectedVertex);
      this.render();
      return;
    }

    if (this.tool === 'pan') {
      this.dragTarget = {
        type: 'pan',
        pointerId: event.pointerId,
        startX: pos.x,
        startY: pos.y,
        initialPanX: this.panX,
        initialPanY: this.panY
      };
    }
  }

  handlePointerMove(event) {
    const pos = this.svgCoords(event);
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, pos);
    }

    const world = this.worldCoords(event);
    const snapped = {
      x: this.snapValue(world.x),
      y: this.snapValue(world.y)
    };

    const readout = document.getElementById('coordinateReadout');
    if (readout) {
      readout.textContent = `Cursor: x = ${snapped.x.toFixed(3)} m · y = ${snapped.y.toFixed(3)} m ${this.symmetric ? '· [Simetría ON]' : ''} ${this.viewLocked ? '· [Vista Fija]' : ''}`;
    }

    if (!this.dragTarget || this.dragTarget.pointerId !== event.pointerId) return;

    if (this.dragTarget.type === 'pan') {
      this.panX = this.dragTarget.initialPanX + (pos.x - this.dragTarget.startX);
      this.panY = this.dragTarget.initialPanY + (pos.y - this.dragTarget.startY);
      this.render();
      return;
    }

    // ARRASTRE DE VÉRTICE SUAVE Y CONTROLADO
    const idx = this.dragTarget.index;
    const side = this.dragTarget.side;
    const n = this.profile.left.length;

    let newY = snapped.y;
    const minGap = 0.02; // Al menos 2 cm de separación entre niveles
    if (idx > 0) {
      newY = Math.max(newY, this.profile.left[idx - 1].y + minGap);
    } else {
      // El nivel base (idx === 0) no puede ser negativo
      newY = Math.max(0, newY);
    }
    if (idx < n - 1) {
      newY = Math.min(newY, this.profile.left[idx + 1].y - minGap);
    }

    let newX = snapped.x;

    const isBoundary = idx === 0 || idx === n - 1;
    const minWidth = isBoundary ? 0 : 0.02;

    const currentLeft = this.profile.left[idx].x;
    const currentRight = this.profile.right[idx].x;

    let updatedLeft = currentLeft;
    let updatedRight = currentRight;

    if (this.symmetric) {
      const halfWidth = Math.max(Math.abs(newX), minWidth / 2);
      updatedLeft = -halfWidth;
      updatedRight = halfWidth;
    } else {
      // INC-08: Cuando la simetría está desactivada, cada pared se mueve con total independencia
      if (side === 'left') {
        newX = Math.min(newX, currentRight - minWidth);
        updatedLeft = newX;
        updatedRight = currentRight;
      } else {
        newX = Math.max(newX, currentLeft + minWidth);
        updatedRight = newX;
        updatedLeft = currentLeft;
      }
    }

    if (this.onProfileChange) {
      this.onProfileChange({
        index: idx,
        y: newY,
        leftX: updatedLeft,
        rightX: updatedRight,
        isFinished: false
      });
    }
  }

  handlePointerUp(event) {
    if (this.dragTarget && this.dragTarget.pointerId === event.pointerId) {
      if (this.dragTarget.index !== undefined && this.onProfileChange) {
        this.onProfileChange({
          index: this.dragTarget.index,
          isFinished: true
        });
      }
      this.dragTarget = null;
    }
    this.activePointers.delete(event.pointerId);
    try {
      if (this.svg.hasPointerCapture(event.pointerId)) {
        this.svg.releasePointerCapture(event.pointerId);
      }
    } catch {}
  }

  insertLevelAt(worldX, worldY) {
    if (!this.profile) return;
    const yMin = this.profile.yMin;
    const yMax = this.profile.yMax;
    const minGap = 0.02;

    if (worldY <= yMin + minGap || worldY >= yMax - minGap) {
      this.onStatusMessage('Inserta el nivel entre la base y la boca del recipiente con suficiente margen.');
      return;
    }

    // Ordenar alturas existentes para identificar el tramo correcto
    const existingYs = this.profile.left.map(p => p.y);
    let lowIdx = 0;
    while (lowIdx < existingYs.length - 1 && existingYs[lowIdx + 1] <= worldY) {
      lowIdx++;
    }
    const yLow = existingYs[lowIdx];
    const yHigh = existingYs[lowIdx + 1];

    if (!Number.isFinite(yHigh) || (yHigh - yLow) < 2 * minGap) {
      this.onStatusMessage('No hay suficiente espacio vertical entre estos niveles para insertar otro punto.');
      return;
    }

    // Calcular y seguro respetando cuadrícula sin colisionar con niveles vecinos
    let targetY = this.snap ? this.snapValue(worldY) : worldY;
    if (targetY <= yLow + minGap || targetY >= yHigh - minGap) {
      targetY = Math.round(((yLow + yHigh) / 2) * 1000) / 1000;
    }

    const curLeft = this.profile.xLeft(targetY);
    const curRight = this.profile.xRight(targetY);

    if (worldX < curLeft - 0.05 || worldX > curRight + 0.05) {
      this.onStatusMessage('Pulsa dentro de la figura para insertar un nivel de altura.');
      return;
    }

    let leftX = curLeft;
    let rightX = curRight;
    if (this.symmetric) {
      const hw = Math.max(Math.abs(curLeft), Math.abs(curRight));
      leftX = -hw;
      rightX = hw;
    }

    if (this.onProfileChange) {
      this.onProfileChange({
        action: 'insertLevel',
        y: targetY,
        leftX,
        rightX
      });
    }
  }

  // Sincroniza todas las parejas de vértices simétricamente (Criterio 5 de INC-08)
  symmetrizeProfile() {
    if (!this.profile) return;
    const n = this.profile.left.length;
    for (let i = 0; i < n; i++) {
      const isBoundary = i === 0 || i === n - 1;
      const minWidth = isBoundary ? 0 : 0.02;
      const l = this.profile.left[i].x;
      const r = this.profile.right[i].x;
      const halfWidth = Math.max(Math.abs(l), Math.abs(r), minWidth / 2);
      if (this.onProfileChange) {
        this.onProfileChange({
          index: i,
          leftX: -halfWidth,
          rightX: halfWidth,
          isFinished: i === n - 1
        });
      }
    }
  }

  deleteLevelAt(index) {
    if (this.onProfileChange) {
      this.onProfileChange({
        action: 'deleteLevel',
        index
      });
    }
  }
}
