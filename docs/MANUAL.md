# Manual

1. Abre `/public/Llenado` en Acode y abre `index.html`. Si la vista previa no permite módulos ES o almacenamiento persistente, ejecuta desde la carpeta `python3 -m http.server 8000` y abre `http://127.0.0.1:8000` en el navegador local.
2. Edita la tabla de niveles: cada fila fija la altura y los límites izquierdo y derecho. En el plano, **Editar puntos** permite arrastrar los círculos; las flechas del teclado los mueven con el círculo enfocado. **Insertar nivel** y un toque/clic dentro del perfil agregan un nivel interpolado. **Desplazar** permite arrastrar el plano; los controles +/− y la rueda ajustan el zoom, y **Restablecer vista** recupera el encuadre. Agrega o elimina filas desde la tabla; se requieren dos niveles como mínimo y el ancho debe permanecer positivo.
3. Opcionalmente escribe ecuaciones para `x_i(y)` y `x_d(y)` y pulsa **Aplicar en los niveles**. En **Ecuaciones por tramo**, edita cada pared y elige interpolación **Recto** o **Curvo**. El modo recto muestrea la expresión en 12 intervalos; el curvo usa una cúbica Hermite con pendientes calculadas numéricamente. Revisa el aviso si la ecuación produce anchura no positiva.
4. Configura profundidad, caudal y volumen inicial. Las unidades internas son SI (m, m³, m³/s, s).
5. Usa iniciar, pausa, reinicio o el control deslizante para observar el llenado.
6. Consulta capacidad, volumen, altura, tiempo, perfil y cuatro gráficas. El procedimiento indica método de inversión, tolerancia y error estimado.
7. Escribe un nombre y usa **Guardar**. Selecciona un diseño guardado para abrirlo, renombrarlo o borrarlo. La biblioteca vive en IndexedDB de ese navegador/dispositivo. Usa **Exportar JSON** para respaldo o mover proyectos e **Importar JSON** para restaurar un diseño validado.

El plano y la tabla editan el mismo perfil canónico. Las curvas Hermite forman parte del modelo matemático y el área líquida dibujada sigue la pared curva. Las aproximaciones numéricas se muestran con método, tolerancia y error estimado; la altura obtenida por inversión es numérica.
