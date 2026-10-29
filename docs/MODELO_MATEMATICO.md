# Modelo matemático y físico

El recipiente es la extrusión de un perfil plano a profundidad constante `d`; no es un sólido de revolución. Para `y∈[y_base,y_top]`, las paredes interiores son `x_i(y)` y `x_d(y)`. El ancho es `w(y)=x_d(y)-x_i(y)` y el área horizontal `A(y)=d·w(y)`.

El volumen hasta la altura `h` es `V(h)=∫[y_base,h] A(y)dy`; la capacidad es `V(y_top)`. Con caudal constante `Q` y volumen inicial `V0`, sin salida ni rebose, `V(h(t))=V0+Q·t`, con volumen y altura limitados a la capacidad. Mientras `A(h)>0`, `dh/dt=Q/A(h)`. El tiempo para alcanzar `h` es `(V(h)-V0)/Q` si `Q>0` y el objetivo es alcanzable.

Unidades SI internas: m, m², m³, m³/s y s. La profundidad y el ancho deben ser positivos, el caudal no negativo y la geometría debe cubrir el dominio con paredes de alturas alineadas, estrictamente crecientes y sin cruce.

## Tramos de geometría

La versión 1 usa segmentos lineales. La versión 2 puede mezclar tramos lineales y cúbicos Hermite. Para un tramo Hermite de altura `Δy` y `t=(y-y0)/Δy`, cada pared se define por sus extremos `x0,x1` y pendientes `m0=dx/dy|y0`, `m1=dx/dy|y1`:

`x(t)=(2t³−3t²+1)x0 +(t³−2t²+t)Δy·m0 +(-2t³+3t²)x1 +(t³−t²)Δy·m1`.

El ancho cúbico es `w(t)=x_d(t)-x_i(t)`. La validación revisa extremos e interiores críticos donde `dw/dt=0`; no basta con comparar los anchos de los nudos. Las pendientes tienen unidades `m/m` (adimensionales si ambos ejes están en m).

## Integración y precisión

`A(y)=d·w(y)`. En cada tramo lineal o Hermite, `w(t)` es un polinomio de grado máximo tres; se integra analíticamente respecto a `y` y se multiplica por `d`. El resultado es exacto en aritmética real y queda sujeto al redondeo de coma flotante. El motor informa un estimado de error de redondeo y usa Simpson adaptativo si ese estimado supera la tolerancia absoluta solicitada.

La conversión inversa `h(V)` usa bisección, por lo que la altura es aproximada numéricamente; el motor informa método, tolerancia y residuo estimado en m³. Las curvas del dibujo se muestrean desde las mismas funciones canónicas; el muestreo de pantalla no cambia el volumen.

Áreas nulas impiden invertir `V(h)` de forma única y generan error. No se permiten divisiones por cero silenciosas ni anchos no positivos.
