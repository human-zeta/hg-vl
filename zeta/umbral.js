/* UMBRAL · ZETA — el plano de UMBRAL (web/umbral/ del vault) como fondo de la página de Zeta.
   Reemplaza a la pantalla LED (pantalla.js). Canvas WebGL2 fijo DETRÁS del contenido:
   - el logo Z holográfico (película delgada iridiscente con dispersión cromática por canal),
     desde z.bin (el z.gltf de UMBRAL compactado: herramientas/zeta-media/z-bin.py), gira 360°
     con el recorrido de la página;
   - 131K partículas corpóreas (65K en celular), GPGPU MRT, que migran entre tres formaciones
     según la sección en pantalla — cada sección marca data-fase (0 → 2) y data-velo (0 → 1):
       0 · ESCENA  — pilares de luz a los costados de la columna de lectura + halo orbital del Z
       1 · VÓRTICE — disco de acreción alrededor del Z
       2 · TÚNEL   — anillos que convergen al Z (el cierre: contacto)
   - el velo atenúa la materia SOLO detrás de la columna de lectura; en los márgenes brilla entera.
   Regla de exposición de UMBRAL: el vacío oscuro domina. Mouse = la materia te esquiva;
   clic en el vacío = onda. Mientras el video del hero tapa la pantalla no se dibuja nada, y el
   ensamblado arranca la primera vez que el plano asoma. Movimiento reducido = plano quieto
   (las partículas se dibujan en su formación, sin simular). El botón «UMBRAL» lo apaga y lo recuerda. */
(()=>{'use strict';
const BIN=new URL('z.bin',(document.currentScript&&document.currentScript.src)||location.href).href;
const cv=document.createElement('canvas');cv.id='umbral';cv.setAttribute('aria-hidden','true');
document.body.prepend(cv);
const gl=cv.getContext('webgl2',{alpha:false,antialias:false,depth:false,premultipliedAlpha:false});
if(!gl||!gl.getExtension('EXT_color_buffer_float')){cv.remove();return;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const MOVIL=matchMedia('(pointer:coarse)').matches||innerWidth<760;
const btn=document.createElement('button');btn.id='umbral-btn';btn.type='button';document.body.append(btn);

function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
 if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
function prog(v,f){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));
 gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}

const NOISE=`
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod(i,289.0);
 vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh2=-step(h,vec4(0.0));
 vec4 a0=b0.xzyw+s0.xzyw*sh2.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh2.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
vec3 snoiseVec3(vec3 p){return vec3(snoise(p),snoise(p+vec3(123.4,45.6,78.9)),snoise(p+vec3(-9.1,32.7,11.3)));}
vec3 curlNoise(vec3 p){const float e=0.1;vec3 dx=vec3(e,0.,0.),dy=vec3(0.,e,0.),dz=vec3(0.,0.,e);
 vec3 px0=snoiseVec3(p-dx),px1=snoiseVec3(p+dx),py0=snoiseVec3(p-dy),py1=snoiseVec3(p+dy),pz0=snoiseVec3(p-dz),pz1=snoiseVec3(p+dz);
 float x=(py1.z-py0.z)-(pz1.y-pz0.y),y=(pz1.x-pz0.x)-(px1.z-px0.z),z=(px1.y-px0.y)-(py1.x-py0.x);
 return normalize(vec3(x,y,z)/(2.0*e));}`;

const QUAD_VS=`#version 300 es
in vec2 a;out vec2 uv;void main(){uv=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}`;

// mezcla de las tres formaciones (la usan la simulación y, quieto, el dibujo)
const HOME=`
vec3 hogar(vec3 hA,vec3 hB,vec3 hC,float f){
 return f<1.0 ? mix(hA,hB,smoothstep(0.0,1.0,f)) : mix(hB,hC,smoothstep(1.0,2.0,f));}`;

const SIM_FS=`#version 300 es
precision highp float;in vec2 uv;
layout(location=0) out vec4 oPos;layout(location=1) out vec4 oVel;
uniform sampler2D uPos,uVel,uHomeA,uHomeB,uHomeC,uAttr;
uniform float uTime,uDt,uIntro,uAspect,uPhase,uSpin;
uniform vec2 uZ;uniform vec3 uMouse;uniform vec4 uShock;
${NOISE}
${HOME}
void main(){
 vec3 home=hogar(texture(uHomeA,uv).rgb,texture(uHomeB,uv).rgb,texture(uHomeC,uv).rgb,uPhase);
 vec4 at=texture(uAttr,uv);
 vec3 pos=texture(uPos,uv).rgb;
 vec3 vel=texture(uVel,uv).rgb;
 vec3 spring=(home-pos)*mix(0.6,5.0,uIntro);
 float idle=mix(0.35,0.12,at.b);
 vec3 breathe=curlNoise(home*2.5+uTime*0.16)*idle;
 vec2 dp=pos.xy-uMouse.xy; dp.x*=uAspect;
 float d2=dot(dp,dp);
 vec3 mForce=vec3(normalize(dp+1e-4),0.4)*(uMouse.z*exp(-d2*3.2)*9.0);
 vec2 sp2=pos.xy-uShock.xy; sp2.x*=uAspect;
 float sd=length(sp2);
 float ring=exp(-pow((sd-uShock.z*1.6)*4.0,2.0));
 vec3 sForce=vec3(normalize(sp2+1e-4),0.5)*ring*uShock.w*14.0;
 float disp=clamp(length(pos-home)*1.8,0.0,1.0);
 vec3 turb=curlNoise(pos*2.0+uTime*0.5)*disp*3.4;
 // el giro del Z arremolina la materia (fuerza tangencial por velocidad de scroll)
 vec2 rc=pos.xy-uZ;
 vec2 tang=normalize(vec2(-rc.y,rc.x)+1e-4);
 vec3 swirl=vec3(tang,0.0)*uSpin*exp(-dot(rc,rc)*0.35)*2.4;
 vel+=(spring+breathe+mForce+sForce+turb+swirl)*uDt;
 vel*=0.92;
 pos+=vel*uDt;
 oPos=vec4(pos,disp);
 oVel=vec4(vel,0.0);
}`;

// partículas: esferas corpóreas. Paleta de UMBRAL (cian → verde → violeta) con el ácido y el
// rojo glitch de la página como chispas. uLane/uVelo: atenuación de la columna de lectura.
const DRAW_VS=`#version 300 es
precision highp float;
in float aIndex;
out vec3 vCol;out float vDisp;out float vSoft;out float vSpark;
uniform sampler2D uPos,uAttr,uHomeA,uHomeB,uHomeC;uniform vec2 uTexSize;
uniform float uAspect,uDPR,uTime,uIntro,uStatic,uPhase,uVelo,uLane,uW;uniform vec2 uPar;
${HOME}
void main(){
 vec2 t=(vec2(mod(aIndex,uTexSize.x),floor(aIndex/uTexSize.x))+0.5)/uTexSize;
 vec4 s=texture(uPos,t);
 vec4 at=texture(uAttr,t);
 vec3 p=uStatic>0.5 ? hogar(texture(uHomeA,t).rgb,texture(uHomeB,t).rgb,texture(uHomeC,t).rgb,uPhase) : s.rgb;
 vDisp=uStatic>0.5 ? 0.0 : s.a;
 float z=clamp(p.z,0.0,1.0);
 float persp=1.0/(1.0+z*0.85);
 vec2 cam=uPar*(z-0.35)*0.16;
 vec2 sp=(p.xy+cam)*persp; sp.x/=uAspect;
 gl_Position=vec4(sp*0.93,0.,1.);
 float near=1.0-z;
 gl_PointSize=uDPR*at.r*mix(1.1,4.6,near)*persp*(1.0+vDisp*0.7);
 vSoft=mix(0.15,0.85,near*step(3.0,at.r));
 float hue=fract(at.g+uTime*0.012);
 vec3 c;
 if(at.b>0.55){                                                  // halo: película delgada
   float a3=fract(at.a+uTime*0.05);
   c=0.5+0.5*cos(6.2832*(a3+vec3(0.0,0.33,0.67)));
   c=mix(vec3(0.8,0.85,1.0),c,0.55)*1.1;
 } else {
   if(hue<0.30)      c=mix(vec3(0.04,0.30,0.45),vec3(0.20,0.80,0.95),hue/0.30);
   else if(hue<0.55) c=mix(vec3(0.10,0.45,0.25),vec3(0.45,0.95,0.50),(hue-0.30)/0.25);
   else if(hue<0.88) c=mix(vec3(0.32,0.22,0.75),vec3(0.62,0.48,1.0),(hue-0.55)/0.33);
   else              c=mix(vec3(0.55,0.80,0.10),vec3(0.72,1.0,0.0),(hue-0.88)/0.12);   // ácido #b8ff00
   float ch=fract(at.a*31.0);
   if(ch>0.988) c=vec3(1.0,0.18,0.33);                            // rojo glitch #ff2d55
 }
 float band=smoothstep(0.20,0.0,abs((p.y*0.5+0.5)-fract(uTime*0.045)));
 float beat=smoothstep(0.7,0.0,length(p.xy))*(0.5+0.5*sin(uTime*0.9));
 float glow=0.20+0.42*band+0.24*beat+near*0.16+vDisp*1.2;
 glow*=mix(0.30,1.0,step(0.15,at.b));                            // el polvo, al 30%
 glow*=mix(1.0,1.6,step(0.25,at.b)*step(at.b,0.5)*(1.0-smoothstep(0.6,1.4,uPhase)));   // pilares: luz de escenario
 // velo: solo detrás de la columna de lectura
 float px=abs(gl_Position.x)*uW*0.5;
 glow*=1.0-uVelo*(1.0-smoothstep(uLane*0.88,uLane*1.12,px));
 vCol=c*glow*uIntro;
 vSpark=step(0.985,fract(at.a*57.0))*(0.5+0.5*sin(uTime*3.0+at.a*40.0));
}`;
const DRAW_FS=`#version 300 es
precision highp float;
in vec3 vCol;in float vDisp;in float vSoft;in float vSpark;out vec4 o;
void main(){
 vec2 d=(gl_PointCoord-0.5)*2.0;
 float r2=dot(d,d); if(r2>1.0) discard;
 float nz=sqrt(max(1.0-r2,0.0));
 vec3 n=vec3(d.x,-d.y,nz);
 vec3 L=normalize(vec3(-0.45,0.55,0.72));
 float diff=0.38+0.62*max(dot(n,L),0.0);
 float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.0),26.0)*0.30;
 float edge=smoothstep(1.0,mix(0.55,0.05,vSoft),r2);
 vec3 c=vCol*diff+vec3(1.0)*spec*(1.0-vSoft);
 c+=vCol*vSpark*0.9;
 float a=edge*mix(0.42,0.15,vSoft);
 o=vec4(c*a,a);
}`;

// el logo Z: malla holográfica iridiscente; cada canal muestrea la película DESFASADO = dispersión
const MESH_VS=`#version 300 es
precision highp float;
in vec3 aP;in vec3 aN;
uniform mat3 uRot;uniform float uAspect,uScale;uniform vec2 uPar,uZ;
out vec3 vN;out vec3 vP;
void main(){
 vec3 p=uRot*aP*uScale;
 vN=uRot*aN;
 vP=p;
 float depth=0.35-p.z*0.5;
 float persp=1.0/(1.0+depth*0.85);
 vec2 sp=(uZ+p.xy+uPar*(depth-0.35)*0.16)*persp;
 sp.x/=uAspect;
 gl_Position=vec4(sp*0.93,0.0,1.0);
}`;
const MESH_FS=`#version 300 es
precision highp float;
in vec3 vN;in vec3 vP;out vec4 o;
uniform float uTime,uIntro,uFade;
vec3 pal(float t){return 0.5+0.5*cos(6.2832*(t+vec3(0.0,0.33,0.67)));}
void main(){
 vec3 N=normalize(vN);
 vec3 V=vec3(0.,0.,1.);
 float ndv=abs(dot(N,V));
 float fres=pow(1.0-ndv,2.1);
 float phase=ndv*1.7+vP.y*0.9+vP.x*0.4+uTime*0.05;
 vec3 film=vec3(pal(phase+0.05).r, pal(phase).g, pal(phase-0.05).b);
 vec3 L=normalize(vec3(-0.45,0.6,0.8));
 float spec=pow(max(dot(reflect(-L,N),V),0.0),42.0);
 vec3 c=film*(0.34+fres*2.3)+vec3(0.9,0.95,1.0)*spec*1.1;
 float a=(0.10+fres*0.62)*uIntro*uFade;
 o=vec4(c*a,a);
}`;

let simP,drawP,meshP;
try{simP=prog(QUAD_VS,SIM_FS);drawP=prog(DRAW_VS,DRAW_FS);meshP=prog(MESH_VS,MESH_FS);}
catch(e){console.warn('UMBRAL:',e);cv.remove();btn.remove();return;}
const quad=gl.createVertexArray();gl.bindVertexArray(quad);
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const qa=gl.getAttribLocation(simP,'a');gl.enableVertexAttribArray(qa);gl.vertexAttribPointer(qa,2,gl.FLOAT,false,0,0);
gl.bindVertexArray(null);

// ════════ el logo Z (z.bin: int16 posiciones, int8 normales) — llega después, sin trabar la página ════════
let mesh=null;
fetch(BIN).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();}).then(buf=>{
 const [nv,ni,ib]=new Uint32Array(buf,0,3);
 let off=16; const P=new Int16Array(buf,off,nv*3); off+=Math.ceil(nv*6/4)*4;
 const N=new Int8Array(buf,off,nv*3); off+=Math.ceil(nv*3/4)*4;
 const I=ib===2?new Uint16Array(buf,off,ni):new Uint32Array(buf,off,ni);
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,P,gl.STATIC_DRAW);
 const lp=gl.getAttribLocation(meshP,'aP');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,3,gl.SHORT,true,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,N,gl.STATIC_DRAW);
 const ln=gl.getAttribLocation(meshP,'aN');gl.enableVertexAttribArray(ln);gl.vertexAttribPointer(ln,3,gl.BYTE,true,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);
 gl.bindVertexArray(null);
 mesh={vao,count:ni,type:ib===2?gl.UNSIGNED_SHORT:gl.UNSIGNED_INT};
 if(reduced.matches)pedir();
}).catch(e=>console.warn('UMBRAL: sin logo Z —',e.message));

// ════════ las tres formaciones (el layout se arma con el viewport de entrada) ════════
const TW=512, TH=MOVIL?128:256, COUNT=TW*TH;
const homeA=new Float32Array(COUNT*4), homeB=new Float32Array(COUNT*4), homeC=new Float32Array(COUNT*4),
      attr=new Float32Array(COUNT*4), zero=new Float32Array(COUNT*4);
const rnd=Math.random, gauss=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*v);};
const clamp01=v=>Math.min(0.98,Math.max(0.02,v));
const ASP0=innerWidth/innerHeight, VW=ASP0/0.93, RETRATO=ASP0<0.9;
const ZC=[0,RETRATO?0.10:0.06];                                  // centro del Z
const LANE0=Math.min(1040,innerWidth)/2-24;                      // media columna de lectura en px
const laneN=Math.min(0.97,LANE0/(innerWidth/2));                 // …en NDC
const xDesdeNDC=(n,z)=>n*ASP0/0.93*(1+z*0.85);                  // NDC → mundo, a profundidad z
let k=0;
function put(x,y,z,size,hue,type,phase){
 if(k>=COUNT)return;
 homeA[k*4]=x;homeA[k*4+1]=y;homeA[k*4+2]=z;homeA[k*4+3]=1;
 attr[k*4]=size;attr[k*4+1]=hue;attr[k*4+2]=type;attr[k*4+3]=phase;
 k++;
}
function bodySize(){ const r=rnd(); return r<0.93 ? 0.45+rnd()*1.0 : 1.8+rnd()*2.2; }
// FORMACIÓN A — escena: halo orbital del Z + pilares de luz (los de los márgenes enteros; los de
// adentro quedan detrás del velo) + polvo
(function halo(){
 const N=MOVIL?4500:9000, rr0=Math.min(0.56,VW*0.8);
 for(let i=0;i<N;i++){
  const a=rnd()*6.2832, rr=rr0+gauss()*0.006;
  put(ZC[0]+Math.cos(a)*rr, ZC[1]+Math.sin(a)*rr*0.94+Math.sin(a*2.0)*0.02, 0.3+rnd()*0.12, 0.6+rnd()*0.8, rnd(), 0.66, a/6.2832);
 }
})();
(function pilares(){
 const m=1-laneN, fuera=m>0.12;                                   // ¿hay margen de verdad a los costados?
 const cols=fuera                                                // [NDC x, profundidad, ancho]
  ? [[laneN+m*0.24,.46,.035],[laneN+m*0.56,.36,.05],[laneN+m*0.86,.52,.04],[0.30,.80,.05],[0.58,.66,.06]]
  : [[0.97,.45,.04],[0.84,.60,.035],[0.30,.80,.04]];
 const N=MOVIL?30000:70000;
 for(let i=0;i<N;i++){
  const c=cols[(rnd()*cols.length)|0], lado=rnd()<0.5?-1:1;
  const y=rnd()*2.6-1.3, z=clamp01(c[1]+gauss()*0.14);
  const wob=Math.sin(y*3.1+c[0]*7.0+lado)*0.04;
  put(lado*xDesdeNDC(c[0],z)+gauss()*c[2]+wob, y, z, bodySize(), rnd(), 0.33, rnd());
 }
})();
while(k<COUNT){ put((rnd()*2-1)*VW*1.1, rnd()*2.6-1.3, rnd(), bodySize(), rnd(), 0.0, rnd()); }

// FORMACIÓN B — vórtice: disco de acreción alrededor del Z, hasta los márgenes
const RB=Math.max(1.19,VW*0.95);
for(let i=0;i<COUNT;i++){
 const a=rnd()*6.2832, R=0.34+Math.pow(rnd(),0.65)*(RB-0.34), sq=0.40+rnd()*0.06;
 homeB[i*4]=ZC[0]+Math.cos(a)*R;
 homeB[i*4+1]=ZC[1]+Math.sin(a)*R*sq+Math.sin(a*3.0+R*8.0)*0.025;
 homeB[i*4+2]=clamp01(0.30+gauss()*0.16); homeB[i*4+3]=1;
}
// FORMACIÓN C — túnel: anillos que convergen al Z (portal)
const RC=Math.max(1.35,VW*1.05);
for(let i=0;i<COUNT;i++){
 const t=Math.pow(rnd(),0.8), a=rnd()*6.2832, R=(RC-(RC-0.14)*t)+gauss()*0.045;
 homeC[i*4]=ZC[0]+Math.cos(a)*R*1.15; homeC[i*4+1]=ZC[1]+Math.sin(a)*R; homeC[i*4+2]=clamp01(t*0.97+0.02); homeC[i*4+3]=1;
}

function makeTex(data){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,TW,TH,0,gl.RGBA,gl.FLOAT,data);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
const scatter=new Float32Array(COUNT*4);
for(let i=0;i<COUNT;i++){
 const a=rnd()*6.2832, b=Math.acos(rnd()*2-1), R=1.8+rnd()*1.4;
 scatter[i*4]=Math.sin(b)*Math.cos(a)*R; scatter[i*4+1]=Math.sin(b)*Math.sin(a)*R*0.7; scatter[i*4+2]=rnd();
}
const homeTexA=makeTex(homeA), homeTexB=makeTex(homeB), homeTexC=makeTex(homeC), attrTex=makeTex(attr);
const posTex=[makeTex(scatter),makeTex(scatter)], velTex=[makeTex(zero),makeTex(zero)];
const fbo=[gl.createFramebuffer(),gl.createFramebuffer()];
for(let s=0;s<2;s++){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[s]);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,posTex[s],0);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,velTex[s],0);}
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
const idx=new Float32Array(COUNT);for(let i=0;i<COUNT;i++)idx[i]=i;
const drawVAO=gl.createVertexArray();gl.bindVertexArray(drawVAO);
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,idx,gl.STATIC_DRAW);
const il=gl.getAttribLocation(drawP,'aIndex');gl.enableVertexAttribArray(il);gl.vertexAttribPointer(il,1,gl.FLOAT,false,0,0);
gl.bindVertexArray(null);

// ════════ fase y velo según la sección en pantalla ════════
const secs=[...document.querySelectorAll('[data-fase]')];
const hero=document.querySelector('.hero');
function objetivo(){
 if(!secs.length) return {f:0,v:0};
 const c=innerHeight*0.5;
 const pts=secs.map(s=>{const r=s.getBoundingClientRect();return {y:r.top+Math.min(r.height,innerHeight)*0.5,f:+s.dataset.fase||0,v:+s.dataset.velo||0};});
 if(c<=pts[0].y) return pts[0];
 for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];
  if(c<=b.y){const t=(c-a.y)/Math.max(1,b.y-a.y), e=t*t*(3-2*t);return {f:a.f+(b.f-a.f)*e,v:a.v+(b.v-a.v)*e};}}
 return pts[pts.length-1];
}
const asoma=()=>!hero||hero.getBoundingClientRect().bottom<innerHeight-1;   // ¿el video del hero deja ver algo?

// ════════ loop ════════
const U=n=>gl.getUniformLocation(simP,n), D=n=>gl.getUniformLocation(drawP,n), M=n=>gl.getUniformLocation(meshP,n);
let DPR=Math.min(devicePixelRatio||1,MOVIL?1.5:1.7);
let cur=0, aspect=1, last=0, reloj=0, intro0=-1, raf=0;
const mouse={x:9,y:9,f:0}, par={x:0,y:0,tx:0,ty:0};
let shock={x:0,y:0,t:-9,w:0};
let fase=-1, velo=0, spin=0, sS=0, medidos=0, sumaDt=0;
let on=true;try{if(localStorage.getItem('zeta-umbral')==='0')on=false}catch(e){}
function resize(){cv.width=Math.round(innerWidth*DPR);cv.height=Math.round(innerHeight*DPR);aspect=cv.width/cv.height;}
function scrollProg(){const sc=document.scrollingElement, m=sc.scrollHeight-innerHeight;return m>0?scrollY/m:0;}
function rotM(yaw,pitch){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
 return new Float32Array([ cy,0,-sy,  sy*sx,cx,cy*sx,  sy*cx,-sx,cy*cx ]);   // rotX·rotY, column-major
}

function frame(dtR){
 const quieto=reduced.matches;
 const dt=Math.min(dtR,0.033);
 if(!quieto) reloj+=dtR;
 if(intro0<0) intro0=reloj;
 const time=quieto?0:reloj;
 const introT=quieto?1:Math.min(1,Math.max(0,(reloj-intro0-0.15)/3.0));
 const introE=introT*introT*(3-2*introT);
 par.x+=(par.tx-par.x)*0.05; par.y+=(par.ty-par.y)*0.05;
 const obj=objetivo();
 fase=(fase<0||quieto)?obj.f:fase+(obj.f-fase)*0.06;
 velo=quieto?obj.v:velo+(obj.v-velo)*0.1;
 const sRaw=scrollProg(), sPrev=sS;
 sS=quieto?sRaw:sS+(sRaw-sS)*0.07;
 spin=spin*0.9+((sS-sPrev)/Math.max(dt,1e-3))*0.1;
 const spinF=quieto?0:Math.max(-3,Math.min(3,spin*22));
 const sAge=time-shock.t;
 if(!quieto){
  gl.useProgram(simP);gl.bindVertexArray(quad);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[1-cur]);gl.viewport(0,0,TW,TH);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,posTex[cur]);gl.uniform1i(U('uPos'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,velTex[cur]);gl.uniform1i(U('uVel'),1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,homeTexA);gl.uniform1i(U('uHomeA'),2);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,homeTexB);gl.uniform1i(U('uHomeB'),3);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,homeTexC);gl.uniform1i(U('uHomeC'),4);
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,attrTex);gl.uniform1i(U('uAttr'),5);
  gl.uniform1f(U('uTime'),time);gl.uniform1f(U('uDt'),dt);gl.uniform1f(U('uIntro'),introE);gl.uniform1f(U('uAspect'),aspect);
  gl.uniform1f(U('uPhase'),fase);gl.uniform1f(U('uSpin'),spinF);gl.uniform2f(U('uZ'),ZC[0],ZC[1]);
  gl.uniform3f(U('uMouse'),mouse.x,mouse.y,mouse.f);
  gl.uniform4f(U('uShock'),shock.x,shock.y,Math.max(0,sAge),shock.w*Math.exp(-sAge*1.8));
  gl.drawArrays(gl.TRIANGLES,0,3);cur=1-cur;
 }
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawBuffers([gl.BACK]);gl.viewport(0,0,cv.width,cv.height);
 gl.clearColor(0.02,0.02,0.024,1);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
 gl.useProgram(drawP);gl.bindVertexArray(drawVAO);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,posTex[cur]);gl.uniform1i(D('uPos'),0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,attrTex);gl.uniform1i(D('uAttr'),1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,homeTexA);gl.uniform1i(D('uHomeA'),2);
 gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,homeTexB);gl.uniform1i(D('uHomeB'),3);
 gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,homeTexC);gl.uniform1i(D('uHomeC'),4);
 gl.uniform2f(D('uTexSize'),TW,TH);gl.uniform1f(D('uAspect'),aspect);gl.uniform1f(D('uDPR'),DPR);
 gl.uniform1f(D('uTime'),time);gl.uniform1f(D('uIntro'),introE);gl.uniform2f(D('uPar'),par.x,par.y);
 gl.uniform1f(D('uStatic'),quieto?1:0);gl.uniform1f(D('uPhase'),fase);gl.uniform1f(D('uVelo'),velo);
 gl.uniform1f(D('uLane'),(Math.min(1040,innerWidth)/2-24)*DPR);gl.uniform1f(D('uW'),cv.width);
 gl.drawArrays(gl.POINTS,0,COUNT);
 if(mesh){                                                       // el Z gira 360° con el recorrido de la página
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(meshP);gl.bindVertexArray(mesh.vao);
  gl.uniformMatrix3fv(M('uRot'),false,rotM(sS*6.2832+time*0.06,0.16+Math.sin(time*0.18)*0.10));
  gl.uniform1f(M('uAspect'),aspect);gl.uniform1f(M('uScale'),0.36*Math.min(1,VW/0.7));
  gl.uniform2f(M('uPar'),par.x,par.y);gl.uniform2f(M('uZ'),ZC[0],ZC[1]);
  gl.uniform1f(M('uTime'),time);gl.uniform1f(M('uIntro'),introE);
  gl.uniform1f(M('uFade'),(0.55+0.45*Math.min(1,Math.max(0,fase)))*(1-velo*0.55));
  gl.drawElements(gl.TRIANGLES,mesh.count,mesh.type,0);
 }
 gl.disable(gl.BLEND);
 mouse.f*=0.9;
}
function loop(now){
 raf=0;if(!on||document.hidden||reduced.matches)return;
 const dtR=Math.min((now-last)/1000||0.016,0.1);last=now;
 // celular lento → bajar la resolución una vez
 if(medidos<90){medidos++;sumaDt+=dtR;if(medidos===90&&sumaDt/90>0.040&&DPR>1){DPR=1;resize();}}
 if(asoma()) frame(dtR);                                         // tapado por el hero: no se dibuja
 raf=requestAnimationFrame(loop);
}
function pedir(){ if(on&&!raf&&reduced.matches&&asoma()) raf=requestAnimationFrame(()=>{raf=0;frame(0);}); }
function sync(){
 cancelAnimationFrame(raf);raf=0;
 cv.style.visibility=on?'visible':'hidden';
 btn.textContent=on?'UMBRAL · ON':'UMBRAL · OFF';btn.setAttribute('aria-pressed',String(on));
 btn.title=on?'Apagar el fondo UMBRAL':'Prender el fondo UMBRAL';
 if(!on)return;
 if(reduced.matches){pedir();return}                                // plano quieto
 if(!document.hidden){last=performance.now();raf=requestAnimationFrame(loop)}
}
btn.addEventListener('click',()=>{on=!on;try{localStorage.setItem('zeta-umbral',on?'1':'0')}catch(e){}sync()});
reduced.addEventListener('change',sync);
document.addEventListener('visibilitychange',sync);
addEventListener('resize',()=>{resize();pedir();},{passive:true});
addEventListener('scroll',pedir,{passive:true});

// ════════ input: la materia esquiva el puntero; clic en el vacío = onda ════════
function toWorld(cx,cy){
 const nx=cx/innerWidth*2-1, ny=1-cy/innerHeight*2;
 mouse.x=nx*aspect/0.93; mouse.y=ny/0.93;
 par.tx=nx; par.ty=ny;
}
addEventListener('pointermove',e=>{ if(e.pointerType==='touch')return; toWorld(e.clientX,e.clientY); mouse.f=1.0; },{passive:true});
addEventListener('touchmove',e=>{const t=e.touches[0];if(t){toWorld(t.clientX,t.clientY);mouse.f=1.15;}},{passive:true});
addEventListener('pointerdown',e=>{
 const el=e.target instanceof Element?e.target:null;
 if(!on||e.button!==0||(el&&el.closest('a,button,video,iframe,input,textarea,.yt-embed,.work,.edu,.tools')))return;
 toWorld(e.clientX,e.clientY); shock={x:mouse.x,y:mouse.y,t:reloj,w:1};
});
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();on=false;sync();btn.hidden=true});
resize();sync();
})();
