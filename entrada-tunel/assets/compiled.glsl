{@}common.glsl{@}
#define PI  3.141592653589793
#define TAU 6.283185307179586

float saturate(float v) { return clamp(v, 0.0, 1.0); }
vec2  saturate(vec2 v)  { return clamp(v, 0.0, 1.0); }
vec3  saturate(vec3 v)  { return clamp(v, 0.0, 1.0); }

float remap(float v, float a, float b, float c, float d) {
    return c + (v - a) * (d - c) / (b - a);
}

mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Ruido ordenado de 8 bits contra el bandeado de los degradados oscuros.
float dither8(vec2 fragCoord) {
    return fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
}

// ACES filmica aproximada (Krzysztof Narkowicz).
vec3 tonemapACES(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

// Correccion de color: lift / gamma / gain mas saturacion.
//
// Es lo que hace un LUT .cube —Active Theory carga varios— pero resuelto con
// aritmetica en vez de una textura 3D. A cambio de perder las curvas
// arbitrarias que permite un LUT, se ajusta desde la consola sin reexportar
// nada, y no cuesta un asset ni una unidad de textura.
//
//   lift  mueve las sombras sin tocar las altas
//   gamma dobla los medios
//   gain  escala las altas
//
// El orden importa: gain y lift primero, gamma despues. Invertido, la gamma
// se aplica sobre un negro ya levantado y las sombras se lavan.
vec3 grade(vec3 c, vec3 lift, vec3 gamma, vec3 gain, float sat) {
    c = c * gain + lift;
    c = pow(max(c, 0.0), gamma);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(l), c, sat);
}

{@}noise.glsl{@}
float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
               mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// Dos variantes: el conteo de octavas debe ser constante para que el loop se
// desenrolle. La simulacion usa 3, el fondo 5.
float fbm3(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { s += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return s;
}

float fbm5(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return s;
}

{@}curl.glsl{@}
#include noise.glsl

vec3 potential(vec3 p) {
    return vec3(fbm3(p), fbm3(p + 19.19), fbm3(p - 43.70));
}

// El rotor de un campo potencial tiene divergencia cero por construccion: el
// flujo no converge a puntos ni deja huecos. Con ruido crudo las particulas se
// apelmazan en tres grumos. Ver docs/particulas.md §2.
vec3 curlNoise(vec3 p) {
    const float e = 0.09;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    vec3 px0 = potential(p - dx), px1 = potential(p + dx);
    vec3 py0 = potential(p - dy), py1 = potential(p + dy);
    vec3 pz0 = potential(p - dz), pz1 = potential(p + dz);

    float x = (py1.z - py0.z) - (pz1.y - pz0.y);
    float y = (pz1.x - pz0.x) - (px1.z - px0.z);
    float z = (px1.y - px0.y) - (py1.x - py0.x);

    return vec3(x, y, z) / (2.0 * e);
}

{@}palette.glsl{@}
#include common.glsl

// Escala de grises, no color de marca.
//
// La escena es blanco sobre negro. El unico color de la imagen lo aporta la
// ABERRACION CROMATICA, que separa los canales hacia los bordes. Sobre una
// imagen neutra esas franjas se leen como optica; sobre una imagen ya teñida
// se pierden dentro del tinte.
//
// Las tres rampas se diferencian por un susurro de temperatura, no por matiz.
// Se conservan los nombres y la estructura —sombra, medio, alta, con
// luminancia monotona— para que nada del codigo que las usa tenga que cambiar.
//
// Tres paradas explicitas y no paleta de coseno: cada coeficiente de la
// formula de coseno afecta a los tres canales, y mover un extremo tiñe el
// otro. Ver docs/particulas.md §8.
//
// Regla que sostiene la imagen: la luminancia sube de forma monotona de la
// sombra a la alta. El color varia; el brillo ordena.

vec3 ramp3(float t, vec3 c0, vec3 c1, vec3 c2) {
    t = saturate(t);
    return t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
}

vec3 rampAcid(float t) {   // "profundo": apenas calido
    return ramp3(t, vec3(0.012, 0.010, 0.008),
                    vec3(0.268, 0.252, 0.236),
                    vec3(1.000, 0.986, 0.962));
}

vec3 rampCyan(float t) {   // "superficie": apenas frio
    return ramp3(t, vec3(0.008, 0.010, 0.013),
                    vec3(0.232, 0.246, 0.268),
                    vec3(0.958, 0.976, 1.000));
}

vec3 rampNeutral(float t) {
    return ramp3(t, vec3(0.010, 0.010, 0.011),
                    vec3(0.248, 0.248, 0.253),
                    vec3(0.985, 0.985, 0.990));
}

// uDoor: -1 profundo · 0 neutro · +1 superficie.
vec3 doorRamp(float t, float uDoor) {
    vec3 col = rampNeutral(t);
    col = mix(col, rampAcid(t), saturate(-uDoor));
    col = mix(col, rampCyan(t), saturate( uDoor));
    return col;
}

{@}Fullscreen.vs{@}
// Un triangulo, no un quad: evita la costura diagonal donde dos triangulos se
// tocan, que en un blur se nota.
out vec2 vUv;

void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}

{@}Field.fs{@}
#include common.glsl
#include noise.glsl
#include palette.glsl

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform float uDoor;
uniform float uSeam;
uniform vec2  uResolution;
uniform vec2  uPointer;
uniform float uIntensity;

void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    // Deriva lenta en dos capas a distinta velocidad. El paralaje entre capas
    // da profundidad sin geometria.
    float t = uTime * 0.035;
    vec3 q = vec3(p * 1.6, t);
    float n1 = fbm5(q);
    float n2 = fbm5(q * 2.3 + vec3(n1 * 0.8, 0.0, t * 0.6));
    float n  = mix(n1, n2, 0.55);

    // El puntero no mueve el campo: le levanta la densidad. Mover el fondo con
    // el mouse se siente barato; iluminarlo, no.
    float d = length(p - uPointer * vec2(aspect, 1.0));
    float lift = exp(-d * 2.2) * 0.18;

    float dens = saturate(n * 1.25 - 0.30 + lift);
    vec3 col = doorRamp(dens * 0.7 + 0.05, uDoor);
    col *= dens * dens * uIntensity;

    // Haz vertical en la juntura de las dos puertas.
    //
    // Refuerza la estructura que ya tiene la entrada en lugar de importar una
    // estetica nueva: la linea existe en el layout, esto la enciende. Toma el
    // color de la puerta activa, asi el hover confirma la eleccion antes del
    // click.
    // Delgado y contenido a proposito: el haz confirma que hay un umbral, no
    // compite con la puerta elegida. Ancho o brillante tira el ojo al centro
    // justo cuando la decision ya se tomo hacia un costado.
    float seam = exp(-abs(p.x) * 38.0);
    float flick = 0.86 + 0.14 * vnoise(vec3(0.0, uv.y * 4.0, uTime * 1.6));
    col += doorRamp(0.92, uDoor) * seam * flick * uSeam * 0.34;

    // Vineteado antes del post, para que el bloom no lo coma por los bordes.
    col *= 1.0 - saturate(length(p) * 0.62 - 0.05);

    fragColor = vec4(col, 1.0);
}

{@}SimPosition.fs{@}
#include common.glsl
#include curl.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tPos;
uniform sampler2D tInit;
uniform float uTime;
uniform float uDelta;
uniform vec3  uAttract;
uniform float uPull;
uniform float uCenterZ;
uniform float uRush;

// Media longitud del volumen que acompaña a la camara.
const float HALF_Z = 4.0;

void main() {
    vec4 data = texture(tPos, vUv);
    vec3 pos  = data.xyz;
    float life = data.w;

    vec3 vel = curlNoise(pos * 0.42 + vec3(0.0, 0.0, uTime * 0.05)) * 0.55;

    // Deriva hacia la camara, apenas insinuada.
    //
    // A 0.14 el empuje dominaba sobre el rotor y las particulas se leian
    // arrastradas, todas en la misma direccion. Bajandolo, vuelve a mandar el
    // curl y el movimiento se ve organico: es lo que hacia que en la version
    // original se sintieran naturales.
    vel.z += 0.06 + uRush * 1.10;

    // Atractor de la puerta activa.
    //
    // La caida exponencial con la distancia es lo que hace que esto se lea
    // como una corriente y no como un iman: las cercanas responden fuerte, las
    // lejanas apenas se inclinan, y el conjunto se deforma en vez de
    // colapsar. Con una fuerza uniforme todas convergen al mismo punto y la
    // nube se transforma en una bola.
    vec3 toA = uAttract - pos;
    float dist = length(toA) + 1e-4;
    vel += (toA / dist) * uPull * 2.6 * exp(-dist * 0.30);

    pos += vel * uDelta;
    life -= uDelta * 0.055;

    // ENVOLTURA TOROIDAL alrededor de la camara.
    //
    // El volumen de polvo viaja con el espectador en lugar de cubrir todo el
    // trayecto. Antes el tubo medía 24 unidades de largo y las mismas 65.536
    // particulas quedaban repartidas en casi ocho veces el volumen de la nube
    // original: por eso el campo se veia ralo comparado con la primera landing.
    //
    // Envolviendo en Z relativo a la camara, la densidad que se ve es siempre
    // la misma y alcanza un volumen chico. Es la unica forma de tener un tunel
    // infinito sin pagar mas particulas.
    float rel = pos.z - uCenterZ;
    pos.z = uCenterZ + mod(rel + HALF_Z, 2.0 * HALF_Z) - HALF_Z;

    // Renace en SU posicion original —relativa al centro— para que la nube
    // conserve su silueta en vez de rehacerse al azar.
    vec4 init = texture(tInit, vUv);
    if (life <= 0.0 || length(pos.xy) > 3.4) {
        pos  = vec3(init.xy, uCenterZ + init.z);
        life = 1.0;
    }

    fragColor = vec4(pos, life);
}

{@}Particles.vs{@}
#include common.glsl
#include noise.glsl

uniform sampler2D tPos;
uniform mat4  uProjection;
uniform mat4  uView;
uniform float uSize;
uniform int   uGrid;
uniform vec2  uResolution;
uniform float uCenterZ;

out float vLife;
out float vDepth;
out float vSeed;
out float vEdge;

void main() {
    ivec2 texel = ivec2(gl_VertexID % uGrid, gl_VertexID / uGrid);
    vec4 data = texelFetch(tPos, texel, 0);

    // Identidad estable: derivada del indice, no de la posicion, para que no
    // cambie mientras la particula se mueve.
    vSeed = hash13(vec3(float(texel.x), float(texel.y), 7.13));

    // Desvanecido antes del limite del volumen de reciclado. Sin esto la nube
    // termina en un canto recto y se delata todo el truco.
    // El volumen se desvanece por su radio y por la distancia al centro que
    // viaja con la camara. El desvanecido termina ANTES del limite de la
    // envoltura: si coincidieran, se veria aparecer y desaparecer el polvo en
    // un plano recto delante y detras.
    float rad = length(data.xy);
    float dz = abs(data.z - uCenterZ);
    // El desvanecido radial arranca EN el borde de la distribucion (2,4), no
    // adentro. Con 1,9 se apagaba el 37% de las particulas por area sin ganar
    // nada: la nube no llega mas alla de 2,4, asi que recortar antes solo
    // resta brillo. El trabajo de suavizar lo hace el desvanecido en Z, que es
    // el eje sobre el que se mira.
    vEdge = (1.0 - smoothstep(2.35, 3.30, rad))
          * (1.0 - smoothstep(2.60, 3.85, dz));

    vec4 viewPos = uView * vec4(data.xyz, 1.0);
    gl_Position = uProjection * viewPos;

    float dist = -viewPos.z;

    // Las particulas detras de la camara tienen dist negativa y disparan
    // gl_PointSize a decenas de miles de pixeles: aparecen como franjas
    // verticales cruzando la pantalla.
    if (dist < 0.15) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        vLife = 0.0;
        vDepth = 0.0;
        return;
    }

    float sizeVar = 0.55 + 0.9 * vSeed;
    gl_PointSize = clamp(uSize * sizeVar * (uResolution.y / 900.0) / dist, 1.0, 16.0);

    vLife  = data.w;
    vDepth = dist;
}

{@}Particles.fs{@}
#include common.glsl
#include palette.glsl

in float vLife;
in float vDepth;
in float vSeed;
in float vEdge;
out vec4 fragColor;

uniform float uDoor;
uniform float uEnergy;

void main() {
    // Disco con borde suave. gl_PointCoord evita subir una textura de sprite:
    // 0 bytes de asset para el mismo resultado.
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float mask = smoothstep(0.5, 0.05, r);
    if (mask <= 0.002) discard;

    // Nucleo y halo con la misma mascara a distinta potencia: el nucleo supera
    // el umbral de bloom en unos pocos pixeles mientras el halo se queda
    // debajo. Asi el brillo sale de puntos definidos y no de una nube lavada.
    float core = pow(mask, 3.0);

    float fade  = smoothstep(0.0, 0.18, vLife) * smoothstep(1.0, 0.72, vLife);
    float atten = 1.0 / (1.0 + vDepth * vDepth * 0.055);

    // Brillo muy desparejo: la mayoria apenas visible, unas pocas encendidas.
    // Una distribucion uniforme de 65 mil puntos identicos es, literalmente,
    // ruido — el ojo no encuentra donde posarse.
    float bright = 0.06 + 0.94 * pow(vSeed, 3.0);

    float energy = mask * fade * atten * vEdge * bright * uEnergy;

    vec3 col = doorRamp(vLife * 0.55 + 0.25, uDoor);
    col *= 0.40 + 2.60 * core;

    // Color premultiplicado + blend ONE/ONE: el aporte es col*energy, lineal.
    // Con SRC_ALPHA/ONE seria col*energy², que quema el centro y borra los bordes.
    fragColor = vec4(col * energy, energy);
}

{@}BloomLuminosity.fs{@}
#include common.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uKnee;

void main() {
    vec3 c = texture(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // Rodilla suave: un corte duro hace titilar los bordes del bloom cuando la
    // luminancia oscila alrededor del umbral.
    float soft = l - uThreshold + uKnee;
    soft = clamp(soft, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float contrib = max(soft, l - uThreshold) / max(l, 1e-4);

    fragColor = vec4(c * contrib, 1.0);
}

{@}BloomBlur.fs{@}
#include common.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tDiffuse;
uniform vec2 uDirection;
uniform vec2 uTexelSize;

void main() {
    // Gaussiano de 9 taps en 5 lecturas, usando los offsets fraccionarios del
    // filtrado bilineal.
    const float o[3] = float[3](0.0, 1.3846153846, 3.2307692308);
    const float w[3] = float[3](0.2270270270, 0.3162162162, 0.0702702703);

    vec3 acc = texture(tDiffuse, vUv).rgb * w[0];
    for (int i = 1; i < 3; i++) {
        vec2 off = uDirection * uTexelSize * o[i];
        acc += texture(tDiffuse, vUv + off).rgb * w[i];
        acc += texture(tDiffuse, vUv - off).rgb * w[i];
    }
    fragColor = vec4(acc, 1.0);
}

{@}BloomComposite.fs{@}
#include common.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tMip0;
uniform sampler2D tMip1;
uniform sampler2D tMip2;

void main() {
    // Suma de la piramide con pesos decrecientes. Una sola escala da un halo
    // plano; tres dan la caida larga que el ojo lee como luz.
    vec3 c = texture(tMip0, vUv).rgb * 1.00
           + texture(tMip1, vUv).rgb * 0.62
           + texture(tMip2, vUv).rgb * 0.34;
    fragColor = vec4(c, 1.0);
}

{@}Composite.fs{@}
#include common.glsl
#include noise.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tStreak;
uniform vec2  uResolution;
uniform float uTime;
uniform float uBloom;
uniform float uStreak;
uniform vec3  uStreakTint;
uniform vec3  uLift;
uniform vec3  uGamma;
uniform vec3  uGain;
uniform float uSaturation;
uniform float uAberration;
uniform float uGrain;
uniform float uFade;
uniform float uGlitch;
uniform float uFlash;
uniform vec2  uAbCenter;
uniform float uAbBoost;

void main() {
    vec2 uv = vUv;

    // --- Glitch ---------------------------------------------------------
    //
    // Desgarros horizontales por bandas. El sitio se llama HUMAN GLITCHE: el
    // efecto es identidad, no decoracion, pero solo funciona si es RARO. Un
    // glitch permanente deja de leerse como falla y pasa a leerse como
    // textura de fondo.
    //
    // Por eso hay dos compuertas: step(0.90) deja pasar una banda de cada
    // diez, y floor(uTime*14) hace que la seleccion cambie a saltos en vez de
    // barrer de forma continua. La cuantizacion temporal es lo que le da el
    // caracter digital; sin ella el desgarro se desliza y parece un liquido.
    float band = floor(uv.y * 26.0);
    float n = hash13(vec3(band, floor(uTime * 14.0), 3.7));
    float tear = step(0.90, n) * (n - 0.90) / 0.10;
    float dir = n > 0.95 ? 1.0 : -1.0;
    uv.x += tear * dir * uGlitch * 0.055;

    // --- Aberracion cromatica -------------------------------------------
    //
    // El centro optico es el PUNTERO, no el centro de la pantalla.
    //
    // Una lente real no tiene aberracion en su eje y la gana hacia los bordes.
    // Al mover ese eje con el mouse, el efecto deja de ser una capa encima de
    // la imagen y pasa a leerse como un cristal que la persona esta moviendo:
    // debajo del cursor la imagen queda limpia, y alrededor se descompone.
    // Es la misma informacion visual, pero atada a algo que el usuario
    // controla, que es lo que la vuelve interactiva en vez de decorativa.
    vec2 off = uv - uAbCenter;

    // r² ACOTADO.
    //
    // La formula asume un centro optico en el medio del cuadro, donde el radio
    // hasta una esquina da r² ≈ 0,5. Al mover el centro con el puntero eso deja
    // de valer: con el mouse contra un borde, la esquina opuesta llega a r² ≈ 1
    // y la separacion de canal se duplica — medido, saltaba de 1,4 a unos 6 px.
    // Sobre particulas de dos pixeles eso no es una lente, es confeti rojo y
    // verde en media pantalla.
    //
    // El tope conserva el caracter radial —cero bajo el cursor, creciendo hacia
    // afuera— y le pone un techo al peor caso.
    float r2 = min(dot(off, off), 0.32);

    // El parametro esta en PIXELES de separacion en la esquina, no en unidades
    // de UV. Con la formula en UV el desplazamiento depende de la resolucion:
    // el valor que se ve bien en una ventana chica separa los canales veinte
    // pixeles en pantalla completa, y sobre particulas de dos pixeles eso no
    // se lee como una lente sino como confeti rojo y verde.
    //
    // uAbBoost lo sube con la VELOCIDAD del puntero: quieto casi no se nota,
    // en un gesto rapido el cristal se estira. Es lo que le da peso al mouse.
    float ab = uAberration * (1.0 + uAbBoost * 5.0) + uGlitch * 9.0;
    vec2 d = off * (r2 * 4.0) * ab / uResolution;

    vec3 col;
    col.r = texture(tScene, uv - d).r;
    col.g = texture(tScene, uv).g;
    col.b = texture(tScene, uv + d).b;

    col += texture(tBloom, uv).rgb * uBloom;

    // La estela va teñida y NO se suma al bloom antes del tonemap por
    // separado: entra aca para poder darle su propio color. Una lente
    // anamorfica real tiñe la estela —el recubrimiento no es neutro— y ese
    // desvio de color es la mitad de por que se lee como optica y no como
    // efecto.
    col += texture(tStreak, uv).rgb * uStreakTint * uStreak;

    col = tonemapACES(col);
    col = grade(col, uLift, uGamma, uGain, uSaturation);

    // Estrobo de transicion: un golpe a blanco que decae en ~150 ms. Se usa
    // al cruzar de nivel; con prefers-reduced-motion nunca se dispara.
    col = mix(col, vec3(1.0), uFlash);

    // Grano despues del mapeo tonal, para que no lo comprima.
    float g = hash13(vec3(gl_FragCoord.xy, uTime * 60.0)) - 0.5;
    col += g * (uGrain + uGlitch * 0.05);

    col *= uFade;
    col += dither8(gl_FragCoord.xy);

    fragColor = vec4(col, 1.0);
}

{@}LensStreak.fs{@}
#include common.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tDiffuse;
uniform vec2  uTexelSize;
uniform float uScale;
uniform float uAtten;
uniform float uGain;

// Estela anamorfica: el equivalente del HydraLensStreakPass de su bundle.
//
// Solo horizontal. Es lo que produce una lente anamorfica real —el elemento
// cilindrico desenfoca distinto en cada eje— y es la firma visual mas
// reconocible del cine. Sobre puntos brillantes chicos, como las particulas,
// rinde mucho mas que ensanchar el bloom: el bloom agranda la mancha, la
// estela dibuja una linea.
//
// NO se normaliza por la suma de pesos, y ese es el punto.
//
// La primera version dividia por wsum como un gaussiano corriente. Un
// gaussiano normalizado conserva la energia MEDIA, pero reparte la de un
// punto aislado entre trece muestras: encadenado tres veces, el pico de una
// particula caia a menos de una milesima y el target quedaba en negro (medido:
// 0,0002 de luminancia maxima).
//
// Aca la muestra central conserva peso 1 y las laterales decaen
// exponencialmente. El pico sobrevive la cadena y lo que se agrega es la cola.
void main() {
    vec3 acc = texture(tDiffuse, vUv).rgb;

    for (int i = 1; i <= 6; i++) {
        float fi = float(i);
        float w = pow(uAtten, fi);
        vec2 off = vec2(fi * uScale * uTexelSize.x, 0.0);
        acc += texture(tDiffuse, vUv + off).rgb * w;
        acc += texture(tDiffuse, vUv - off).rgb * w;
    }

    fragColor = vec4(acc * uGain, 1.0);
}

{@}Body.vs{@}
#include common.glsl

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aBary;
// Por instancia:
layout(location = 3) in vec4 aOrbit;   // radio, velocidad angular, fase, inclinacion
layout(location = 4) in vec4 aBody;    // escala, color, giro propio, es_sol

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
uniform float uTime;
uniform float uStage;   // 0 = sistema abierto y en calma · 1 = colapsado al nucleo

out vec3 vNormal;
out vec3 vBary;
out vec3 vViewDir;
out float vDepth;
out float vColorT;
out float vSun;
out vec3  vLocal;

void main() {
    // Etapas del descenso.
    //
    // A medida que se baja, las orbitas se contraen y los cuerpos aceleran:
    // el sistema se cierra sobre su centro. Es la misma figura que hace la
    // escalera —la espiral tambien se aprieta— y las dos convergen en el
    // nucleo. Lo que arriba era un sistema abierto, abajo es un solo corazon.
    float contract = 1.0 - uStage * 0.78;
    float rush = 1.0 + uStage * uStage * 5.0;

    // La orbita se resuelve ACA, no en la CPU. El buffer de instancias se
    // sube una vez al arrancar; lo unico que cambia por frame es uTime.
    float ang = uTime * aOrbit.y * rush + aOrbit.z;
    float r = aOrbit.x * contract;
    vec3 orbit = vec3(cos(ang) * r, 0.0, sin(ang) * r);

    // Inclinacion del plano orbital, alrededor del eje X.
    float ci = cos(aOrbit.w), si = sin(aOrbit.w);
    orbit.yz = vec2(orbit.y * ci - orbit.z * si, orbit.y * si + orbit.z * ci);

    // Giro propio del cuerpo sobre su eje. Con facetas se nota, y es lo que
    // evita que los planetas parezcan calcomanias trasladandose.
    float sp = uTime * aBody.z;
    float cs = cos(sp), ss = sin(sp);
    vec3 p = aPosition;
    vec3 nrm = aNormal;
    p.xz   = vec2(p.x * cs - p.z * ss,     p.x * ss + p.z * cs);
    nrm.xz = vec2(nrm.x * cs - nrm.z * ss, nrm.x * ss + nrm.z * cs);

    // Posicion sobre la esfera unitaria, ya girada. Es el dominio sobre el que
    // se evalua el fuego: al venir del giro propio del cuerpo, el patron rota
    // CON la superficie en vez de quedarse pegado a la pantalla.
    vLocal = normalize(p);

    // El sol crece con la etapa; los planetas se achican al ser absorbidos.
    float scale = aBody.x * mix(1.0 - uStage * 0.45, 1.0 + uStage * 0.55, aBody.w);
    // El sol respira: un pulso de escala del 3% que el ASCII vuelve visible
    // como un temblor de celdas en el limbo. Solo el sol (aBody.w).
    scale *= 1.0 + 0.028 * aBody.w * sin(uTime * 1.35);

    vec4 world = uModel * vec4(p * scale + orbit, 1.0);
    vec4 viewPos = uView * world;
    gl_Position = uProjection * viewPos;

    // Normal y direccion de vista en el mismo espacio (vista).
    vNormal  = normalize(mat3(uView) * (uNormalMatrix * nrm));
    vViewDir = normalize(-viewPos.xyz);

    vBary   = aBary;
    vDepth  = -viewPos.z;
    vColorT = aBody.y;
    vSun    = aBody.w;
}

{@}Body.fs{@}
#include common.glsl
#include noise.glsl
#include palette.glsl

in vec3 vNormal;
in vec3 vBary;
in vec3 vViewDir;
in float vDepth;
in float vColorT;
in float vSun;
in vec3  vLocal;

out vec4 fragColor;

uniform float uDoor;
uniform float uOpacity;
uniform float uTime;

// Fuego en la superficie, por deformacion de dominio.
//
// Un fbm crudo da manchas que laten en el lugar. Lo que hace que se lea como
// FLUIDO es evaluar el ruido en un dominio que a su vez esta desplazado por
// otro ruido: cada punto se mueve segun un campo que tambien se mueve, y de
// ahi salen los filamentos que se estiran y se doblan sobre si mismos en vez
// de aparecer y desaparecer.
//
// Dos niveles de deformacion. Con uno la superficie ya ondula pero conserva un
// aire de nubes; el segundo es el que la vuelve plasma.
float surfaceFire(vec3 p, float t) {
    vec3 q = vec3(fbm3(p + vec3(0.0, 0.0, t * 0.35)),
                  fbm3(p + vec3(5.2, 1.3, t * 0.28)),
                  fbm3(p + vec3(9.4, 7.1, t * 0.41)));

    vec3 r = vec3(fbm3(p + 3.1 * q + vec3(1.7, 9.2, t * 0.22)),
                  fbm3(p + 3.1 * q + vec3(8.3, 2.8, t * 0.19)),
                  fbm3(p + 3.1 * q + vec3(4.1, 6.5, t * 0.26)));

    float f = fbm3(p * 1.35 + 3.6 * r);

    // Curva dura: las crestas se separan del fondo. Sin esto el resultado es
    // gris parejo y, al pasar por el ASCII, todas las celdas caen en el mismo
    // caracter y la superficie se aplana por completo.
    return pow(saturate(f * 1.85 - 0.28), 1.5);
}

void main() {
    // Wireframe por coordenada baricentrica: la distancia a la arista mas
    // cercana es el minimo de las tres componentes. Dividir por fwidth la
    // convierte a pixeles de pantalla, y por eso el trazo mantiene el grosor
    // este el cuerpo cerca o lejos.
    vec3 d = fwidth(vBary);
    vec3 a = smoothstep(vec3(0.0), d * 1.6, vBary);
    float edge = 1.0 - min(min(a.x, a.y), a.z);

    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);
    float atten = 1.0 / (1.0 + vDepth * vDepth * 0.008);

    // Planeta: cascara facetada, se lee por sus aristas.
    float planet = edge * 0.50 + fres * 0.38;

    // Sol: superficie de fuego mas borde encendido.
    //
    // El fuego se calcula SOLO para el sol. Es la parte cara del shader —siete
    // fbm por pixel— y evaluarlo en los planetas seria pagarlo seis veces mas
    // para tirarlo con un mix a cero.
    float sun = 0.0;
    if (vSun > 0.5) {
        float fire = surfaceFire(vLocal * 2.7, uTime);
        // El borde define la circunferencia; el fuego llena adentro.
        //
        // Valores bajos a proposito. Con el sol mas brillante, el bloom lo
        // empuja entero por encima del ultimo nivel del alfabeto ASCII y el
        // disco queda como un bloque macizo de arrobas: el fuego existe pero
        // no se puede leer, porque todas las celdas caen en el mismo caracter.
        // El rango dinamico del sol ES el detalle del efecto.
        // Valles casi negros entre filamentos: el contraste INTERNO del
        // disco es lo que lo hace leer como algo ardiendo y no como una
        // luna gris. El piso y el fresnel planos eran los que lo lavaban.
        sun = 0.02 + fire * 1.00 + fres * 0.35;
    }

    float energy = mix(planet, sun, vSun) * uOpacity * atten;
    if (energy < 0.002) discard;

    vec3 col = doorRamp(mix(vColorT, 0.97, vSun), uDoor);

    fragColor = vec4(col * energy, energy);
}

{@}Orbit.vs{@}
#include common.glsl

layout(location = 0) in vec3 aPosition;   // circulo unitario en XZ
layout(location = 3) in vec4 aOrbit;      // radio, -, -, inclinacion

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uStage;

out float vDepth;
out float vStage;

void main() {
    // Misma contraccion que los cuerpos: los anillos tienen que acompañar a
    // los planetas o se despegan de sus orbitas.
    vec3 p = aPosition * (aOrbit.x * (1.0 - uStage * 0.78));
    vStage = uStage;
    float ci = cos(aOrbit.w), si = sin(aOrbit.w);
    p.yz = vec2(p.y * ci - p.z * si, p.y * si + p.z * ci);

    vec4 viewPos = uView * uModel * vec4(p, 1.0);
    gl_Position = uProjection * viewPos;
    vDepth = -viewPos.z;
}

{@}Orbit.fs{@}
#include common.glsl
#include palette.glsl

in float vDepth;
in float vStage;
out vec4 fragColor;

uniform float uDoor;
uniform float uOpacity;

void main() {
    // Energia alta para una linea de UN pixel de ancho.
    //
    // A 0,34 el aporte medido de las seis orbitas era 0,0003 sobre una escena
    // de 0,029: invisible. Una linea de un pixel cubre una fraccion minima de
    // pantalla, asi que para que registre necesita brillar por pixel mucho mas
    // que una superficie. Pasado el umbral de bloom, el desenfoque la ensancha
    // y termina leyendose como un hilo encendido — que es justo lo que tiene
    // que ser una orbita.
    // Las orbitas se apagan al colapsar el sistema: en el nucleo ya no hay
    // caminos que recorrer, hay un centro.
    float atten = 1.0 / (1.0 + vDepth * vDepth * 0.008);
    float energy = 1.45 * (1.0 - vStage * 0.85) * uOpacity * atten;
    vec3 col = doorRamp(0.42, uDoor);
    fragColor = vec4(col * energy, energy);
}

{@}Mesh.vs{@}
#include common.glsl

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aBary;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec3 vBary;
out vec3 vViewDir;
out float vDepth;

void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vec4 viewPos = uView * world;
    gl_Position = uProjection * viewPos;

    // Normal y direccion de vista en EL MISMO espacio (vista). Mezclar mundo
    // con vista da un fresnel que gira con la camara en vez de con el objeto:
    // el error se ve como un brillo que se pega a la pantalla.
    vNormal  = normalize(mat3(uView) * (uNormalMatrix * aNormal));
    vViewDir = normalize(-viewPos.xyz);

    vBary  = aBary;
    vDepth = -viewPos.z;
}

{@}Mesh.fs{@}
#include common.glsl
#include palette.glsl

in vec3 vNormal;
in vec3 vBary;
in vec3 vViewDir;
in float vDepth;

out vec4 fragColor;

uniform float uDoor;
uniform float uOpacity;

void main() {
    // Wireframe por coordenada baricentrica.
    //
    // La distancia a la arista mas cercana es el minimo de las tres
    // componentes interpoladas. Dividir por fwidth convierte esa distancia a
    // PIXELES de pantalla, y por eso el trazo mantiene el mismo grosor esté
    // el objeto cerca o lejos. Sin la derivada, las aristas del fondo se
    // afinan hasta desaparecer y las del frente engordan.
    vec3 d = fwidth(vBary);
    vec3 a = smoothstep(vec3(0.0), d * 1.6, vBary);
    float edge = 1.0 - min(min(a.x, a.y), a.z);

    // Fresnel: brilla en los bordes donde la superficie escapa de la vista.
    // Es lo que separa un objeto de vidrio de un objeto pintado.
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);

    // Atenuacion mas suave que la de las particulas (0.008 contra 0.055).
    // La malla vive lejos por diseño —a unas 8 unidades de la camara— y con la
    // curva de las particulas quedaba en energia 0,03: invisible. Un objeto
    // solido no se desvanece con la distancia al mismo ritmo que el polvo en
    // suspension, asi que tampoco tiene por que compartir la constante.
    float atten = 1.0 / (1.0 + vDepth * vDepth * 0.008);
    float energy = (edge * 0.45 + fres * 0.40) * uOpacity * atten;
    if (energy < 0.002) discard;

    vec3 col = doorRamp(0.50 + 0.40 * fres, uDoor);

    // Premultiplicado, para blend ONE/ONE igual que las particulas.
    fragColor = vec4(col * energy, energy);
}

{@}Corona.fs{@}
#include common.glsl
#include noise.glsl
#include palette.glsl

in vec2 vUv;
out vec4 fragColor;

uniform vec3  uEye;
uniform vec3  uForward;
uniform vec3  uRight;
uniform vec3  uUp;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uTime;
uniform float uSunRadius;
uniform float uStrength;
uniform vec3  uLimb;

// Doce pasos, no dieciocho. El jitter por pixel disimula el bandeado que
// dejaria un march tan corto, y el pase es el mas caro de la escena: medido,
// se llevaba mas de un tercio del frame al llegar al sol.
const int STEPS = 12;

// Tres regiones activas fijas sobre la esfera. Las erupciones no salen de
// cualquier lado: salen de manchas concretas, y esa es la diferencia entre una
// corona con estructura y una pelusa isotropa alrededor del disco.
const vec3 ACTIVE[3] = vec3[3](
    normalize(vec3( 0.62,  0.68, -0.38)),
    normalize(vec3(-0.78,  0.24,  0.58)),
    normalize(vec3( 0.12, -0.72,  0.68))
);

// Interseccion rayo-esfera centrada en el origen. Devuelve (cerca, lejos) o
// x negativo si no hay impacto.
vec2 sphereHit(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(1.0, -1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}

float density(vec3 p, float r0, float r1) {
    float r = length(p);
    float h = (r - r0) / (r1 - r0);
    if (h < 0.0 || h > 1.0) return 0.0;

    vec3 dir = p / r;

    // CIZALLA con la altura.
    //
    // Sin esto los filamentos salen rectos hacia afuera y la corona parece un
    // erizo. Rotando la direccion en funcion de la altura, las estructuras se
    // inclinan a medida que suben y se leen como ARCOS — que es la forma que
    // realmente tiene una protuberancia siguiendo una linea de campo.
    // La cizalla lleva ademas una deriva temporal: las regiones activas
    // orbitan lentamente el limbo y los arcos nunca estan quietos.
    float sh = h * 1.45 + uTime * 0.045;
    float cs = cos(sh), sn = sin(sh);
    dir.xz = vec2(dir.x * cs - dir.z * sn, dir.x * sn + dir.z * cs);

    // Regiones activas.
    //
    // El exponente define cuan localizada es cada erupcion. A 6,5 los tres
    // lobulos se solapaban y cubrian casi todo el angulo solido: el resultado
    // era una neblina pareja alrededor del disco (medido: senal en el 87% del
    // target). A 15 quedan manchas separadas con negro entre ellas, que es lo
    // que se ve en una foto real del limbo.
    float region = 0.0;
    for (int i = 0; i < 3; i++) {
        float d = 1.0 - dot(dir, ACTIVE[i]);
        region += exp(-d * 15.0);
    }

    // Una cuarta region ANCLADA AL LIMBO VISIBLE.
    //
    // Las tres fijas caen donde caigan: pueden quedar del lado oculto, o de
    // frente —donde una protuberancia se proyecta sobre el propio disco y se
    // pierde—. Esta se construye a partir de la posicion de la camara, de modo
    // que siempre esta sobre el borde y se ve DE PERFIL, recortada contra el
    // negro. Es la que sostiene la imagen; las otras tres la acompañan.
    region += exp(-(1.0 - dot(dir, uLimb)) * 11.0) * 1.35;

    region = saturate(region);

    // Salida temprana ANTES del ruido.
    //
    // Es la optimizacion que hace viable el pase: las regiones activas cubren
    // una fraccion chica del angulo solido, asi que la mayoria de las muestras
    // del raymarch terminan aca sin evaluar un solo fbm. Sin este corte el
    // pase cuesta cuatro veces mas.
    if (region < 0.012) return 0.0;

    vec3 q = dir * 3.05 + vec3(0.0, 0.0, uTime * 0.095);
    vec3 w = vec3(fbm3(q), fbm3(q + 4.7), fbm3(q - 8.1));
    float n = fbm3(q * 2.25 + w * 2.5 + vec3(h * 2.1));

    float fil = pow(saturate(n * 1.95 - 0.44), 2.0);
    float fall = exp(-h * 4.2);

    return region * fil * fall;
}

void main() {
    if (uStrength <= 0.002) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    // Rayo construido desde la base de la camara. Es mas barato y mas simple
    // que invertir la matriz de vista-proyeccion, y no necesita precision
    // extra: lo unico que se pide es la direccion.
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uForward
                      + uRight * ndc.x * uAspect * uTanHalfFov
                      + uUp    * ndc.y * uTanHalfFov);

    float r0 = uSunRadius;
    // 2,8 y no 3,1: la cascara mas amplia se proyectaba sobre casi todo el
    // encuadre y la corona se leia como un velo. Con las regiones ya
    // localizadas se puede volver a estirarla un poco, y el alcance extra es
    // lo que deja que un arco salga del borde y se recorte contra el negro.
    float r1 = uSunRadius * 2.2;

    vec2 outer = sphereHit(uEye, rd, r1);
    if (outer.y < 0.0 || outer.y < outer.x) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    float tStart = max(outer.x, 0.0);
    float tEnd = outer.y;

    // El cuerpo del sol tapa lo que hay detras: el march se corta en su
    // superficie. Sin esto la corona de atras se suma a la de adelante y el
    // disco queda con un halo parejo que borra el limbo.
    vec2 inner = sphereHit(uEye, rd, r0);
    if (inner.x > 0.0 && inner.y >= inner.x) tEnd = min(tEnd, inner.x);
    if (tEnd <= tStart) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    float dt = (tEnd - tStart) / float(STEPS);
    // Jitter por pixel: rompe el bandeado en anillos concentricos que produce
    // un march de paso fijo. Con pocos pasos, sin esto se ven las capas.
    // Jitter RE-TIRADO por frame. Congelado (seed constante) el patron de
    // bandas del march quedaba clavado mientras el volumen se movia detras:
    // el 'sunburst trabado'. Variando por frame se vuelve ruido temporal,
    // que el bloom y la celda ASCII promedian sin dejar estructura fija.
    float jitter = hash13(vec3(gl_FragCoord.xy, mod(uTime * 60.0, 977.0)));
    float t = tStart + dt * jitter;

    float acc = 0.0;
    for (int i = 0; i < STEPS; i++) {
        acc += density(uEye + rd * t, r0, r1) * dt;
        t += dt;
        if (acc > 2.5) break;   // saturado: seguir no cambia el resultado
    }

    vec3 col = rampNeutral(saturate(0.45 + acc * 0.55));
    // Ganancia alta. Las protuberancias tienen que competir con un disco que
    // esta muy por encima del blanco, y encima despues pasan por el ASCII: si
    // no superan el escalon de luminancia de un caracter, sencillamente no
    // existen. Medido, a 3,2 llegaban a 0,125 y quedaban debajo del cuerpo.
    fragColor = vec4(col * acc * uStrength * 7.50, 1.0);
}

{@}Ascii.fs{@}
#include common.glsl

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;    // imagen compuesta, ya mapeada a tono
uniform sampler2D tCells;    // la misma imagen a resolucion de celda
uniform sampler2D tGlyphs;   // atlas horizontal de glifos
uniform vec2  uCellCount;
uniform float uGlyphCount;
uniform float uMix;

void main() {
    vec3 scene = texture(tScene, vUv).rgb;

    // Salida temprana cuando el efecto esta apagado. La rama es uniforme para
    // todo el frame —uMix es un uniform, no varia por pixel— asi que la GPU no
    // paga divergencia: simplemente no ejecuta el resto.
    if (uMix <= 0.001) {
        fragColor = vec4(scene, 1.0);
        return;
    }

    // Coordenada dentro de la celda, y centro de la celda para muestrear el
    // promedio. floor/fract sobre uv escalado da las dos de una.
    vec2 scaled = vUv * uCellCount;
    vec2 cellUv = fract(scaled);
    vec2 center = (floor(scaled) + 0.5) / uCellCount;

    vec3 cell = texture(tCells, center).rgb;
    float lum = dot(cell, vec3(0.2126, 0.7152, 0.0722));

    // Indice de caracter por densidad de tinta.
    //
    // Curva suave, no raiz cuadrada. La raiz levantaba tanto los medios que el
    // sol entero caia en los dos ultimos caracteres y perdia todo su relieve.
    // 0,85 alcanza para rescatar el polvo tenue del fondo sin aplastar arriba.
    float idx = floor(saturate(pow(lum, 0.85)) * (uGlyphCount - 0.001));

    vec2 atlasUv = vec2((idx + cellUv.x) / uGlyphCount, cellUv.y);
    float ink = texture(tGlyphs, atlasUv).r;

    // El caracter toma el color de su celda, no blanco puro: asi la aberracion
    // cromatica del composite sobrevive al pase y los glifos de los bordes
    // conservan su franja de color.
    vec3 ascii = cell * ink * 2.10;

    fragColor = vec4(mix(scene, ascii, uMix), 1.0);
}

{@}Blit.fs{@}
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tDiffuse;
void main() { fragColor = texture(tDiffuse, vUv); }
