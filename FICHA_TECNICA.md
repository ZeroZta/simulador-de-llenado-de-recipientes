# Ficha Técnica del Proyecto «Llenado»

### A. Nombre de la IA
- **Asistente:** Antigravity (Google DeepMind)
- **Modelos utilizados:** Claude Opus 5.5 & Gemini 3.8 Flash

### B. Versión
- **Versión del Proyecto:** v0.2.0 (Simulador interactivo con cálculo analítico, vista limpia, exportador GeoGebra, vista fija y física exacta)

---

### C. Prompt Maestro para Recrear Fielmente este Proyecto

Copia el siguiente bloque de texto y proporciónalo a cualquier modelo avanzado de Inteligencia Artificial (Claude, ChatGPT, Gemini, etc.) para que reconstruya este simulador exactamente con la misma arquitectura, precisión física, interactividad y diseño visual:

```markdown
Actúa como un Ingeniero de Software experto en Física Computacional, Geometría Analítica y Desarrollo Web Vanilla (ES6+, SVG interactivo sin librerías externas).

Tu tarea es crear un Simulador Educativo e Interactivo de Llenado de Recipientes Extruidos llamado "Llenado". Debe funcionar 100% offline en navegadores modernos (móvil y PC).

1. REQUERIMIENTOS MATEMÁTICOS Y FÍSICOS (SISTEMA INTERNACIONAL - SI):
- Geometría: Perfil 2D extruido con profundidad constante d (m). Se define por niveles de altura y estrictamente crecientes: cada nivel i tiene una cota y_i, un límite izquierdo x_i(y) y un límite derecho x_d(y). Se admiten tramos rectos lineales y cúbicos Hermite continuos.
- Condición de frontera crítica: Se permite anchura transversal w(y) = 0 ÚNICAMENTE en la base (y_min, punta hacia abajo ▽) o en la boca (y_max, punta hacia arriba △) para recipientes triangulares/cónicos. En cualquier cota interior debe cumplirse estrictamente w(y) > 0 para evitar auto-intersecciones.
- Leyes físicas de llenado: Ancho w(y) = x_d(y) - x_i(y); Área transversal horizontal A(y) = d · w(y); Volumen acumulado V(h) = integral exacta de A(y) dy; con caudal constante Q (m³/s) y volumen inicial V0 (m³), V(t) = min(V0 + Q·t, Capacidad); rapidez instantánea dh/dt = Q / A(h); cálculo de altura h(V) por bisección numérica acotada.

2. INTERFAZ DE USUARIO DUAL Y RESPONSIVA:
- Panel 1: Editor en Plano Cartesiano SVG interactivo con cuadrícula graduada en metros y marcas numéricas legibles.
  * Control de «Vista fija» (Checkbox): Al activarse, la escala y el centro del plano cartesiano NO se mueven ni saltan cuando el usuario arrastra vértices, permitiendo micro-ajustes cómodos.
  * Modo Simetría (Checkbox): Al mover una pared lateral, la pared contraria se refleja automáticamente centrada en el eje vertical.
  * Ajuste a cuadrícula (Snap): Resolución métrica (0.05 m).
  * Vértices arrastrables con restricciones geométricas para evitar que las paredes se crucen.
  * Selector de plantillas geométricas precargadas: Rectangular, Triángulo ▽, Triángulo △, Trapecio/Embudo, Matraz y Copa parabólica.
  * Tabla colapsable con las coordenadas numéricas exactas (y, x_izq, x_der).
- Panel 2: Recipiente en Limpio (Física Pura):
  * Renderizado SVG limpio del recipiente físico real (paredes con grosor estético de acrílico/cristal, boca abierta y fondo cerrado).
  * Sin cuadrículas, sin ejes ni vértices de edición.
  * Simulación del líquido con gradiente y superficie (menisco), con cota de altura actual h(t).
  * Controles de simulación física: Iniciar, Pausar, Reiniciar, control de tiempo (slider), caudal Q, volumen inicial V0 y profundidad d.
- Panel 3: Fórmulas Analíticas y Exportador a GeoGebra:
  * Deducción en tiempo real de las ecuaciones de las paredes x_i(y), x_d(y), ancho w(y), área transversal A(y) y rapidez dh/dt.
  * GENERADOR PARA GEOGEBRA: Tarjeta con botón «📋 Copiar para GeoGebra» que genera el código listo para pegar en la barra de entrada de GeoGebra (vértices Izq_i y Der_i, segmentos de pared y base, curvas paramétricas Curva(x(t), t, t, y0, y1), función de área condicional A(y) = Si(...) e integral de volumen V(h) = Integral(A, y_min, h)).
- Panel 4: Gráficas de Análisis:
  * Cuatro gráficas SVG en tiempo real: h(t), V(t), A(y) y w(y).

3. ARQUITECTURA MODULAR (ES6 Nativo sin frameworks ni CDNs):
- Estructura limpia modular:
  * src/geometry/profile.js y editor.js (geometría canónica, antiderivadas y serialización JSON).
  * src/physics/model.js (motor físico de llenado y cuadratura).
  * src/math/parser.js y expressions.js (evaluación matemática segura).
  * src/ui/cartesian-editor.js (gestos, escala fija, snap y simetría).
  * src/ui/clean-view.js (vista limpia del recipiente físico).
  * src/ui/formula-viewer.js (fórmulas analíticas y generador de sintaxis GeoGebra).
  * src/ui/templates.js (plantillas geométricas).
  * src/ui/charts.js (trazado de series SVG).
  * src/ui/app.js (coordinador central).
- Suite de pruebas con Node.js nativo (tests/model.test.js) con 10/10 pruebas unitarias aprobadas.

4. CRITERIOS DE ACEPTACIÓN:
- El agua jamás debe salirse ni desbordar la figura en ninguna forma geométrica (incluyendo puntas y triángulos con w=0).
- Compatible de forma fluida tanto en dispositivos móviles táctiles como en PC.
```

---

### D. Historial de Prompts Secuenciales (6 Iteraciones de Desarrollo)

| Iteración | Fecha | Modelo | Prompt Original del Usuario |
|:---:|:---:|:---:|---|
| **1** | 2026-10-23 08:57 | Claude Opus 5.5 | `hola claude analiza este codigo (en esta carperta ) quiero mejorarlo, es un simulador de llenado , pero al hacer dibujos tipo triangulos, el agua se sale de la figura, ademas es dificil dibujar, quier que todo se mantenga como graficas, ademas dd agregar un apartado donde el recipiente se muestre en limpio( sin las rayas de la grafica ) y que se directamente dependiente del grafico del recipiente, analiza primero el codigo para que me entiendas` |
| **2** | 2026-10-23 09:02 | Claude Opus 5.5 | `1. se supone que es un simulador, asi que las graficas con calculos reales son vitales y si quiero dibujar en el plano cartesiano con el unico motivo de que al dibujar, abajo aparezca la formula real del recipiente.` |
| **3** | 2026-10-23 09:06 | Claude Opus 5.5 | `2. ¿a que te refieres?, no entiendo, 3. dibujo del recipiente en un lugar comodo ( lo uso en telefono y compu ). 5. claro reorganiza el codigo` |
| **4** | 2026-10-23 09:19 | Gemini 3.8 Flash | `continua` |
| **5** | 2026-10-23 10:05 | Gemini 3.8 Flash | `me gusto mucho pero quisiera agregar unas cosas, 1. boton para mantener fija la grafica durante el dibujo, es molesto querer mover algo un poco y moverlo al otro lado del universo, 2. quiero poder tener la formula ( para geogebra ) del recipiente dibujado` |
| **6** | 2026-10-23 10:32 | Gemini 3.8 Flash | `ya solo falta un apartado : 2. crea su ficha técnica con los datos: A. nombre de la IA B. Versión C: el Promt que se utilizo y las versiones (numero de veces, colocar cada una de ellas)` |
