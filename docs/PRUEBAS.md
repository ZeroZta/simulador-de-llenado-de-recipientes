# Pruebas y auditoría

Entorno: Node.js v22.23.2, Android/Linux ARM64 en PRoot. Fecha: 2026-10-23.

## Ejecutadas

- `npm test`: **9/9 aprobadas**. Cubre recipiente extruido, anchuras y alturas inválidas, integral/inversión/llenado, seguridad del parser, geometría lineal, curvas Hermite y mixtas, rechazo de cruces interiores, e importación y validación inicial de la biblioteca.
- `npm run check`: chequeo sintáctico de geometría, editor, parser, expresiones, física, almacenamiento y UI.
- Parseo estático de `index.html`: 48 IDs únicos y referencias a recursos locales existentes.
- Auditoría estática previa: no encontró `eval(`, `new Function` ni recursos CDN. La biblioteca de gráficas usa SVG nativo.

## Pendientes

- No hubo navegador ni automatización DOM disponibles: puntero, toque, pellizco, animación, foco y gráficas no se ejercitaron en ejecución.
- IndexedDB no está disponible en Node: se verificó el error explícito de entorno no disponible y la validación previa, pero falta CRUD real, cuota y persistencia entre reinicios en navegador.
- Falta abrir desde Acode en un dispositivo y completar el recorrido manual descrito en `MANUAL.md`.
- La copia de Descargas debe sincronizarse y compararse al terminar los cambios.

No se atribuyen resultados visuales o de IndexedDB a pruebas que no se ejecutaron.
