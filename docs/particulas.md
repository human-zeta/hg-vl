# Partículas GPGPU — el proceso

Sistema de 65.536 partículas simuladas enteramente en la placa de video, usado
como fondo de la página de entrada.

Este documento es el registro de **cómo se llegó a eso**: la técnica, los cuatro
errores que hubo que corregir con su síntoma visual, y los parámetros con los
que se ajusta. Está escrito para que alguien lo pueda retomar dentro de un año
sin tener que redescubrir nada.

Implementación de referencia: `~/Desktop/landing-gl/`. El análisis completo de
arquitectura del que salió esto está en `landing-gl/docs/dossier.md`.

---

## 1. La idea central

**La CPU no toca ninguna partícula.**

La posición de cada una vive en un texel de una textura de punto flotante. Un
único pase de pantalla completa integra las 65.536 a la vez en el fragment
shader. En todo el frame no hay un solo bucle sobre partículas en JavaScript.

```
textura de posiciones (256×256, RGBA32F)
        │  xyz = posición, w = vida
        ▼
   SimPosition.fs  ── un triángulo de pantalla completa
        │           lee la textura A, escribe la textura B
        ▼
   se intercambian A y B  (ping-pong)
        │
        ▼
   Particles.vs  ── drawArrays(POINTS, 0, 65536) SIN buffer de vértices
        │           deriva su texel de gl_VertexID y lee con texelFetch
        ▼
   Particles.fs  ── disco con núcleo brillante, blend aditivo
```

Tres decisiones que hacen que esto funcione:

**Ping-pong obligatorio.** Un shader no puede leer y escribir la misma textura
en el mismo draw. Hacen falta dos targets que se alternan.

**RGBA32F, no half float.** Con 16 bits las posiciones se cuantizan de forma
visible cuando la partícula se aleja del origen: aparece un temblor en
escalones. Es el tipo de defecto que se ve y no se sabe nombrar.

**Cero buffers de vértices.** `gl.drawArrays(gl.POINTS, 0, 65536)` sin ningún
atributo. El vertex shader hace:

```glsl
ivec2 texel = ivec2(gl_VertexID % uGrid, gl_VertexID / uGrid);
vec4 data = texelFetch(tPos, texel, 0);
```

No se sube geometría nunca. El costo de memoria del sistema entero son dos
texturas de 256×256×16 bytes = 2 MB.

---

## 2. El campo que las mueve

No es ruido crudo: es el **rotor** de un campo de ruido.

```glsl
vec3 potential(vec3 p) {
    return vec3(fbm3(p), fbm3(p + 19.19), fbm3(p - 43.70));
}

vec3 curlNoise(vec3 p) {
    const float e = 0.09;
    // ... derivadas parciales cruzadas del potencial
    return vec3(x, y, z) / (2.0 * e);
}
```

**Por qué importa:** el rotor de cualquier campo potencial tiene divergencia
cero por construcción. El flujo no converge a puntos ni deja huecos.

Con ruido crudo como velocidad, las partículas se apelmazan en tres o cuatro
grumos y el resto de la pantalla queda vacía. Con curl mantienen densidad pareja
y el movimiento se lee como fluido. Es la diferencia entre "nube que respira" y
"puntos que se juntaron".

Se le suma una deriva vertical constante (`vel.y += 0.16`) para que el conjunto
tenga dirección y no sea un remolino sin intención.

---

## 3. Los cuatro bugs

Esta es la parte que vale guardar. Cada uno tiene un síntoma visual
característico y una causa que no es evidente mirando la pantalla.

### 3.1 Rayas verticales atravesando la pantalla

**Síntoma:** líneas de color que cruzan el encuadre entero, sobre todo al borde.

**Causa:** partículas detrás de la cámara. Con `dist = -viewPos.z` negativa, el
cálculo de tamaño explota:

```glsl
gl_PointSize = uSize / dist;   // dist ≈ 0 → decenas de miles de píxeles
```

**Arreglo:** descartarlas explícitamente y acotar el tamaño.

```glsl
float dist = -viewPos.z;
if (dist < 0.15) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // fuera del volumen de recorte
    gl_PointSize = 0.0;
    return;
}
gl_PointSize = clamp(uSize * sizeVar * (uResolution.y / 900.0) / dist, 1.0, 16.0);
```

El tope no es cosmético: acota el peor caso de relleno cuando una partícula pasa
cerca del ojo.

### 3.2 Centro quemado y bordes invisibles

**Síntoma:** la nube tiene un núcleo blanco saturado y se desvanece a nada
demasiado rápido. No hay rango intermedio.

**Causa:** `blendFunc(SRC_ALPHA, ONE)` con la energía puesta también en el
color. El aporte final termina siendo `color · energía²`.

**Arreglo:** color premultiplicado y blend `ONE, ONE`.

```glsl
float energy = mask * fade * atten * vEdge * bright * 1.7;
fragColor = vec4(col * energy, energy);
```
```js
gl.blendFunc(gl.ONE, gl.ONE);
```

Ahora el aporte es exactamente `color · energía`, lineal y predecible.

### 3.3 Aspecto de estática de televisor

**Síntoma:** no se lee como un cielo, se lee como ruido. El ojo no encuentra
dónde posarse.

**Causa:** 65.536 partículas con brillo uniforme. Una distribución pareja de
puntos idénticos es, literalmente, ruido.

**Arreglo:** brillo muy desparejo, con una potencia sobre una semilla estable
por partícula.

```glsl
vSeed  = hash13(vec3(float(texel.x), float(texel.y), 7.13));  // en el vertex
bright = 0.06 + 0.94 * pow(vSeed, 3.0);                       // en el fragment
```

La mayoría queda apenas visible y unas pocas encendidas. La semilla se deriva
del **índice**, no de la posición, para que no cambie mientras la partícula se
mueve. El tamaño también varía por semilla (`0.55 + 0.9 * vSeed`), si no aparece
una trama regular.

### 3.4 Canto recto en el borde de la nube

**Síntoma:** la nube termina en una línea recta. Se ve el cilindro donde la
simulación hace renacer las partículas y se delata todo el truco.

**Arreglo:** desvanecer **antes** del límite, y que la distribución inicial lo
exceda por los dos lados.

```glsl
float rad = length(data.xz);
vEdge = (1.0 - smoothstep(2.6, 4.3, rad))
      * (1.0 - smoothstep(1.5, 2.6, abs(data.y)));
```

Con el rango vertical de la semilla en `-2.9 … 1.9`, que pasa el desvanecido de
`|y| = 1.5 → 2.6` por arriba y por abajo. Si coincidieran, el canto vuelve.

---

## 4. Renacimiento

Cuando una partícula agota su vida o sale del volumen, vuelve a **su** posición
inicial, leída de una tercera textura:

```glsl
vec4 init = texture(tInit, vUv);
if (life <= 0.0 || pos.y > 3.2 || length(pos.xz) > 4.5) {
    pos  = init.xyz;
    life = 1.0;
}
```

Reusar la posición original en vez de hashear una nueva mantiene la silueta de
la nube estable a lo largo del tiempo.

Dos detalles:

- **La semilla se genera una sola vez** y se sube a los tres targets. Generarla
  dos veces daba dos nubes distintas: las partículas renacían en un lugar que no
  correspondía a la distribución de arranque.
- **Las vidas arrancan escalonadas** (`Math.random()`, no `1.0`). Si todas
  empiezan iguales, mueren juntas y la nube parpadea entera cada 18 segundos.
- La distribución usa `sqrt(random())` para el radio: da área uniforme. Sin la
  raíz, las partículas se amontonan en el centro.

---

## 5. Parámetros

Todo lo ajustable, con el efecto de moverlo.

| Dónde | Parámetro | Efecto |
|---|---|---|
| `device.js` | `grid` | Lado de la grilla. `256` = 65.536 partículas. `128` = 16.384 |
| `device.js` | `particleSize` | Tamaño base. **Sube al bajar el conteo**: menos partículas grandes cubren un volumen parecido, si no la nube se ve rala |
| `Particles.fs` | `bright` (exponente 3.0) | Más alto = menos partículas encendidas, más contraste |
| `Particles.fs` | `energy` (factor 1.7) | Brillo general. Por encima de ~2.5 se lava |
| `Particles.fs` | `atten` (0.055) | Caída con la distancia. Más alto = más sensación de niebla |
| `Particles.vs` | `vEdge` | Dónde se desvanece la nube |
| `SimPosition.fs` | `vel` (0.55) | Velocidad del flujo |
| `SimPosition.fs` | `life -= dt * 0.055` | Duración: ~18 s por ciclo |
| `particles.js` | `_seed()` radio 2.6 | Ancho de la nube |

Se ajustan en vivo desde la consola con `window.__scene`. Ese acceso es
deliberado: afinar a ojo requiere ver el cambio en el frame siguiente, no
recargar y esperar.

```js
__scene.quality.particleSize = 22
```

---

## 6. Costo

Medido en Apple M2, Chrome 148, a 2560×1440 (peor caso):

| | ms/frame |
|---|---|
| Simulación de las 65.536 | 1,29 |
| Dibujado | 1,01 |
| Campo de fondo | 0,18 |
| Post-proceso (bloom) | 2,21 |
| **Frame completo** | **7,49** |

Presupuesto para 60 Hz: 16,7 ms. Sobra la mitad.

**Las partículas son la parte barata.** La intuición dice lo contrario y está
mal: 65 mil puntos cuestan menos que la cadena de post-proceso.

### Nota de método

La primera tanda de mediciones se hizo con `EXT_disjoint_timer_query_webgl2` y
daba números imposibles — reportó que la escena *sin* partículas costaba más que
con ellas. El overhead por query inflaba cada medición corta.

La cifra confiable salió de reloj de pared sobre 60 frames con `readPixels` al
final para forzar la sincronización. **Antes de optimizar, verificar que el
instrumento mide lo que se cree.**

---

## 7. Requisitos y camino degradado

El sistema necesita:

- **WebGL2** (no hay fallback a WebGL1: `texelFetch` y `gl_VertexID` no existen ahí)
- **`EXT_color_buffer_float`** para renderizar a textura de punto flotante
- **`MAX_VERTEX_TEXTURE_IMAGE_UNITS >= 1`** — el vertex shader lee la textura de
  posiciones. Sin samplers en vertex no hay GPGPU posible.

Si falta cualquiera de las tres, `device.js` baja a nivel `low`: sin partículas
y sin bloom, solo el campo de fondo con la intensidad subida para compensar.

Se prueba forzándolo por URL:

```
?tier=low      ?tier=medium      ?tier=high
```

Probar el nivel bajo antes de publicar es la única forma práctica de no
enterarse en producción de que ese camino no se ejecutó nunca.

---

## 8. Para la paleta de HG·VL

La escena de referencia usa una rampa fría azul y una cálida ámbar. Para la
entrada de hg-vl las rampas van a los colores de marca:

```
--acid   #b8ff00      --cyan   #3ad0ff      --black  #050505
--glitch #ff2d55      --white  #f0ede6
```

Las rampas se definen con **tres paradas explícitas**, no con paleta de coseno:

```glsl
vec3 ramp3(float t, vec3 c0, vec3 c1, vec3 c2) {
    t = saturate(t);
    return t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
}
```

La fórmula de coseno es elegante y con cuatro `vec3` describe una rampa entera,
pero cada coeficiente afecta a los tres canales: mover un extremo tiñe el otro.
Cuando hace falta un color de marca concreto, tres paradas se ajustan en un
minuto y la fórmula pelea media hora.

**Regla que sostiene la imagen:** la luminancia tiene que subir de forma
monótona de la sombra a la alta. El color puede variar; el brillo ordena. Es lo
que evita que vuelva el aspecto de confeti del bug 3.3.

### Advertencia con el verde ácido

`#b8ff00` tiene luminancia muy alta (~0,89 en la ponderación estándar). Sobre el
umbral de bloom (0,50) casi cualquier partícula ácida va a florecer. Dos
opciones: bajar la energía de las partículas ácidas, o subir el umbral. La
primera conserva mejor el contraste.

---

## 9. Aberración cromática: la trampa y el gesto

### La trampa

El parámetro se expresa **en píxeles de separación en la esquina**, nunca en
unidades de UV.

```glsl
vec2 off = uv - uAbCenter;
float r2 = dot(off, off);
vec2 d = off * (r2 * 4.0) * ab / uResolution;
```

Con la fórmula en UV el desplazamiento depende de la resolución: el valor que se
ve bien en una ventana chica separa los canales 20 px en pantalla completa. Y
sobre partículas de 2 px eso no se lee como una lente — se lee como puntos rojos
y verdes sueltos.

Base: **1,4 px** en calidad alta, **0,9 px** en media.

### El gesto

El centro óptico es **el puntero**, no el centro de la pantalla (`uAbCenter`).

Una lente real no tiene aberración en su eje y la gana hacia los bordes. Al
mover ese eje con el mouse, el efecto deja de ser una capa encima de la imagen y
pasa a leerse como un cristal que la persona está moviendo: debajo del cursor la
imagen queda limpia y alrededor se descompone. Es la misma información visual,
pero atada a algo que el usuario controla — eso es lo que la vuelve interactiva
en lugar de decorativa.

Encima va `uAbBoost`, que la escala con la **velocidad** del puntero:

```glsl
float ab = uAberration * (1.0 + uAbBoost * 5.0) + uGlitch * 9.0;
```

Medido: en reposo 1,4 px; en un barrido sostenido llega a **5,1 px** y vuelve a
1,4 en menos de un segundo.

Dos detalles que hacen la diferencia:

- **La velocidad se mide sobre el puntero crudo, el centro se toma del
  amortiguado.** La velocidad sobre el amortiguado ya perdió el pico del gesto,
  que es justo lo que se quiere capturar. El centro sobre el crudo salta píxel a
  píxel y hace titilar toda la pantalla alrededor del cursor.
- **Ataque rápido, caída lenta** (constantes 14 y 3,5). El efecto engancha con
  el gesto y se va con calma. Simétrico se siente elástico y barato.
