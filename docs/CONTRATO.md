# Contrato común de arquitectura — Llenado

Estado: versión 2, 2026-10-23.

## Modelo geométrico canónico
El recipiente es un perfil 2D extruido con profundidad constante `d`; no es un sólido de revolución. La geometría guarda nudos ordenados por altura `y`, interpolación por tramo y funciones evaluables `xLeft(y)` y `xRight(y)`. Se exige `yMin < yMax`, `d > 0`, continuidad en uniones y ancho finito positivo `w(y)=xRight(y)-xLeft(y)>0` en todo el dominio. La vista y la física consumen el mismo objeto de perfil.

La versión 1 conserva polilíneas lineales. La versión 2 representa cada pared con nudos `{x,y,slope}` (pendiente `dx/dy`) y una lista de segmentos `linear` o `hermite`; los segmentos Hermite usan interpolación cúbica en el parámetro normalizado de altura. El perfil valida el mínimo interior del ancho en cada intervalo, no solo sus extremos. El dibujo aproxima curvas con muestras del mismo evaluador canónico.

## Unidades internas y datos
Las magnitudes internas usan SI: coordenadas, profundidad y altura en m; área en m²; volumen en m³; caudal en m³/s; tiempo en s. El objeto `VesselProfile` expone `yMin`, `yMax`, `depth`, `xLeft(y)`, `xRight(y)`, `width(y)`, `area(y)`, `volumeTo(y)`, `capacity`, `heightAtVolume(v)`, `sampleContour(...)`, `validate()` y `toJSON()`. Serialización versionada y datos importados se validan antes de uso.

## Contrato matemático/físico
`A(y)=d*(xRight(y)-xLeft(y))`; `V(h)=integral[yMin,h] A(y)dy`; capacidad `V(yMax)`. Cada tramo lineal o cúbico Hermite tiene integral polinómica exacta (salvo coma flotante); las rutinas numéricas que usen cuadratura deben seguir declarando tolerancia/error estimado. Caudal constante sin salida/rebose y volumen inicial `V0`: `V(h(t))=V0+Q*t`, limitado por capacidad. Para `A(h)>0`, `dh/dt=Q/A(h)`. Un área nula, no finita o ancho no positivo genera error de dominio, nunca división silenciosa.

## Contratos de módulos
- `src/geometry/profile.js`: geometría y validación; editor importa/exporta su representación JSON.
- `src/math/parser.js`: parser aritmético seguro sin `eval` ni compilación dinámica; AST limitado a constantes, variable `y`, operaciones y funciones permitidas.
- `src/physics/model.js`: consume `VesselProfile`, caudal y estado inicial; no mantiene otra geometría.
- `src/ui/*`: adaptadores DOM/canvas; no duplica fórmulas de física.
- `src/storage.js`: IndexedDB con fallback explícito a exportación JSON si no está disponible.
- `tests/*`: pruebas de parser, geometría, integración y simulación.

## Integración
Módulos ES nativos, sin CDN, sin backend ni dependencias obligatorias. `index.html` es entrada offline. Los agentes deben crear solo los archivos asignados y notificar contratos/cambios; coordinador integra y audita.
