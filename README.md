# Simulador de Llenado de Recipientes

Simulador interactivo y educativo para el cálculo, análisis físico y visualización en tiempo real del llenado de recipientes prismáticos (perfil bidimensional extruido a profundidad constante). Desarrollado íntegramente con tecnologías web estándar (HTML5, SVG, CSS3 y JavaScript ES6 modular), sin dependencias externas, frameworks ni conexión a Internet.

---

## 🚀 Inicio Rápido y Ejecución

Al estar estructurado como módulos JavaScript nativos (`ES modules`), los navegadores modernos requieren que los archivos se sirvan mediante un servidor HTTP local (la política CORS restringe `import` sobre protocolo `file://`).

### Opción 1: Servidor local con Python (Recomendado)
Desde la terminal en la carpeta del proyecto, ejecuta:
```bash
python3 -m http.server 8000
```
Luego abre en cualquier navegador web:
👉 **[http://localhost:8000](http://localhost:8000)**

### Opción 2: Extensión Live Server de VS Code
Abre la carpeta del proyecto en VS Code, haz clic derecho sobre `index.html` y selecciona **«Open with Live Server»**.

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y verificación sintáctica ejecutables con Node.js (versión 18+). No requiere ejecutar `npm install`:

- **Ejecutar pruebas unitarias (18 pruebas):**
  ```bash
  npm test
  ```
- **Comprobación sintáctica de todos los módulos:**
  ```bash
  npm run check
  ```

---

## 📋 Características Principales

1. **Editor Geométrico Cartesiano:**
   - Edición interactiva de vértices en plano cartesiano $(x, y)$ con relación de aspecto 1:1 física.
   - Herramientas de edición, inserción de niveles y desplazamiento/zoom.
   - Soporte para tramos rectos y curvas cúbicas Hermite con derivadas continuas.
   - Modo de simetría con sincronización automática o edición asimétrica libre.
   - Admisión de recipientes con ápice o punta ($w=0$ en base o boca).

2. **Simulación Física en Tiempo Real:**
   - Integración analítica exacta de volumen y cálculo por bisección de altura en función del tiempo.
   - Control unificado de reproducción (`Iniciar`, `Pausar`, `Continuar`, `Repetir`, `Restablecer`).
   - Sincronización instantánea entre el plano cartesiano y la vista limpia del recipiente.

3. **Cálculos y Exportación:**
   - Tarjetas métricas de capacidad total, volumen de agua, altura del líquido y tiempo estimado de llenado.
   - Gráficas de análisis dinámico: $h(t)$, $V(t)$, $A(y)$ y $V(h)$.
   - Deducción analítica de fórmulas y exportación directa de código para GeoGebra.
   - Biblioteca local (IndexedDB) para guardar/cargar diseños y respaldo en formato JSON estandarizado.

---

## 📚 Documentación Adicional

- [docs/MODELO_MATEMATICO.md](docs/MODELO_MATEMATICO.md): Formulación matemática, ecuaciones de tramos, derivadas Hermite e integración analítica.
- [docs/MANUAL.md](docs/MANUAL.md): Manual de usuario detallado.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): Arquitectura de módulos y flujo de datos.
- [FICHA_TECNICA.md](FICHA_TECNICA.md): Ficha técnica y especificaciones de diseño.
