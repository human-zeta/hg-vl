/* HUMAN GLITCHE · VISUAL LAB — la puerta
   El mundo: un escenario procedural, plantado adentro del núcleo.
   Sin scroll y sin dependencias externas. */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================ the shader ============================== */
  var VERT =
    'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';

  var FRAG = [
'precision highp float;',
'uniform vec2  u_res;',
'uniform float u_time;',
'uniform float u_p;',
'uniform vec3  u_peel;',
'uniform float u_reduce;',

/* La rampa UMBRAL: fuego violeta que pasa por celeste y muere en verde agua.
   ACID_C queda solo como color de interfaz (el peel/wireframe). */
'const vec3 VOID_C    = vec3(0.010,0.012,0.045);',
'const vec3 VIOLET_C  = vec3(0.478,0.184,1.000);',
'const vec3 CELESTE_C = vec3(0.247,0.831,1.000);',
'const vec3 AGUA_C    = vec3(0.184,1.000,0.753);',
'const vec3 ACID_C    = vec3(0.722,1.000,0.000);',
'const vec3 WHITE_C   = vec3(0.941,0.929,0.902);',

'vec3 hgRamp(float t){t=clamp(t,0.0,1.0);',
' if(t<0.50) return mix(VOID_C,VIOLET_C,smoothstep(0.0,0.50,t));',
' if(t<0.80) return mix(VIOLET_C,CELESTE_C,smoothstep(0.50,0.80,t));',
' if(t<0.94) return mix(CELESTE_C,AGUA_C,smoothstep(0.80,0.94,t));',
' return mix(AGUA_C,WHITE_C,smoothstep(0.94,1.0,t));}',

'float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
' float a=hash21(i),b=hash21(i+vec2(1.0,0.0)),c=hash21(i+vec2(0.0,1.0)),d=hash21(i+vec2(1.0,1.0));',
' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+vec2(17.3,9.1);a*=0.5;}return v;}',

'float plasma(vec2 p,float t){',
' vec2 q=vec2(fbm(p+vec2(0.0,t*0.06)),fbm(p+vec2(5.2,1.3)));',
' vec2 r=vec2(fbm(p+3.4*q+vec2(1.7,9.2)+t*0.04),fbm(p+3.4*q+vec2(8.3,2.8)));',
' return fbm(p+3.0*r);}',

'vec3 stars(vec2 uv,float depth){vec3 acc=vec3(0.0);',
' for(int k=0;k<3;k++){float fk=float(k);float scale=90.0+fk*130.0;',
'  vec2 sp=uv*scale+vec2(0.0,depth*(52.0+fk*120.0));',
'  vec2 gi=floor(sp);vec2 gf=fract(sp)-0.5;float h=hash21(gi+fk*37.0);',
'  if(h>0.974){float d=length(gf);',
'   float tw=0.65+0.35*sin(u_time*(1.2+h*3.0)+h*30.0)*(1.0-u_reduce);',
'   float s=smoothstep(0.055,0.0,d)*tw;',
'   acc+=s*mix(vec3(0.9),hgRamp(0.55+0.4*h),0.4)*(0.95-fk*0.22)*(0.5+0.9*(1.0-u_p));}}',
' return acc*(1.0-smoothstep(0.55,0.95,u_p));}',

'float peelMask(vec2 frag){if(u_peel.z<=0.001)return 0.0;',
' float d=length(frag-u_peel.xy);',
' float radius=(110.0+260.0*u_p)*u_peel.z;',
' return smoothstep(radius,radius*0.35,d);}',

/* Lo que hay debajo del render lo escribe assets/flujo.js — si no cargó,
   el peel simplemente no revela nada en vez de romper el shader. */
(window.FLUJO_GLSL ||
 'vec3 flujo(vec2 frag,vec2 res,float t,vec2 ctr,float p){return vec3(0.0);}'),

'void main(){',
' vec2 frag=gl_FragCoord.xy;',
' vec2 uv=(frag-0.5*u_res)/min(u_res.x,u_res.y);',
' float t = u_reduce>0.5 ? 0.0 : u_time;',
' float r=length(uv); float ang=atan(uv.y,uv.x);',
' float sunR=mix(0.020,1.55,pow(u_p,1.45));',
' vec3 col=VOID_C*(0.35+0.65*(1.0-u_p));',
' col+=stars(uv,u_p);',
' float fil=plasma(vec2(ang*2.4+u_p*1.7,r*3.2-t*0.10-u_p*2.2),t);',
' float coronaFall=exp(-max(r-sunR,0.0)*mix(9.0,2.2,u_p));',
' float corona=coronaFall*(0.35+0.65*fil);',
' float edge=smoothstep(sunR,sunR*0.965,r);',
' float surf=plasma(uv*mix(5.0,1.6,u_p)+vec2(0.0,-t*0.05),t);',
/* Dispersión cromática de UMBRAL: la película delgada se muestrea con
   desfase por canal RGB, así la corona astilla el violeta en flecos
   celestes y verde agua — el mismo truco del holograma Z. */
' float film=fract(ang*0.5/3.14159+r*1.6-t*0.045+u_p*0.5);',
' vec3 thin=0.5+0.5*sin((vec3(film)+vec3(0.0,0.055,0.11))*6.28318*2.0);',
/* Exposición: el sol arde bajo, en brasa. La materia de UMBRAL se compone
   por screen encima, y sobre un sol a plena potencia las partículas se
   lavaban — el vacío tiene que dominar para que la materia se lea. */
' float heat=clamp(surf*0.62+0.26+u_p*0.30,0.0,1.0);',
' vec3 body=hgRamp(heat)*(0.40+0.40*surf);',
' vec3 coronaC=mix(VIOLET_C,mix(CELESTE_C,AGUA_C,0.35),thin)*(0.44+0.46*u_p);',
' col+=coronaC*corona*mix(0.62,1.30,u_p);',
' col=mix(col,body,edge);',
' float rim=smoothstep(sunR*1.02,sunR*0.985,r)-smoothstep(sunR*0.985,sunR*0.86,r);',
' col+=WHITE_C*max(rim,0.0)*(0.30+0.55*u_p);',
' float inside=smoothstep(0.80,1.0,u_p);',
' vec3 core=hgRamp(clamp(0.34+surf*0.42,0.0,1.0));',
' col=mix(col,core*(0.34+0.34*surf),inside*0.85);',
' col*=mix(1.0,0.20,smoothstep(0.80,0.97,u_p));',
' col=col/(1.0+col*0.95);',
' col=pow(max(col,0.0),vec3(1.10));',
' float grain=(hash21(frag+fract(t)*91.7)-0.5)*0.045;',
' col+=grain;',
' col*=1.0-0.46*smoothstep(0.35,1.15,r)*(1.0-u_p*0.5);',
' float pm=peelMask(frag);',
' if(pm>0.001){ col=mix(col,VOID_C*0.35+flujo(frag,u_res,t,u_peel.xy,u_p),pm); }',
' gl_FragColor=vec4(max(col,0.0),1.0);}'
  ].join('\n');

  /* ============================ gl bootstrap ============================ */
  var canvas = document.getElementById('stage');
  /* preserveDrawingBuffer: matter.js copia este canvas para componerlo con
     las partículas. Sin esto el buffer queda indefinido después de componer. */
  var glOpts = { antialias: false, alpha: false, preserveDrawingBuffer: true,
                 powerPreference: 'high-performance' };
  var gl = canvas.getContext('webgl', glOpts)
        || canvas.getContext('experimental-webgl', glOpts);

  var U = {}, running = false;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader:', gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }

  function initGL() {
    if (!gl) return false;
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('link:', gl.getProgramInfoLog(prog)); return false;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    ['u_res','u_time','u_p','u_peel','u_reduce'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1f(U.u_reduce, reduce ? 1 : 0);
    return true;
  }

  /* The shader is the page's only heavy thing, so it is sized deliberately:
     a hard cap on DPR keeps a 5K display from asking for 4x the fragments a
     1080p one does, for a field that is mostly soft gradient. */
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.u_res, w, h);
    }
    return dpr;
  }

  var state = { p: 0, peelX: -9999, peelY: -9999, peelZ: 0, dpr: 1 };

  function frame(ms) {
    if (!running) return;
    gl.uniform1f(U.u_time, ms * 0.001);
    gl.uniform1f(U.u_p, state.p);
    gl.uniform3f(U.u_peel, state.peelX * state.dpr,
                 (innerHeight - state.peelY) * state.dpr, state.peelZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  function drawOnce() {
    gl.uniform1f(U.u_time, 0);
    gl.uniform1f(U.u_p, state.p);
    gl.uniform3f(U.u_peel, state.peelX * state.dpr,
                 (innerHeight - state.peelY) * state.dpr, state.peelZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  var glOK = initGL();
  if (glOK) {
    state.dpr = resize();
    addEventListener('resize', function () { state.dpr = resize(); if (reduce) drawOnce(); });
    if (reduce) { drawOnce(); } else { running = true; requestAnimationFrame(frame); }
  } else {
    // No WebGL: the page is still the journey, just painted in CSS.
    canvas.style.background =
      'radial-gradient(circle at 50% 55%, #7d7bff 0%, #2a1660 28%, #0a0722 62%, #050505 100%)';
  }

  /* ====================== the peel · signature move ===================== */
  /* "La realidad es una interfaz — quien la ve, la rediseña." The pointer
     peels the render back to the wireframe underneath. It opens wider the
     deeper you are, and at the core it stops closing behind you. */
  if (!reduce && glOK) {
    var targetZ = 0;
    function pointTo(x, y) { state.peelX = x; state.peelY = y; targetZ = 1; }
    addEventListener('pointermove', function (e) { pointTo(e.clientX, e.clientY); },
                     { passive: true });
    addEventListener('pointerdown', function (e) { pointTo(e.clientX, e.clientY); targetZ = 1.6; },
                     { passive: true });
    addEventListener('pointerleave', function () { targetZ = 0; });
    (function ease() {
      // At the core the peel persists: floor rises with depth.
      var floorZ = state.p > 0.82 ? (state.p - 0.82) * 3.2 : 0;
      state.peelZ += ((Math.max(targetZ, floorZ)) - state.peelZ) * 0.08;
      requestAnimationFrame(ease);
    })();
  }


  /* ====================== profundidad sin scroll ======================== */
  /* Antes u_p lo movía el scroll: era el viaje. Ahora no hay viaje, hay una
     puerta — así que la página se planta adentro del núcleo y se queda ahí.
     A esa profundidad el sol ya está atenuado y el peel tiene piso propio
     (ver el ease de arriba): el flujo queda abierto sin que toques nada.
     Un intro corto para que el mundo llegue, y después respira. */
  var P_CORE = 0.955, tStart = performance.now();
  (function depth() {
    var t = (performance.now() - tStart) / 1000;
    var intro = Math.min(1, t / 3.4);
    intro = intro * intro * (3 - 2 * intro);            // smoothstep
    var breath = reduce ? 0 : Math.sin(t * 0.11) * 0.018;
    state.p = (0.62 + (P_CORE - 0.62) * intro) + breath;
    if (reduce) { if (glOK) drawOnce(); return; }       // un cuadro y listo
    requestAnimationFrame(depth);
  })();

  /* El hint se apaga apenas movés: ya entendiste que la interfaz responde. */
  var hint = document.getElementById('hint');
  if (hint) {
    addEventListener('pointermove', function off() {
      hint.style.opacity = 0;
      removeEventListener('pointermove', off);
    }, { passive: true, once: false });
  }
})();
