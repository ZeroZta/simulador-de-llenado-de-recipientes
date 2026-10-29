/**
 * Plantillas geométricas predefinidas para facilitar el dibujo de recipientes.
 */

export const PRESET_TEMPLATES = [
  {
    id: 'rect',
    name: 'Cilíndrico / Rectangular',
    create: () => ({
      levels: [
        { y: 0, left: -0.25, right: 0.25 },
        { y: 1, left: -0.25, right: 0.25 }
      ],
      segments: ['linear']
    })
  },
  {
    id: 'triangle_down',
    name: 'Cono / V invertida (▽ Punta abajo)',
    create: () => ({
      levels: [
        { y: 0, left: 0, right: 0 },
        { y: 1, left: -0.4, right: 0.4 }
      ],
      segments: ['linear']
    })
  },
  {
    id: 'triangle_up',
    name: 'Punta arriba (△)',
    create: () => ({
      levels: [
        { y: 0, left: -0.4, right: 0.4 },
        { y: 1, left: 0, right: 0 }
      ],
      segments: ['linear']
    })
  },
  {
    id: 'trapezoid',
    name: 'Trapecio (Embudo / Copa)',
    create: () => ({
      levels: [
        { y: 0, left: -0.15, right: 0.15 },
        { y: 1, left: -0.45, right: 0.45 }
      ],
      segments: ['linear']
    })
  },
  {
    id: 'flask',
    name: 'Matraz Erlenmeyer',
    create: () => ({
      levels: [
        { y: 0, left: -0.4, right: 0.4 },
        { y: 0.7, left: -0.15, right: 0.15 },
        { y: 1.1, left: -0.15, right: 0.15 }
      ],
      segments: ['linear', 'linear']
    })
  },
  {
    id: 'parabolic',
    name: 'Copa parabólica (Curvo Hermite)',
    create: () => ({
      levels: [
        { y: 0, left: -0.05, right: 0.05, leftSlope: -0.8, rightSlope: 0.8 },
        { y: 1, left: -0.45, right: 0.45, leftSlope: -0.1, rightSlope: 0.1 }
      ],
      segments: ['hermite']
    })
  }
];
