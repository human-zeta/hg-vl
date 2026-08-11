# ARCHIVADA — entrada de dos puertas

**Se eligió `entrada-tunel/` como variante principal (2026-08-11).** Esta quedó
archivada, no borrada: ninguna carpeta está commiteada todavía, y borrar sin
historial es perder el trabajo. Si se confirma que no hace falta, se borra con
un `rm -rf` y listo.

Las rutas y pasos de "Publicar" de abajo quedaron obsoletos: referían a
`entrada/`, que ahora es `_archivo/entrada-dos-puertas/`.

---

Versión de la entrada de hg-vl con fondo de partículas en GPU.

Ver en local:

```bash
python3 -m http.server 8811 --directory /Users/human/Desktop/repos/hg-vl
```

Después `http://localhost:8811/entrada/`.

## Qué cambia respecto del portal actual

Se conservan la estructura de dos puertas, los textos, los links, la tipografía
y la paleta. Lo que se suma:

| | |
|---|---|
| **Campo de partículas** | 65.536 simuladas en la placa de video, con bloom |
| **Atractor por puerta** | Al pasar el mouse, la corriente se inclina hacia esa puerta |
| **Viraje de color** | Neutro en reposo → ácido en HG, cyan en VL |
| **Haz en la juntura** | La línea entre puertas se enciende con el color de la activa |
| **Glitch** | Desgarros horizontales al entrar, al elegir puerta y al hacer click |
| **Retirada de la puerta inactiva** | Baja a 34% de opacidad; el contraste hace el trabajo |
| **Aberración con el mouse** | El centro óptico es el puntero, y la separación crece con su velocidad |
| **Profundidad en los textos** | Cada línea se inclina según su capa: el titular 6× más que las etiquetas |
| **Estela anamórfica** | Trazos horizontales desde los puntos brillantes, teñidos en frío |
| **Corrección de color** | Lift/gamma/gain y saturación después del mapeo tonal |
| **Sistema solar** | Sol, 6 planetas y sus órbitas, instanciados: 2 draw calls, velocidades según Kepler |

El grano SVG del portal anterior se eliminó: ahora lo produce el shader de
composición, junto al bloom y la aberración cromática.

El estado de puerta se deriva de **un solo número** (`door`, de -1 a +1)
amortiguado en el render loop. Un valor en vez de cuatro animaciones sueltas: no
pueden desincronizarse entre sí.

## Profundidad en los textos

Cada línea tiene una profundidad (`DEPTH` en `src/main.js`) y se inclina con el
puntero. El titular se mueve 6× más que las etiquetas, y esa diferencia es lo
que se lee como volumen.

Dos decisiones que no son obvias:

**La perspectiva va como función de `transform`** —`perspective(900px)` dentro
del propio transform— y no como propiedad del contenedor. La puerta inactiva se
atenúa con `opacity`, y una opacidad menor que 1 fuerza `transform-style: flat`
en todo lo que cuelga de ella: un `preserve-3d` en el contenedor quedaría
anulado justo en el estado que más se mira. Con la función, cada elemento es su
propia escena 3D e inmune al contexto de apilado de sus ancestros.

**Un único escritor de `transform` por elemento.** El revelado de entrada solo
mueve un valor `rev`; quien escribe el `transform` es siempre `applyLayer()`, ya
combinado con la inclinación. Si cada uno escribiera por su lado, el último en
correr pisaría al otro y el texto quedaría trabado a mitad de entrada.

Las capas también entran ordenadas por profundidad, no por orden del documento:
el titular primero, las etiquetas al final.

`prefers-reduced-motion` desactiva la inclinación y deja solo el revelado.

## Medido

Apple M2, Chrome 148, viewport 1336×1448:

- **2,95 ms por frame** — presupuesto para 60 Hz: 16,7
- Post-proceso completo: 0,81 · estela: 0,09 · sistema solar: 0,08
- Parallax de las 15 capas del DOM: 0,12
- **~19 KB, 16 requests** (12 KB son las dos fuentes de Google)

Ese 0,12 ms mide solo el JavaScript. `transform` y `opacity` son propiedades de
compositor y no disparan layout, así que el recálculo de estilo es barato, pero
no está medido acá.

El proceso de las tres piezas nuevas —con los dos errores que costaron el efecto
de estela— está en [`../docs/post-y-geometria.md`](../docs/post-y-geometria.md).

El proceso completo de las partículas está en
[`../docs/particulas.md`](../docs/particulas.md).

## Accesibilidad

- El texto es HTML real: se selecciona, se indexa y lo lee un lector de pantalla.
- **El foco de teclado produce el mismo estado que el hover.** Quien navega con
  Tab ve la escena responder igual que con el mouse.
- `cmd`/`ctrl`/`shift`-click y botón del medio no se interceptan: "abrir en
  pestaña nueva" sigue funcionando.
- Sin WebGL2 la página sigue siendo la página: dos puertas legibles sobre negro.
  Probarlo con `?tier=low`.

## Ajuste en vivo

```js
__scene.setDoor('vl')              // forzar estado de puerta
__scene.pulse(1)                   // disparar glitch
__scene.quality.particleSize = 20
__scene.quality.aberration = 3     // px de separación en la esquina, en reposo
__scene.post.enabled = false       // apagar bloom y estela
__scene.post.streakAmount = 1.2    // intensidad de la estela
__scene.post.grade.saturation = 0.4
__scene.solar = null               // sacar el sistema solar
```

Los cuerpos y sus órbitas se definen en la tabla `BODIES` de
`src/scene/solar.js`: radio, escala, inclinación, fase y color por cuerpo. Las
velocidades se derivan del radio con la tercera ley de Kepler, no se declaran.

Si un cambio en un `.js` no se refleja, el navegador está sirviendo el módulo
cacheado. Forzar revalidación y recargar:

```js
await fetch('/entrada/src/scene/post.js', { cache: 'reload' })
```

Parámetros y qué mueve cada uno: `docs/particulas.md` §5.

## Publicar

Cuando esté aprobada:

```bash
cd /Users/human/Desktop/repos/hg-vl
cp index.html index-portal-plano.html   # respaldo del portal actual
cp entrada/index.html index.html
```

Y corregir en el `index.html` de la raíz las dos rutas relativas, que pasan a
colgar de la raíz del sitio:

```
assets/compiled.glsl  →  entrada/assets/compiled.glsl
src/main.js           →  entrada/src/main.js
```

La ruta del shader aparece dos veces: en el `<link rel="preload">` del `<head>`
y en la llamada a `scene.load()` dentro de `src/main.js`.

**Poner una marca de build en las URLs.** Durante el desarrollo el navegador
sirvió módulos cacheados varias veces: el código en disco estaba bien y la
página corría una versión vieja. En GitHub Pages pasa lo mismo, y un visitante
recurrente puede quedarse con una mezcla de versiones, que es peor que
cualquiera de las dos. Active Theory lo resuelve con un sello en cada asset
(`app.1780406240914.js`); acá alcanza con un `?v=` en el import de `main.js` y
en la ruta del shader, actualizado en cada publicación.

## Pendiente antes de publicar

- **No probado en móvil real.** El preset `medium` está calculado, no medido.
  En pantallas de menos de 620 px las puertas se apilan y el atractor pierde
  sentido: conviene desactivarlo ahí y dejar solo la deriva.
- El velo (`#scrim`) está calibrado para dos columnas. Si cambia el layout, hay
  que mover los dos focos con él.
- Falta decidir si el click navega con el glitch de 260 ms o si conviene una
  transición de salida más larga hacia `/home.html` y `/vl/`.
