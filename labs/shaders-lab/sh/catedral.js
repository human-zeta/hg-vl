/* CATEDRAL — arquitectura infinita por repetición de dominio.
   No hay malla: la nave entera es una función de distancia. `mod()` sobre las
   coordenadas hace que una sola columna se repita para siempre, y una torsión
   sobre el eje impide que se lea como un loop. Los materiales son la película
   delgada de UMBRAL: el mismo truco de dispersión, ahora sobre superficie. */
(function () {
  var FS = function (P, R) { return [
'#version 300 es',
'precision highp float;',
'in vec2 uv; out vec4 o;',
'uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uPulso;',
P, R,

'float sdBox(vec3 p, vec3 b){vec3 q=abs(p)-b;',
' return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}',

/* El mapa devuelve distancia y, por referencia, cuánto emite ese punto.
   Todo está en coordenadas del túnel: rad = qué tan lejos del eje. */
/* Coordenadas de la nave: el mismo cambio de variable lo usan el mapa y el
   sombreado, así que vive en una sola función. */
'void nave_coords(vec3 p, out float rad, out float a, out float zc){',
/* Torsión: el pasillo rota sobre su propio eje al avanzar. Sin esto la
   repetición se delata como un bucle a los pocos metros. */
' float tw=p.z*0.035+uT*0.04;',
' float ca=cos(tw), sa=sin(tw);',
' vec2 xy=mat2(ca,-sa,sa,ca)*p.xy;',
' rad=length(xy);',
' float ang=atan(xy.y,xy.x);',
/* Repetición angular: una nervadura se convierte en diez. */
' const float N=10.0;',
' float sect=6.2831853/N;',
' a=mod(ang+sect*0.5,sect)-sect*0.5;',
' zc=mod(p.z,3.0)-1.5;}',

'float mapa(vec3 p, out float emis){',
' emis=0.0;',
' float rad,a,zc; nave_coords(p,rad,a,zc);',
' vec2 rp=vec2(cos(a),sin(a))*rad;',
/* La nave: cilindro hueco, mirado desde adentro. */
' float muro=2.15-rad;',
/* Nervadura vertical pegada al muro, una por sector. */
' float costilla=length(vec2(rp.x-2.02, rp.y))-0.085;',
/* Anillos: repetición en z. Cada 3 unidades, un arco completo. */
' float anillo=max(abs(rad-1.98)-0.075, abs(zc)-0.20);',
' float piso=p.y+1.62;',
' return min(min(muro,costilla),min(anillo,piso));}',

/* La ventana no es geometría: es una zona del muro. Decidirlo en el sombreado
   y no en el SDF evita que el vitral flote adelante de la piedra. */
'float ventana(vec3 p){',
' float rad,a,zc; nave_coords(p,rad,a,zc);',
' if(rad<2.02) return 0.0;',
' float lat=abs(a*rad);',
/* entre nervaduras (lat lejos de 0) y entre anillos (zc lejos de 0) */
' float h=smoothstep(0.17,0.23,lat)*(1.0-smoothstep(0.30,0.36,lat));',
' float v=smoothstep(0.34,0.46,abs(zc))*(1.0-smoothstep(1.05,1.20,abs(zc)));',
' return h*v;}',

'vec3 normal(vec3 p){',
' const vec2 e=vec2(1.0,-1.0)*0.0012; float t;',
' return normalize(e.xyy*mapa(p+e.xyy,t)+e.yyx*mapa(p+e.yyx,t)',
'                 +e.yxy*mapa(p+e.yxy,t)+e.xxx*mapa(p+e.xxx,t));}',

/* Oclusión ambiental barata: cinco muestras a lo largo de la normal. */
'float ao(vec3 p, vec3 n){float s=0.0,w=1.0,t;',
' for(int i=1;i<=5;i++){float h=0.02*float(i);',
'  s+=w*(h-mapa(p+n*h,t)); w*=0.72;}',
' return clamp(1.0-2.4*s,0.0,1.0);}',

'void main(){',
' vec2 p=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);',
/* Cámara: avanza sola por el eje; el puntero solo inclina la mirada. */
' float av=uT*1.35;',
' vec3 ro=vec3(0.0,0.0,av);',
' vec2 mm=(uM-0.5)*vec2(0.55,0.35);',
' vec3 rd=normalize(vec3(p.x+mm.x*0.35, p.y-mm.y*0.35, 1.25));',
/* Marcha: pasos cortos cerca, largos lejos. El 0.85 es el factor de
   seguridad — sin él la torsión hace que la marcha sobrepase la pared. */
' float t=0.0, emis=0.0, e2=0.0; bool hit=false;',
' for(int i=0;i<110;i++){',
'  vec3 pos=ro+rd*t;',
'  float d=mapa(pos,e2);',
'  if(d<0.0015*t+0.0009){ hit=true; emis=e2; break; }',
'  t+=d*0.85;',
'  if(t>42.0) break;}',
' vec3 col=VOID_C*0.5;',
' if(hit){',
'  vec3 pos=ro+rd*t;',
'  vec3 n=normal(pos);',
'  float oc=ao(pos,n);',
'  float fres=pow(1.0-abs(dot(n,-rd)),3.0);',
/* Película delgada sobre el muro: la fase depende de la geometría, así que
   el color viaja con la superficie en vez de estar pintado encima. */
'  float fase=pos.z*0.14+atan(pos.y,pos.x)*0.35+fres*1.2+uT*0.03;',
'  vec3 film=pelicula(fase);',
'  vec3 base=mix(VIOLET_C*0.10, mix(VIOLET_C,CELESTE_C,film.g), 0.55);',
'  col=base*oc*(0.30+0.85*fres);',
/* Los vitrales son la única fuente: tiñen el aire y lavan la piedra. */
'  float vent=ventana(pos);',
'  vec3 luz=mix(CELESTE_C,AGUA_C,0.5+0.5*sin(pos.z*0.35+uT*0.4));',
'  col=mix(col, luz*(1.15+1.4*uPulso), vent);',
'  col+=mix(AGUA_C,CELESTE_C,film.b)*oc*0.09;',
'  col+=WHITE_C*pow(fres,4.0)*0.45*oc;',
' }',
/* Niebla: el fondo del túnel se disuelve en vacío en vez de cortarse. */
' float niebla=1.0-exp(-t*0.085);',
' col=mix(col, VOID_C*0.6, niebla);',
/* Destello del pulso: al hacer click el aire se ioniza un instante. */
' col+=mix(CELESTE_C,ACID_C,0.3)*uPulso*0.16*exp(-t*0.10);',
' col=col/(1.0+col*0.72);',
' col=pow(max(col,0.0),vec3(0.92));',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*91.7)-0.5)*0.035;',
' o=vec4(max(col,0.0),1.0);}'
  ].join('\n'); };

  (window.LAB = window.LAB || []).push({
    id: 'catedral',
    nombre: 'CATEDRAL',
    tec: 'Raymarching SDF · repetición de dominio · película delgada',
    desc: 'Una nave infinita que no existe: no hay malla ni vértices, solo una ' +
          'función que dice a qué distancia está la piedra más cercana. mod() ' +
          'repite una columna para siempre y una torsión sobre el eje impide ' +
          'que se lea como un loop. Los vitrales son la única luz.',
    crear: function (API) {
      var gl = API.gl;
      var prog = API.programa(
        '#version 300 es\nlayout(location=0) in vec2 a;out vec2 uv;' +
        'void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}',
        FS(API.PALETA, API.RUIDO));
      if (!prog) return null;
      var U = {};
      ['uRes','uT','uM','uPulso'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      var W = 2, H = 2;
      return {
        medir: function (w, h) { W = w; H = h; },
        dibujar: function (t, dt, m) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, W, H);
          gl.useProgram(prog);
          gl.uniform2f(U.uRes, W, H);
          gl.uniform1f(U.uT, t);
          gl.uniform2f(U.uM, m.x, m.y);
          gl.uniform1f(U.uPulso, m.pulso);
          API.dibujarQuad();
        },
        soltar: function () { gl.deleteProgram(prog); }
      };
    }
  });
})();
