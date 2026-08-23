/* LA MATERIA — port del motor de partículas de UMBRAL (web/umbral/) para la
   entrada. GPGPU WebGL2 MRT: posiciones y velocidades viven en texturas float,
   el sim corre en un fragment shader y el draw son point sprites aditivos.
   La formación deriva sola entre VÓRTICE y TÚNEL, la velocidad del puntero
   arremolina la materia (fuerza tangencial), el puntero la esquiva y el click
   dispara una onda. Regla de exposición heredada de UMBRAL v1:
   con blend aditivo el vacío domina — alfas bajos, polvo atenuado. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // la página está completa sin la materia

  var cv = document.getElementById('matter');
  if (!cv) return;
  var gl = cv.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { cv.style.display = 'none'; return; }

  var MOBILE = innerWidth < 760;
  // repartidas en profundidad rinden menos por pantalla que en un plano:
  // el túnel pide más materia para tener densidad
  var TW = MOBILE ? 160 : 288, TH = MOBILE ? 160 : 288, COUNT = TW * TH;

  function sh(t, s) {
    var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn('matter:', gl.getShaderInfoLog(o)); return null; }
    return o;
  }
  function prog(v, f) {
    var vs = sh(gl.VERTEX_SHADER, v), fs = sh(gl.FRAGMENT_SHADER, f);
    if (!vs || !fs) return null;
    var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('matter link:', gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  var NOISE = [
'vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}',
'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
'float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
' vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
' vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
' vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod(i,289.0);',
' vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
' float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);',
' vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);',
' vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh2=-step(h,vec4(0.0));',
' vec4 a0=b0.xzyw+s0.xzyw*sh2.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh2.zzww;',
' vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}',
'vec3 snoiseVec3(vec3 p){return vec3(snoise(p),snoise(p+vec3(123.4,45.6,78.9)),snoise(p+vec3(-9.1,32.7,11.3)));}',
'vec3 curlNoise(vec3 p){const float e=0.1;vec3 dx=vec3(e,0.,0.),dy=vec3(0.,e,0.),dz=vec3(0.,0.,e);',
' vec3 px0=snoiseVec3(p-dx),px1=snoiseVec3(p+dx),py0=snoiseVec3(p-dy),py1=snoiseVec3(p+dy),pz0=snoiseVec3(p-dz),pz1=snoiseVec3(p+dz);',
' float x=(py1.z-py0.z)-(pz1.y-pz0.y),y=(pz1.x-pz0.x)-(px1.z-px0.z),z=(px1.y-px0.y)-(py1.x-py0.x);',
' return normalize(vec3(x,y,z)/(2.0*e));}'].join('\n');

  var QUAD_VS = '#version 300 es\nin vec2 a;out vec2 uv;void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}';

  /* Compositor del mundo. El sol (#stage) entra como textura y se compone
     ACÁ, no con mix-blend-mode de CSS: una capa CSS con
     blend se promueve sola en el compositor y Chromium la ordena por encima de
     main — la materia terminaba pintando sobre el texto, y ninguna promoción
     de capa desde CSS lo arreglaba de forma estable. Con todo compuesto en un
     único canvas opaco el problema no existe. */
  var BLIT_FS = [
'#version 300 es',
'precision highp float;in vec2 uv;out vec4 o;',
'uniform sampler2D uSun,uClip;',
'uniform float uClipMix,uClipAR,uViewAR;',
'void main(){',
' vec3 s=texture(uSun,uv).rgb;',
' if(uClipMix>0.001){',
'  vec2 sc=(uClipAR>uViewAR)?vec2(uViewAR/uClipAR,1.0):vec2(1.0,uClipAR/uViewAR);',
'  vec2 cu=(uv-0.5)*sc+0.5;',
'  vec3 c=texture(uClip,cu).rgb*uClipMix;',
'  s=1.0-(1.0-s)*(1.0-c);',            // screen, igual que el blend que reemplaza
' }',
' o=vec4(s,1.0);}'].join('\n');

  /* sim: el hogar se mezcla entre 3 formaciones (uPhase 0..2) */
  var SIM_FS = [
'#version 300 es',
'precision highp float;in vec2 uv;',
'layout(location=0) out vec4 oPos;layout(location=1) out vec4 oVel;',
'uniform sampler2D uPos,uVel,uHomeA,uHomeB,uHomeC,uAttr;',
'uniform float uTime,uDt,uIntro,uAspect,uPhase,uSpin;',
'uniform vec3 uMouse;uniform vec4 uShock;',
NOISE,
'void main(){',
' vec3 hA=texture(uHomeA,uv).rgb, hB=texture(uHomeB,uv).rgb, hC=texture(uHomeC,uv).rgb;',
' vec3 home = uPhase<1.0 ? mix(hA,hB,smoothstep(0.0,1.0,uPhase)) : mix(hB,hC,smoothstep(1.0,2.0,uPhase));',
' vec4 at=texture(uAttr,uv);',
' vec3 pos=texture(uPos,uv).rgb;',
' vec3 vel=texture(uVel,uv).rgb;',
' vec3 spring=(home-pos)*mix(0.6,5.0,uIntro);',
' float idle=mix(0.35,0.12,at.b);',
' vec3 breathe=curlNoise(home*2.5+uTime*0.16)*idle;',
' vec2 dp=pos.xy-uMouse.xy; dp.x*=uAspect;',
' float d2=dot(dp,dp);',
' vec3 mForce=vec3(normalize(dp+1e-4),0.4)*(uMouse.z*exp(-d2*3.2)*9.0);',
' vec2 sp2=pos.xy-uShock.xy; sp2.x*=uAspect;',
' float sd=length(sp2);',
' float ring=exp(-pow((sd-uShock.z*1.6)*4.0,2.0));',
' vec3 sForce=vec3(normalize(sp2+1e-4),0.5)*ring*uShock.w*14.0;',
' float disp=clamp(length(pos-home)*1.8,0.0,1.0);',
' vec3 turb=curlNoise(pos*2.0+uTime*0.5)*disp*3.4;',
' vec2 rc=pos.xy;',
' vec2 tang=normalize(vec2(-rc.y,rc.x)+1e-4);',
' vec3 swirl=vec3(tang,0.0)*uSpin*exp(-dot(rc,rc)*0.35)*2.4;',
' vel+=(spring+breathe+mForce+sForce+turb+swirl)*uDt;',
' vel*=0.92;',
' pos+=vel*uDt;',
' oPos=vec4(pos,disp);',
' oVel=vec4(vel,0.0);}'].join('\n');

  /* draw: esferas corpóreas en la tríada violeta/celeste/agua del sol */
  var DRAW_VS = [
'#version 300 es',
'precision highp float;',
'in float aIndex;',
'out vec3 vCol;out float vSoft;out float vSpark;',
'uniform sampler2D uPos,uAttr;uniform vec2 uTexSize;',
'uniform float uAspect,uDPR,uTime,uIntro,uWorldP,uTravel,uDepth;uniform vec2 uPar;',
'const vec3 VIOLET_C  = vec3(0.478,0.184,1.000);',
'const vec3 CELESTE_C = vec3(0.247,0.831,1.000);',
'const vec3 AGUA_C    = vec3(0.184,1.000,0.753);',
'void main(){',
' vec2 t=vec2(mod(aIndex,uTexSize.x),floor(aIndex/uTexSize.x))/uTexSize;',
' vec4 s=texture(uPos,t);',
' vec4 at=texture(uAttr,t);',
' float disp=s.a;',
' vec3 p=s.rgb;',
/* Profundidad que se recicla con mod: la materia viaja HACIA el espectador y
   vuelve a entrar por el fondo. Dividir x,y por la distancia es la
   perspectiva: lejos convergen al centro, cerca se abren y te pasan de largo.
   La formación (cinturón / vórtice / túnel) queda como sección del túnel. */
' float zr=mod(at.a*uDepth - uTravel, uDepth);',
' float d=zr+0.6;',
' vec2 world=p.xy*1.15+uPar*0.30;',
' vec2 sp=world*(2.0/d); sp.x/=uAspect;',
' gl_Position=vec4(sp,0.,1.);',
' float near=1.0-clamp(zr/uDepth,0.0,1.0);',
' gl_PointSize=uDPR*at.r*(12.0/d)*(1.0+disp*0.7);',
' vSoft=mix(0.15,0.85,near*step(3.0,at.r));',
' float hue=fract(at.g+uTime*0.012);',
' vec3 c;',
' if(at.b>0.9){ c=mix(vec3(0.85,0.88,1.0),mix(VIOLET_C,CELESTE_C,at.g)*1.15,0.5); }',
' else if(at.b>0.55){',
'   float a3=fract(at.a+uTime*0.05);',
'   float w=0.5+0.5*cos(6.2832*a3);',
'   c=mix(mix(VIOLET_C,CELESTE_C,w),AGUA_C,0.5+0.5*cos(6.2832*(a3+0.33)));',
'   c=mix(vec3(0.8,0.85,1.0),c,0.6)*1.1;',
' } else {',
'   if(hue<0.45)      c=mix(VIOLET_C*0.55,VIOLET_C,hue/0.45);',
'   else if(hue<0.78) c=mix(CELESTE_C*0.6,CELESTE_C,(hue-0.45)/0.33);',
'   else              c=mix(AGUA_C*0.6,AGUA_C,(hue-0.78)/0.22);',
' }',
' float band=smoothstep(0.20,0.0,abs((p.y*0.5+0.5)-fract(uTime*0.045)));',
' float beat=smoothstep(0.7,0.0,length(p.xy))*(0.5+0.5*sin(uTime*0.9));',
/* Exposición contra un sol en brasa: con screen sobre un fondo casi negro la
   materia se compone casi entera, así que pide MENOS ganancia que antes, no
   más — de lo contrario se filtra por la translucidez de las plates. */
' float glow=0.20+0.34*band+0.20*beat+near*0.34+disp*1.1;',
' float dustDim=mix(0.30,1.0,step(0.15,at.b));',
' glow*=dustDim;',
' glow*=mix(1.0,1.5,step(0.9,at.b));',
/* Sobre el cuerpo brillante del sol la materia aditiva se lava; cerca del
   centro y a mitad del viaje la atenuamos para que no ensucie, y en el
   túnel final (el mundo se apaga) vuelve a plena potencia. */
' float sunGlare=smoothstep(0.55,0.12,length(p.xy))*smoothstep(0.1,0.45,uWorldP)*(1.0-smoothstep(0.72,0.92,uWorldP));',
' glow*=1.0-0.55*sunGlare;',
/* Entran desde el fondo y se apagan justo antes de pasarte, así el reciclado
   no se ve como un parpadeo ni como un manchón gigante encima de la cámara. */
' glow*=smoothstep(0.0,1.6,zr)*(1.0-smoothstep(uDepth*0.80,uDepth,zr));',
' vCol=c*glow*uIntro;',
' vSpark=step(0.985,fract(at.a*57.0))*(0.5+0.5*sin(uTime*3.0+at.a*40.0));}'].join('\n');

  var DRAW_FS = [
'#version 300 es',
'precision highp float;',
'in vec3 vCol;in float vSoft;in float vSpark;out vec4 o;',
'void main(){',
' vec2 d=(gl_PointCoord-0.5)*2.0;',
' float r2=dot(d,d); if(r2>1.0) discard;',
' float nz=sqrt(max(1.0-r2,0.0));',
' vec3 n=vec3(d.x,-d.y,nz);',
' vec3 L=normalize(vec3(-0.45,0.55,0.72));',
' float diff=0.38+0.62*max(dot(n,L),0.0);',
' float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.0),26.0)*0.30;',
' float edge=smoothstep(1.0,mix(0.55,0.05,vSoft),r2);',
' vec3 c=vCol*diff+vec3(1.0)*spec*(1.0-vSoft);',
' c+=vCol*vSpark*0.9;',
' float a=edge*mix(0.42,0.15,vSoft);',
' o=vec4(c*a,a);}'].join('\n');

  var simP = prog(QUAD_VS, SIM_FS), drawP = prog(DRAW_VS, DRAW_FS),
      blitP = prog(QUAD_VS, BLIT_FS);
  if (!simP || !drawP || !blitP) return;

  /* A partir de acá este canvas ES el mundo: el sol y el clip se apagan como
     capas CSS y viajan como texturas. */
  var stage = document.getElementById('stage');
  var clip = document.getElementById('peakClip');
  document.documentElement.classList.add('world-composited');

  function srcTex() {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  var sunTex = srcTex(), clipTex = srcTex();

  var quad = gl.createVertexArray(); gl.bindVertexArray(quad);
  var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var qa = gl.getAttribLocation(simP, 'a');
  gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /* ── las 3 formaciones del viaje ─────────────────────────────────────── */
  var homeA = new Float32Array(COUNT*4), homeB = new Float32Array(COUNT*4),
      homeC = new Float32Array(COUNT*4), attr = new Float32Array(COUNT*4),
      zero = new Float32Array(COUNT*4);
  var rnd = Math.random;
  function gauss(){ var u=0,v=0; while(!u)u=rnd(); while(!v)v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v); }
  function bodySize(){ var r=rnd(); return r<0.93 ? 0.45+rnd()*1.0 : 1.8+rnd()*2.2; }

  // A — CINTURÓN: bandas orbitales alrededor del punto lejano + polvo ambiente
  var k=0;
  var bands=[[0.72,0.012],[0.95,0.02],[1.22,0.03]];
  var beltN=Math.floor(COUNT*0.62);
  for(k=0;k<beltN;k++){
    var b=bands[(rnd()*bands.length)|0];
    var a=rnd()*6.2832, R=b[0]+gauss()*b[1]+Math.sin(a*3.0)*0.015;
    homeA[k*4]=Math.cos(a)*R*1.12; homeA[k*4+1]=Math.sin(a)*R*0.62; homeA[k*4+2]=0.25+rnd()*0.5; homeA[k*4+3]=1;
    attr[k*4]=bodySize(); attr[k*4+1]=rnd(); attr[k*4+2]=0.33; attr[k*4+3]=rnd();
  }
  for(;k<COUNT;k++){
    homeA[k*4]=(rnd()*2-1)*1.5; homeA[k*4+1]=(rnd()*2-1)*1.1; homeA[k*4+2]=rnd(); homeA[k*4+3]=1;
    var star=rnd();
    attr[k*4]=star<0.04?1.8+rnd()*2.0:bodySize();
    attr[k*4+1]=rnd(); attr[k*4+2]=star<0.04?0.95:(star<0.18?0.66:0.0); attr[k*4+3]=rnd();
  }
  // B — VÓRTICE: disco de acreción alrededor del sol
  for(var i=0;i<COUNT;i++){
    var a2=rnd()*6.2832, R2=0.34+Math.pow(rnd(),0.65)*0.85, sq=0.40+rnd()*0.06;
    homeB[i*4]=Math.cos(a2)*R2;
    homeB[i*4+1]=Math.sin(a2)*R2*sq+Math.sin(a2*3.0+R2*8.0)*0.025;
    homeB[i*4+2]=Math.min(0.98,Math.max(0.02,0.30+gauss()*0.16));
    homeB[i*4+3]=1;
  }
  // C — TÚNEL: anillos que convergen al núcleo (portal)
  for(var j=0;j<COUNT;j++){
    var t=Math.pow(rnd(),0.8), a3=rnd()*6.2832, R3=(1.35-(1.35-0.14)*t)+gauss()*0.045;
    homeC[j*4]=Math.cos(a3)*R3*1.15;
    homeC[j*4+1]=Math.sin(a3)*R3;
    homeC[j*4+2]=Math.min(0.98,t*0.97+0.02);
    homeC[j*4+3]=1;
  }
  // intro: la materia llega dispersa desde afuera
  var scatter=new Float32Array(COUNT*4);
  for(var s=0;s<COUNT;s++){
    var sa=rnd()*6.2832, sb=Math.acos(rnd()*2-1), SR=1.8+rnd()*1.4;
    scatter[s*4]=Math.sin(sb)*Math.cos(sa)*SR; scatter[s*4+1]=Math.sin(sb)*Math.sin(sa)*SR*0.7;
    scatter[s*4+2]=rnd(); scatter[s*4+3]=0;
  }

  function makeTex(data){
    var t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,TW,TH,0,gl.RGBA,gl.FLOAT,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }
  var homeTexA=makeTex(homeA), homeTexB=makeTex(homeB), homeTexC=makeTex(homeC), attrTex=makeTex(attr);
  var posTex=[makeTex(scatter),makeTex(scatter)];
  var velTex=[makeTex(zero),makeTex(zero)];
  var fbo=[gl.createFramebuffer(),gl.createFramebuffer()];
  for(var f=0;f<2;f++){
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[f]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,posTex[f],0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,velTex[f],0);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  var idx=new Float32Array(COUNT); for(var n=0;n<COUNT;n++) idx[n]=n;
  var drawVAO=gl.createVertexArray(); gl.bindVertexArray(drawVAO);
  var ib=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,ib); gl.bufferData(gl.ARRAY_BUFFER,idx,gl.STATIC_DRAW);
  var il=gl.getAttribLocation(drawP,'aIndex');
  gl.enableVertexAttribArray(il); gl.vertexAttribPointer(il,1,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);

  /* ── loop ────────────────────────────────────────────────────────────── */
  var U=function(nm){return gl.getUniformLocation(simP,nm);};
  var D=function(nm){return gl.getUniformLocation(drawP,nm);};
  var DPR=Math.min(devicePixelRatio||1,1.5);
  var cur=0, aspect=1, t0=performance.now(), last=t0;
  var mouse={x:9,y:9,f:0}, par={x:0,y:0,tx:0,ty:0};
  var shock={x:0,y:0,t:-9,w:0};
  var spin=0;
  /* Sin scroll, la profundidad es fija: la página se planta adentro del
     núcleo (mismo valor que world.js). Lo que mueve la materia ahora sos vos —
     la velocidad del puntero arremolina y empuja el túnel. */
  var P_CORE=0.955, DEPTH=14.0, travel=0, pSpeed=0;

  function resize(){ cv.width=innerWidth*DPR; cv.height=innerHeight*DPR; aspect=cv.width/cv.height; }
  addEventListener('resize',resize); resize();

  function frame(now){
    var dt=Math.min((now-last)/1000,0.033); last=now;
    var time=(now-t0)/1000;
    var intro=Math.min(1,Math.max(0,(time-0.3)/3.2));
    var introE=intro*intro*(3-2*intro);
    par.x+=(par.tx-par.x)*0.05; par.y+=(par.ty-par.y)*0.05;
    pSpeed*=0.90;                                  // la mano deja estela
    spin=spin*0.92+pSpeed*0.08;
    var spinF=Math.max(-3,Math.min(3,spin*18));
    // La formación deriva sola entre vórtice y túnel: el plano nunca se
    // queda quieto, pero tampoco pide que hagas nada.
    var phase=1.62+0.38*Math.sin(time*0.055);
    var sAge=time-shock.t;

    gl.useProgram(simP); gl.bindVertexArray(quad);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[1-cur]); gl.viewport(0,0,TW,TH);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,posTex[cur]); gl.uniform1i(U('uPos'),0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,velTex[cur]); gl.uniform1i(U('uVel'),1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,homeTexA); gl.uniform1i(U('uHomeA'),2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,homeTexB); gl.uniform1i(U('uHomeB'),3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D,homeTexC); gl.uniform1i(U('uHomeC'),4);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D,attrTex); gl.uniform1i(U('uAttr'),5);
    gl.uniform1f(U('uTime'),time); gl.uniform1f(U('uDt'),dt);
    gl.uniform1f(U('uIntro'),introE); gl.uniform1f(U('uAspect'),aspect);
    gl.uniform1f(U('uPhase'),phase); gl.uniform1f(U('uSpin'),spinF);
    gl.uniform3f(U('uMouse'),mouse.x,mouse.y,mouse.f);
    gl.uniform4f(U('uShock'),shock.x,shock.y,Math.max(0,sAge),shock.w*Math.exp(-sAge*1.8));
    gl.drawArrays(gl.TRIANGLES,0,3); cur=1-cur;

    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.drawBuffers([gl.BACK]);
    gl.viewport(0,0,cv.width,cv.height);
    gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);

    // 1) el mundo de fondo: sol (+ clip del pico si está sonando)
    var mix = clip ? (parseFloat(clip.dataset.mix) || 0) : 0;
    gl.disable(gl.BLEND);
    gl.useProgram(blitP); gl.bindVertexArray(quad);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sunTex);
    if (stage && stage.width) {
      try { gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,stage); } catch (e) {}
    }
    gl.uniform1i(gl.getUniformLocation(blitP,'uSun'),0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, clipTex);
    var clipAR = 16/9;
    if (mix > 0.001 && clip.readyState >= 2 && clip.videoWidth) {
      clipAR = clip.videoWidth / clip.videoHeight;
      try { gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,clip); } catch (e) { mix = 0; }
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.uniform1i(gl.getUniformLocation(blitP,'uClip'),1);
    gl.uniform1f(gl.getUniformLocation(blitP,'uClipMix'),mix);
    gl.uniform1f(gl.getUniformLocation(blitP,'uClipAR'),clipAR);
    gl.uniform1f(gl.getUniformLocation(blitP,'uViewAR'),cv.width/cv.height);
    gl.drawArrays(gl.TRIANGLES,0,3);

    // 2) la materia encima, aditiva
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    gl.useProgram(drawP); gl.bindVertexArray(drawVAO);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,posTex[cur]); gl.uniform1i(D('uPos'),0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,attrTex); gl.uniform1i(D('uAttr'),1);
    gl.uniform2f(D('uTexSize'),TW,TH); gl.uniform1f(D('uAspect'),aspect); gl.uniform1f(D('uDPR'),DPR);
    gl.uniform1f(D('uTime'),time); gl.uniform1f(D('uIntro'),introE);
    gl.uniform1f(D('uWorldP'),P_CORE); gl.uniform2f(D('uPar'),par.x,par.y);
    travel += (2.4 + Math.min(20,Math.abs(spin)*26)) * dt;
    gl.uniform1f(D('uTravel'),travel); gl.uniform1f(D('uDepth'),DEPTH);
    gl.drawArrays(gl.POINTS,0,COUNT);
    gl.disable(gl.BLEND);
    mouse.f*=0.9;
    requestAnimationFrame(frame);
  }

  /* ── input: la materia te esquiva; click = onda ──────────────────────── */
  function toWorld(cx,cyy){
    var nx=cx/innerWidth*2-1, ny=1-cyy/innerHeight*2;
    mouse.x=nx*aspect/0.93; mouse.y=ny/0.93;
    par.tx=nx; par.ty=ny;
  }
  var lastPx=null, lastPy=null;
  function trackSpeed(cx,cyy){
    if(lastPx!==null){
      var dx=(cx-lastPx)/innerWidth, dy=(cyy-lastPy)/innerHeight;
      pSpeed=Math.min(3.5,pSpeed+Math.sqrt(dx*dx+dy*dy)*26);
    }
    lastPx=cx; lastPy=cyy;
  }
  addEventListener('mousemove',function(e){ toWorld(e.clientX,e.clientY); mouse.f=1.0;
    trackSpeed(e.clientX,e.clientY); },{passive:true});
  addEventListener('pointerdown',function(e){ toWorld(e.clientX,e.clientY);
    shock={x:mouse.x,y:mouse.y,t:(performance.now()-t0)/1000,w:1}; },{passive:true});
  addEventListener('touchmove',function(e){ var t=e.touches[0];
    if(t){ toWorld(t.clientX,t.clientY); mouse.f=1.15; trackSpeed(t.clientX,t.clientY); } },{passive:true});

  requestAnimationFrame(frame);

  /* Chromium arma el árbol de capas antes de que estos canvas fijos empiecen a
     pintar, y en la primera composición los ordena mal: la materia aparece
     dibujada SOBRE el contenido de main hasta que algo fuerza una composición
     nueva. Un scroll de 1px lo corregía — o sea que el layout y el z-order ya
     eran correctos; lo único viejo era el composite. Sin página scrolleable
     ese recurso ya no está: verificar en Chrome de escritorio. */
  /* NOTA de composición (Chromium): en el primer pintado, antes de cualquier
     scroll, el navegador compone este canvas fijo por encima del contenido de
     main — las partículas se ven sobre el texto. No es z-order ni blend: el
     layout ya es correcto y se corrige solo con el primer scroll, que es lo
     primero que esta página pide hacer. Probado sin éxito: isolation:isolate,
     z-index negativo, promover main (transform/will-change), sacar
     backdrop-filter, sacar mix-blend-mode y empujar el scroll por JS al
     cargar. Se deja documentado en vez de arrastrar un workaround que no
     funciona; conviene verificarlo en Chrome/Safari de escritorio. */
})();
