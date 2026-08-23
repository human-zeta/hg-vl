/* PRISMA — render espectral volumétrico.
   El resto del laboratorio (y UMBRAL) hace la iridiscencia con un truco: tres
   canales RGB desfasados. Se ve bien pero es una imitación. Acá el color no se
   elige: se marcha por un volumen calculando la interferencia de película
   delgada para DOCE longitudes de onda entre 400 y 700 nm, y recién al final
   ese espectro se convierte a color con las funciones de igualación CIE 1931
   (ajuste gaussiano de Wyman) y la matriz XYZ→sRGB.
   Por eso los bordes dan colores que no se pueden escribir a mano: son los que
   le salen a la luz cuando se parte de verdad. */
(function () {
  var NL = 12;
  var FS = function (P, R) { return [
'#version 300 es',
'precision highp float;',
'in vec2 uv; out vec4 o;',
'uniform vec2 uRes; uniform float uT; uniform vec2 uM; uniform float uPulso;',
P, R,
'const int NL=' + NL + ';',
'float hash13b(vec3 p){p=fract(p*0.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}',
'float ruido3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);',
' return mix(mix(mix(hash13b(i),hash13b(i+vec3(1,0,0)),f.x),',
'                mix(hash13b(i+vec3(0,1,0)),hash13b(i+vec3(1,1,0)),f.x),f.y),',
'            mix(mix(hash13b(i+vec3(0,0,1)),hash13b(i+vec3(1,0,1)),f.x),',
'                mix(hash13b(i+vec3(0,1,1)),hash13b(i+vec3(1,1,1)),f.x),f.y),f.z);}',
'float fbm3(vec3 p){float v=0.0,a=0.5;',
' for(int i=0;i<3;i++){v+=a*ruido3(p);p=p*2.07+vec3(11.3,7.1,3.7);a*=0.5;}return v;}',

/* Gaussiana de sigma partido: distinta caída a cada lado del pico. Es la
   pieza del ajuste de Wyman a las curvas CIE. */
'float gp(float x,float mu,float s1,float s2){',
' float t=(x-mu)*((x<mu)?1.0/s1:1.0/s2);',
' return exp(-0.5*t*t);}',
/* Funciones de igualación del observador estándar CIE 1931. */
'vec3 cie(float l){',
' float x=1.056*gp(l,599.8,37.9,31.0)+0.362*gp(l,442.0,16.0,26.7)-0.065*gp(l,501.1,20.4,26.2);',
' float y=0.821*gp(l,568.8,46.9,40.5)+0.286*gp(l,530.9,16.3,31.1);',
' float z=1.217*gp(l,437.0,11.8,36.0)+0.681*gp(l,459.0,26.0,13.8);',
' return vec3(x,y,z);}',
'vec3 xyz2rgb(vec3 c){',
' return vec3( 3.2406*c.x-1.5372*c.y-0.4986*c.z,',
'             -0.9689*c.x+1.8758*c.y+0.0415*c.z,',
'              0.0557*c.x-0.2040*c.y+1.0570*c.z);}',

/* El volumen: láminas de jabón enroscadas. La densidad es el grosor de la
   película, y el grosor es lo que decide qué color sobrevive. */
'float campo(vec3 p, float t, out float grosor){',
' vec3 q=p;',
' float giro=t*0.10+length(p.xz)*0.35;',
' float c=cos(giro), s=sin(giro);',
' q.xz=mat2(c,-s,s,c)*q.xz;',
' float f=fbm3(q*1.15+vec3(0.0,t*0.10,0.0));',
/* Una lámina es una superficie de nivel: la densidad vive cerca de f=0.5. */
' float lam=1.0-smoothstep(0.0,0.050,abs(f-0.5));',
/* Envoltura: sin esto la nube llena el cuadro y se pierde el vacío. */
' float env=1.0-smoothstep(0.45,1.75,length(p));',
' grosor=210.0+430.0*f+300.0*(p.y*0.5+0.5)+120.0*ruido3(q*3.4+vec3(t*0.2));',
' return lam*env;}',

'void main(){',
' vec2 pp=(gl_FragCoord.xy-0.5*uRes)/min(uRes.x,uRes.y);',
' vec2 mm=(uM-0.5);',
' float yaw=mm.x*1.1+uT*0.06, pit=-mm.y*0.7;',
' vec3 ro=vec3(0.0,0.0,3.1);',
' vec3 rd=normalize(vec3(pp,-1.55));',
/* cámara orbitando */
' float cy=cos(yaw), sy=sin(yaw), cx=cos(pit), sx=sin(pit);',
' mat3 R1=mat3(cy,0.0,-sy, 0.0,1.0,0.0, sy,0.0,cy);',
' mat3 R2=mat3(1.0,0.0,0.0, 0.0,cx,-sx, 0.0,sx,cx);',
' ro=R1*R2*ro; rd=R1*R2*rd;',

' float spec[NL];',
' for(int j=0;j<NL;j++) spec[j]=0.0;',
' float trans=1.0;',
' float t=1.05+hash21(gl_FragCoord.xy)*0.06;',   // jitter contra el bandeado
' const int PASOS=56;',
' for(int i=0;i<PASOS;i++){',
'  vec3 p=ro+rd*t;',
'  float gr; float d=campo(p,uT,gr);',
'  if(d>0.004){',
'   float peso=d*0.115*trans;',
'   for(int j=0;j<NL;j++){',
'    float lam=400.0+(float(j)+0.5)*(300.0/float(NL));',
/* Interferencia de película delgada: el camino óptico extra es 2·n·grosor,
   y a cada longitud de onda le toca una fase distinta. Eso ES la dispersión:
   no está pintada, sale de la cuenta. */
'    float fase=6.2831853*2.0*1.42*gr/lam;',
/* Airy: con finura alta cada longitud de onda solo pasa en una banda
   angosta, y ahí es donde el blanco se abre en colores. */
'    float sn=sin(fase*0.5);',
'    float inten=1.0/(1.0+18.0*sn*sn);',
'    spec[j]+=peso*inten;',
'   }',
'   trans*=1.0-d*0.055;',
'   if(trans<0.02) break;',
'  }',
'  t+=0.046;',
' }',

' vec3 xyz=vec3(0.0);',
' for(int j=0;j<NL;j++){',
'  float lam=400.0+(float(j)+0.5)*(300.0/float(NL));',
'  xyz+=spec[j]*cie(lam);',
' }',
' xyz*=(300.0/float(NL))*0.0052;',
' vec3 col=max(xyz2rgb(xyz),0.0);',
/* El vacío de la casa por debajo, para que el espectro flote sobre negro. */
' col+=VOID_C*0.55;',
' col*=1.0+uPulso*0.5;',
' col=col/(1.0+col*0.85);',
' col=pow(col,vec3(1.0/2.2));',                  // a espacio de pantalla
' float vin=length(pp);',
' col*=1.0-0.45*smoothstep(0.45,1.25,vin);',
' col+=(hash21(gl_FragCoord.xy+fract(uT)*77.7)-0.5)*0.03;',
' o=vec4(max(col,0.0),1.0);}'
  ].join('\n'); };

  (window.LAB = window.LAB || []).push({
    id: 'prisma',
    nombre: 'PRISMA',
    tec: 'Render espectral · 12 longitudes de onda · CIE 1931 → sRGB',
    desc: 'El color no se elige: se calcula. Se marcha por un volumen de ' +
          'láminas midiendo la interferencia para doce longitudes de onda entre ' +
          '400 y 700 nm, y recién al final ese espectro se convierte a color con ' +
          'las curvas del ojo humano. Los bordes dan tonos que no se pueden ' +
          'escribir a mano — son los que le salen a la luz al partirse.',
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
