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

// Paleta de marca HG·VL.
//
//   --acid  #b8ff00    HUMAN GLITCHE, puerta izquierda
//   --cyan  #3ad0ff    VISUAL LAB,    puerta derecha
//   --white #f0ede6    estado neutro, sin puerta activa
//
// Tres paradas explicitas por rampa, no paleta de coseno: cada coeficiente de
// la formula de coseno afecta a los tres canales, y mover un extremo tiñe el
// otro. Con un color de marca exacto eso es media hora de pelea.
//
// Regla que sostiene la imagen: la luminancia sube de forma monotona de la
// sombra a la alta. El color varia; el brillo ordena. Ver docs/particulas.md §8.

vec3 ramp3(float t, vec3 c0, vec3 c1, vec3 c2) {
    t = saturate(t);
    return t < 0.5 ? mix(c0, c1, t * 2.0) : mix(c1, c2, (t - 0.5) * 2.0);
}

vec3 rampAcid(float t) {
    return ramp3(t, vec3(0.020, 0.045, 0.000),
                    vec3(0.230, 0.400, 0.010),
                    vec3(0.722, 1.000, 0.000));
}

vec3 rampCyan(float t) {
    return ramp3(t, vec3(0.000, 0.030, 0.055),
                    vec3(0.055, 0.290, 0.420),
                    vec3(0.228, 0.816, 1.000));
}

vec3 rampNeutral(float t) {
    return ramp3(t, vec3(0.030, 0.035, 0.045),
                    vec3(0.170, 0.190, 0.230),
                    vec3(0.941, 0.929, 0.902));
}

// uDoor: -1 = HG (acido), 0 = neutro, +1 = VL (cyan).
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

void main() {
    vec4 data = texture(tPos, vUv);
    vec3 pos  = data.xyz;
    float life = data.w;

    vec3 vel = curlNoise(pos * 0.42 + vec3(0.0, 0.0, uTime * 0.05)) * 0.55;

    // Deriva vertical constante: le da direccion al conjunto para que no sea
    // un remolino sin intencion.
    vel.y += 0.16;

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

    // Renace en SU posicion original: reusar tInit en vez de hashear de nuevo
    // mantiene la silueta de la nube estable en el tiempo.
    vec4 init = texture(tInit, vUv);
    if (life <= 0.0 || pos.y > 3.2 || length(pos.xz) > 4.8) {
        pos  = init.xyz;
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
    float rad = length(data.xz);
    vEdge = (1.0 - smoothstep(2.6, 4.3, rad))
          * (1.0 - smoothstep(1.5, 2.6, abs(data.y)));

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
    float r2 = dot(off, off);

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

out vec3 vNormal;
out vec3 vBary;
out vec3 vViewDir;
out float vDepth;
out float vColorT;
out float vSun;

void main() {
    // La orbita se resuelve ACA, no en la CPU. El buffer de instancias se
    // sube una vez al arrancar; lo unico que cambia por frame es uTime.
    float ang = uTime * aOrbit.y + aOrbit.z;
    vec3 orbit = vec3(cos(ang) * aOrbit.x, 0.0, sin(ang) * aOrbit.x);

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

    vec4 world = uModel * vec4(p * aBody.x + orbit, 1.0);
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
#include palette.glsl

in vec3 vNormal;
in vec3 vBary;
in vec3 vViewDir;
in float vDepth;
in float vColorT;
in float vSun;

out vec4 fragColor;

uniform float uDoor;
uniform float uOpacity;

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
    // Sol: cuerpo lleno con borde encendido. Es la unica fuente de luz de la
    // escena y tiene que superar el umbral de bloom para florecer — pero con
    // poco relleno. Con el disco entero muy brillante, el bloom y la estela lo
    // convierten en una mancha horizontal sin forma: lo que define un sol es
    // el borde, no el centro.
    float sun = 0.30 + fres * 1.55;

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

out float vDepth;

void main() {
    vec3 p = aPosition * aOrbit.x;
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
    float atten = 1.0 / (1.0 + vDepth * vDepth * 0.008);
    float energy = 1.45 * uOpacity * atten;
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

{@}Blit.fs{@}
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tDiffuse;
void main() { fragColor = texture(tDiffuse, vUv); }
