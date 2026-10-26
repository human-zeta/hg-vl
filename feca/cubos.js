/* CUBOS · FECA — el fondo de feca.hg-vl.com (lo que en zeta es UMBRAL, acá es otro shader).
   Cubos LED colgados entre humo, como los de sus fotos de sala: cada cubo es una pantalla con
   vetas de luz sobre rojo, los cabezales móviles cortan el humo en azul, el público queda al pie
   en contraluz y todo late a tempo. Canvas WebGL fijo DETRÁS del contenido.
   - Cada sección marca data-fase (0 → 2) y data-velo (0 → 1), igual que en zeta:
       0 · SALA    — cubos casi quietos, haces lentos, público al pie
       1 · MAPPING — una sola imagen proyectada sobre todos los cubos, con un barrido que los cruza
       2 · DROP    — los cubos dan un cuarto de giro por compás y el contenido se vuelve franjas
     data-velo atenúa SOLO detrás de la columna de lectura; en los márgenes brilla entero.
   - Está escrito en ISF de verdad: CUERPO es el mismo texto que baja cualquier botón [data-fs]
     como cubos-feca.fs para VDMX6. La página solo le antepone lo que en VDMX pone el host
     (precisión, TIME, RENDERSIZE y un uniform por cada INPUT).
   - Mouse = el cabezal de seguimiento apunta adonde estás; clic en el vacío = golpe.
   - Se dibuja a resolución reducida (el humo no pide más) y baja sola si el equipo no llega.
   - Movimiento reducido = un cuadro quieto. El botón «CUBOS» lo apaga y lo recuerda.
   - Sin destellos de pantalla completa: el golpe late en los cubos y en los haces, no en todo. */
(()=>{'use strict';

const ISF={
  DESCRIPTION:'CUBOS · cubos LED colgados entre humo, haces de cabezales y golpe a tempo. El fondo de feca.hg-vl.com',
  CREDIT:'Human Glitche · Visual Lab, para Feca (@feka.vj)',
  ISFVSN:'2',
  CATEGORIES:['Generator'],
  INPUTS:[
    {NAME:'fase',TYPE:'float',DEFAULT:0,MIN:0,MAX:2,LABEL:'Fase (0 sala · 1 mapping · 2 drop)'},
    {NAME:'bpm',TYPE:'float',DEFAULT:126,MIN:0,MAX:180,LABEL:'BPM (0 = sin reloj)'},
    {NAME:'golpe',TYPE:'float',DEFAULT:0,MIN:0,MAX:1,LABEL:'Golpe (atalo al bombo)'},
    {NAME:'recorrido',TYPE:'float',DEFAULT:0.5,MIN:0,MAX:1,LABEL:'Cámara a lo largo de la fila'},
    {NAME:'focoX',TYPE:'float',DEFAULT:0.5,MIN:0,MAX:1,LABEL:'Seguidor X'},
    {NAME:'focoY',TYPE:'float',DEFAULT:0.6,MIN:0,MAX:1,LABEL:'Seguidor Y'},
    {NAME:'publico',TYPE:'float',DEFAULT:1,MIN:0,MAX:1,LABEL:'Público al pie'},
    {NAME:'colorCubo',TYPE:'color',DEFAULT:[1,0.12,0.24,1],LABEL:'Color de los cubos'},
    {NAME:'colorHaz',TYPE:'color',DEFAULT:[0.18,0.42,1,1],LABEL:'Color de los haces'},
    {NAME:'velo',TYPE:'float',DEFAULT:0,MIN:0,MAX:1,LABEL:'Velo sobre la columna central'},
    {NAME:'columna',TYPE:'float',DEFAULT:0.36,MIN:0,MAX:0.5,LABEL:'Ancho de la columna'}
  ]
};

/* GLSL ES 1.00 sin #version (el dialecto de ISF): floats siempre con punto, loops de largo fijo,
   arrays globales indexados solo con el índice del loop. */
const CUERPO=`// CUBOS · para Feca (@feka.vj) — Human Glitche · Visual Lab
#define NC 7
#define NH 4

vec3 cc[NC];   // centro de cada cubo
vec2 cg[NC];   // giro (coseno, seno)
float cs[NC];  // medio lado
vec3 ho[NH];   // origen de cada cabezal
vec3 hd[NH];   // dirección de cada haz

float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float ruido(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1.0,0.0)),f.x),mix(h2(i+vec2(0.0,1.0)),h2(i+vec2(1.0,1.0)),f.x),f.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<4;i++){ s+=a*ruido(p); p=p*2.02+vec2(3.1,1.7); a*=0.5; }
  return s;
}
float caja(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }

float escena(vec3 p, out float cual){
  float d=1e4; cual=0.0;
  for(int k=0;k<NC;k++){
    vec3 q=p-cc[k];
    q.xz=vec2(cg[k].x*q.x-cg[k].y*q.z, cg[k].y*q.x+cg[k].x*q.z);
    float b=caja(q, vec3(cs[k], cs[k]*0.82, cs[k]))-0.015;
    if(b<d){ d=b; cual=float(k); }
  }
  return d;
}

float humo(vec3 p){
  float n=ruido(p.xz*0.32+vec2(TIME*0.035, p.y*0.4))*0.65+ruido(p.xy*0.8+vec2(-TIME*0.05, p.z*0.3))*0.35;
  return 0.012+0.05*n*n+0.03*smoothstep(0.5,-1.6,p.y);
}

float haz(vec3 p, vec3 o, vec3 d, float ancho){
  vec3 v=p-o; float a=dot(v,d);
  if(a<0.0) return 0.0;
  float r2=max(dot(v,v)-a*a,0.0);
  float w=ancho+a*0.075;
  return exp(-r2/(w*w))/(1.0+a*0.06);
}

// una fila de gente: cada celda es una persona (hombros redondos + cabeza) y se mira también
// a las vecinas, así los cuerpos se pisan como en una pista llena y no quedan escalones
float silueta(vec2 fc, float escala, float base, float var, float par, float salto){
  float x=fc.x/RENDERSIZE.y*escala+par;
  float c0=floor(x), techo=0.0;
  for(int j=-1;j<=1;j++){
    float c=c0+float(j);
    float f=x-c-0.5-(h1(c*2.3)-0.5)*0.4;
    float alto=base+var*h1(c*1.31)+salto*h1(c*4.7);
    float hombros=alto-0.014-0.34*f*f;   // los hombros caen a los brazos
    float r2=0.016+0.01*h1(c*5.9);
    float cabeza=alto+0.03*sqrt(max(0.0,1.0-f*f/r2));
    techo=max(techo,max(hombros,cabeza));
  }
  float y=fc.y/RENDERSIZE.y;
  return smoothstep(techo+0.004,techo-0.004,y);
}

void main(){
  vec2 R=RENDERSIZE.xy;
  float pulso=TIME*bpm/60.0;
  float bombo=max(bpm>0.5 ? exp(-fract(pulso)*5.0) : 0.0, golpe);
  float mapeo=smoothstep(0.35,1.0,fase)*(1.0-0.6*smoothstep(1.4,2.0,fase));
  float drop=smoothstep(1.2,2.0,fase);
  float brillo=0.7+bombo*(0.35+0.35*fase);

  // los cubos: una fila en arco por encima de la pista
  float compas=smoothstep(0.0,0.16,fract(pulso*0.25));
  for(int k=0;k<NC;k++){
    float i=float(k);
    cc[k]=vec3((i-3.0)*2.75+sin(i*2.3)*0.35, 1.45+0.45*sin(i*1.7+0.5)+0.06*sin(TIME*0.6+i*1.3), 9.0+1.8*cos(i*1.31));
    // cuarto de giro por compás en el drop: el cubo es simétrico, así que volver a 0 no se nota
    float a=i*0.9+TIME*0.07*(h1(i)>0.5?1.0:-1.0)+drop*1.5707963*compas;
    cg[k]=vec2(cos(a),sin(a));
    cs[k]=0.62+0.2*h1(i+3.0);
  }

  // cámara: recorre la fila con el scroll y en el drop se mete debajo de los cubos
  vec3 ro=vec3(mix(-3.2,3.2,recorrido)+0.25*sin(TIME*0.13), -0.9+0.35*drop, 1.4*smoothstep(0.8,2.0,fase));
  vec3 ta=vec3(ro.x*0.7, 1.0, 9.5);
  vec3 fw=normalize(ta-ro), rt=normalize(cross(vec3(0.0,1.0,0.0),fw)), up=cross(fw,rt);
  float esc=R.x<R.y ? R.x*1.35 : R.y;   // en vertical se abre el campo
  vec2 uv=(gl_FragCoord.xy-0.5*R)/esc;
  vec3 rd=normalize(fw*1.55+uv.x*rt+uv.y*up);

  // cabezales: cuatro en el rig de atrás que barren hacia la pista
  for(int k=0;k<NH;k++){
    float i=float(k);
    float t=TIME*(0.32+0.07*i)+i*1.7;
    ho[k]=vec3((i-1.5)*4.2, 4.4, 10.5);
    hd[k]=normalize(vec3(0.75*sin(t)+drop*0.25*sin(pulso*1.5707963+i), -1.0, -0.55+0.35*sin(t*0.8+i*2.1)));
  }
  // seguidor: apunta adonde marca el foco
  vec2 uf=(vec2(focoX,focoY)*R-0.5*R)/esc;
  vec3 fo=vec3(ro.x, 4.8, 3.0);
  vec3 fd=normalize(ro+normalize(fw*1.55+uf.x*rt+uf.y*up)*7.0-fo);
  float ampHaz=5.0+1.5*fase+bombo*2.5*drop;

  vec3 col=vec3(0.0);
  float T=1.0;
  float t=0.3+0.45*h2(gl_FragCoord.xy+fract(TIME)*17.0);
  float cual=-1.0; bool toca=false;
  for(int i=0;i<80;i++){
    vec3 p=ro+rd*t;
    float id; float d=escena(p,id);
    if(d<0.003*t){ toca=true; cual=id; break; }
    float dt=min(max(d*0.9,0.004),0.55);
    float de=humo(p);
    vec3 L=vec3(0.0);
    for(int k=0;k<NH;k++) L+=colorHaz.rgb*haz(p,ho[k],hd[k],0.04);
    L*=ampHaz;
    L+=vec3(1.0,0.9,0.85)*haz(p,fo,fd,0.03)*4.0;
    L+=colorCubo.rgb*exp(-max(d,0.0)*3.0)*0.85*brillo;   // los cubos prenden el humo que los rodea
    col+=T*de*L*dt;
    T*=exp(-de*dt*0.9);
    t+=dt;
    if(t>34.0||T<0.03) break;
  }

  if(toca){
    vec3 p=ro+rd*t;
    vec3 q=vec3(0.0); float s=1.0;
    for(int k=0;k<NC;k++){
      if(float(k)==cual){
        q=p-cc[k];
        q.xz=vec2(cg[k].x*q.x-cg[k].y*q.z, cg[k].y*q.x+cg[k].x*q.z);
        s=cs[k];
      }
    }
    vec3 a=abs(q)/vec3(s,s*0.82,s);
    vec2 cara, medio;
    if(a.x>a.y&&a.x>a.z){ cara=q.zy; medio=vec2(s,s*0.82); }
    else if(a.y>a.z){ cara=q.xz; medio=vec2(s,s); }
    else { cara=q.xy; medio=vec2(s,s*0.82); }
    // contenido: cada cubo el suyo (sala) o una sola imagen cortada a la forma de todos (mapping)
    vec2 cu=mix(cara/s*0.9+vec2(cual*3.7,cual*1.9), p.xy*0.42+vec2(0.0,p.z*0.1), mapeo);
    float n=fbm(cu*1.4+vec2(TIME*0.11,-TIME*0.07));
    float vena=pow(1.0-abs(2.0*fbm(cu*2.1+n*1.5-vec2(0.0,TIME*0.09))-1.0),12.0);
    vec3 em=colorCubo.rgb*(0.12+0.6*n*n)+vec3(1.0,0.86,0.9)*vena*1.8;
    float bx=mod(TIME*3.2,26.0)-13.0;
    em+=vec3(1.0,0.95,0.97)*exp(-pow((p.x-bx)*1.6,2.0))*0.9*mapeo;
    // drop: franjas que bajan a tempo (en la altura del cubo, que no cambia con el giro)
    float franja=step(0.5,fract(q.y*3.0/s-pulso*0.5));
    em=mix(em, colorCubo.rgb*(0.2+1.5*franja)+vec3(1.0)*franja*bombo*0.5, drop*0.75);
    vec2 bd=medio-abs(cara);
    em*=mix(0.08,1.0,smoothstep(0.0,0.05,min(bd.x,bd.y)));   // el borde del gabinete
    col+=T*em*brillo;
  }

  // el público al pie, en contraluz (dos filas con paralaje; saltan apenas con el golpe)
  float pub=publico*(1.0-0.35*drop);
  float lejos=silueta(gl_FragCoord.xy, 13.0, 0.16, 0.03, ro.x*0.18, 0.006*bombo);
  float cerca=silueta(gl_FragCoord.xy, 7.0, 0.08, 0.045, ro.x*0.32+0.5, 0.012*bombo);
  col=mix(col, col*0.3, lejos*pub);
  col=mix(col, col*0.03, cerca*pub);

  col=1.0-exp(-col*1.7);
  col=pow(col, vec3(0.85));
  vec2 v=gl_FragCoord.xy/R-0.5;
  col*=1.0-0.45*dot(v,v);
  float cx=abs(gl_FragCoord.x/R.x-0.5);
  col*=mix(1.0-velo*0.85, 1.0, smoothstep(columna*0.92, columna+0.05, cx));
  col+=(h2(gl_FragCoord.xy+fract(TIME*7.0)*91.0)-0.5)/128.0;
  gl_FragColor=vec4(col,1.0);
}
`;

const fs=()=>'/*'+JSON.stringify(ISF,null,2)+'*/\n\n'+CUERPO;
function bajar(e){
  e.preventDefault();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([fs()],{type:'text/plain'}));
  a.download='cubos-feca.fs';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
// el .fs se baja aunque el navegador no tenga WebGL
document.querySelectorAll('[data-fs]').forEach(b=>b.addEventListener('click',bajar));

const cv=document.createElement('canvas');cv.id='cubos';cv.setAttribute('aria-hidden','true');
document.body.prepend(cv);
const gl=cv.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
if(!gl){cv.remove();return;}

const nombres=ISF.INPUTS.map(i=>i.NAME);
const PRE='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'+
  'uniform float TIME;\nuniform vec2 RENDERSIZE;\n'+
  ISF.INPUTS.map(i=>'uniform '+(i.TYPE==='color'?'vec4':'float')+' '+i.NAME+';').join('\n')+'\n';
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
let P;
try{
  P=gl.createProgram();
  gl.attachShader(P,sh(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}'));
  gl.attachShader(P,sh(gl.FRAGMENT_SHADER,PRE+CUERPO));
  gl.linkProgram(P);
  if(!gl.getProgramParameter(P,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(P));
}catch(err){console.warn('CUBOS:',err.message);cv.remove();return;}
gl.useProgram(P);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const la=gl.getAttribLocation(P,'a');gl.enableVertexAttribArray(la);gl.vertexAttribPointer(la,2,gl.FLOAT,false,0,0);
const U={};['TIME','RENDERSIZE',...nombres].forEach(n=>U[n]=gl.getUniformLocation(P,n));
gl.uniform4f(U.colorCubo,1,0.12,0.24,1);
gl.uniform4f(U.colorHaz,0.18,0.42,1,1);
gl.uniform1f(U.bpm,126);

const quieto=matchMedia('(prefers-reduced-motion: reduce)');
const MOVIL=matchMedia('(pointer:coarse)').matches||innerWidth<760;
let escala=MOVIL?0.42:0.55;
function medir(){
  const w=Math.max(1,Math.round(innerWidth*escala)),h=Math.max(1,Math.round(innerHeight*escala));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}
  gl.viewport(0,0,w,h);
}

// lo que pide la página: la sección que cruza el centro de la pantalla manda
const secs=[...document.querySelectorAll('[data-fase]')];
const S={fase:0,velo:0,rec:0,fx:0.5,fy:0.6,golpe:0},O={fase:0,velo:0,rec:0,fx:0.5,fy:0.6};
function objetivo(){
  const mid=innerHeight*0.5;let s=null,dist=1e9;
  for(const el of secs){const r=el.getBoundingClientRect();
    const d=r.top>mid?r.top-mid:(r.bottom<mid?mid-r.bottom:0);if(d<dist){dist=d;s=el;}}
  if(s){O.fase=parseFloat(s.dataset.fase)||0;O.velo=parseFloat(s.dataset.velo)||0;}
  const alto=document.documentElement.scrollHeight-innerHeight;
  O.rec=alto>0?Math.min(1,Math.max(0,scrollY/alto)):0;
}
let ultimoMouse=-1e9;
addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;
  O.fx=e.clientX/innerWidth;O.fy=1-e.clientY/innerHeight;ultimoMouse=performance.now();},{passive:true});
addEventListener('pointerdown',e=>{
  if(e.target.closest&&e.target.closest('a,button,video,input,label,iframe,.yt-embed,.media,figure'))return;
  S.golpe=1;},{passive:true});
addEventListener('scroll',()=>{objetivo();if(quieto.matches)pedir();},{passive:true});
addEventListener('resize',()=>{medir();objetivo();pedir();});

function subir(t){
  gl.uniform1f(U.TIME,t);gl.uniform2f(U.RENDERSIZE,cv.width,cv.height);
  gl.uniform1f(U.fase,S.fase);gl.uniform1f(U.velo,S.velo);gl.uniform1f(U.recorrido,S.rec);
  gl.uniform1f(U.focoX,S.fx);gl.uniform1f(U.focoY,S.fy);gl.uniform1f(U.golpe,S.golpe);
  gl.uniform1f(U.publico,1-Math.min(1,Math.max(0,(S.fase-0.1)/0.6)));
  const col=Math.min(1040,innerWidth)/2/innerWidth;
  gl.uniform1f(U.columna,col);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

const btn=document.createElement('button');btn.id='cubos-btn';btn.type='button';document.body.append(btn);
let on=true;try{on=localStorage.getItem('feca-cubos')!=='0';}catch(_){}
function pintarBtn(){btn.textContent=on?'CUBOS ●':'CUBOS ○';btn.setAttribute('aria-pressed',String(on));
  btn.setAttribute('aria-label',on?'Apagar el fondo de cubos':'Prender el fondo de cubos');cv.style.display=on?'':'none';}
btn.addEventListener('click',()=>{on=!on;try{localStorage.setItem('feca-cubos',on?'1':'0');}catch(_){}pintarBtn();pedir();});

const t0=performance.now();let raf=0,prev=t0,lento=0;
function cuadro(now){
  raf=0;if(!on||document.hidden)return;
  const dt=Math.min(0.1,(now-prev)/1000);prev=now;
  if(quieto.matches){Object.assign(S,O,{golpe:0});subir(8);return;}
  if(now-ultimoMouse>4000){const w=(now-t0)/1000;O.fx=0.5+0.3*Math.sin(w*0.3);O.fy=0.6+0.15*Math.sin(w*0.23);}
  const k=1-Math.exp(-dt*1.8),km=1-Math.exp(-dt*4);
  S.fase+=(O.fase-S.fase)*k;S.velo+=(O.velo-S.velo)*k;S.rec+=(O.rec-S.rec)*k;
  S.fx+=(O.fx-S.fx)*km;S.fy+=(O.fy-S.fy)*km;S.golpe*=Math.exp(-dt*3.5);
  subir((now-t0)/1000);
  // si el equipo no llega a ~40 cuadros por segundo, bajar la resolución (hasta un piso)
  lento=dt>0.026?lento+dt:Math.max(0,lento-dt*0.5);
  if(lento>1.5&&escala*0.82>=0.3){escala*=0.82;lento=0;medir();}
  pedir();
}
function pedir(){if(!raf&&on&&!document.hidden)raf=requestAnimationFrame(cuadro);}
document.addEventListener('visibilitychange',()=>{prev=performance.now();pedir();});
quieto.addEventListener&&quieto.addEventListener('change',pedir);
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);cv.remove();btn.remove();});

medir();objetivo();Object.assign(S,O);pintarBtn();pedir();
})();
