# entrada-tunel/ — el viaje al sol

Variante de la entrada: el scroll atraviesa un túnel de polvo, pasa cerca de
los planetas y termina frente al sol, que se dibuja **en ASCII**.

**Es la variante principal** (elegida 2026-08-11). La versión de dos puertas
quedó archivada en `_archivo/entrada-dos-puertas/` — no borrada: ninguna
carpeta está commiteada, y borrar sin historial es perder. El `index.html` de
producción sigue intacto hasta que se pida publicar; los pasos y la marca de
build necesaria están al final.

```bash
python3 -m http.server 8811 --directory /Users/human/Desktop/repos/hg-vl
```

Después `http://localhost:8811/entrada-tunel/`.

## Qué cambió respecto de la versión anterior

**Se sacó la escalera en espiral.** Era la estructura literal del descenso, y
lo único que hacía era tapar media pantalla con geometría. El efecto que valía
era el túnel.

| Distancia | Qué pasa |
|---|---|
| 0,00 · **BORDE** | Afuera del sistema. El polvo llena el cuadro |
| 0,22 · **VISUAL LAB** | Placa de cristal líquido con los previews parpadeando |
| 0,48 · **TRÁNSITO** | Se pasa cerca de los cuerpos. Las órbitas se contraen |
| 0,74 · **EL SOL** | La imagen se disuelve en ASCII. Fuego fluido en la superficie |

Un solo número, `descent` (0..1), amortiguado en el render loop, alimenta la
cámara, el campo de visión, la etapa del sistema y la entrada del ASCII.

## Blanco sobre negro

Las rampas de color pasaron a **escala de grises**. El único color de la imagen
lo aporta la aberración cromática, que separa los canales hacia los bordes.

Y por eso la saturación del grade está **por encima de 1**, no por debajo.

La corrección de color corre **después** de la aberración en el composite:
bajarla para "desaturar la escena" mataría justo el color que se quiere
conservar. Sobre gris, subirla no tiñe nada —el gris tiene saturación cero— pero
enciende las franjas de separación de canal. **La desaturación viene de las
rampas, no del grade.**

## Calibrado contra la landing original

La primera landing (`~/Desktop/landing-gl`) se veía con más contraste y sus
partículas más naturales. En vez de ajustar de memoria, se midió el histograma
de luminancia del target de escena en las dos, con la misma métrica:

| | media | pico | % bajo 0,017 |
|---|---|---|---|
| **landing-gl** (objetivo) | 0,0306 | 1,548 | 42,4 |
| túnel, antes | 0,023 | 1,078 | 49,6 |
| **túnel, ahora** | 0,0262 | 1,329 | 38,4 |

**El diagnóstico fue al revés de lo que parecía.** El túnel medía *más oscuro*
de media, no menos. Lo que le faltaba era el pico: 1,08 contra 1,55. No era
falta de oscuridad sino falta de brillos que la atraviesen — una imagen pareja y
apagada se lee como plana, y lo que se percibe como contraste es negro profundo
**con puntos que lo perforan**.

Tres causas, en orden de peso:

1. **La energía de partícula estaba en 1,15 en vez de 1,75.** La había bajado
   para la versión de dos puertas, donde el texto ocupaba las dos mitades y el
   fondo competía. Acá no aplica.
2. **El volumen era ocho veces más grande** que la nube original, con las mismas
   65.536 partículas: el campo quedaba ralo. Se resolvió con la envoltura
   toroidal (abajo), no subiendo el conteo — eso hubiera cuadruplicado el costo
   de simulación.
3. **El desvanecido radial recortaba adentro de la distribución.** Arrancaba en
   1,9 con partículas hasta 2,4: apagaba el 37% por área sin ganar nada. En la
   landing original el desvanecido arranca justo en el borde, o sea no corta.

## El túnel son las partículas

Antes eran una esfera en el origen. Con la nube centrada, la cámara arrancaba a
15 unidades mirándola desde afuera: se veía un objeto lejano, no un viaje. Ahora
la cámara **atraviesa** el volumen, y el paralaje entre las cercanas y las
lejanas es lo que da la velocidad.

**El volumen viaja con la cámara**, con envoltura toroidal en Z: cuando una
partícula sale por un extremo del cilindro entra por el otro. Es la única forma
de tener un túnel infinito sin pagar más partículas — un tubo fijo que cubriera
todo el trayecto necesitaría ocho veces el conteo para verse igual de denso.

La trayectoria (`src/scene/path.js`) entra en diagonal suave, no de frente. Un
acercamiento recto sobre el eje deja el sistema quieto en el centro del cuadro
durante todo el trayecto: eso no es un viaje, es un zoom.

## El sol

**Fuego por deformación de dominio.** Un fbm crudo da manchas que laten en el
lugar. Lo que lo vuelve fluido es evaluar el ruido en un dominio que a su vez
está desplazado por otro ruido, dos niveles: cada punto se mueve según un campo
que también se mueve, y de ahí salen los filamentos que se estiran y se doblan.

Se calcula **sólo para el sol** (`if (vSun > 0.5)`). Son siete fbm por píxel:
evaluarlo en los planetas sería pagarlo seis veces más para tirarlo con un mix
a cero.

## El ASCII

La imagen se divide en celdas, se promedia la luminancia de cada una y se dibuja
el carácter cuya densidad de tinta le corresponde. Doce niveles: `` .:-=+*ox#%@``

- El atlas de glifos se genera con **Canvas2D al arrancar**, no es un asset.
- El promedio por celda sale de dibujar la imagen en un target de 1/22 con
  filtrado LINEAR. No hace falta un pase de reducción ni leer N×N muestras.
- Los caracteres toman el color de su celda, no blanco puro: así la aberración
  sobrevive al pase y los glifos del borde conservan su franja.

### Tres calibraciones que decidieron si se veía

**La celda tiene que medir ~11 px CSS.** A 12 px de dispositivo con DPR 2 la
celda queda en 6 px CSS y el resultado es indistinguible de un dithering
ordenado. El efecto sólo existe si se reconoce el alfabeto. Ahora son 22.

**El rango dinámico del sol ES el detalle.** Con el sol más brillante, el bloom
lo empuja entero por encima del último nivel del alfabeto y el disco queda como
un bloque macizo de arrobas: el fuego existe pero no se puede leer. Hubo que
bajarlo a `0.04 + fire*0.82 + fres*0.55`.

**La curva del índice va cerca de lineal.** Una raíz cuadrada levantaba tanto
los medios que todo el sol caía en los dos últimos caracteres. Ahora `pow(lum,
0.85)`.

## La corona y las erupciones

Un **raymarch** sobre la cáscara esférica que rodea al sol, a **cuarto de
resolución**. La imagen después pasa por el ASCII, que la cuantiza en celdas de
17 px: resolver la corona fina para después promediarla sería pagar por detalle
que el propio efecto destruye.

Tres cosas la hacen leer como la referencia:

**Regiones activas, no niebla.** Las erupciones no salen de cualquier lado:
salen de manchas concretas. Con el exponente en 6,5 los lóbulos se solapaban y
cubrían casi todo el ángulo sólido — señal en el 87% del target, o sea un velo
parejo. A 15 quedan manchas separadas con negro entre ellas.

**Una región anclada al limbo visible.** Las fijas caen donde caigan: pueden
quedar del lado oculto, o de frente, donde una protuberancia se proyecta sobre
el propio disco y se pierde. La cuarta se construye a partir de la posición de
la cámara, así siempre se ve **de perfil**, recortada contra el negro.

**Cizalla con la altura.** Sin ella los filamentos salen rectos y la corona
parece un erizo. Rotando la dirección en función de la altura, las estructuras
se inclinan al subir y se leen como **arcos** — la forma que realmente tiene una
protuberancia siguiendo una línea de campo.

La optimización que la hace viable: el `region < 0.012` sale **antes** de
evaluar un solo fbm. Las regiones activas cubren poco ángulo sólido, así que la
mayoría de las muestras del march terminan ahí.

## Al llegar, la óptica se calma

El bloom baja a un tercio y la estela casi se apaga (`stage` los escala). Son lo
que da atmósfera durante el viaje, pero sobre el sol difuminaban el limbo hasta
convertirlo en un degradado que cubría medio cuadro — y el ASCII promediaba ese
degradado, con lo cual las erupciones desaparecían dentro de él.

Y el encuadre final está **descentrado a propósito**: la cámara apunta arriba y
a la derecha del sol, así el disco queda abajo a la izquierda y los arcos tienen
negro contra el cual leerse. Con el sol centrado llenando el cuadro no hay
espacio donde arquearse.

## Dinámica y transiciones

**El "sunburst trabado" era un bug real**: el jitter del raymarch de la corona
se calculaba solo con la posición del píxel (semilla constante), así que el
patrón de bandas del march quedaba congelado mientras el volumen se movía por
detrás — un abanico de rayos clavado. Re-tirado por frame se vuelve ruido
temporal que el bloom y la celda ASCII promedian sin dejar estructura fija.
Contribuía también la rodilla del bloom (0,28): las crestas del fuego cruzando
el umbral daban latigazos de brillo. Se ensanchó a 0,36.

Sobre eso, el paquete de dinámica:

| | Qué hace | Dónde |
|---|---|---|
| **Giro de barrena** | Una vuelta completa (τ) entre la placa y el núcleo. El DOM no gira — el mundo sí. Arranca y termina derecho, así los dos textos se leen sobre horizonte estable | `path.js` `rollAt()` |
| **Estrobos de transición** | Golpe a blanco de ~150 ms al cruzar de nivel — cuatro en todo el viaje | `Scene.flash()` |
| **Warp por scroll** | La velocidad real del scroll abre el FOV (+9°), estira las estelas (×3), precipita el polvo y refuerza la aberración | `scene.js` `warp` |
| **El sol respira** | Pulso de escala del 3% que el ASCII vuelve temblor de celdas en el limbo | `Body.vs` |
| **La corona deriva y respira** | Las regiones activas orbitan lento el limbo; el brillo late con dos senos inconmensurables — nunca repite ciclo | `Corona.fs` / `scene.js` |

**Fotosensibilidad**: los estrobos son cortos, espaciados (solo en cruces de
nivel) y **nunca se disparan con `prefers-reduced-motion`**; el giro de barrena
también se anula y el warp queda a un cuarto. Un flash es exactamente lo que
esa preferencia pide evitar.

## Rendimiento

Re-medido en frío (2026-08-11), Apple M2, Chrome, tamaño forzado 1336×1448 —
el mismo de toda la serie histórica. Reloj de pared con `readPixels` forzando
sincronización, mínimo de 3 corridas de 30 frames.

| | ms/frame |
|---|---|
| Medio viaje (sin corona ni ASCII activos) | 3,25 |
| **Frente al sol, todo activo — peor caso** | **8,51** |
| Corona (12 pasos, arranque en descent 0,55) | 1,57 |
| Sol y su fuego | 1,32 |
| Presupuesto 60 Hz | 16,7 |

El peor caso usa la mitad del presupuesto. Las dos mitigaciones de la corona
—12 pasos de march en vez de 18, y el pase arranca recién en `descent` 0,55—
la bajaron de la cuota de un tercio del frame que medía antes a 1,57 ms.

Nota de método: una sesión larga de pruebas puede dejar la máquina throttleada
y los absolutos dejan de valer (la misma escena llegó a medir 6× su costo
real). Si los números dan raros, medir la sonda de medio viaje primero: si da
muy por encima de ~3 ms en esta máquina, descansar y volver a medir.

## Sin verificar

- **La sincronía entre el scroll del documento y la escena no pudo probarse.**
  El panel del navegador no le da viewport al tab, así que `scrollTo` y la
  medición del alto se contradicen; el recorrido se hizo fijando `descent` a
  mano. **Hay que mirarlo en un navegador real antes de mostrarlo.**
- **Nada probado en móvil.** El fuego son siete fbm por píxel del sol: puede no
  entrar en un teléfono. La corona ya quedó **desactivada fuera del nivel
  `high`** como precaución (gating en `scene.js`, `quality.mesh >= 2`); si el
  fuego tampoco da, bajar a un solo nivel de deformación en `medium`.
- **Los arcos leen como corona irregular, no como el bucle único y dramático de
  la referencia.** Para eso haría falta modelar la línea de campo explícitamente
  —un toroide o una spline por erupción— en vez de derivarla del ruido.
- El texto del DOM sobre el sol en ASCII necesita más contraste. El velo actual
  está calibrado para la escena limpia, no para una pantalla llena de glifos.
- Las cuatro celdas de preview son placeholders. **Reemplazar por trabajo real
  de VL.**

## Ajuste en vivo

```js
__scene.post.ascii.mix = 1        // forzar ASCII (lo pisa el scroll)
__scene.post.streakAmount = 0.6
__scene.post.grade.saturation = 2 // subir el color de la aberración
__scene.post.bloomAmount = 0.3
__scene.quality.particleSize = 18
```

### Las cinco perillas del contraste

En orden de efecto. Las tres primeras se tocan en vivo; las dos últimas piden
recarga.

| Perilla | Dónde | Qué hace |
|---|---|---|
| `uEnergy` | `particles.js` (1,75) | Brillo de partícula. **Sube el pico**, que es lo que se percibe como contraste |
| `uIntensity` | `scene.js` (0,62) | Fondo. **Bajarlo abre el negro** entre partículas |
| `bloomAmount` | `post.js` (0,55) | Mucho bloom aplana: difumina los picos hacia los medios |
| `particleSize` | `device.js` (14) | Puntos más chicos = más negro entre ellos, más fino |
| radio y `HALF_Z` | `particles.js` / `SimPosition.fs` (2,4 y 4,0) | Volumen. **Más chico = más denso** con el mismo conteo |

Para medir en vez de mirar, el histograma de referencia está arriba: el objetivo
es media ≈ 0,031 y pico ≈ 1,55 sobre el target de escena.

Trayectoria: `src/scene/path.js`. Cuerpos: tabla `BODIES` en
`src/scene/solar.js`. Alfabeto y tamaño de celda: `src/scene/ascii.js`.

Proceso de las piezas anteriores: [`../docs/particulas.md`](../docs/particulas.md)
y [`../docs/post-y-geometria.md`](../docs/post-y-geometria.md).
