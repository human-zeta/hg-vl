# Post-proceso y geometría — el proceso

Tres piezas sumadas a la entrada para acercarla al acabado de activetheory.net:
estela anamórfica, corrección de color y una malla procedural.

Complementa [`particulas.md`](particulas.md), que cubre el sistema de partículas.

---

## Por qué estas tres

Del análisis del bundle de Active Theory (174 shaders) salió el inventario de
lo que ellos tienen y nosotros no:

| Ellos | Qué es | Costo de replicar |
|---|---|---|
| `HydraLensStreakPass`, `LensFlare` | Estelas y destellos de lente | **Bajo** — es post |
| LUTs `.cube` | Corrección de color | **Bajo** — es post |
| `PBRShader`, `Lighting`, `ShadowDepth`, `LightVolume` | Materiales, luces de área, sombras | Alto |
| `TubeShader`, `ChainShader`, `GlassInner`, `SplineParticle` | Objetos con material | Alto |
| Draco + Basis | Mallas y texturas comprimidas | Alto |

**El grueso de la diferencia no era post-proceso.** Era que ellos tienen objetos
y nosotros solo partículas. Por eso, además de los dos efectos baratos, se
instaló el pipeline de geometría: buffers de vértices, normales y matriz de
modelo. Sin eso, cualquier objeto futuro arranca de cero.

---

## 1. Estela anamórfica

Solo horizontal. Es lo que produce una lente anamorfica real —el elemento
cilíndrico desenfoca distinto en cada eje— y es la firma visual más reconocible
del cine. Sobre puntos brillantes chicos rinde mucho más que ensanchar el bloom:
el bloom agranda la mancha, la estela dibuja una línea.

Tres pases horizontales encadenados a cuarto de resolución, con offset creciente
1 → 4 → 12. Trece muestras cada uno: 39 lecturas cubren unos 408 píxeles de
alcance.

### Los dos errores que costaron el efecto

Vale registrarlos porque los dos daban un resultado *plausible* —el pase corría,
no había error de compilación, el target existía— y sin medir no se notaban.

**Error 1: normalizar por la suma de pesos.**

La primera versión era un gaussiano corriente, `acc / wsum`. Un gaussiano
normalizado conserva la energía **media**, pero reparte la de un punto aislado
entre trece muestras. Encadenado tres veces, el pico de una partícula caía a
menos de una milésima.

Medido: el target de estela daba **0,0002 de luminancia máxima**. Negro.

El arreglo es no normalizar. La muestra central conserva peso 1 y las laterales
decaen exponencialmente (`pow(0.74, i)`), con una ganancia global de 0,55. El
pico sobrevive la cadena y lo que se agrega es la cola.

```glsl
vec3 acc = texture(tDiffuse, vUv).rgb;      // centro con peso 1
for (int i = 1; i <= 6; i++) {
    float w = pow(uAtten, float(i));
    vec2 off = vec2(float(i) * uScale * uTexelSize.x, 0.0);
    acc += texture(tDiffuse, vUv + off).rgb * w;
    acc += texture(tDiffuse, vUv - off).rgb * w;
}
fragColor = vec4(acc * uGain, 1.0);
```

**Error 2: alcance mayor que el target.**

Las escalas eran 1, 7 y 49. A cuarto de resolución eso da 6 × 49 = 294 texels de
alcance sobre una textura de 334 de ancho: el kernel abarcaba la textura entera
y promediaba el negro de los bordes.

**El alcance de la última etapa no puede acercarse al ancho del target.** Con
1, 4, 12 el alcance total es 102 texels, un 30% del ancho.

### Y un tercer ajuste, ya de calidad

Con las dos correcciones el pico subió de 0,0002 a 0,017 — pero la relación
media/pico era **0,61**: casi una banda uniforme. Se leía como neblina
horizontal, no como trazos.

La causa: la estela salía de `mips[0]` *después* del blur del bloom, o sea de
una fuente ya repartida. Moviendo la llamada a antes de `_blur(0)`, la fuente es
el umbral todavía nítido:

| | pico | media/pico |
|---|---|---|
| Normalizada (rota) | 0,0002 | — |
| Corregida, fuente borrosa | 0,017 | 0,61 |
| **Corregida, fuente nítida** | **0,078** | **0,27** |

Una estela anamórfica necesita puntos definidos de donde salir.

### El tinte

La estela se suma con color propio (`uStreakTint`, frío y algo desaturado). Una
lente real tiñe la estela porque el recubrimiento no es neutro, y ese desvío de
color es la mitad de por qué se lee como óptica y no como efecto. Del mismo
color que su fuente, se lee como bloom estirado.

---

## 2. Corrección de color

Lift / gamma / gain más saturación, después del mapeo tonal. Es lo que hace un
LUT `.cube` —Active Theory carga varios— pero con aritmética en vez de una
textura 3D.

```glsl
vec3 grade(vec3 c, vec3 lift, vec3 gamma, vec3 gain, float sat) {
    c = c * gain + lift;
    c = pow(max(c, 0.0), gamma);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(l), c, sat);
}
```

**El orden importa:** gain y lift primero, gamma después. Invertido, la gamma se
aplica sobre un negro ya levantado y las sombras se lavan.

Se pierde la libertad de curva arbitraria que da un LUT. A cambio se ajusta
desde la consola sin reexportar nada, y no cuesta un asset ni una unidad de
textura. Para una paleta de dos colores de marca alcanza de sobra.

Valores actuales: sombras levemente frías, altas neutras, saturación 1,06.

---

## 3. Sistema solar

Un sol, seis planetas y sus órbitas, detrás de la juntura.

Empezó siendo una icosfera suelta girando. Hace el mismo trabajo —dar escala a
una nube que por sí sola no tiene tamaño de referencia, porque podría medir un
metro o un kilómetro— pero suma jerarquía y tiempo: hay un centro, hay cuerpos
que lo recorren, y el conjunto cambia mientras alguien mira. **Una esfera
girando es un objeto; esto es un lugar.**

### Instanciado

Una sola geometría de icosfera dibujada con `drawArraysInstanced`. Los elementos
orbitales van como atributos **por instancia** (`vertexAttribDivisor(loc, 1)`:
avanzan una vez por instancia en vez de una por vértice):

```
loc 3  aOrbit = (radio, velocidad angular, fase, inclinación)
loc 4  aBody  = (escala, color, giro propio, es_sol)
```

La posición se resuelve **en el vertex shader** a partir de `uTime`. El buffer
se sube una vez al arrancar y no se vuelve a tocar: la CPU no calcula ni una
órbita por frame. Todo el sistema son **dos draw calls** —cuerpos y órbitas— y
2.240 triángulos.

### Las velocidades siguen a Kepler

`ω ∝ r^-1.5`: los cuerpos de afuera van más lentos.

Con velocidades iguales el conjunto gira como un plato y se lee como una rueda
dentada. Con la ley real los cuerpos se adelantan unos a otros y se cruzan, y la
figura nunca se repite. Es una línea de código y es la diferencia entre un
adorno que gira y algo que parece un sistema.

Las inclinaciones también son distintas por órbita, y el giro propio de cada
cuerpo alterna de signo: un sistema donde todo rota igual se ve mecánico.

### Las órbitas necesitan muchísima más energía que una superficie

Las órbitas son `LINE_LOOP` instanciado — líneas de **un píxel**.

A energía 0,34 —un valor razonable para una superficie— el aporte medido de las
seis órbitas era **0,0003** sobre una escena de 0,029. Invisible.

Una línea de un píxel cubre una fracción mínima de pantalla, así que para
registrar necesita brillar por píxel mucho más que una superficie. A **1,45**
pasa el umbral de bloom, el desenfoque la ensancha, y termina leyéndose como un
hilo encendido — que es exactamente lo que tiene que ser una órbita. Aporte
medido: 0,0015, cinco veces más.

### El sol se define por el borde, no por el centro

Primera versión: disco lleno muy brillante. El bloom y la estela anamórfica lo
convertían en una mancha horizontal sin forma.

El relleno bajó de 0,55 a 0,30 y el fresnel del borde subió a 1,55. Un sol se
reconoce por su circunferencia encendida; el centro saturado solo alimenta al
bloom.

### Decisiones de la geometría

**Icosfera y no esfera UV.** Los triángulos quedan casi todos del mismo tamaño.
Una esfera UV amontona vértices en los polos y las facetas se ven desparejas
justo donde más se nota.

**Triángulos sueltos, no indexados.** Indexar ahorraría memoria, pero compartir
un vértice entre caras obliga a promediar su normal y eso suaviza el sombreado
cuando lo que se quiere es la faceta marcada. Además cada vértice necesita su
coordenada baricéntrica propia, que por definición no se puede compartir.

**Wireframe por coordenada baricéntrica**, sin dibujar una sola línea:

```glsl
vec3 d = fwidth(vBary);
vec3 a = smoothstep(vec3(0.0), d * 1.6, vBary);
float edge = 1.0 - min(min(a.x, a.y), a.z);
```

Dividir por `fwidth` convierte la distancia a la arista en **píxeles de
pantalla**, y por eso el trazo mantiene el grosor esté el objeto cerca o lejos.
Sin la derivada, las aristas del fondo se afinan hasta desaparecer y las del
frente engordan.

**Normal y dirección de vista en el mismo espacio.** Mezclar mundo con vista da
un fresnel que gira con la cámara en vez de con el objeto: el error se ve como
un brillo pegado a la pantalla.

**Sin escritura de profundidad.** Es una cáscara emisiva, no un sólido. Con
depth write ocultaría las partículas de atrás, y lo que se busca es que la nube
la atraviese — que se lea como un volumen dentro del polvo y no como una
calcomanía encima.

**VAO propio.** El resto del proyecto dibuja sin atributos. Si la malla
configurara sus punteros en el VAO compartido, los pases de pantalla completa
arrastrarían atributos habilitados que no usan.

### Calibración

Cinco iteraciones, oscilando entre pasarse y quedarse corto. Vale el registro
porque el error nunca fue el mismo:

| | qué | resultado |
|---|---|---|
| 1 | Icosfera radio 1,95 a z=−1,15 | Se comía el encuadre: el objeto pasaba de dar escala a ser el tema |
| 2 | Radio 1,15, opacidad 0,13 | Invisible: la atenuación por distancia la mataba |
| 3 | Opacidad 0,80, atenuación 0,008 | Presente sin dominar |
| 4 | Sistema solar, escala 1,10 | Las órbitas exteriores se cortaban contra los bordes: arcos sueltos, no un sistema |
| 5 | Escala 0,88, velo más ceñido | Se lee el sistema completo y el texto sigue legible |

El paso 2 falló por reusar la constante de atenuación de las partículas (0,055)
a una distancia de 8 unidades. **Un objeto sólido no se desvanece con la
distancia al mismo ritmo que el polvo en suspensión**, así que tampoco comparte
la constante: 0,008.

El paso 4 enseñó lo suyo: **una órbita cortada por el borde deja de ser una
órbita.** La escala máxima del sistema la fija el encuadre, no el gusto.

En el paso 5 también hubo que ceñir el velo (`#scrim`) de 58%×46% al 46%×44% y
correrlo de 24%/76% a 19%/81%. Los dos focos oscuros que le dan piso al texto
se solapaban en el centro y apagaban justo donde vive el sistema.

Aportes medidos sobre la escena: los cuerpos suman 0,0093 de luminancia media
contra 0,0291 del resto — un 32%. Las órbitas, 0,0015.

---

## 4. Costo

Apple M2, Chrome 148, viewport 1336×1448:

| | ms/frame |
|---|---|
| **Frame completo** | **2,95** |
| Sin post-proceso | 2,14 |
| Costo de la estela | 0,09 |
| Costo del sistema solar completo | 0,08 |
| Presupuesto 60 Hz | 16,7 |

2.240 triángulos en dos draw calls y tres pases más de pantalla completa a
cuarto de resolución son, en la práctica, gratis.

**El límite acá no es el rendimiento: es el criterio.** En las cinco
iteraciones de calibración ninguna se detuvo por costo. Sobra presupuesto para
mucho más de lo que la composición aguanta.

---

## 5. Nota para publicar

Durante el desarrollo el navegador sirvió módulos ES cacheados durante varias
iteraciones: el código en disco estaba bien y la página corría una versión
vieja. Se detectó comparando el valor de una propiedad contra el archivo.

En producción sobre GitHub Pages pasa lo mismo. La solución es la que usa Active
Theory: **una marca de build en la URL de cada asset**
(`app.1780406240914.js`). Sin eso, un visitante recurrente puede quedarse con
una mezcla de versiones vieja y nueva, que es peor que cualquiera de las dos.

Para forzar la recarga en desarrollo:

```js
await fetch('/entrada/src/scene/post.js', { cache: 'reload' })
```

y después recargar la página.
