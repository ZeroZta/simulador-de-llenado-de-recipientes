# Plan de mejoras — Llenado interactivo

Fecha: 2026-10-23. El objetivo es llevar el simulador desde una primera versión funcional a un laboratorio interactivo: cada gesto o cambio de parámetro debe actualizar geometría, resultados, gráficas y animación desde el mismo modelo canónico.

## Principios de trabajo

- Una sola geometría compartida entre editor, ecuaciones, física y gráficas.
- Respuesta inmediata al editar; cálculos costosos se limitan durante el gesto y se refinan al terminarlo.
- Los controles deben funcionar con ratón, tacto y teclado.
- Mostrar unidades, método y tolerancia cuando el resultado sea numérico.
- Trabajar sin conexión y conservar importación/exportación compatible.
- Cada fase termina con criterios de aceptación y pruebas ejecutables.

## Fase 1 — Cerrar el ciclo de interacción del editor

**Prioridad: inmediata.**

- Probar en Acode y navegador móvil el arrastre de vértices, inserción de niveles, zoom, desplazamiento y gesto de pellizco.
- Corregir el manejo de captura de puntero, cancelación, foco y validación mientras se arrastra.
- Añadir rejilla cartesiana con escala y marcas numéricas; mostrar coordenadas del cursor y punto seleccionado.
- Añadir selección visible del vértice, guías de alineación y ajuste opcional a rejilla.
- Agregar/deshacer/repetir acciones (Ctrl/Cmd+Z y botones) sin perder sincronía entre tabla y plano.
- Separar las ecuaciones de la tabla en paneles editables por tramo; al editar una ecuación, actualizar el perfil y explicar errores de dominio.

**Aceptación:** editar por plano, tabla o ecuación produce el mismo perfil y resultados; los gestos no desplazan la página accidentalmente; un perfil inválido muestra el error y no se usa en la simulación; deshacer/repetir restaura geometría y parámetros.

## Fase 2 — Geometría avanzada y perfiles compuestos

**Prioridad: alta.**

- Formalizar segmentos lineales y curvas admitidas (por ejemplo, Bézier cúbicas o arcos) con dominio explícito y continuidad verificable.
- Crear un AST geométrico versionado para tramos; admitir ecuaciones seguras por pared y tramo.
- Añadir límites verticales, base y boca configurables, simetría opcional y plantillas de recipientes.
- Validar intersecciones, discontinuidades, anchura positiva, extremos, puntos repetidos y estabilidad cerca de singularidades.
- Importar proyectos anteriores de esquema v1 y migrarlos de forma explícita; conservar exportación estable.

**Aceptación:** cada tramo define evaluador, derivada cuando exista y estrategia de integración; los perfiles compuestos tienen un dominio total continuo o errores localizados; los casos límite tienen pruebas.

## Fase 3 — Motor matemático y físico de mayor precisión

**Prioridad: alta.**

- Integrar exactamente tramos con primitiva conocida y usar cuadratura adaptativa para curvas, comunicando tolerancia y error estimado.
- Añadir derivadas y validación del dominio al AST; definir claramente radianes, funciones y precedencia de operadores.
- Mejorar la inversión volumen-altura con límites de error y tratamiento robusto de áreas pequeñas.
- Añadir caudal variable `Q(t)`, pausas, volumen inicial, descarga opcional y rebose configurable.
- Calcular tiempo de llegada a alturas objetivo y mostrar `dh/dt=Q/A(h)` en el estado actual.
- Añadir límites de precisión y rendimiento para evitar bloqueos con diseños grandes.

**Aceptación:** identidades analíticas y numéricas concuerdan dentro de las tolerancias declaradas; no hay divisiones por cero silenciosas; unidades y condiciones iniciales aparecen en resultados y procedimiento.

## Fase 4 — Laboratorio visual y exploración

**Prioridad: alta.**

- Sincronizar el cursor de altura entre perfil, animación y gráficas.
- Añadir selección de curva, leyenda, ejes con marcas, tooltip accesible y exportación de gráficas como SVG/PNG.
- Mostrar comparaciones entre diseños y escenarios de caudal/profundidad.
- Añadir reproducción a distintas velocidades, avance paso a paso y control determinista por tiempo.
- Incorporar preguntas guiadas y retos educativos opcionales (por ejemplo, estimar el tiempo o comparar recipientes de igual capacidad).

**Aceptación:** cada gráfica indica variables y unidades; el cursor comparte altura/tiempo entre vistas; la animación puede pausarse, reanudarse y volver a un estado exacto.

## Fase 5 — Proyectos, sesiones y robustez móvil

**Prioridad: media.**

- Pasar de un único diseño guardado a una biblioteca IndexedDB con nombre, fecha, duplicado, renombrado y borrado con confirmación.
- Guardar restauración de sesión y preferencias de interfaz; manejar cuota, versiones y migraciones de IndexedDB.
- Validar estrictamente tamaño, versión y contenido JSON; ofrecer vista previa antes de reemplazar el diseño abierto.
- Mejorar adaptación a pantallas pequeñas, contraste, foco, lectores de pantalla y áreas táctiles.
- Mantener copia de Descargas mediante una rutina manual documentada hasta que exista sincronización segura disponible.

**Aceptación:** la biblioteca sobrevive al cierre y reapertura del navegador; importar archivos inválidos no modifica el proyecto abierto; todas las acciones principales funcionan sin teclado físico.

## Fase 6 — Verificación y entrega

**Prioridad: continua y obligatoria antes de declarar terminado.**

- Pruebas unitarias de parser, segmentos, curvas, validación, cuadratura, inversión y unidades.
- Pruebas de integración de editor→perfil→física→gráficas y de persistencia/importación.
- Pruebas DOM y navegador móvil para puntero, táctil, teclado y accesibilidad.
- Pruebas de regresión con fixtures analíticos: prisma rectangular, ancho lineal, recipiente con estrechamiento y perfil inválido.
- Ensayo offline en Acode; inspección de red para confirmar que no se requieren recursos externos.
- Comparar hashes y resultados entre fuente y copia de Descargas; actualizar `docs/PRUEBAS.md` con resultados observados.

**Aceptación:** todas las pruebas automatizadas pasan; las pruebas manuales quedan registradas por dispositivo/navegador; no se afirma una función probada si solo pasó revisión estática.

## Orden recomendado

1. Cerrar edición interactiva del plano y probarla en móvil (Fase 1).
2. Definir el modelo extensible de tramos y añadir curvas con contratos matemáticos (Fase 2).
3. Extender física y precisión para esos tramos (Fase 3).
4. Sincronizar exploración visual y controles educativos (Fase 4).
5. Completar biblioteca de proyectos y accesibilidad móvil (Fase 5).
6. Ejecutar verificación de navegador y Acode antes de declarar una versión estable (Fase 6).

## Estado de partida

## Estado de implementación (2026-10-23)

- **Fase 1, implementada con validación estática:** arrastre con puntero, inserción, desplazamiento, zoom, pellizco, rejilla con marcas, coordenadas, selección, ajuste, teclado y deshacer/rehacer. Ecuaciones por tramo permiten interpolación lineal o Hermite. Falta probar gestos y foco en Acode/navegador móvil.
- **Fase 2, parcial:** el perfil canónico versionado admite segmentos rectos y cúbicos Hermite; valida anchura positiva también en extremos interiores y comparte geometría con cálculo y dibujo. Falta AST de expresiones geométricas versionado, más formas de contorno y pruebas de continuidad/C1.
- **Fase 3, parcial:** integra polinomios por antiderivada hasta error de coma flotante estimado y dispone de Simpson adaptativo; inversión acotada e información de tolerancia. Sigue limitado a caudal constante, sin descarga ni rebose configurable.
- **Fase 4, parcial:** animación con pausa/reinicio/avance por control temporal y gráficas SVG independientes. Falta sincronización del cursor entre gráficas, exportación de gráficas y pruebas visuales.
- **Fase 5, parcial:** biblioteca IndexedDB con crear/actualizar, listar, abrir, renombrar y borrar diseños; importación valida antes de reemplazar el modelo. No se ha probado IndexedDB en navegador ni persistencia tras reinicio.
- **Fase 6, parcial:** pruebas de modelo y chequeos estáticos disponibles; falta una prueba real en Acode/navegador móvil y repetir la auditoría offline allí.

No se declara el simulador terminado: los resultados automatizados no sustituyen las pruebas de interacción visual y almacenamiento en el navegador objetivo.
