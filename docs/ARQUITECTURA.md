# Arquitectura

Aplicación web modular con módulos ES nativos, sin dependencias remotas ni backend obligatorio. `index.html` monta la UI; `src/geometry/profile.js` es dueño del perfil canónico compartido por dibujo y física, con segmentos lineales o Hermite; `src/geometry/editor.js` convierte trazos y valida importaciones; `src/math/` analiza y evalúa expresiones mediante AST seguro; `src/physics/model.js` integra área y resuelve altura; `src/storage.js` gestiona la biblioteca IndexedDB; `src/ui/` contiene interfaz y visualizaciones SVG; `tests/` contiene pruebas Node.

Persistencia: `src/storage.js` gestiona registros nombrados en IndexedDB y valida el formato JSON, geometría, parámetros y tamaño. La UI puede guardar, abrir, renombrar y borrar proyectos. Importación y exportación usan JSON versionado; exportar JSON sigue siendo la vía portable entre dispositivos.

El contrato normativo está en `CONTRATO.md`. El mismo `VesselProfile` alimenta las paredes dibujadas, las áreas, los volúmenes y las gráficas.

## Límite actual

Los perfiles son funciones `x(y)` por tramos lineales o cúbicos Hermite. El perfil Hermite se valida en sus extremos e interiores; la integración polinómica es analítica hasta redondeo flotante. El plano SVG permite mover vértices con puntero/táctil, insertar niveles, editar mediante teclado, acercar/alejar y desplazar. No se ha comprobado visualmente en navegador/Acode ni IndexedDB real en pantalla táctil.
