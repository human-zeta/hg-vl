// Curso VDMX6 — contenido completo de la sección de Academia.
// Se carga después de courses-content.js y extiende/override las claves "VDMX-*".
// Diagramas SVG propios (estética HG) embebidos inline; sin dependencias externas.
// Paleta: --black #050505 · --white #f0ede6 · --acid #b8ff00 · --glitch #ff2d55 · mono 'Space Mono'.
(function () {
  window.TOPIC_CONTENT = window.TOPIC_CONTENT || {};

  Object.assign(window.TOPIC_CONTENT, {

    // ───────────────────────────────────────────────────────────────
    "VDMX-0": `
<h3>Qué es VDMX6</h3>
<p><strong>VDMX6</strong> es un software de VJing y media-server modular para macOS, desarrollado por <strong>Vidvox</strong>. Es el programa que usan muchos artistas audiovisuales para mezclar video en vivo, generar visuales procedurales con shaders, reaccionar al audio y controlar todo desde controladores físicos. A diferencia de un editor de video —que trabaja sobre una línea de tiempo fija— VDMX está diseñado desde cero para el <em>tiempo real</em>: nada está pre-renderizado, todo ocurre en el instante en que tocás un control.</p>
<p>La idea más importante que tenés que entender antes de tocar un solo botón es esta: <strong>VDMX no es una app con una interfaz fija, es un sistema para construir tu propio instrumento</strong>. Vos armás la interfaz que necesitás juntando piezas. Esas piezas son de dos tipos: <strong>layers</strong> (capas de video) y <strong>plugins</strong> (todo lo demás). Esa distinción atraviesa todo el programa.</p>

<h3>VDMX vs. Resolume — dos filosofías</h3>
<p>Si venís de Resolume Arena, el cambio de mentalidad es grande. En Resolume tenés una grilla fija de capas y columnas: la estructura ya está dada y vos llenás las celdas. En VDMX <strong>la estructura la definís vos</strong>. No hay una grilla obligatoria; hay un lienzo (el workspace) donde colocás los módulos que tu proyecto necesita y los conectás entre sí.</p>
<ul>
<li><strong>Resolume</strong>: opinado, rápido de arrancar, estructura predefinida (composición → capas → columnas → clips).</li>
<li><strong>VDMX</strong>: abierto, modular, curva de aprendizaje más empinada, pero techo mucho más alto. Cada proyecto puede tener una interfaz completamente distinta.</li>
</ul>
<p>Esto significa que dos VJ pueden usar VDMX y tener pantallas que no se parecen en nada. No está mal: es el punto. VDMX premia a quien diseña su instrumento con intención.</p>

<h3>El flujo de la señal de video</h3>
<p>Más allá de lo modular, todo proyecto de VDMX tiene un recorrido de señal que siempre es el mismo. La señal de video nace en una <strong>fuente</strong>, entra a un <strong>layer</strong>, se mezcla en el <strong>Layer Compositor</strong>, pasa opcionalmente por una <strong>cadena de FX</strong> y termina en una <strong>salida</strong> (el proyector, una pantalla LED, otra app vía Syphon/NDI).</p>

<figure class="fig">
<svg viewBox="0 0 680 340" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="340" fill="#050505"/>
  <!-- fila de etapas -->
  <g>
    <rect x="20" y="40" width="110" height="58" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.45"/>
    <text x="75" y="66" fill="#f0ede6" font-size="11" text-anchor="middle">FUENTES</text>
    <text x="75" y="82" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">media · cámara</text>
    <text x="75" y="92" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">ISF · Syphon</text>

    <rect x="160" y="40" width="110" height="58" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.45"/>
    <text x="215" y="66" fill="#f0ede6" font-size="11" text-anchor="middle">LAYER</text>
    <text x="215" y="84" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">una fuente</text>

    <rect x="300" y="40" width="120" height="58" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.65"/>
    <text x="360" y="64" fill="#b8ff00" font-size="11" text-anchor="middle">COMPOSITOR</text>
    <text x="360" y="82" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">mezcla de capas</text>

    <rect x="450" y="40" width="100" height="58" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.45"/>
    <text x="500" y="66" fill="#f0ede6" font-size="11" text-anchor="middle">FX CHAIN</text>
    <text x="500" y="84" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">efectos</text>

    <rect x="580" y="40" width="80" height="58" rx="4" fill="#0d0d0d" stroke="#ff2d55" stroke-opacity="0.6"/>
    <text x="620" y="66" fill="#ff2d55" font-size="11" text-anchor="middle">OUTPUT</text>
    <text x="620" y="84" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">pantalla</text>
  </g>
  <!-- flechas entre etapas -->
  <g stroke="#b8ff00" stroke-opacity="0.5" stroke-width="1.4" fill="none">
    <path d="M130 69 L158 69"/><path d="M270 69 L298 69"/>
    <path d="M420 69 L448 69"/><path d="M550 69 L578 69"/>
  </g>
  <g fill="#b8ff00" fill-opacity="0.6">
    <path d="M158 69 l-7 -3 v6 z"/><path d="M298 69 l-7 -3 v6 z"/>
    <path d="M448 69 l-7 -3 v6 z"/><path d="M578 69 l-7 -3 v6 z"/>
  </g>
  <!-- bus de data-sources -->
  <rect x="20" y="250" width="640" height="58" rx="4" fill="#0d0d0d" stroke="#ff2d55" stroke-opacity="0.35"/>
  <text x="34" y="244" fill="#ff2d55" fill-opacity="0.8" font-size="8.5" letter-spacing="2">DATA-SOURCES — EL SISTEMA NERVIOSO</text>
  <g fill="#f0ede6" fill-opacity="0.6" font-size="8.5" text-anchor="middle">
    <text x="95" y="284">AUDIO</text><text x="215" y="284">MIDI</text>
    <text x="335" y="284">OSC</text><text x="455" y="284">LFO / CLOCK</text>
    <text x="585" y="284">SENSORES</text>
  </g>
  <!-- conexiones punteadas del bus hacia las etapas -->
  <g stroke="#ff2d55" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 4" fill="none">
    <path d="M75 250 L75 100"/><path d="M215 250 L215 100"/>
    <path d="M360 250 L360 100"/><path d="M500 250 L500 100"/>
  </g>
</svg>
<figcaption><b>El recorrido de la señal</b> — fuentes → layer → compositor → FX → output. Por debajo corre el bus de <b>data-sources</b>: cualquier control (audio, MIDI, OSC, LFO) puede engancharse a cualquier parámetro de cualquier etapa.</figcaption>
</figure>

<h3>Lo que convierte a VDMX en un instrumento: data-sources y mapeo</h3>
<p>Acá está el corazón del programa. En VDMX, <strong>cualquier valor que cambia con el tiempo es un <em>data-source</em></strong>: el volumen de tu micrófono, un knob de tu controlador MIDI, un mensaje OSC desde el teléfono, un oscilador interno (LFO), el reloj de BPM. Y <strong>cualquier parámetro de cualquier módulo</strong> —la opacidad de una capa, la intensidad de un efecto, la velocidad de un clip— puede recibir uno de esos data-sources.</p>
<p>Conectar un data-source a un parámetro se llama <strong>mapear</strong>. Cuando mapeás el grave de la música a la opacidad de una capa, esa capa "respira" con el bombo sin que vos toques nada. Cuando mapeás un fader MIDI a un crossfader, ese fader físico se vuelve parte de tu instrumento. El 80% del aprendizaje de VDMX es entender qué se puede mapear a qué —y eso lo vemos en profundidad en el módulo <em>Data-sources y mapeo</em>.</p>

<h3>ISF — generar visuales con código</h3>
<p>VDMX nació junto con <strong>ISF (Interactive Shader Format)</strong>, un formato abierto para shaders GLSL que corren en la GPU. Un shader ISF puede ser una <em>fuente</em> (genera la imagen desde cero: ruido, gradientes, fractales) o un <em>efecto</em> (transforma una imagen que entra). VDMX trae cientos incluidos y podés escribir los tuyos. No necesitás saber programar para empezar, pero ISF es lo que le da a VDMX su techo creativo. Lo vemos en su propio módulo.</p>

<h3>Requisitos y versiones</h3>
<ul>
<li><strong>Sistema</strong>: VDMX6 es exclusivo de macOS. No hay versión para Windows ni Linux.</li>
<li><strong>VDMX6 vs VDMX6 Plus</strong>: la versión Plus habilita plugins de <em>TouchDesigner</em> y <em>Vuo</em> como generadores/efectos dentro de VDMX. La base alcanza para el 95% del trabajo.</li>
<li><strong>GPU</strong>: como casi todo corre en la placa de video, una Mac con GPU decente marca una diferencia enorme en cuántas capas y efectos podés apilar.</li>
</ul>

<h3>Error frecuente al empezar</h3>
<p>VDMX <strong>no tiene autoguardado por defecto</strong>. Es el error número uno de quien arranca: armás un patch hermoso durante una hora, la app se cierra y perdiste todo. Acostumbrate a guardar con <code>⌘S</code> seguido, y nombrá las versiones con fecha (<code>set_2026-06-30_v2.vdmx</code>). El archivo de proyecto de VDMX guarda toda la estructura de tu instrumento, no el video: los clips se referencian desde su ubicación en disco, así que nunca muevas la carpeta de media después de armar el set.</p>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Abrí VDMX6 y, sin buscar tutoriales, identificá visualmente las cinco etapas del recorrido de señal en un proyecto en blanco: ¿dónde está la fuente?, ¿dónde se mezclan las capas?, ¿dónde sale el video? Después escribí en una nota propia, con tus palabras, la diferencia entre un <em>layer</em> y un <em>plugin</em>, y tres ejemplos de cosas que en VDMX serían un <em>data-source</em>. Guardá el proyecto vacío con un nombre con fecha para fijar el hábito de <code>⌘S</code>.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-1": `
<h3>El workspace: tu mesa de trabajo</h3>
<p>Cuando abrís VDMX6 no ves una interfaz única, sino un <strong>workspace</strong>: un conjunto de ventanas flotantes que podés mover, redimensionar y organizar como quieras sobre el escritorio. Cada ventana es un módulo —un layer, un mixer, un control de audio, un preview—. Vos sos quien decide qué ventanas hay y dónde van. Por eso el primer trabajo serio en VDMX no es mezclar video: es <strong>diseñar el layout de tu instrumento</strong>.</p>

<h3>El Workspace Inspector — el centro de control</h3>
<p>La ventana más importante es el <strong>Workspace Inspector</strong>. Desde acá creás, configurás y borrás todo. Está organizado en pestañas:</p>
<table class="ref">
<tr><th>Pestaña</th><th>Para qué sirve</th></tr>
<tr><td>Layers</td><td>Agregar y configurar capas de video. Cada layer es una banda de imagen que se mezcla en el compositor.</td></tr>
<tr><td>Plugins</td><td>Agregar todo lo que <em>no</em> es una capa: Audio Analysis, LFO, Clock, Control Surface, Movie Recorder, salidas Syphon/NDI, etc. Se crean con el botón <code>+</code>.</td></tr>
<tr><td>Media</td><td>Gestionar las bibliotecas de medios (Media Bins) y las páginas de clips.</td></tr>
<tr><td>Workspace</td><td>Configuración global del proyecto: resolución del canvas, preferencias de render, ventanas y páginas.</td></tr>
</table>
<p>La regla mental es simple: <strong>¿es una banda de video que se compone con otras? → es un Layer. ¿Es cualquier otra cosa? → es un Plugin.</strong> Una fuente de audio es un plugin. Un oscilador es un plugin. Una salida a proyector es un plugin. Una superficie de control con sliders es un plugin.</p>

<h3>Anatomía de una ventana de módulo</h3>

<figure class="fig">
<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="360" fill="#050505"/>
  <!-- Workspace Inspector a la izquierda -->
  <rect x="20" y="30" width="190" height="300" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/>
  <text x="34" y="52" fill="#b8ff00" font-size="9" letter-spacing="1.5">WORKSPACE INSPECTOR</text>
  <g font-size="9.5">
    <rect x="34" y="64" width="162" height="22" fill="#b8ff00" fill-opacity="0.12" stroke="#b8ff00" stroke-opacity="0.4"/>
    <text x="44" y="79" fill="#b8ff00">Layers</text>
    <rect x="34" y="90" width="162" height="22" fill="none" stroke="#f0ede6" stroke-opacity="0.12"/>
    <text x="44" y="105" fill="#f0ede6" fill-opacity="0.7">Plugins        +</text>
    <rect x="34" y="116" width="162" height="22" fill="none" stroke="#f0ede6" stroke-opacity="0.12"/>
    <text x="44" y="131" fill="#f0ede6" fill-opacity="0.7">Media</text>
    <rect x="34" y="142" width="162" height="22" fill="none" stroke="#f0ede6" stroke-opacity="0.12"/>
    <text x="44" y="157" fill="#f0ede6" fill-opacity="0.7">Workspace</text>
  </g>
  <text x="34" y="196" fill="#f0ede6" fill-opacity="0.35" font-size="8">El botón + crea</text>
  <text x="34" y="208" fill="#f0ede6" fill-opacity="0.35" font-size="8">cada plugin nuevo.</text>

  <!-- una ventana de plugin a la derecha -->
  <rect x="250" y="30" width="410" height="190" rx="4" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.25"/>
  <rect x="250" y="30" width="410" height="22" rx="4" fill="#161616"/>
  <circle cx="264" cy="41" r="4" fill="#ff2d55" fill-opacity="0.7"/>
  <text x="288" y="45" fill="#f0ede6" fill-opacity="0.8" font-size="9">Audio Analysis 1 — ventana flotante</text>
  <text x="620" y="45" fill="#f0ede6" fill-opacity="0.4" font-size="11">⌄</text>
  <!-- "main UI" del plugin -->
  <rect x="266" y="66" width="378" height="90" rx="3" fill="#070707" stroke="#b8ff00" stroke-opacity="0.2"/>
  <text x="276" y="60" fill="#f0ede6" fill-opacity="0.4" font-size="8">interfaz principal (main UI)</text>
  <g stroke="#b8ff00" stroke-opacity="0.5" fill="none" stroke-width="1.3">
    <path d="M280 130 Q330 80 380 125 T480 120 T620 130"/>
  </g>
  <!-- fila de UI items -->
  <g>
    <rect x="266" y="168" width="60" height="40" rx="3" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.15"/>
    <rect x="334" y="168" width="14" height="40" rx="2" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.15"/>
    <rect x="338" y="188" width="6" height="18" fill="#b8ff00" fill-opacity="0.5"/>
    <circle cx="380" cy="188" r="18" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.2"/>
    <line x1="380" y1="188" x2="392" y2="178" stroke="#b8ff00" stroke-opacity="0.6"/>
  </g>
  <text x="266" y="226" fill="#f0ede6" fill-opacity="0.35" font-size="8">UI items: sliders, knobs, botones — cada uno publica un data-source</text>

  <!-- inspector del plugin -->
  <rect x="250" y="238" width="410" height="92" rx="4" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.2"/>
  <text x="264" y="258" fill="#f0ede6" fill-opacity="0.75" font-size="9">INSPECTOR — configuración profunda del módulo seleccionado</text>
  <g font-size="8.5" fill="#f0ede6" fill-opacity="0.45">
    <text x="264" y="280">Input Device ▾</text><text x="430" y="280">Channel ▾</text>
    <text x="264" y="300">Filter List  +</text><text x="430" y="300">Play-Thru ▾</text>
  </g>
</svg>
<figcaption><b>Dos niveles de interfaz</b> — el <b>Workspace Inspector</b> (izquierda) donde creás módulos, y cada módulo con su <b>main UI</b> (lo que tocás en vivo) más su <b>Inspector</b> (la configuración profunda que dejás lista antes del show).</figcaption>
</figure>

<p>Cada módulo tiene dos caras que conviene no confundir:</p>
<ul>
<li><strong>Main UI</strong>: la cara visible que vas a tocar durante el show —sliders, knobs, botones, la vista de señal—. Es la parte "instrumento".</li>
<li><strong>Inspector</strong>: la configuración profunda —qué dispositivo de audio usás, qué codec graba, qué puerto OSC escucha—. Es la parte "taller". La dejás lista <em>antes</em> de subir al escenario y casi no la tocás en vivo.</li>
</ul>

<h3>UI items: las piezas con las que armás tu interfaz</h3>
<p>Muchos plugins —en especial el <strong>Control Surface</strong>— te dejan construir su cara visible colocando <em>UI items</em>: sliders, botones (momentáneos o toggle), pop-ups, ruedas de color, campos de texto, posiciones 2D, multi-sliders. Lo clave: <strong>cada UI item que colocás publica automáticamente un data-source</strong>. Es decir, ponés un slider en pantalla y ese slider ya está disponible para mapearse a cualquier parámetro. Así es como diseñás tu propio panel de control.</p>

<h3>Páginas (Workspace Pages)</h3>
<p>Un instrumento serio no entra en una sola pantalla. VDMX te deja organizar las ventanas en <strong>páginas</strong>: distintos arreglos de tu workspace que cambiás con un atajo. Una página "fuentes" para preparar clips, una página "performance" con solo los controles que tocás en vivo, una página "outputs" para revisar las salidas. Es la forma de tener un proyecto complejo sin ahogarte en ventanas.</p>

<h3>Guardar, versionar y mover el proyecto</h3>
<ul>
<li>El proyecto se guarda como un archivo <code>.vdmx</code> que contiene <strong>toda la estructura</strong>: módulos, mapeos, layout, páginas. No contiene el video.</li>
<li>Los clips se <strong>referencian</strong> desde su ubicación en disco. Si movés o renombrás la carpeta de media, VDMX pierde el rastro. Mantené una carpeta de proyecto con el <code>.vdmx</code> y la media juntos.</li>
<li>Versioná con fecha. Antes de un show, hacé <code>Save As</code> a una versión "congelada" que no vas a tocar, y trabajá sobre una copia.</li>
</ul>

<h3>Preferencias clave (un primer vistazo)</h3>
<p>En <strong>Preferences</strong> vas a volver para tres cosas, sobre todo: configurar puertos <strong>OSC</strong> y dispositivos <strong>MIDI</strong>, definir los puertos de <strong>DMX/Art-Net</strong> si controlás luces, y ajustar las <strong>Rendering Preferences</strong> (framerate del canvas, "Skip Canvas Rendering"). No hace falta tocarlas para empezar, pero saber que existen te ahorra frustraciones más adelante.</p>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Diseñá el layout base de tu instrumento. Creá un proyecto nuevo y, desde el Workspace Inspector, agregá: un Layer, un plugin de <em>Audio Analysis</em> y un plugin de <em>Preview</em>. Acomodá las tres ventanas de forma que las puedas ver todas a la vez. Después creá dos <strong>páginas</strong>: una llamada "taller" con todas las ventanas visibles, y una "show" que muestre solo el Preview y los controles que tocarías en vivo. Practicá cambiar entre páginas. Guardá con nombre y fecha.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-2": `
<h3>El Layer Compositor: dónde nace la imagen final</h3>
<p>El <strong>Layer Compositor</strong> es el módulo donde tus capas de video se apilan y se mezclan para producir la imagen que finalmente sale al proyector. Funciona como las capas de Photoshop o After Effects: se apilan de abajo hacia arriba y <strong>las capas de arriba se dibujan sobre las de abajo</strong>. La capa inferior es la base; cada capa superior se combina con el resultado acumulado según su modo de mezcla y su opacidad.</p>
<p>Un proyecto puede tener varios compositors, pero el principal alimenta al <strong>Canvas</strong> —la imagen maestra del proyecto, que es lo que después enviás a las salidas (proyector, Syphon, NDI)—.</p>

<h3>Una capa = una fuente</h3>
<p>Cada <strong>layer</strong> reproduce una sola fuente a la vez: un clip de video, una imagen, un generador ISF, una cámara, un stream de Syphon. Cuando disparás un clip nuevo en esa capa desde el Media Bin, reemplaza al anterior. Esta es una diferencia con Resolume que conviene tener clara: en VDMX la capa es un canal continuo de imagen, y vos le cambiás la fuente que está sonando ahí.</p>
<p>Cada layer tiene sus propios controles, que vas a usar todo el tiempo:</p>
<ul>
<li><strong>Opacity</strong>: cuán visible es la capa respecto a lo que tiene debajo (0 a 100%).</li>
<li><strong>Composition / Blend Mode</strong>: cómo se combinan los píxeles de la capa con los de abajo.</li>
<li><strong>FX Chain</strong>: la cadena de efectos propia de esa capa (lo vemos en su módulo).</li>
<li><strong>Transformaciones</strong>: posición, escala, rotación, recorte de la capa dentro del canvas.</li>
</ul>

<h3>Modos de mezcla (Blend Modes)</h3>
<p>El blend mode decide la <em>matemática</em> con la que una capa se funde con las de abajo. Dominar cinco o seis modos te alcanza para el 95% del trabajo en vivo:</p>
<table class="ref">
<tr><th>Modo</th><th>Qué hace</th><th>Cuándo usarlo</th></tr>
<tr><td>Normal</td><td>La capa reemplaza lo de abajo según su opacidad.</td><td>Base, cortes limpios.</td></tr>
<tr><td>Add</td><td>Suma los valores de color. Los negros se vuelven transparentes; los brillos se acumulan.</td><td>Luz, partículas, fuego, destellos.</td></tr>
<tr><td>Screen</td><td>Como Add pero suave: aclara sin "quemar".</td><td>Humo, overlays luminosos.</td></tr>
<tr><td>Multiply</td><td>Multiplica los valores: oscurece. Los blancos se vuelven transparentes.</td><td>Texturas oscuras, sombras, viñetas.</td></tr>
<tr><td>Overlay</td><td>Combina Multiply y Screen según el tono base: sube contraste y saturación.</td><td>Dar punch a una mezcla apagada.</td></tr>
<tr><td>Difference</td><td>Resta los valores: produce inversiones de color impredecibles.</td><td>Sets experimentales, psicodelia.</td></tr>
</table>

<figure class="fig">
<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="360" fill="#050505"/>
  <text x="40" y="40" fill="#b8ff00" font-size="9" letter-spacing="1.5">EL STACK DE CAPAS — SE COMPONE DE ABAJO HACIA ARRIBA</text>
  <!-- capas apiladas en perspectiva isométrica simple -->
  <g>
    <!-- capa base -->
    <polygon points="120,250 360,250 440,290 200,290" fill="#0d0d0d" stroke="#f0ede6" stroke-opacity="0.3"/>
    <text x="150" y="277" fill="#f0ede6" fill-opacity="0.6" font-size="9">L1 — fondo · Normal</text>
    <!-- capa media -->
    <polygon points="120,195 360,195 440,235 200,235" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.35"/>
    <text x="150" y="222" fill="#f0ede6" fill-opacity="0.7" font-size="9">L2 — textura · Multiply</text>
    <!-- capa superior -->
    <polygon points="120,140 360,140 440,180 200,180" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.55"/>
    <text x="150" y="167" fill="#b8ff00" font-size="9">L3 — partículas · Add</text>
  </g>
  <!-- flecha de composición hacia el canvas -->
  <g stroke="#b8ff00" stroke-opacity="0.5" stroke-width="1.4" fill="none">
    <path d="M455 165 C 520 165 520 215 555 215"/>
  </g>
  <path d="M555 215 l-8 -3 v6 z" fill="#b8ff00" fill-opacity="0.6"/>
  <!-- canvas resultante -->
  <rect x="490" y="150" width="160" height="120" rx="4" fill="#070707" stroke="#ff2d55" stroke-opacity="0.55"/>
  <text x="570" y="145" fill="#ff2d55" fill-opacity="0.85" font-size="9" text-anchor="middle">CANVAS</text>
  <g opacity="0.8">
    <rect x="490" y="150" width="160" height="120" rx="4" fill="#101a05"/>
    <circle cx="540" cy="220" r="22" fill="#b8ff00" fill-opacity="0.18"/>
    <circle cx="600" cy="195" r="14" fill="#b8ff00" fill-opacity="0.28"/>
    <rect x="500" y="160" width="140" height="50" fill="#ff2d55" fill-opacity="0.06"/>
  </g>
  <text x="570" y="288" fill="#f0ede6" fill-opacity="0.4" font-size="8" text-anchor="middle">imagen maestra → salidas</text>
  <!-- nota opacidad -->
  <text x="40" y="325" fill="#f0ede6" fill-opacity="0.4" font-size="8.5">El orden importa: la misma textura en Multiply sobre el fondo NO da igual que el fondo sobre la textura.</text>
</svg>
<figcaption><b>El compositor</b> apila las capas y las funde según blend mode + opacidad, produciendo el <b>Canvas</b>: la imagen maestra que se envía a todas las salidas.</figcaption>
</figure>

<h3>Grupos y sub-composiciones</h3>
<p>VDMX te deja <strong>agrupar capas</strong> y tratar el grupo entero como una sola señal de video. Esto es enorme: un grupo de tres capas con su mezcla resuelta puede convertirse en la <em>fuente</em> de otra capa o de un efecto. Así armás cadenas de procesamiento en cascada —por ejemplo, mezclás tres texturas en un grupo, y ese grupo entra a un efecto de espejo como si fuera un solo clip— sin reventar el rendimiento, porque el grupo se renderiza una vez.</p>

<h3>Crossfading entre fuentes y entre capas</h3>
<p>Hay dos formas de hacer transiciones:</p>
<ul>
<li><strong>Crossfade dentro de una capa</strong>: si una capa tiene dos fuentes asignadas, su crossfader controla la transición entre ellas. Podés automatizarlo, mapearlo a MIDI o cruzarlo a mano. La velocidad se define en segundos, o en beats si VDMX está sincronizado al BPM del audio.</li>
<li><strong>Two Channel Mixer (plugin)</strong>: un crossfader maestro entre dos capas enteras, al estilo DJ. No procesa imagen: solo controla la opacidad de las dos capas elegidas, con botones CUT y FADE y opción de auto-fade al disparar un clip. Ideal para sets tipo A/B.</li>
</ul>

<h3>El Canvas y el rendimiento</h3>
<p>El <strong>Canvas</strong> es la imagen final que produce el compositor principal, a la resolución que definiste en las preferencias del workspace. Todo lo que llega ahí es lo que sale. Dos reglas de oro de rendimiento desde el día uno:</p>
<ul>
<li><strong>Menos capas activas, mejor</strong>: cada capa visible es trabajo de GPU. 6–8 capas simultáneas es un número sano en hardware de gama media. Si necesitás más material, agrupá o usá páginas.</li>
<li><strong>El blend mode también cuesta</strong>: modos simples (Normal, Add) son baratos; distorsiones y blurs encadenados sobre varias capas pueden tirar el framerate. Empezá liviano y sumá efectos con criterio.</li>
</ul>

<h3>Errores comunes</h3>
<ul>
<li><strong>Confundir orden de capas con orden de efectos</strong>: subir una capa en el stack cambia qué tapa a qué; reordenar efectos dentro de una capa cambia el look de esa capa. Son dos cosas distintas.</li>
<li><strong>Opacidad al 100% con Add por todos lados</strong>: si todo suma, la imagen se "quema" a blanco. Add pide capas con fondos oscuros y dosis de opacidad.</li>
<li><strong>No nombrar las capas</strong>: en la oscuridad del show, "Layer 4 / Layer 5 / Layer 6" no te dice nada. Nombralas por función ("fondo", "texturas", "logo").</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Armá un compositor de tres capas y nombralas "fondo", "textura" y "luz". Poné un clip o generador distinto en cada una. Asigná Normal a la base, Multiply a la del medio y Add a la de arriba, y bajá la opacidad de las dos superiores a la mitad. Ahora <strong>reordená</strong>: subí la capa "luz" al medio y bajá "textura" arriba — observá cómo cambia el resultado aunque los clips sean los mismos. Después agrupá las tres capas y usá ese grupo como fuente de una cuarta capa con un efecto. Documentá qué combinación de orden + blend + opacidad te dio el look más interesante.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-3": `
<h3>Qué es una fuente</h3>
<p>Una <strong>fuente</strong> (source) es cualquier cosa que produce imagen. Cada layer reproduce una fuente a la vez, y el menú de fuente de la capa es donde elegís qué tipo poner. VDMX tiene seis familias de fuentes que vas a usar todo el tiempo:</p>
<table class="ref">
<tr><th>Fuente</th><th>Qué es</th></tr>
<tr><td>Movie File</td><td>Un archivo de video desde tu disco. La fuente más usada.</td></tr>
<tr><td>Image</td><td>Una imagen fija (PNG, JPG, etc.). Útil para logos, fondos, texturas.</td></tr>
<tr><td>ISF Generator</td><td>Un shader que genera la imagen desde cero por código (ruido, gradientes, fractales). No usa archivos.</td></tr>
<tr><td>Camera</td><td>Cualquier cámara que macOS reconozca: webcam, cámara externa con capturadora, cámara IP.</td></tr>
<tr><td>Syphon</td><td>Video que llega <em>desde otra app en la misma Mac</em>, sin pérdida ni latencia.</td></tr>
<tr><td>NDI®</td><td>Video que llega <em>por red</em> desde otra máquina o dispositivo.</td></tr>
</table>

<h3>Movie File Player — reproducir clips</h3>
<p>Cuando una capa toca un clip, tenés control total sobre su reproducción: punto de entrada y salida, modo de loop (normal o ping-pong), velocidad (rate), dirección, y la posición del cabezal (playhead) —que podés mapear a un data-source para "scratchear" el clip al ritmo de la música—.</p>
<p>El punto crítico es el <strong>codec</strong>. Para performance en vivo, el estándar de la industria es <strong>HAP</strong> (y sus variantes HAP Q, HAP Alpha), diseñado para VJing: descomprime en la GPU y libera la CPU, así podés reproducir varios clips en HD/4K sin tirones. Convertí tu material a HAP con <strong>Shutter Encoder</strong> (gratis) o el codec HAP para After Effects/Premiere antes del show. Un H.264 pesado puede funcionar en tu casa y reventarte el framerate en el escenario.</p>

<h3>Generadores ISF, cámara y entradas de red</h3>
<ul>
<li><strong>ISF generators</strong>: visuales procedurales infinitos que nunca se repiten y pesan casi nada en disco. VDMX trae cientos; los vemos a fondo en el módulo de FX/ISF.</li>
<li><strong>Cámara</strong>: agregás una cámara como fuente y la tratás igual que un clip —con efectos, blend, mapeos—. Podés tener varias simultáneas (cámara en vivo del público, por ejemplo).</li>
<li><strong>Syphon</strong>: el protocolo macOS para compartir video entre apps. Si TouchDesigner, Resolume o un generador externo publican por Syphon, VDMX los recibe como fuente en tiempo real. Ideal para combinar herramientas.</li>
<li><strong>NDI®</strong>: lo mismo pero por red Ethernet/WiFi. Permite recibir señal desde otra computadora —setups distribuidos, una máquina genera y otra mezcla—.</li>
</ul>

<h3>El Media Bin — tu biblioteca y tu lanzador de clips</h3>
<p>El <strong>Media Bin</strong> es el plugin donde organizás y disparás todo tu material. Es una grilla de celdas; cada celda es un clip. Sus partes:</p>
<ul>
<li><strong>Pages</strong>: organizás los clips en páginas temáticas ("intro", "drop", "texturas"). Cambiás de página con un clic, atajo o data-source.</li>
<li><strong>Table of Contents</strong>: el índice de todas las páginas.</li>
<li><strong>Filtering</strong>: campo de búsqueda para encontrar un clip por nombre en sets grandes.</li>
<li><strong>&lt; / &gt; / ?</strong>: dispara el clip anterior, el siguiente o uno aleatorio.</li>
</ul>

<figure class="fig">
<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="360" fill="#050505"/>
  <text x="34" y="34" fill="#b8ff00" font-size="9" letter-spacing="1.5">MEDIA BIN — DISPARO HACIA UN LAYER</text>
  <!-- grilla media bin -->
  <g>
    <rect x="30" y="50" width="270" height="190" rx="4" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.2"/>
    <text x="44" y="70" fill="#f0ede6" fill-opacity="0.5" font-size="8">PAGE: drop ▾   filter: ____</text>
  </g>
  <g>
    ` + [0,1,2,3,4,5,6,7,8].map(function(i){var c=i%3,r=Math.floor(i/3);var x=44+c*84,y=80+r*48;var on=(i===4);return '<rect x="'+x+'" y="'+y+'" width="74" height="40" rx="2" fill="'+(on?'#101a05':'#080808')+'" stroke="'+(on?'#b8ff00':'#f0ede6')+'" stroke-opacity="'+(on?'0.7':'0.15')+'"/>'+(on?'<text x="'+(x+37)+'" y="'+(y+24)+'" fill="#b8ff00" font-size="8" text-anchor="middle">▶ activo</text>':'<text x="'+(x+37)+'" y="'+(y+24)+'" fill="#f0ede6" fill-opacity="0.3" font-size="8" text-anchor="middle">clip</text>');}).join('') + `
  </g>
  <!-- triggers -->
  <rect x="30" y="255" width="270" height="70" rx="4" fill="#0c0c0c" stroke="#ff2d55" stroke-opacity="0.3"/>
  <text x="44" y="275" fill="#ff2d55" fill-opacity="0.8" font-size="8">DISPARO: mouse · teclado · MIDI · OSC · DMX</text>
  <text x="44" y="296" fill="#f0ede6" fill-opacity="0.45" font-size="8">Voice mode: Mono / Cycle / Poly</text>
  <text x="44" y="312" fill="#f0ede6" fill-opacity="0.45" font-size="8">Quantize: al fin de clip / beat / inmediato</text>
  <!-- flecha al layer -->
  <g stroke="#b8ff00" stroke-opacity="0.5" stroke-width="1.4" fill="none"><path d="M305 145 L375 145"/></g>
  <path d="M375 145 l-8 -3 v6 z" fill="#b8ff00" fill-opacity="0.6"/>
  <!-- layer con selector de fuente -->
  <rect x="385" y="60" width="265" height="265" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.45"/>
  <text x="400" y="82" fill="#b8ff00" font-size="9">LAYER — fuente actual ▾</text>
  <g font-size="9" fill="#f0ede6" fill-opacity="0.7">
    <rect x="400" y="94" width="235" height="22" fill="#b8ff00" fill-opacity="0.1" stroke="#b8ff00" stroke-opacity="0.4"/>
    <text x="412" y="109" fill="#b8ff00">Movie File ◀ activo</text>
    <text x="412" y="138">Image</text>
    <text x="412" y="160">ISF Generator</text>
    <text x="412" y="182">Camera</text>
    <text x="412" y="204">Syphon</text>
    <text x="412" y="226">NDI®</text>
  </g>
  <text x="400" y="262" fill="#f0ede6" fill-opacity="0.35" font-size="8">La misma capa puede recibir</text>
  <text x="400" y="276" fill="#f0ede6" fill-opacity="0.35" font-size="8">cualquiera de estas seis familias.</text>
  <text x="400" y="300" fill="#f0ede6" fill-opacity="0.35" font-size="8">Auto-Eject: nota off vacía la celda.</text>
</svg>
<figcaption><b>El Media Bin</b> dispara clips a un layer (por mouse, teclado, MIDI, OSC o DMX), y el <b>selector de fuente</b> de la capa decide qué familia reproduce. <b>Voice modes</b> y <b>quantize</b> definen a qué capa va y en qué momento.</figcaption>
</figure>

<h3>Cómo se dispara un clip</h3>
<p>Un clip se puede disparar de muchas formas: clic del mouse, una tecla, una nota MIDI, un mensaje OSC, un valor DMX. El modo <strong>Detect Range</strong> asigna un rango de notas MIDI mandando solo la primera y la última. Y los <strong>Voice Modes</strong> deciden a qué capa va el clip:</p>
<ul>
<li><strong>Monophonic</strong> (default): siempre al layer seleccionado.</li>
<li><strong>Cycle</strong>: avanza al siguiente layer en cada disparo.</li>
<li><strong>Polyphonic</strong>: usa el próximo layer libre — útil para apilar varios clips a la vez.</li>
</ul>
<p><strong>Quantized Triggering</strong> retrasa el disparo hasta un punto musical (fin del clip actual, próximo beat, etc.) para que los cambios caigan en tempo. <strong>Auto-Eject</strong> puede vaciar la capa al recibir el "note off" del trigger (la imagen aparece mientras mantenés la tecla y desaparece al soltar).</p>

<h3>Errores comunes</h3>
<ul>
<li><strong>Material sin convertir a HAP</strong>: la causa número uno de tirones en vivo. Convertí todo antes del show.</li>
<li><strong>Mover la carpeta de media</strong>: VDMX referencia los clips por ruta. Si movés la carpeta, las celdas quedan vacías. Tené el <code>.vdmx</code> y la media en una carpeta de proyecto.</li>
<li><strong>Resolución de clips mayor a la del canvas</strong>: VDMX puede escalar, pero es caro. Exportá tus clips al tamaño del canvas.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Armá un Media Bin con dos páginas de al menos 6 clips cada una. Probá las tres formas de disparo: mouse, teclado (asigná teclas 1–6) y, si tenés controlador, notas MIDI. Cambiá el Voice Mode a Cycle y observá cómo cada disparo cae en una capa distinta. Después agregá una segunda capa con una fuente <em>Camera</em> o <em>ISF Generator</em> y mezclala con tus clips. Si convertiste el material a HAP, compará el uso de CPU contra los mismos clips en H.264.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-4": `
<h3>El FX Chain — efectos en cadena</h3>
<p>Un <strong>FX Chain</strong> es una pila de efectos que procesan una imagen en orden, uno tras otro. Lo poderoso de VDMX es que <strong>casi todo puede tener su propia cadena de efectos</strong>: una fuente, un layer, un grupo de capas, incluso el canvas final. La imagen entra por arriba de la cadena, pasa por cada efecto y sale transformada.</p>
<p>El <strong>orden importa</strong>, y mucho. Un desenfoque seguido de un calidoscopio no da el mismo resultado que un calidoscopio seguido de un desenfoque. Reordenar la cadena (arrastrando los efectos) es una de las herramientas creativas más rápidas que tenés.</p>

<figure class="fig">
<svg viewBox="0 0 680 320" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="320" fill="#050505"/>
  <text x="34" y="34" fill="#b8ff00" font-size="9" letter-spacing="1.5">FX CHAIN — LA IMAGEN ATRAVIESA LOS EFECTOS EN ORDEN</text>
  <!-- in -->
  <rect x="30" y="70" width="90" height="60" rx="4" fill="#0d0d0d" stroke="#f0ede6" stroke-opacity="0.3"/>
  <text x="75" y="104" fill="#f0ede6" fill-opacity="0.7" font-size="9" text-anchor="middle">IMAGEN</text>
  <!-- efectos -->
  <g>
    <rect x="160" y="70" width="100" height="60" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.4"/>
    <text x="210" y="98" fill="#f0ede6" font-size="9" text-anchor="middle">FX 1</text>
    <text x="210" y="114" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">Hue Rotate</text>
    <rect x="295" y="70" width="100" height="60" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.4"/>
    <text x="345" y="98" fill="#f0ede6" font-size="9" text-anchor="middle">FX 2</text>
    <text x="345" y="114" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">Kaleidoscope</text>
    <rect x="430" y="70" width="100" height="60" rx="4" fill="#0d0d0d" stroke="#b8ff00" stroke-opacity="0.4"/>
    <text x="480" y="98" fill="#f0ede6" font-size="9" text-anchor="middle">FX 3</text>
    <text x="480" y="114" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">Blur</text>
  </g>
  <!-- out -->
  <rect x="565" y="70" width="90" height="60" rx="4" fill="#0d0d0d" stroke="#ff2d55" stroke-opacity="0.55"/>
  <text x="610" y="104" fill="#ff2d55" font-size="9" text-anchor="middle">SALIDA</text>
  <!-- flechas -->
  <g stroke="#b8ff00" stroke-opacity="0.5" stroke-width="1.4" fill="none">
    <path d="M120 100 L158 100"/><path d="M260 100 L293 100"/>
    <path d="M395 100 L428 100"/><path d="M530 100 L563 100"/>
  </g>
  <g fill="#b8ff00" fill-opacity="0.6">
    <path d="M158 100 l-7 -3 v6 z"/><path d="M293 100 l-7 -3 v6 z"/>
    <path d="M428 100 l-7 -3 v6 z"/><path d="M563 100 l-7 -3 v6 z"/>
  </g>
  <text x="345" y="160" fill="#f0ede6" fill-opacity="0.4" font-size="8" text-anchor="middle">↔ arrastrá para reordenar — el orden cambia el resultado</text>
  <!-- ISF box abajo -->
  <rect x="30" y="200" width="625" height="100" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.3"/>
  <text x="46" y="222" fill="#b8ff00" font-size="9">UN EFECTO ISF — sus INPUTS se publican como controles mapeables</text>
  <g font-size="8.5" fill="#f0ede6" fill-opacity="0.6">
    <rect x="46" y="236" width="120" height="46" rx="3" fill="#080808" stroke="#f0ede6" stroke-opacity="0.15"/>
    <text x="106" y="256" text-anchor="middle">intensity</text><text x="106" y="270" text-anchor="middle" fill-opacity="0.4">float 0–1</text>
    <rect x="178" y="236" width="120" height="46" rx="3" fill="#080808" stroke="#f0ede6" stroke-opacity="0.15"/>
    <text x="238" y="256" text-anchor="middle">color</text><text x="238" y="270" text-anchor="middle" fill-opacity="0.4">RGBA</text>
    <rect x="310" y="236" width="120" height="46" rx="3" fill="#080808" stroke="#f0ede6" stroke-opacity="0.15"/>
    <text x="370" y="256" text-anchor="middle">center</text><text x="370" y="270" text-anchor="middle" fill-opacity="0.4">point2D</text>
    <rect x="442" y="236" width="120" height="46" rx="3" fill="#080808" stroke="#f0ede6" stroke-opacity="0.15"/>
    <text x="502" y="256" text-anchor="middle">toggle</text><text x="502" y="270" text-anchor="middle" fill-opacity="0.4">bool</text>
  </g>
  <text x="582" y="263" fill="#ff2d55" fill-opacity="0.7" font-size="8" text-anchor="middle">→ mapeables</text>
</svg>
<figcaption><b>Arriba</b>: la imagen atraviesa los efectos en orden (reordenar cambia el look). <b>Abajo</b>: un shader <b>ISF</b> declara sus <b>INPUTS</b> (float, color, point2D, bool) y VDMX los expone como controles que podés mapear a audio, MIDI u OSC.</figcaption>
</figure>

<h3>Tipos de efectos</h3>
<ul>
<li><strong>ISF</strong>: efectos por shader GLSL, corren en GPU, son la mayoría y los más versátiles. VDMX trae una librería enorme.</li>
<li><strong>Core Image</strong>: efectos nativos de macOS, muy optimizados.</li>
<li><strong>FreeFrame (FFGL)</strong> y <strong>Quartz Composer</strong> (legacy, en desuso pero soportado).</li>
</ul>
<p>Cada efecto trae sus parámetros, y como todo en VDMX, esos parámetros se pueden ajustar a mano, automatizar con un LFO, o mapear a audio/MIDI/OSC. Un Hue Rotate con un LFO sinusoidal cicla el color solo; una intensidad de glitch mapeada al bombo "golpea" con la música.</p>

<h3>Máscaras</h3>
<p>Las <strong>máscaras</strong> se aplican como un efecto más en la cadena y recortan qué parte de la imagen se ve. Podés usar máscaras de forma (círculos, rectángulos, gradientes), máscaras por canal alfa, o usar la imagen de otra capa/fuente como máscara (luma key, chroma key). Combinadas con blend modes, son la base del compositing en vivo: aislar una figura, abrir "ventanas" en una capa, hacer transiciones con forma.</p>

<h3>ISF a fondo — generar y transformar con código</h3>
<p><strong>ISF (Interactive Shader Format)</strong> es un formato abierto, creado por Vidvox, para shaders GLSL que corren en la GPU. Un mismo archivo ISF puede ser de dos tipos según lo que haga:</p>
<ul>
<li><strong>Generador</strong>: produce imagen desde cero ( no recibe entrada). Ruido, gradientes, patrones, fractales.</li>
<li><strong>Efecto</strong>: recibe una imagen (<code>inputImage</code>) y la transforma.</li>
</ul>
<p>Lo que hace a ISF tan integrado con VDMX es su cabecera <strong>JSON</strong>: en la parte de arriba del archivo, el shader declara sus <code>INPUTS</code> —cada uno con un tipo (<code>float</code>, <code>bool</code>, <code>color</code>, <code>point2D</code>, <code>image</code>, <code>long</code> para menús)—. VDMX lee ese JSON y <strong>genera automáticamente los controles</strong>: un <code>float</code> se vuelve un slider, un <code>color</code> una rueda de color, un <code>point2D</code> un control de posición XY. Y, como cualquier control, esos inputs se mapean a data-sources.</p>
<p>No necesitás programar para usar los cientos de ISF que vienen incluidos. Pero VDMX trae un <strong>editor de ISF integrado</strong>: podés abrir un shader, ver su código y sus inputs, editarlo en vivo y ver el resultado al instante. Es la puerta de entrada para crear tus propios visuales —y como ISF es un estándar, los shaders que escribas funcionan también en otros hosts (Millumin, CoGe, web vía ISF.video).</p>
<p>Con <strong>VDMX6 Plus</strong>, además, podés usar composiciones de <strong>TouchDesigner</strong> y <strong>Vuo</strong> como generadores o efectos, integrando esos entornos nodales dentro de tu cadena.</p>

<h3>Rendimiento y errores comunes</h3>
<ul>
<li><strong>Cada efecto cuesta GPU</strong>: blurs grandes y distorsiones encadenadas sobre varias capas tiran el framerate. Menos efectos bien elegidos &gt; muchos efectos mediocres.</li>
<li><strong>Ignorar el orden de la cadena</strong>: antes de descartar un look, probá reordenar los mismos efectos.</li>
<li><strong>Mapear todo de golpe</strong>: si automatizás cada parámetro, perdés el control. Elegí 2–3 parámetros "vivos" por efecto y dejá el resto fijo.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Tomá una sola fuente (un clip o una cámara) y armále un FX Chain de tres efectos: uno de color (Hue Rotate), uno de distorsión (Kaleidoscope o Mirror) y un Blur suave. Reproducí el resultado, después <strong>reordená</strong> la cadena de las seis maneras posibles y documentá cuál te gusta más. Luego abrí un generador ISF de la librería, entrá a su editor integrado y cambiá el valor por defecto de uno de sus INPUTS; observá cómo el control en la interfaz refleja el cambio. Por último, agregá una máscara para recortar la imagen a una forma.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-5": `
<h3>El concepto que define a VDMX</h3>
<p>Si entendés este módulo, entendés VDMX. Todo lo demás —layers, efectos, audio, MIDI— son piezas; el <strong>mapeo</strong> es lo que las convierte en un instrumento. La idea es de una simpleza brutal: <strong>cualquier valor que cambia con el tiempo puede controlar cualquier parámetro</strong>.</p>
<p>VDMX divide el mundo en dos roles:</p>
<ul>
<li><strong>Data-source (provider)</strong>: algo que <em>produce</em> un valor cambiante. El volumen del audio, un knob MIDI, un mensaje OSC, un LFO, el reloj de BPM, un UI item que pusiste vos.</li>
<li><strong>Receiver</strong>: un parámetro que <em>recibe</em> ese valor. La opacidad de una capa, la intensidad de un efecto, la velocidad de un clip, el crossfader de un mixer.</li>
</ul>
<p>Conectar un provider a un receiver es <strong>mapear</strong>. Eso es el 80% del trabajo creativo en VDMX.</p>

<figure class="fig">
<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="360" fill="#050505"/>
  <text x="40" y="34" fill="#b8ff00" font-size="9" letter-spacing="1.5">PROVIDERS</text>
  <text x="305" y="34" fill="#ff2d55" fill-opacity="0.85" font-size="9" letter-spacing="1.5">MAPEO</text>
  <text x="560" y="34" fill="#b8ff00" font-size="9" letter-spacing="1.5">RECEIVERS</text>
  <!-- providers -->
  <g font-size="9">
    ` + ['Audio · grave','MIDI · knob','OSC · /x','LFO · seno','Clock · BPM'].map(function(t,i){var y=58+i*52;return '<rect x="30" y="'+y+'" width="170" height="38" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/><text x="46" y="'+(y+23)+'" fill="#f0ede6" fill-opacity="0.8">'+t+'</text><circle cx="200" cy="'+(y+19)+'" r="4" fill="#b8ff00" fill-opacity="0.7"/>';}).join('') + `
  </g>
  <!-- receivers -->
  <g font-size="9">
    ` + ['Layer · opacity','FX · intensity','Clip · rate','Mixer · crossfade','Mask · size'].map(function(t,i){var y=58+i*52;return '<rect x="480" y="'+y+'" width="170" height="38" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/><text x="496" y="'+(y+23)+'" fill="#f0ede6" fill-opacity="0.8">'+t+'</text><circle cx="480" cy="'+(y+19)+'" r="4" fill="#b8ff00" fill-opacity="0.7"/>';}).join('') + `
  </g>
  <!-- bus de mapeo central -->
  <rect x="250" y="58" width="180" height="246" rx="6" fill="#0c0c0c" stroke="#ff2d55" stroke-opacity="0.35"/>
  <text x="340" y="150" fill="#f0ede6" fill-opacity="0.6" font-size="8.5" text-anchor="middle">rango min/max</text>
  <text x="340" y="168" fill="#f0ede6" fill-opacity="0.6" font-size="8.5" text-anchor="middle">curva · invert</text>
  <text x="340" y="186" fill="#f0ede6" fill-opacity="0.6" font-size="8.5" text-anchor="middle">smoothing</text>
  <text x="340" y="210" fill="#ff2d55" fill-opacity="0.7" font-size="8" text-anchor="middle">ctrl+drag</text>
  <!-- conexiones cruzadas -->
  <g stroke="#b8ff00" stroke-opacity="0.35" stroke-width="1.2" fill="none">
    <path d="M204 77 C 240 77 240 110 248 130"/>
    <path d="M204 129 C 240 129 240 150 248 160"/>
    <path d="M204 233 C 240 233 245 200 248 190"/>
  </g>
  <g stroke="#b8ff00" stroke-opacity="0.35" stroke-width="1.2" fill="none">
    <path d="M432 150 C 460 150 460 77 476 77"/>
    <path d="M432 170 C 460 170 460 181 476 181"/>
    <path d="M432 190 C 460 190 460 285 476 285"/>
  </g>
  <text x="340" y="330" fill="#f0ede6" fill-opacity="0.4" font-size="8" text-anchor="middle">Cualquier provider → cualquier receiver. Un receiver puede además reenviar a MIDI/OSC/DMX.</text>
</svg>
<figcaption><b>El sistema nervioso</b> — los <b>providers</b> (izquierda) se conectan a los <b>receivers</b> (derecha) pasando por un mapeo donde definís <b>rango, curva, invert y suavizado</b>. La conexión se hace con <b>ctrl+drag</b> o clic derecho sobre el parámetro.</figcaption>
</figure>

<h3>Cómo se mapea, en la práctica</h3>
<p>Hay dos gestos básicos:</p>
<ul>
<li><strong>Ctrl+drag</strong>: arrastrás desde el "pin" de un data-source (un puntito que aparece en cada control y en cada salida de plugin) hasta el parámetro destino. Se establece la conexión.</li>
<li><strong>Clic derecho sobre el parámetro</strong> → eligís el data-source desde un menú. Útil cuando hay muchos providers.</li>
</ul>
<p>Una vez conectado, abrís el mapeo y ajustás cómo se traduce el valor:</p>
<ul>
<li><strong>Rango (min/max)</strong>: a qué porción del parámetro llega el data-source. Quizás querés que el grave mueva la opacidad solo entre 40% y 100%, no de 0 a 100.</li>
<li><strong>Curva</strong>: lineal, exponencial, etc. Cambia la "sensación" de la reacción.</li>
<li><strong>Invert</strong>: el valor alto del provider produce el valor bajo del receiver.</li>
<li><strong>Smoothing</strong>: suaviza señales nerviosas (clave con audio, para que no "tiemble").</li>
</ul>

<h3>Los providers que vas a usar</h3>
<p>Cada uno tiene su módulo más adelante, pero conviene tener el mapa: <strong>Audio Analysis</strong> (frecuencias, beat), <strong>LFO</strong> (osciladores), <strong>Clock</strong> (BPM), <strong>Step Sequencer</strong> (patrones), <strong>Data Looper</strong> (gestos grabados), <strong>Control Surface</strong> (tus sliders/botones), <strong>MIDI</strong>, <strong>OSC</strong>, <strong>HID</strong> (gamepads), <strong>Timecode</strong>, <strong>Video Tracking</strong> (posición de un cuerpo/cara). Todos publican data-sources que viven en el mismo "bus" y se mapean igual.</p>

<h3>Trucos clave</h3>
<ul>
<li><strong>Manual + data-source a la vez</strong>: un parámetro puede tener control manual <em>y</em> recibir un data-source; se combinan. Movés el slider para fijar la base y el audio modula alrededor.</li>
<li><strong>Reenvío de salida</strong>: un receiver puede a su vez <em>mandar</em> su valor a MIDI/OSC/DMX. Así VDMX controla luces, hardware u otra app.</li>
<li><strong>Debug con Comm Display</strong>: el plugin Comm Display muestra los mensajes MIDI y OSC que entran. Si un mapeo "no responde", abrilo y verificá que el mensaje llega.</li>
<li><strong>OSCQuery / web controller</strong>: cada Control Surface puede publicarse por OSCQuery en la red local, con un controlador web accesible desde cualquier teléfono o tablet sin instalar nada. Lo vemos en el módulo de OSC.</li>
</ul>

<h3>Errores comunes</h3>
<ul>
<li><strong>Audio sin smoothing</strong>: la opacidad "vibra" porque la señal de audio es ruidosa. Subí el smoothing.</li>
<li><strong>Rango completo siempre</strong>: mapear de 0 a 100% suele ser demasiado. Acotá el rango para reacciones musicales, no espasmódicas.</li>
<li><strong>Mapeos fantasma</strong>: borraste un controlador pero el mapeo quedó. Si algo se mueve solo, revisá los data-sources activos.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Tomá un patch con dos capas y mapeá tres conexiones distintas: (1) el grave del Audio Analysis a la opacidad de la capa inferior, con smoothing y rango 30–100%; (2) un LFO sinusoidal a la intensidad de un efecto; (3) un knob MIDI (o un slider del Control Surface si no tenés controlador) al crossfader entre las dos capas. Para cada mapeo, jugá con el rango, la curva y el invert hasta que la reacción se sienta <em>musical</em> y no mecánica. Abrí el Comm Display para confirmar que tus mensajes MIDI/OSC llegan. Documentá los tres rangos que mejor funcionaron.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-6": `
<h3>Por qué reaccionar al audio</h3>
<p>La conexión entre lo que se escucha y lo que se ve es el alma del VJing. Cuando los visuales responden al grave, al beat y a la energía de la música, el público lo percibe sin pensarlo: todo "encaja". El plugin <strong>Audio Analysis</strong> es el que convierte una señal de audio en data-sources que después mapeás a cualquier parámetro (ver módulo <em>Data-sources y mapeo</em>).</p>

<h3>El plugin Audio Analysis</h3>
<p>Lo agregás desde la pestaña Plugins del Workspace Inspector. Su interfaz principal:</p>
<ul>
<li><strong>On/Off</strong>: activá el análisis solo cuando lo usás; apagado ahorra CPU.</li>
<li><strong>Vista de señal con filtros</strong>: el espectro de audio en vivo, con "ventanas" de filtro que podés mover.</li>
<li><strong>Gain</strong>: ajusta el nivel de entrada <em>antes</em> del análisis. Clave: si la señal entra muy baja, nada reacciona; muy alta, todo se satura.</li>
<li><strong>Section Preset</strong>: guardás y recuperás arreglos de filtros.</li>
</ul>
<p>En el <strong>Inspector</strong> configurás lo importante: <strong>Input Device</strong> (qué entrada de audio: micrófono, interfaz, o una captura del sistema), <strong>Channel</strong> (un canal o la suma de todos), <strong>Play-Thru</strong> (a qué salida mandar el audio para monitorear) y la <strong>Filter List</strong>.</p>

<h3>Filtros de frecuencia — el corazón del análisis</h3>
<p>Cada <strong>filtro</strong> aísla una banda del espectro y publica su propio data-source. Lo movés directamente sobre la vista de señal: <strong>arrastrás horizontal para mover la frecuencia central</strong> (de graves a agudos) y <strong>vertical para abrir o cerrar el ancho de banda</strong>. Así creás un filtro para el bombo (sub), otro para la voz/sintes (medios) y otro para los hi-hats (agudos), cada uno entregando un valor independiente.</p>

<figure class="fig">
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="300" fill="#050505"/>
  <text x="34" y="30" fill="#b8ff00" font-size="9" letter-spacing="1.5">ANÁLISIS DE AUDIO — UN FILTRO POR BANDA → UN DATA-SOURCE</text>
  <!-- espectro -->
  <rect x="30" y="48" width="620" height="150" rx="4" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.15"/>
  <g>
    ` + Array.from({length:60}).map(function(_,i){var x=40+i*10;var h=[10,18,40,70,55,30,20,16,22,30,26,18,14,12,20,28,22,16,14,12,16,22,18,14,12,10,14,18,15,12,11,14,20,17,13,12,16,22,19,15,13,12,15,20,17,14,12,11,13,16,14,12,11,10,12,15,13,11,10,9][i];return '<rect x="'+x+'" y="'+(190-h)+'" width="6" height="'+h+'" fill="#b8ff00" fill-opacity="0.28"/>';}).join('') + `
  </g>
  <!-- ventanas de filtro -->
  <g>
    <rect x="48" y="60" width="80" height="128" rx="3" fill="#ff2d55" fill-opacity="0.06" stroke="#ff2d55" stroke-opacity="0.5"/>
    <text x="88" y="78" fill="#ff2d55" fill-opacity="0.85" font-size="8" text-anchor="middle">SUB</text>
    <rect x="270" y="60" width="120" height="128" rx="3" fill="#b8ff00" fill-opacity="0.05" stroke="#b8ff00" stroke-opacity="0.5"/>
    <text x="330" y="78" fill="#b8ff00" font-size="8" text-anchor="middle">MEDIOS</text>
    <rect x="520" y="60" width="110" height="128" rx="3" fill="#b8ff00" fill-opacity="0.05" stroke="#b8ff00" stroke-opacity="0.35"/>
    <text x="575" y="78" fill="#b8ff00" fill-opacity="0.8" font-size="8" text-anchor="middle">AGUDOS</text>
  </g>
  <text x="40" y="214" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">20 Hz</text>
  <text x="610" y="214" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">20 kHz</text>
  <text x="340" y="214" fill="#f0ede6" fill-opacity="0.35" font-size="7.5" text-anchor="middle">↔ arrastrá: horizontal = frecuencia · vertical = ancho de banda</text>
  <!-- salidas -->
  <g font-size="8">
    <circle cx="88" cy="245" r="4" fill="#ff2d55" fill-opacity="0.7"/><text x="88" y="266" fill="#f0ede6" fill-opacity="0.6" text-anchor="middle">→ opacidad</text>
    <circle cx="330" cy="245" r="4" fill="#b8ff00" fill-opacity="0.7"/><text x="330" y="266" fill="#f0ede6" fill-opacity="0.6" text-anchor="middle">→ velocidad FX</text>
    <circle cx="575" cy="245" r="4" fill="#b8ff00" fill-opacity="0.7"/><text x="575" y="266" fill="#f0ede6" fill-opacity="0.6" text-anchor="middle">→ partículas</text>
  </g>
</svg>
<figcaption><b>Cada filtro es una "ventana"</b> sobre el espectro: lo arrastrás para elegir su frecuencia y su ancho. Publica un data-source independiente que mapeás donde quieras — el sub a la opacidad, los medios a un efecto, los agudos a las partículas.</figcaption>
</figure>

<h3>Las señales que extraés</h3>
<table class="ref">
<tr><th>Señal</th><th>Qué es</th><th>Buena para</th></tr>
<tr><td>Amplitude</td><td>El volumen general. La más simple y reactiva.</td><td>Opacidad global, escala que "respira".</td></tr>
<tr><td>Beat / pulso</td><td>Detecta el golpe y genera un disparo discreto en cada beat.</td><td>Triggers de clip, flashes, cambios de color.</td></tr>
<tr><td>FFT por banda</td><td>El valor de una banda de frecuencia (lo de los filtros).</td><td>Separar bombo de hi-hat y mapear distinto.</td></tr>
<tr><td>BPM</td><td>El tempo estimado del audio.</td><td>Sincronizar LFOs y secuencias al ritmo.</td></tr>
</table>

<h3>Parámetros por filtro y suavizado</h3>
<p>Cada filtro tiene, además de frecuencia y ancho, su <strong>gain</strong> (cuánto pesa esa banda) y su <strong>smoothing</strong> (suavizado). El smoothing es el truco más importante: la señal de audio cruda es nerviosa y hace "vibrar" los parámetros. Subiendo el smoothing, la reacción se vuelve fluida y musical en vez de espasmódica. Para un grave que empuja la opacidad, querés algo de smoothing; para un beat que dispara un flash, querés poco o nada.</p>

<h3>Múltiples instancias</h3>
<p>Podés tener <strong>varios plugins Audio Analysis a la vez</strong>, cada uno afinado distinto: uno dedicado al kick con poco smoothing y reacción rápida, otro a los hats, otro a un canal de audio separado. Es una práctica común en sets serios.</p>

<h3>Errores comunes</h3>
<ul>
<li><strong>Gain mal seteado</strong>: si nada reacciona, casi siempre es el gain de entrada, no el mapeo.</li>
<li><strong>Latencia</strong>: si la reacción va atrasada respecto al audio, bajá el buffer de la tarjeta de sonido.</li>
<li><strong>Olvidar el smoothing</strong>: la causa número uno de visuales que "tiemblan".</li>
<li><strong>Dejarlo encendido sin usar</strong>: consume CPU. Apagalo si esa instancia no está mapeada.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Agregá un Audio Analysis y configurá tres filtros: sub, medios y agudos, arrastrándolos sobre el espectro. Mapeá el sub a la opacidad de una capa (con bastante smoothing), el beat a disparar un clip, y los agudos a la intensidad de un efecto de partículas (con poco smoothing). Poné música de tres géneros distintos y ajustá el gain y el smoothing de cada filtro hasta que la reacción se sienta musical en todos. Documentá qué cambió entre un tema de techno y uno más melódico.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-7": `
<h3>El tiempo como material</h3>
<p>Hasta ahora controlaste cosas a mano o con audio. Este módulo es sobre <strong>generar movimiento automático y sincronizado</strong>: señales que cambian solas en el tiempo, ancladas a un tempo común. Son cuatro plugins que trabajan juntos —Clock, LFO, Step Sequencer y Data Looper— y comparten una misma columna vertebral: el reloj.</p>

<h3>Clock — el reloj maestro</h3>
<p>El <strong>Clock</strong> genera o sigue un tempo (BPM) al que se sincroniza todo lo demás. Es el director de orquesta del proyecto. Sus modos:</p>
<ul>
<li><strong>Internal</strong>: vos definís el BPM, a mano o con <strong>TAP</strong> (golpeás al ritmo).</li>
<li><strong>MIDI Follow</strong>: se esclaviza a un MIDI Clock externo (el DJ, Ableton Live) — sincronización sin deriva.</li>
<li><strong>BPM Detection</strong>: detecta el tempo desde una entrada de audio.</li>
</ul>
<p>Controles útiles: <strong>/2</strong> y <strong>x2</strong> (mitad/doble de BPM), salto al próximo <strong>downbeat</strong>, y reinicio de la medida. En la pestaña Sync podés activar <strong>Ableton Link</strong> (sincroniza posición y tempo con otras apps en la red) y <strong>MIDI Clock Out</strong> (VDMX manda el tempo a hardware externo).</p>

<figure class="fig">
<svg viewBox="0 0 680 340" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="340" fill="#050505"/>
  <!-- clock maestro -->
  <rect x="240" y="26" width="200" height="54" rx="6" fill="#0c0c0c" stroke="#ff2d55" stroke-opacity="0.55"/>
  <text x="340" y="50" fill="#ff2d55" font-size="11" text-anchor="middle">CLOCK · 128 BPM</text>
  <text x="340" y="68" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">reloj maestro — tap · Link · MIDI</text>
  <!-- grilla de beats -->
  <g stroke="#f0ede6" stroke-opacity="0.1" stroke-width="1">
    ` + Array.from({length:9}).map(function(_,i){var x=40+i*75;return '<line x1="'+x+'" y1="110" x2="'+x+'" y2="320"/>';}).join('') + `
  </g>
  <text x="44" y="124" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">beat 1 · 2 · 3 · 4 · 1 · 2 · 3 · 4</text>
  <!-- líneas de sync -->
  <g stroke="#ff2d55" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3 4"><path d="M340 80 L340 110"/></g>
  <!-- LFO -->
  <rect x="40" y="140" width="600" height="52" rx="4" fill="#0a0a0a" stroke="#b8ff00" stroke-opacity="0.3"/>
  <text x="52" y="158" fill="#b8ff00" font-size="8.5">LFO — oscilador (seno, random, bezier)</text>
  <path d="M40 178 Q 77 150 115 178 T 190 178 T 265 178 T 340 178 T 415 178 T 490 178 T 565 178 T 640 178" fill="none" stroke="#b8ff00" stroke-opacity="0.6" stroke-width="1.4"/>
  <!-- Step sequencer -->
  <rect x="40" y="204" width="600" height="52" rx="4" fill="#0a0a0a" stroke="#b8ff00" stroke-opacity="0.3"/>
  <text x="52" y="222" fill="#b8ff00" font-size="8.5">STEP SEQUENCER — un valor por paso</text>
  <g fill="#b8ff00" fill-opacity="0.45">
    ` + [12,20,8,24,15,11,22,9].map(function(h,i){var x=52+i*73;return '<rect x="'+x+'" y="'+(250-h)+'" width="58" height="'+h+'"/>';}).join('') + `
  </g>
  <!-- Data looper -->
  <rect x="40" y="268" width="600" height="52" rx="4" fill="#0a0a0a" stroke="#b8ff00" stroke-opacity="0.3"/>
  <text x="52" y="286" fill="#b8ff00" font-size="8.5">DATA LOOPER — gesto grabado en loop</text>
  <path d="M40 308 C 120 280 160 312 240 296 S 380 278 460 304 S 600 286 640 300" fill="none" stroke="#b8ff00" stroke-opacity="0.6" stroke-width="1.4"/>
</svg>
<figcaption><b>Todo cuelga del Clock</b> — el LFO oscila, el Step Sequencer entrega un valor por paso y el Data Looper reproduce un gesto grabado, los tres bloqueados a la grilla de beats del reloj maestro.</figcaption>
</figure>

<h3>LFO — osciladores</h3>
<p>El <strong>LFO</strong> (Low Frequency Oscillator) genera una señal que sube y baja sola, de forma cíclica. Lo mapeás a un parámetro y ese parámetro se mueve solo. Su editor de curvas te deja dibujar la forma de onda: <strong>seno, coseno, random, lineal o bezier</strong> — incluso combinar tramos distintos en una sola curva (<em>piecewise</em>). La <strong>length</strong> define el ciclo en segundos o, si lo enganchás a un Clock, en medidas (1 ciclo cada 4 beats, por ejemplo). Un LFO en el Hue Rotate cicla el color solo, en tempo, sin que toques nada.</p>

<h3>Step Sequencer — patrones</h3>
<p>El <strong>Step Sequencer</strong> divide el tiempo en pasos y a cada paso le asignás un valor. Sirve para patrones rítmicos de cambio: un valor distinto en cada beat. Sus tracks pueden ser de tipo <strong>Index</strong> (entero), <strong>Number</strong> (cualquier valor), <strong>Boolean</strong> (on/off por paso) o <strong>Color</strong> (un color por fila). Funciona en <strong>Seconds Mode</strong> (duración fija) o <strong>Clock Mode</strong> (en medidas, sincronizado al BPM). Con <code>cmd+click</code> "salteás" un paso. Ideal para, por ejemplo, cambiar el clip o el color en un patrón de 8 pasos que cae siempre en tempo.</p>

<h3>Data Looper — gestos grabados</h3>
<p>El <strong>Data Looper</strong> graba el movimiento de un data-source y lo reproduce en loop, sincronizado al Clock. Movés un slider "a mano" durante una medida, lo grabás, y ese gesto se repite solo para siempre. Modos por track: <strong>Solo</strong> (manual), <strong>Rec New</strong> (graba desde cero), <strong>Rec Add/Over</strong> (graba encima), <strong>Play</strong> (reproduce), <strong>Play once then solo</strong>. Trae un editor donde reorganizás los datos con <strong>warp points</strong> (arrastrás para distorsionar el gesto, option+drag para copiarlo). Es la forma de capturar tu "toque" humano y dejarlo corriendo en loop.</p>

<h3>Cómo se combinan</h3>
<p>La jugada profesional: poné un <strong>Clock</strong> como maestro (idealmente sincronizado al DJ por MIDI Clock o Ableton Link), y enganchá a él un LFO para el color, un Step Sequencer para cambiar de clip cada cierto número de beats, y un Data Looper para un gesto que grabaste en el soundcheck. Todo se mueve solo, todo en tempo, y vos quedás libre para tocar lo que importa en vivo.</p>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Creá un Clock a 120 BPM (usá TAP para fijarlo). Agregá un LFO sincronizado al Clock con length de 1 ciclo cada 4 beats y mapealo a un Hue Rotate. Agregá un Step Sequencer de 8 pasos en Clock Mode y mapealo a la opacidad de una capa, dibujando un patrón. Por último, grabá con el Data Looper un gesto de un slider de efecto durante una medida y dejalo en Play. Mirá cómo los tres se mueven juntos, en tempo, sin que toques nada. Cambiá el BPM y observá que todo se reajusta.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-8": `
<h3>Tus manos en el instrumento</h3>
<p>Mapear audio y LFOs automatiza el movimiento; los controladores físicos te devuelven el <em>toque humano</em>. Este módulo es sobre conectar hardware —controladores MIDI, gamepads, el teclado, hasta un Wiimote— para tocar VDMX como un instrumento real. La regla de oro: <strong>todo lo que vas a tocar en vivo tiene que estar mapeado antes de subir al escenario</strong>. En la oscuridad del show no hay tiempo para clic derecho.</p>

<h3>MIDI Learn — el método universal</h3>
<p>VDMX tiene <strong>MIDI Learn</strong> global y es así de simple: <strong>clic derecho sobre cualquier parámetro → "MIDI Learn" → movés el control físico</strong>. La asignación queda hecha. La próxima vez que muevas ese knob o aprietes ese pad, el parámetro responde.</p>

<figure class="fig">
<svg viewBox="0 0 680 320" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="320" fill="#050505"/>
  <text x="34" y="30" fill="#b8ff00" font-size="9" letter-spacing="1.5">MIDI LEARN — DEL CONTROL FÍSICO AL PARÁMETRO</text>
  <!-- controlador -->
  <rect x="30" y="50" width="300" height="230" rx="6" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.25"/>
  <text x="46" y="72" fill="#f0ede6" fill-opacity="0.55" font-size="8.5">CONTROLADOR MIDI</text>
  <!-- pads -->
  <g>
    ` + Array.from({length:8}).map(function(_,i){var c=i%4,r=Math.floor(i/4);var x=46+c*44,y=86+r*44;var on=(i===5);return '<rect x="'+x+'" y="'+y+'" width="36" height="36" rx="3" fill="'+(on?'#101a05':'#0a0a0a')+'" stroke="'+(on?'#b8ff00':'#f0ede6')+'" stroke-opacity="'+(on?'0.8':'0.18')+'"/>';}).join('') + `
  </g>
  <text x="46" y="196" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">pads → trigger de clips</text>
  <!-- faders -->
  <g>
    ` + [0,1,2,3].map(function(i){var x=230+i*24;return '<rect x="'+x+'" y="86" width="10" height="90" rx="2" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.18"/><rect x="'+x+'" y="'+(120+i*8)+'" width="10" height="6" fill="#b8ff00" fill-opacity="0.55"/>';}).join('') + `
  </g>
  <text x="252" y="196" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">faders → opacidad / crossfade</text>
  <!-- knobs -->
  <g>
    ` + [0,1,2,3].map(function(i){var cx=64+i*68;return '<circle cx="'+cx+'" cy="232" r="16" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.2"/><line x1="'+cx+'" y1="232" x2="'+(cx+10)+'" y2="223" stroke="#b8ff00" stroke-opacity="0.6"/>';}).join('') + `
  </g>
  <text x="46" y="266" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">knobs → parámetros de efectos</text>
  <!-- flecha learn -->
  <g stroke="#ff2d55" stroke-opacity="0.5" stroke-width="1.4" fill="none"><path d="M335 165 L400 165"/></g>
  <path d="M400 165 l-8 -3 v6 z" fill="#ff2d55" fill-opacity="0.6"/>
  <text x="367" y="156" fill="#ff2d55" fill-opacity="0.8" font-size="7.5" text-anchor="middle">learn</text>
  <!-- parametros VDMX -->
  <rect x="410" y="50" width="240" height="230" rx="6" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/>
  <text x="426" y="72" fill="#b8ff00" font-size="8.5">PARÁMETROS EN VDMX</text>
  <g font-size="9" fill="#f0ede6" fill-opacity="0.7">
    <text x="426" y="104">▢ Layer 1 · opacity</text>
    <text x="426" y="134">▢ Layer 2 · opacity</text>
    <text x="426" y="164">▢ FX · glitch amount</text>
    <text x="426" y="194">▢ Mixer · crossfade</text>
    <text x="426" y="224">▢ Clip · trigger</text>
    <text x="426" y="254">▢ Page · next</text>
  </g>
</svg>
<figcaption><b>MIDI Learn</b> conecta cada control físico con un parámetro: pads a triggers de clip, faders a opacidad/crossfade, knobs a efectos. Con el modo <b>Detect</b>, los botones se asignan apretándolos.</figcaption>
</figure>

<h3>Qué control para qué tarea</h3>
<table class="ref">
<tr><th>Control físico</th><th>Mapeo típico</th></tr>
<tr><td>Knobs / potenciómetros</td><td>Opacidad, intensidad de efectos, velocidad de clips.</td></tr>
<tr><td>Faders</td><td>Crossfaders entre capas o fuentes.</td></tr>
<tr><td>Pads / botones</td><td>Trigger de clips, activar efectos, cambiar de preset/página.</td></tr>
<tr><td>Rueda de pitch</td><td>Control fino de un parámetro continuo.</td></tr>
</table>
<p>En controladores con LEDs (Launchpad, APC40), VDMX puede <strong>devolver el estado</strong> al hardware mediante la sección <strong>Sending</strong>: el pad se ilumina cuando el clip está activo. Eso convierte tu controlador en un tablero que refleja lo que pasa en pantalla.</p>

<h3>Teclado</h3>
<p>VDMX asigna teclas a acciones: la barra espaciadora activa/desactiva una capa, 1–9 disparan clips, las flechas cambian de preset. Es el plan B cuando no tenés controlador a mano, y un buen complemento para acciones rápidas.</p>

<h3>HID — gamepads y joysticks</h3>
<p>El plugin <strong>HID Input</strong> conecta gamepads, joysticks y otros dispositivos HID. Al seleccionar el dispositivo, VDMX <strong>crea automáticamente data-sources para todos sus controles</strong> (sticks, gatillos, botones). En el inspector calibrás los rangos min/max de cada eje. Un stick analógico mapeado a una posición 2D te da control gestual buenísimo y barato. Los botones soportan modo "Detect" para asignarlos rápido.</p>

<h3>Wiimote</h3>
<p>VDMX soporta el control <strong>Wiimote</strong> (con nunchuk o classic controller). Creás el plugin, hacés clic en "DETECT" y conectás el control (botón rojo en el compartimiento de baterías). Publica <strong>pitch, yaw y roll</strong> —los movimientos en el aire— como data-sources, además de sus botones, que funcionan con el Hardware Learn. Es una opción expresiva y económica para control gestual. <em>(Limitación: solo Wiimote básico, nunchuk y classic controller; no Motion Plus ni Balance Board.)</em></p>

<h3>Errores comunes</h3>
<ul>
<li><strong>Conflictos de canal/CC</strong>: dos parámetros en el mismo canal y CC se mueven juntos sin querer. Revisá el mapa antes del show.</li>
<li><strong>Mapeos fantasma</strong>: desconectaste un controlador y el mapeo quedó. Si algo no responde o se mueve solo, revisá las asignaciones.</li>
<li><strong>No fijar rangos</strong>: un fader que llega a valores extremos puede romper el look. Acotá min/max por mapeo.</li>
<li><strong>Llegar sin todo mapeado</strong>: el error fatal. El mapeo se hace en el taller, no en el escenario.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Con un controlador MIDI (físico o virtual como un teclado en pantalla), mapeá con MIDI Learn: un fader a la opacidad de una capa, dos pads a disparar dos clips distintos, un knob a un parámetro de efecto y un botón a cambiar de página del Media Bin. Si tu controlador tiene LEDs, activá el echo de estados para que los pads reflejen el clip activo. Después agregá teclas del teclado como respaldo para las dos acciones más importantes. Tocá un set corto de 3 minutos usando <strong>solo</strong> los controles físicos —sin mouse— y anotá qué mapeo te faltó.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-9": `
<h3>Más allá del cable: control por red</h3>
<p>MIDI es genial pero tiene límites: resolución de 128 valores y, normalmente, un cable. <strong>OSC (Open Sound Control)</strong> es un protocolo de red más moderno: viaja por WiFi/Ethernet, tiene alta resolución numérica y direcciones jerárquicas con nombre (como <code>/layer/1/opacity</code>). Es lo que te permite controlar VDMX desde el teléfono, desde otra computadora o desde software como TouchDesigner, Max/MSP o Ableton.</p>

<h3>Control Surface — diseñá tu propio panel</h3>
<p>El plugin <strong>Control Surface</strong> es donde construís tu interfaz de control a medida. Colocás los elementos que querés y <strong>cada uno publica automáticamente un data-source</strong> listo para mapear:</p>
<ul>
<li><strong>Sliders</strong> (con rango min/max y opción de publicar normalizado 0–1).</li>
<li><strong>Botones</strong> momentáneos o toggle, con grupos mutuamente exclusivos.</li>
<li><strong>Pop-up buttons</strong> (menús), <strong>ruedas de color</strong> (RGBA o HSVA por separado), <strong>campos de texto</strong>.</li>
<li><strong>Posición 2D</strong>, <strong>multi-slider</strong> y <strong>multi-button</strong>.</li>
</ul>
<p>Podés <strong>exportar e importar el layout como JSON</strong> para reutilizarlo entre proyectos, e incluso importar layouts de <strong>TouchOSC</strong>. Un Control Surface bien armado es tu "tablero maestro": junta en una sola pantalla los controles que viven dispersos por todo el proyecto.</p>

<h3>OSCQuery — el controlador web sin configurar nada</h3>
<p>Acá está la magia. Cada Control Surface puede publicarse en la red local vía <strong>OSCQuery</strong>, e incluye un <strong>controlador web</strong>: abrís un navegador en cualquier teléfono, tablet o PC conectado a la misma red, entrás a una dirección, y aparece tu panel de control —sin instalar ninguna app—. Tus sliders y botones, en la pantalla táctil del teléfono, controlando VDMX en tiempo real.</p>

<figure class="fig">
<svg viewBox="0 0 680 320" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="320" fill="#050505"/>
  <text x="34" y="30" fill="#b8ff00" font-size="9" letter-spacing="1.5">CONTROL SURFACE → OSCQUERY → CUALQUIER PANTALLA</text>
  <!-- control surface en VDMX -->
  <rect x="30" y="55" width="250" height="220" rx="6" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/>
  <text x="46" y="78" fill="#b8ff00" font-size="8.5">CONTROL SURFACE (en VDMX)</text>
  <g>
    ` + [0,1,2].map(function(i){var x=46+i*70;return '<rect x="'+x+'" y="92" width="14" height="80" rx="2" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.18"/><rect x="'+x+'" y="'+(120+i*14)+'" width="14" height="7" fill="#b8ff00" fill-opacity="0.55"/>';}).join('') + `
    <circle cx="220" cy="130" r="26" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.2"/>
    <circle cx="220" cy="130" r="10" fill="#b8ff00" fill-opacity="0.25"/>
    ` + [0,1,2,3].map(function(i){var c=i%2,r=Math.floor(i/2);return '<rect x="'+(46+c*40)+'" y="'+(192+r*38)+'" width="32" height="30" rx="3" fill="#0a0a0a" stroke="#f0ede6" stroke-opacity="0.18"/>';}).join('') + `
  </g>
  <text x="150" y="262" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">cada elemento = un data-source</text>
  <!-- wifi -->
  <g stroke="#ff2d55" stroke-opacity="0.45" stroke-width="1.4" fill="none">
    <path d="M285 165 L405 165"/>
  </g>
  <path d="M405 165 l-8 -3 v6 z" fill="#ff2d55" fill-opacity="0.6"/>
  <text x="345" y="150" fill="#ff2d55" fill-opacity="0.8" font-size="8" text-anchor="middle">OSCQuery</text>
  <text x="345" y="182" fill="#f0ede6" fill-opacity="0.4" font-size="7.5" text-anchor="middle">WiFi / red local</text>
  <!-- telefono -->
  <rect x="430" y="60" width="120" height="210" rx="14" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.3"/>
  <rect x="442" y="80" width="96" height="170" rx="4" fill="#070707" stroke="#b8ff00" stroke-opacity="0.25"/>
  <text x="490" y="74" fill="#f0ede6" fill-opacity="0.4" font-size="7" text-anchor="middle">navegador del teléfono</text>
  <g>
    ` + [0,1].map(function(i){var x=452+i*44;return '<rect x="'+x+'" y="92" width="16" height="70" rx="2" fill="#0a0a0a" stroke="#b8ff00" stroke-opacity="0.3"/><rect x="'+x+'" y="'+(118+i*10)+'" width="16" height="8" fill="#b8ff00" fill-opacity="0.5"/>';}).join('') + `
    ` + [0,1,2,3].map(function(i){var c=i%2,r=Math.floor(i/2);return '<rect x="'+(452+c*44)+'" y="'+(174+r*38)+'" width="40" height="30" rx="3" fill="#101a05" stroke="#b8ff00" stroke-opacity="0.4"/>';}).join('') + `
  </g>
  <!-- oscquery client -->
  <rect x="575" y="90" width="75" height="150" rx="6" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.2"/>
  <text x="612" y="112" fill="#f0ede6" fill-opacity="0.55" font-size="7.5" text-anchor="middle">OSCQuery</text>
  <text x="612" y="124" fill="#f0ede6" fill-opacity="0.55" font-size="7.5" text-anchor="middle">Client</text>
  <text x="612" y="150" fill="#f0ede6" fill-opacity="0.35" font-size="7" text-anchor="middle">controlar</text>
  <text x="612" y="162" fill="#f0ede6" fill-opacity="0.35" font-size="7" text-anchor="middle">OTRAS apps</text>
  <text x="612" y="186" fill="#f0ede6" fill-opacity="0.35" font-size="7" text-anchor="middle">TouchDesigner</text>
  <text x="612" y="198" fill="#f0ede6" fill-opacity="0.35" font-size="7" text-anchor="middle">Ableton, etc.</text>
</svg>
<figcaption><b>Tu panel, en cualquier pantalla</b> — el Control Surface se publica por OSCQuery y aparece como controlador web en el teléfono, sin instalar nada. El <b>OSCQuery Client</b> hace lo inverso: controla parámetros de otras apps desde VDMX.</figcaption>
</figure>

<h3>OSCQuery Client — el camino inverso</h3>
<p>El plugin <strong>OSCQuery Client</strong> conecta VDMX <em>hacia afuera</em>: te deja controlar parámetros de <em>otras</em> aplicaciones que exponen OSCQuery (TouchDesigner, etc.). Elegís el servidor remoto y qué parámetros querés manejar, y VDMX te arma controles que se sincronizan en ambos sentidos con esa app —siempre que la app remota implemente OSCQuery completo—.</p>

<h3>Configurar OSC a mano</h3>
<p>Si la otra app no usa OSCQuery, configurás OSC clásico en <strong>Preferences → OSC</strong>: definís el puerto de escucha y mapeás los mensajes entrantes (por dirección, ej. <code>/vj/fader1</code>) a parámetros, igual que con MIDI. Apps como <strong>TouchOSC</strong> o <strong>Lemur</strong> te dejan diseñar interfaces táctiles propias y mandarlas a VDMX por OSC.</p>

<h3>Errores comunes</h3>
<ul>
<li><strong>Firewall / red distinta</strong>: si el teléfono no ve a VDMX, casi siempre están en redes WiFi distintas o el firewall bloquea el puerto.</li>
<li><strong>Sincronización OSCQuery a medias</strong>: el control bidireccional solo funciona si la app remota implementa OSCQuery completo; si no, va en un solo sentido.</li>
<li><strong>No exportar el layout</strong>: armás un Control Surface perfecto y no lo guardás como JSON; exportalo para reusarlo.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Armá un Control Surface con tres sliders, una rueda de color y cuatro botones. Mapeá cada elemento a un parámetro real de tu patch (opacidades, color de un generador, triggers). Activá OSCQuery y abrí el controlador web desde tu teléfono en la misma red: comprobá que mover un slider en el teléfono mueve el parámetro en VDMX. Por último, exportá el layout como JSON. Si tenés otra app con OSCQuery, probá el OSCQuery Client para controlarla desde VDMX.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-10": `
<h3>Cuando el show tiene guion</h3>
<p>No todo performance es improvisado. Un show con timecode, una obra de teatro, un mapping arquitectónico sincronizado a una banda sonora, una conferencia con cues exactos: ahí necesitás que ciertas cosas ocurran en <strong>momentos precisos</strong>, no cuando tu mano reaccione. Para eso están la <strong>Cue List</strong> y el <strong>Timecode</strong>.</p>

<h3>Cue List — disparos programados en el tiempo</h3>
<p>La <strong>Cue List</strong> programa acciones en momentos específicos: disparar un clip, cambiar un data-source, saltar a una escena. Es una tabla donde cada fila es un <em>cue</em>:</p>
<table class="ref">
<tr><th>Columna</th><th>Qué define</th></tr>
<tr><td>Time</td><td>Cuándo ocurre la acción.</td></tr>
<tr><td>Target</td><td>Qué cambia: un data-source o un layer que recibe un clip.</td></tr>
<tr><td>Value</td><td>Qué valor o clip se aplica.</td></tr>
<tr><td>Title</td><td>Nombre opcional del cue (para encontrarlo rápido).</td></tr>
<tr><td>Enabled / Lock</td><td>Activar/desactivar o bloquear el cue.</td></tr>
</table>
<p>Arriba tenés controles de transporte: time slider, restart, cue anterior/siguiente, pause, cue aleatorio. Con <code>⌘+Enter</code> creás un cue nuevo en el tiempo actual; <code>Shift+Enter</code> salta al tiempo del cue seleccionado.</p>

<figure class="fig">
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="300" fill="#050505"/>
  <text x="34" y="30" fill="#b8ff00" font-size="9" letter-spacing="1.5">CUE LIST — ACCIONES ANCLADAS A UN TIEMPO</text>
  <!-- transport / timeline -->
  <rect x="30" y="46" width="620" height="30" rx="4" fill="#0c0c0c" stroke="#f0ede6" stroke-opacity="0.2"/>
  <line x1="30" y1="61" x2="650" y2="61" stroke="#f0ede6" stroke-opacity="0.12"/>
  <g fill="#b8ff00" fill-opacity="0.6">
    ` + [120,250,360,470,560].map(function(x){return '<circle cx="'+x+'" cy="61" r="3.5"/>';}).join('') + `
  </g>
  <line x1="360" y1="42" x2="360" y2="80" stroke="#ff2d55" stroke-opacity="0.7" stroke-width="1.5"/>
  <text x="360" y="92" fill="#ff2d55" fill-opacity="0.8" font-size="7.5" text-anchor="middle">playhead</text>
  <!-- tabla -->
  <g font-size="9">
    <text x="46" y="120" fill="#b8ff00" fill-opacity="0.7" font-size="8">TIME</text>
    <text x="160" y="120" fill="#b8ff00" fill-opacity="0.7" font-size="8">TARGET</text>
    <text x="360" y="120" fill="#b8ff00" fill-opacity="0.7" font-size="8">VALUE</text>
    <text x="540" y="120" fill="#b8ff00" fill-opacity="0.7" font-size="8">TITLE</text>
  </g>
  <g font-size="9" fill="#f0ede6" fill-opacity="0.75">
    ` + [['00:00:04','Layer 1','clip · intro.mov','arranque'],['00:00:18','Color DS','#b8ff00','build'],['00:00:32','Layer 2','clip · drop.mov','DROP'],['00:00:45','FX intensity','0.8','clímax'],['00:01:02','Master','black','cierre']].map(function(row,i){var y=140+i*28;var hot=(i===2);return '<rect x="36" y="'+(y-15)+'" width="614" height="24" rx="2" fill="'+(hot?'#101a05':'none')+'" stroke="'+(hot?'#b8ff00':'#f0ede6')+'" stroke-opacity="'+(hot?'0.5':'0.07')+'"/>'+'<text x="46" y="'+y+'" fill="'+(hot?'#b8ff00':'#f0ede6')+'" fill-opacity="0.8">'+row[0]+'</text>'+'<text x="160" y="'+y+'">'+row[1]+'</text>'+'<text x="360" y="'+y+'">'+row[2]+'</text>'+'<text x="540" y="'+y+'" fill-opacity="0.5">'+row[3]+'</text>';}).join('') + `
  </g>
  <text x="46" y="292" fill="#f0ede6" fill-opacity="0.35" font-size="7.5">Formatos de tiempo: Index · Beats · Medidas · SMPTE · Segundos — sincronizable a Clock o Timecode</text>
</svg>
<figcaption><b>La Cue List</b> dispara clips y cambia data-sources en tiempos exactos. El tiempo se mide en segundos, beats, medidas o <b>SMPTE</b>, y puede sincronizarse a un Clock interno o a un Timecode externo.</figcaption>
</figure>

<p>El inspector de la Cue List tiene cuatro secciones: <strong>Data-Sources</strong> (define los suyos propios, con interpolación entre cues: Jump, Linear, Smooth), <strong>Navigation</strong> (saltar a cues por índice, número o nombre), <strong>Time Settings</strong> (formato de tiempo y sincronización) y <strong>Other Options</strong> (auto-scroll, preload de media, export/import CSV). La interpolación es clave: entre un cue y el siguiente, un data-source puede saltar de golpe o transicionar suave.</p>

<h3>Timecode — el reloj absoluto del show</h3>
<p>El plugin <strong>Timecode</strong> recibe y/o genera <strong>timecode SMPTE</strong>, el estándar de sincronización de la industria audiovisual. Publica el tiempo como un valor (float, en segundos) que sincroniza todo lo demás. Modos de recepción (uno a la vez):</p>
<ul>
<li><strong>MTC</strong> (MIDI Timecode): desde un secuenciador o consola.</li>
<li><strong>LTC</strong> (Linear Timecode): timecode como señal de audio.</li>
<li><strong>Data-source interno</strong> (MIDI/OSC/DMX) o <strong>generación interna</strong>.</li>
</ul>
<p>Soporta <strong>reference times</strong> (puntos de referencia con nombre, para medir tiempo transcurrido desde el último marcador) y publica a múltiples destinos a la vez (MTC, LTC, OSC). Su uso estrella: <strong>sincronizar la Cue List a un timecode externo</strong>, de modo que tus visuales caigan al frame exacto junto con la música, las luces y el resto del show.</p>

<h3>Errores comunes</h3>
<ul>
<li><strong>Formato de frames mal configurado</strong>: 24, 25, 29.97, 30 fps deben coincidir con la fuente de timecode, o el sync deriva.</li>
<li><strong>Media sin preload</strong>: si un cue dispara un clip pesado sin preload, puede haber un tirón. Activá el preload en Other Options.</li>
<li><strong>Cues en tiempo absoluto vs relativo</strong>: tené claro si el show corre con timecode externo (absoluto) o con el Clock interno (relativo al arranque).</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Construí una Cue List de 5 cues para un "show" de 1 minuto: un cue de arranque que dispara un clip, uno que cambia el color de un generador con interpolación Smooth, uno que dispara un drop en otra capa, uno que sube la intensidad de un efecto, y un cierre a negro. Usá formato SMPTE. Reproducí la lista completa y ajustá los tiempos con <code>Shift+←/→</code> hasta que el ritmo de los cambios se sienta bien. Si podés, generá timecode interno y verificá que la lista lo sigue.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-11": `
<h3>Sacar la imagen al mundo</h3>
<p>Todo lo que armaste vive dentro de VDMX hasta que lo <strong>sacás</strong>. El <strong>Canvas</strong> —la imagen maestra del proyecto— es el punto de partida, y desde ahí VDMX puede enviar video por muchas vías a la vez. Conocer las salidas es lo que te permite trabajar en cualquier venue: un proyector, varias pantallas, una pared LED, otra app, otra computadora.</p>

<figure class="fig">
<svg viewBox="0 0 680 330" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="330" fill="#050505"/>
  <!-- canvas -->
  <rect x="270" y="30" width="140" height="58" rx="6" fill="#0c0c0c" stroke="#ff2d55" stroke-opacity="0.55"/>
  <text x="340" y="55" fill="#ff2d55" font-size="11" text-anchor="middle">CANVAS</text>
  <text x="340" y="72" fill="#f0ede6" fill-opacity="0.45" font-size="8" text-anchor="middle">imagen maestra</text>
  <!-- salidas -->
  <g>
    ` + [['SYPHON','otra app · misma Mac'],['NDI®','otra app · por red'],['BLACKMAGIC','SDI / HDMI · proyector'],['VIDEO→DMX','Art-Net · pared LED'],['MOVIE REC','grabar a archivo']].map(function(o,i){var x=20+i*132;var y=180;return '<rect x="'+x+'" y="'+y+'" width="118" height="62" rx="4" fill="#0c0c0c" stroke="#b8ff00" stroke-opacity="0.4"/><text x="'+(x+59)+'" y="'+(y+26)+'" fill="#b8ff00" font-size="9" text-anchor="middle">'+o[0]+'</text><text x="'+(x+59)+'" y="'+(y+44)+'" fill="#f0ede6" fill-opacity="0.45" font-size="7" text-anchor="middle">'+o[1]+'</text>';}).join('') + `
  </g>
  <!-- conexiones canvas->salidas -->
  <g stroke="#b8ff00" stroke-opacity="0.4" stroke-width="1.2" fill="none">
    ` + [79,211,343,475,607].map(function(x){return '<path d="M340 90 C 340 140 '+x+' 130 '+x+' 178"/>';}).join('') + `
  </g>
  <text x="340" y="285" fill="#f0ede6" fill-opacity="0.4" font-size="8" text-anchor="middle">Un mismo Canvas puede salir por varias vías a la vez — proyector + LED + grabación, simultáneo.</text>
  <text x="340" y="305" fill="#f0ede6" fill-opacity="0.3" font-size="7.5" text-anchor="middle">Antes de salir: revisá con Preview · calibrá con Scopes · depurá con Comm Display.</text>
</svg>
<figcaption><b>El abanico de salidas</b> — desde el Canvas, VDMX publica por Syphon (apps locales), NDI (red), Blackmagic (SDI/HDMI), Video-to-DMX (paredes LED por Art-Net) y graba a archivo con Movie Recorder, todo a la vez.</figcaption>
</figure>

<h3>Syphon y NDI — compartir con otras apps</h3>
<ul>
<li><strong>Syphon Output</strong>: publica streams de VDMX a otras apps de la <em>misma Mac</em> sin pérdida. Podés publicar varios streams con una sola instancia. Tip de rendimiento: si publicás el Canvas, asegurate de que "Skip Canvas Rendering" esté <strong>desactivado</strong> en las Rendering Preferences.</li>
<li><strong>NDI® Output</strong>: publica por <em>red</em> para que otra máquina o dispositivo reciba el video. Opciones de Alpha, Send as RGB (más calidad, más ancho de banda), Crop, Resize y Throttle FPS.</li>
</ul>

<h3>Blackmagic — salida profesional SDI/HDMI</h3>
<p><strong>Blackmagic Output</strong> envía video (y audio) a un dispositivo Blackmagic (UltraStudio, DeckLink), el estándar para conectarse a switchers y proyectores profesionales por SDI o HDMI. Elegís Output Device, Connection y Output Format (resolución + fps soportados). En dispositivos compatibles podés hacer <strong>keying</strong> (mandar el canal alfa como key para superponer sobre otra fuente). Tiene un botón BLACK para cortar la salida al instante.</p>

<h3>Video to DMX — controlar paredes LED</h3>
<p><strong>Video To DMX</strong> convierte los píxeles de un video en datos <strong>DMX vía Art-Net</strong>, para manejar paredes LED y displays que se controlan como luces. Recortás el área del video, definís las dimensiones de salida (a cuántos "píxeles DMX" se reduce), y configurás el primer píxel y la dirección de lectura (incluido modo <em>snake</em> para tiras serpenteadas). Elegís el tipo de imagen (Grayscale, RGB, HSV, CMYK) y el puerto/canal DMX de arranque. Es el puente entre tus visuales y la iluminación.</p>

<h3>Grabar lo que generás — Movie Recorder</h3>
<p><strong>Movie Recorder</strong> graba el video (y audio) que produce VDMX a un archivo QuickTime. Elegís qué fuente grabar, el codec (<strong>HAP</strong>, HAP Q, ProRes, HEVC), si incluís alfa, la calidad y los FPS. Puede <strong>cuantizar la grabación</strong> al downbeat del Clock, e importar automáticamente los clips grabados al Media Bin. Sirve para documentar un set, para capturar loops generativos que después reutilizás, o para entregar un registro al cliente.</p>

<h3>Las herramientas de control de calidad</h3>
<ul>
<li><strong>Preview</strong>: muestra cualquier stream (un layer, un input, el canvas) en una ventana, con jog/scratch y límite de FPS para ahorrar CPU. Tu monitor de confianza antes de mandar al proyector.</li>
<li><strong>Scopes</strong>: análisis de color (waveform, vectorscope) para calibrar y corregir color — fundamental cuando el venue tiene un proyector con respuesta rara.</li>
<li><strong>Comm Display</strong>: muestra los mensajes MIDI/OSC entrantes; tu herramienta de debug cuando un control "no responde".</li>
</ul>

<h3>Errores comunes</h3>
<ul>
<li><strong>Formato de salida no soportado</strong>: el Output Format de Blackmagic debe ser uno que el dispositivo <em>y</em> el proyector acepten, o no hay imagen.</li>
<li><strong>Grabar en H.264 pesado</strong>: para grabar sin perder frames, usá HAP o ProRes; H.264 puede ahogar la CPU en vivo.</li>
<li><strong>Mapeo DMX al revés</strong>: si la pared LED muestra la imagen espejada o cortada, revisá el primer píxel y la dirección de lectura (wrap vs snake).</li>
<li><strong>Olvidar el Preview</strong>: nunca mandes al proyector algo que no miraste antes en un Preview.</li>
</ul>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio</div>
Configurá tres salidas simultáneas desde un mismo Canvas: un Syphon Output (y, si tenés otra app compatible, comprobá que la recibe), un Preview en ventana, y un Movie Recorder grabando 30 segundos en codec HAP. Mientras grabás, mirá el stream en el Preview y abrí un Scopes para observar el waveform de color. Detené la grabación y verificá que el clip se importó al Media Bin. Si tenés hardware Blackmagic o una pared LED, sumá esa salida y calibrá el formato.
</div>`,

    // ───────────────────────────────────────────────────────────────
    "VDMX-12": `
<h3>De las piezas al instrumento</h3>
<p>Llegaste al final del recorrido técnico. Sabés qué hace cada módulo; ahora viene lo más importante y lo que separa a un VJ de alguien que sabe usar VDMX: <strong>armar un instrumento coherente para tocar en vivo</strong>. Un patch de performance no es "todos los módulos prendidos": es un sistema diseñado para condiciones reales —presión, oscuridad, errores posibles, cambios rápidos— donde cada decisión tiene una razón.</p>

<h3>Los cuatro principios del patch de performance</h3>
<ul>
<li><strong>Mínimo necesario</strong>: cada módulo que agregás es algo que puede fallar o distraerte. En el patch de show va solo lo que vas a usar. Lo demás, afuera.</li>
<li><strong>Todo mapeado de antemano</strong>: en el escenario no hay tiempo para clic derecho. Todo lo que tocás en vivo —faders, pads, knobs, teclas— tiene que estar asignado antes de subir.</li>
<li><strong>A prueba de falla</strong>: ¿qué pasa si un clip no carga, si la cámara se desconecta, si la Mac tose? Un buen patch tiene fallbacks: un generador ISF que siempre funciona, loops de seguridad, una página de emergencia.</li>
<li><strong>Organización visual</strong>: nombrá cada capa, módulo y página por su función. En la oscuridad del show, "Layer 4" no te dice nada; "FONDO" sí.</li>
</ul>

<h3>Cómo se conecta todo — el mapa completo</h3>

<figure class="fig">
<svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" font-family="'Space Mono', monospace">
  <rect width="680" height="360" fill="#050505"/>
  <text x="34" y="28" fill="#b8ff00" font-size="9" letter-spacing="1.5">EL INSTRUMENTO COMPLETO — SEÑAL ARRIBA, CONTROL ABAJO</text>
  <!-- cadena de senal -->
  <g>
    ` + [['FUENTES','Media·ISF·cam'],['LAYERS','+ blend'],['COMPOSITOR','mezcla'],['FX','efectos'],['CANVAS','maestra']].map(function(o,i){var x=24+i*112;var hot=(i===4);return '<rect x="'+x+'" y="50" width="100" height="52" rx="4" fill="#0d0d0d" stroke="'+(hot?'#ff2d55':'#b8ff00')+'" stroke-opacity="'+(hot?'0.55':'0.45')+'"/><text x="'+(x+50)+'" y="72" fill="'+(hot?'#ff2d55':'#f0ede6')+'" font-size="9" text-anchor="middle">'+o[0]+'</text><text x="'+(x+50)+'" y="88" fill="#f0ede6" fill-opacity="0.4" font-size="7" text-anchor="middle">'+o[1]+'</text>';}).join('') + `
    <!-- salidas -->
    <rect x="584" y="50" width="72" height="52" rx="4" fill="#0d0d0d" stroke="#ff2d55" stroke-opacity="0.4"/>
    <text x="620" y="72" fill="#ff2d55" fill-opacity="0.85" font-size="8" text-anchor="middle">OUTPUTS</text>
    <text x="620" y="88" fill="#f0ede6" fill-opacity="0.4" font-size="7" text-anchor="middle">proy·LED</text>
  </g>
  <g stroke="#b8ff00" stroke-opacity="0.45" stroke-width="1.3" fill="none">
    ` + [124,236,348,460,572].map(function(x){return '<path d="M'+x+' 76 L'+(x+10)+' 76"/><path d="M'+(x+10)+' 76 l-7 -3 v6 z" fill="#b8ff00" stroke="none" fill-opacity="0.6"/>';}).join('') + `
  </g>
  <!-- bus de control -->
  <rect x="24" y="250" width="632" height="58" rx="4" fill="#0c0c0c" stroke="#ff2d55" stroke-opacity="0.35"/>
  <text x="36" y="244" fill="#ff2d55" fill-opacity="0.8" font-size="8" letter-spacing="1.5">CAPA DE CONTROL</text>
  <g fill="#f0ede6" fill-opacity="0.65" font-size="8.5" text-anchor="middle">
    ` + ['Audio','MIDI / HID','OSC / teléfono','LFO·Clock·Step','Cue / Timecode'].map(function(t,i){var x=92+i*120;return '<text x="'+x+'" y="284">'+t+'</text>';}).join('') + `
  </g>
  <!-- lineas control->senal -->
  <g stroke="#ff2d55" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="3 4" fill="none">
    ` + [74,186,298,410,522].map(function(x){return '<path d="M'+x+' 250 L'+x+' 104"/>';}).join('') + `
  </g>
  <text x="340" y="334" fill="#f0ede6" fill-opacity="0.4" font-size="8" text-anchor="middle">El instrumento = la cadena de señal (arriba) gobernada por la capa de control (abajo), todo en una o dos páginas.</text>
</svg>
<figcaption><b>El instrumento completo</b> — la cadena de señal (fuentes → canvas → outputs) gobernada desde abajo por la capa de control (audio, MIDI/OSC, automatización, cues). Todo lo de los 11 módulos anteriores, integrado.</figcaption>
</figure>

<h3>Estructura del contenido de un set</h3>
<p>Un set no es clips al azar: es una narrativa visual en el tiempo. Antes de abrir VDMX, respondé: ¿cuánto dura?, ¿qué género es?, ¿hay momentos clave (un drop, un climax)?, ¿cuál es el setup técnico del venue? Con eso, dividí el material en <strong>actos</strong>: intro/calentamiento → desarrollo → peak → outro. Organizá tus páginas del Media Bin y tus presets según esa estructura.</p>

<h3>Páginas y presets para el show</h3>
<p>Usá las <strong>páginas del workspace</strong> para tener una vista "performance" limpia con solo lo que tocás, y guardá <strong>presets/snapshots</strong> del estado del patch como "escenas" (apertura, clímax, cierre) que podés disparar y cruzar en vivo. Así navegás momentos preparados sin improvisar desde cero, pero con libertad para reaccionar.</p>

<h3>Optimización y checklist pre-show</h3>
<ul>
<li>Convertí <strong>todo el material a HAP</strong>; clips al mismo FPS y resolución del canvas.</li>
<li>Limitá las capas activas (6–8 en hardware medio); agrupá si necesitás más.</li>
<li>Verificá que toda la media está en la carpeta del proyecto y referenciada bien.</li>
<li>Probá la <strong>salida física real</strong> con el hardware del venue (proyector/LED/switcher) antes de la gente.</li>
<li>Confirmá el sync MIDI/OSC/Timecode con el DJ o el operador si aplica.</li>
<li>Cerrá apps innecesarias, desactivá actualizaciones automáticas, conectá a corriente, controlá temperatura.</li>
<li>Tené una <strong>página de emergencia</strong>: una composición simple que lances si algo falla.</li>
<li><strong>Guardá una versión "congelada"</strong> del proyecto y tocá sobre una copia.</li>
</ul>

<h3>Durante y después</h3>
<p>En vivo, la regla es <strong>escuchar la música</strong>: tu trabajo sirve al audio, no compite con él. Los cambios más fuertes responden a momentos reales —drops, breaks, builds—; evitá la sobreactuación visual. Desarrollá <em>anticipación</em>: leé las señales de que viene un cambio. Después del show, grabá tu output (Movie Recorder) y revisalo con ojo crítico: qué funcionó, qué transiciones fueron torpes, qué clips nunca usaste y podés sacar. Ese ciclo —tocar, grabar, revisar, depurar el patch— es como tu instrumento mejora.</p>

<div class="ejercicio"><div class="ejercicio-label">✦ Ejercicio — proyecto final</div>
Armá tu primer instrumento de performance completo y tocá un set de 15 minutos. Requisitos: (1) una cadena de señal con al menos 4 capas nombradas por función y un Canvas configurado a la resolución de tu salida; (2) una capa de control con audio (un grave mapeado), un controlador físico (al menos 4 mapeos) y una automatización (un LFO o Step Sequencer al Clock); (3) dos páginas del workspace —"taller" y "show"— y una página de emergencia; (4) todo el material en HAP. Grabá el set completo con Movie Recorder, revisalo al día siguiente y anotá tres mejoras concretas para tu patch. Ese patch revisado es el punto de partida de tu carrera como VJ con VDMX.
</div>`

  });
})();
