/* FLUJO — lo que hay debajo del render.
   Reemplaza la grilla verde del peel: donde el puntero pela la imagen ya no
   aparece un wireframe sino una CORRIENTE — un campo de flujo advectado, las
   líneas de fuerza que mueven el mundo antes de que el mundo se vea.

   Contrato con world.js: este archivo define window.FLUJO_GLSL, un fragmento
   GLSL que world.js inyecta en su shader. Puede usar lo que world.js ya tiene
   declarado arriba — hash21(), vnoise(), y las constantes de paleta
   (VIOLET_C, CELESTE_C, AGUA_C, ACID_C, WHITE_C, VOID_C).
   Debe exponer:  vec3 flujo(vec2 frag, vec2 res, float t, vec2 ctr, float p)
   Cargar SIEMPRE antes que world.js. */
window.FLUJO_GLSL = [

/* Dirección del campo: gradiente de ruido rotado 90° — incompresible, así
   las líneas se cierran sobre sí mismas en vez de morir en los bordes. */
'vec2 flujoDir(vec2 q,float t){',
' float e=0.06;',
' float nx1=vnoise(q+vec2(e,0.0)+t*0.05), nx0=vnoise(q-vec2(e,0.0)+t*0.05);',
' float ny1=vnoise(q+vec2(0.0,e)+t*0.05), ny0=vnoise(q-vec2(0.0,e)+t*0.05);',
' return normalize(vec2(-(ny1-ny0),(nx1-nx0))+1e-5);}',

'vec3 flujo(vec2 frag,vec2 res,float t,vec2 ctr,float p){',
' float mn=min(res.x,res.y);',
' vec2 uv=(frag-0.5*res)/mn;',
' vec2 c=(ctr-0.5*res)/mn;',
/* Advección: marchamos contra la corriente acumulando ruido. Eso estira el
   campo en filamentos — es literalmente la trayectoria de una partícula que
   llega a este píxel. 4 pasos alcanzan y el peel es una región chica. */
' vec2 q=uv*2.7;',
' float acc=0.0,w=0.0,amp=1.0;',
' for(int i=0;i<4;i++){',
'  vec2 d=flujoDir(q,t);',
'  q-=d*0.085;',
'  acc+=amp*vnoise(q*3.1+t*0.22);',
'  w+=amp; amp*=0.74;}',
' float f=acc/max(w,1e-4);',

/* Isolíneas del campo: las bandas viajan hacia afuera desde donde pelaste. */
' float rad=length(uv-c);',
' float phase=f*5.0-t*0.34+rad*2.6;',
' float band=fract(phase);',
' float line=smoothstep(0.40,0.50,band)-smoothstep(0.50,0.60,band);',
' float fine=fract(phase*4.0);',
' float hair=(smoothstep(0.46,0.5,fine)-smoothstep(0.5,0.54,fine))*0.28;',

/* Venas: donde el campo se comprime, la corriente se enciende. */
' float vein=smoothstep(0.62,0.92,f);',
/* Chispas: el ácido sobrevive como pulso de interfaz, no como grilla. */
' float spark=step(0.9975,hash21(floor(frag/3.0)+floor(t*11.0)));',

' vec3 col=mix(VIOLET_C,CELESTE_C,smoothstep(0.25,0.75,f));',
' col=mix(col,AGUA_C,vein*0.75);',
' vec3 out_=col*(line*0.85+hair)+col*vein*0.34;',
' out_+=WHITE_C*line*vein*0.5;',
' out_+=ACID_C*spark*0.55;',
/* La corriente respira con la profundidad: más densa cerca del núcleo. */
' return out_*(0.75+0.65*p);}'
].join('\n');
