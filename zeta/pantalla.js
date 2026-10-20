/* PANTALLA — una pared LED de escenario detrás de la página de Zeta.
   Pasada 1: el campo, a una textura del tamaño de la grilla de LEDs (una celda = un texel):
   plasma con domain warp + curvas de nivel que corren, foco y onda del puntero, onda del clic
   y, cada tanto, «ZETA» mapeado en la pared.
   Pasada 2: cada píxel dibuja su LED; en las franjas de glitch la fila se corre y los canales
   RGB se separan (más glitch cuanto más rápido se scrollea).
   Va DETRÁS del contenido: el video del hero la tapa, y en la columna de lectura se atenúa.
   Movimiento reducido = pared quieta. El botón «LED» la apaga y lo recuerda. */
(()=>{'use strict';
const cv=document.createElement('canvas');cv.id='pantalla';cv.setAttribute('aria-hidden','true');
document.body.prepend(cv);
const gl=cv.getContext('webgl2',{alpha:false,antialias:false,depth:false});
if(!gl){cv.remove();return;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const btn=document.createElement('button');btn.id='pantalla-btn';btn.type='button';document.body.append(btn);

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
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*snoise(p);p*=2.03;a*=.5;}return s;}`;

const QUAD_VS=`#version 300 es
layout(location=0) in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

// ── pasada 1: el contenido de la pared, una celda por texel ──
const FIELD_FS=`#version 300 es
precision highp float;
uniform vec2 uGrid;uniform float uTime,uScroll,uEnergy,uShow;
uniform vec3 uMouse;            // xy en celdas, z = presencia del puntero
uniform vec4 uShock;            // xy en celdas, z = edad en s, w = fuerza
uniform sampler2D uText;
out vec4 o;
${NOISE}
void main(){
 vec2 c=gl_FragCoord.xy;
 vec2 uv=c/uGrid.y;
 float t=uTime;
 vec2 sc=uv-vec2(0.,uScroll);                       // sube con la página, más lento
 vec2 q=vec2(fbm(vec3(sc*1.25,t*.045)),fbm(vec3(sc*1.25+vec2(5.2,1.3),t*.045)));
 float n=fbm(vec3(sc*1.7+q*1.9,t*.075));
 float base=smoothstep(-.3,.8,n);
 // curvas de nivel que corren, como un loop de VJ
 float iso=1.-smoothstep(.0,.075,abs(fract(n*4.6-t*(.11+uEnergy*.25))-.5));
 float v=base*.42+iso*.9*smoothstep(-.45,.35,n);
 // el puntero: foco y onda
 float dd=length(c-uMouse.xy);
 v+=uMouse.z*(exp(-dd*dd/110.)*.85+.32*sin(dd*.62-t*7.)*exp(-dd*.085));
 // la onda del clic
 float ds=length(c-uShock.xy),r=uShock.z*42.;
 if(uShock.w>0.&&uShock.z<4.)v+=uShock.w*exp(-(ds-r)*(ds-r)/7.)*exp(-uShock.z*1.3);   // sin esto, 0×inf = NaN
 // ZETA mapeado en la pared
 vec2 tu=c/uGrid;
 float m=texture(uText,vec2(tu.x,1.-tu.y)).r;
 float sh=uShow*clamp(.7+.5*snoise(vec3(c*.13,t*2.2)),0.,1.);
 v=mix(v,max(v,m*.88),sh);
 o=vec4(clamp(v,0.,1.),0.,0.,1.);
}`;

// ── pasada 2: cada LED ──
const LED_FS=`#version 300 es
precision highp float;
uniform sampler2D uField;uniform vec2 uGrid;
uniform float uCell,uTime,uGlitch,uLane,uW,uDim;
out vec4 o;
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float led(vec2 cell){return texelFetch(uField,ivec2(mod(cell,uGrid)),0).r;}
float punto(float v,float r,float aa){float rad=mix(.07,.43,v);return smoothstep(rad+aa,rad-aa,r);}
vec3 pal(float v,float g){
 vec3 c=mix(vec3(.72,1.,0.),vec3(1.,.98,.9),smoothstep(.74,1.,v));   // ácido → blanco caliente
 return mix(c,vec3(1.,.18,.33),g);                                      // glitch
}
void main(){
 vec2 p=gl_FragCoord.xy;
 vec2 cf=p/uCell,cell=floor(cf);float r=length(fract(cf)-.5),aa=1.3/uCell;
 // franjas de glitch: filas que se corren y separan RGB
 float band=floor(cell.y/5.),tick=floor(uTime*9.);
 float g=step(1.-(.012+uGlitch*.24),hash(band*17.3+tick*1.7));
 float sh=g*floor((hash(band+tick*3.1)-.5)*18.),sp=g*2.;
 float vR=led(cell+vec2(sh+sp,0.)),vG=led(cell+vec2(sh,0.)),vB=led(cell+vec2(sh-sp,0.));
 vec3 col=vec3(pal(vR,g).r*punto(vR,r,aa)*pow(vR,.7),pal(vG,g).g*punto(vG,r,aa)*pow(vG,.7),pal(vB,g).b*punto(vB,r,aa)*pow(vB,.7));
 col+=vec3(.94,.93,.9)*.04*smoothstep(.15,.11,r);                    // el LED apagado
 col*=mix(uDim,1.,smoothstep(uLane,uLane+150.,abs(p.x-uW*.5)));        // columna de lectura
 o=vec4(vec3(5./255.)+col,1.);
}`;

function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
 if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
function prog(v,f){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));
 gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
let fieldP,ledP;
try{fieldP=prog(QUAD_VS,FIELD_FS);ledP=prog(QUAD_VS,LED_FS);}
catch(e){console.warn('PANTALLA no disponible',e);cv.remove();btn.remove();return;}
const U=(p,ks)=>Object.fromEntries(ks.map(k=>[k,gl.getUniformLocation(p,k)]));
const fu=U(fieldP,['uGrid','uTime','uScroll','uEnergy','uShow','uMouse','uShock','uText']);
const lu=U(ledP,['uField','uGrid','uCell','uTime','uGlitch','uLane','uW','uDim']);

const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);

function tex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
const fieldT=tex(),textT=tex(),fbo=gl.createFramebuffer();
const tc=document.createElement('canvas'),tx=tc.getContext('2d');

let W=1,H=1,dpr=1,S=11,cols=1,rows=1,raf=0,last=0,time=0,energy=0,lastY=scrollY,fuente=false;
let ptr=[-99,-99],sptr=[-99,-99],pres=0,ultMov=-9,shock=[-99,-99,-99,0];
let on=true;try{if(localStorage.getItem('zeta-led')==='0')on=false}catch(e){}

function textoZeta(){
 tc.width=cols;tc.height=rows;tx.fillStyle='#000';tx.fillRect(0,0,cols,rows);
 tx.font='100px "Bebas Neue", sans-serif';const w100=tx.measureText('ZETA').width||200;
 const fs=Math.min(rows*.78,cols*.86*100/w100);
 tx.font=fs+'px "Bebas Neue", sans-serif';tx.fillStyle='#fff';tx.textAlign='center';tx.textBaseline='middle';
 tx.fillText('ZETA',cols/2,rows/2+fs*.04);
 gl.bindTexture(gl.TEXTURE_2D,textT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tc);
}
function resize(){
 W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);S=W<760?9:11;
 cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
 cols=Math.ceil(W/S)+1;rows=Math.ceil(H/S)+1;
 gl.bindTexture(gl.TEXTURE_2D,fieldT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,fieldT,0);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 textoZeta();
 if(!raf)frame(0);
}
// «ZETA» aparece cada 13 s durante ~4,5 s (la primera a los 2,5 s)
function show(t){const k=(t-2.5)%13;if(t<2.5||k>4.6)return 0;
 const s=x=>x*x*(3-2*x);return Math.min(s(Math.min(1,k/.7)),s(Math.min(1,(4.6-k)/.9)));}

function frame(dt){
 time+=dt;energy*=Math.exp(-dt*2.2);
 pres+=((time-ultMov<1.6?1:0)-pres)*Math.min(1,dt*4);
 sptr[0]+=(ptr[0]-sptr[0])*Math.min(1,dt*8);sptr[1]+=(ptr[1]-sptr[1])*Math.min(1,dt*8);
 gl.bindVertexArray(vao);
 // pasada 1
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,cols,rows);gl.useProgram(fieldP);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textT);gl.uniform1i(fu.uText,0);
 gl.uniform2f(fu.uGrid,cols,rows);gl.uniform1f(fu.uTime,time);gl.uniform1f(fu.uEnergy,Math.min(1,energy));
 gl.uniform1f(fu.uScroll,scrollY/S/rows*.35);gl.uniform1f(fu.uShow,show(time));
 gl.uniform3f(fu.uMouse,sptr[0],sptr[1],pres);gl.uniform4f(fu.uShock,shock[0],shock[1],time-shock[2],shock[3]);
 gl.drawArrays(gl.TRIANGLES,0,3);
 // pasada 2
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);gl.useProgram(ledP);
 gl.bindTexture(gl.TEXTURE_2D,fieldT);gl.uniform1i(lu.uField,0);
 gl.uniform2f(lu.uGrid,cols,rows);gl.uniform1f(lu.uCell,S*dpr);gl.uniform1f(lu.uTime,time);
 gl.uniform1f(lu.uGlitch,Math.min(1,energy));gl.uniform1f(lu.uW,cv.width);
 gl.uniform1f(lu.uLane,Math.min(W*.5,540)*dpr);gl.uniform1f(lu.uDim,W<760?.4:.34);
 gl.drawArrays(gl.TRIANGLES,0,3);
}
function loop(now){
 raf=0;if(!on||document.hidden||reduced.matches)return;
 const dt=Math.min((now-last)/1000||.016,.05);last=now;frame(dt);raf=requestAnimationFrame(loop);
}
function sync(){
 cancelAnimationFrame(raf);raf=0;
 cv.style.visibility=on?'visible':'hidden';
 btn.textContent=on?'LED · ON':'LED · OFF';btn.setAttribute('aria-pressed',String(on));
 btn.title=on?'Apagar la pantalla LED de fondo':'Prender la pantalla LED de fondo';
 if(!on)return;
 if(reduced.matches){time=time||20;frame(0);return}                  // pared quieta
 if(!document.hidden){last=performance.now();raf=requestAnimationFrame(loop)}
}
btn.addEventListener('click',()=>{on=!on;try{localStorage.setItem('zeta-led',on?'1':'0')}catch(e){}sync()});
reduced.addEventListener('change',sync);
document.addEventListener('visibilitychange',sync);
addEventListener('resize',resize,{passive:true});
addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;ptr=[e.clientX/S,(H-e.clientY)/S];ultMov=time},{passive:true});
addEventListener('scroll',()=>{energy=Math.min(2,energy+Math.abs(scrollY-lastY)*.0028);lastY=scrollY},{passive:true});
// clic en el vacío (no en links, botones ni videos): onda expansiva
addEventListener('pointerdown',e=>{
 const el=e.target instanceof Element?e.target:null;
 if(!on||e.button!==0||(el&&el.closest('a,button,video,iframe,input,textarea,.yt-embed')))return;
 shock=[e.clientX/S,(H-e.clientY)/S,time,1];
});
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();on=false;sync();btn.hidden=true});
// cuando llega Bebas Neue, rehacer «ZETA» con la tipografía de la página
document.fonts&&document.fonts.load('100px "Bebas Neue"').then(()=>{if(!fuente){fuente=true;textoZeta()}}).catch(()=>{});
resize();sync();
})();
